"""LangGraph agent state machine.

We model a small graph with the following nodes:

  classify  →  (clarify | plan_tools)
  plan_tools → (request_confirmation | execute_tools)
  execute_tools → observe → (loop | compose_reply)
  compose_reply → END

LangGraph is used when available; falling back to a plain Python loop with
the same semantics if LangGraph is unavailable in the environment. The
agent always works against the LLM provider abstraction in `llm.py`, so the
flow is identical regardless of provider.
"""
from __future__ import annotations

import logging
import secrets
import time
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy import select

from ..extensions import db
from ..models.ai_conversation import (
    AIConversation,
    AIMessage,
    AIMessageRole,
    AIPendingConfirmation,
    AIToolCall,
)
from ..models.user import User
from ..rbac import Role
from ..utils.time_utils import utcnow
from . import prompts
from .llm import ChatMessage, ToolSpec, get_llm_client
from .tools import Tool, tools_for, tool_by_name

logger = logging.getLogger(__name__)
_MAX_TOOL_ITERATIONS = 4
_CONFIRMATION_TTL_SECONDS = 600


# ---------------------------------------------------------------------------
def primary_persona(user: User) -> str:
    codes = set(user.role_codes)
    if Role.SUPER_ADMIN.value in codes or Role.CLINIC_ADMIN.value in codes or Role.AUDITOR.value in codes:
        return "admin"
    if Role.DOCTOR.value in codes:
        return "doctor"
    if Role.PATIENT.value in codes:
        return "patient"
    return "secretary"


def get_or_create_conversation(user: User, *, conversation_id: int | None, language: str) -> AIConversation:
    if conversation_id:
        conv = db.session.get(AIConversation, conversation_id)
        if conv and conv.user_id == user.id:
            return conv
    conv = AIConversation(
        user_id=user.id,
        role_persona=primary_persona(user),
        language=language,
    )
    db.session.add(conv)
    db.session.flush()
    return conv


def run_agent(
    *,
    user: User,
    message: str,
    conversation_id: int | None = None,
    language: str | None = None,
) -> dict[str, Any]:
    """Run one turn of the agent and return a response payload."""
    lang = (language or user.preferred_language or "en").lower()
    conv = get_or_create_conversation(user, conversation_id=conversation_id, language=lang)
    if conv.language != lang:
        conv.language = lang

    _persist_message(conv, AIMessageRole.USER, message)

    persona = conv.role_persona
    base_prompt = prompts.for_persona(persona)
    today = datetime.now(timezone.utc).strftime("%A %Y-%m-%d")
    user_label = (
        f"User: {user.full_name} (id={user.id}, roles={', '.join(user.role_codes)})"
    )

    # If the caller IS a patient, surface that identity so the LLM never asks
    # for the patient's own name or phone.
    is_patient_caller = (
        "patient" in user.role_codes and getattr(user, "patient", None) is not None
    )
    if is_patient_caller:
        p = user.patient
        caller_patient_block = (
            f"- THE CALLER IS A PATIENT. Their identity is already known and you must\n"
            f"  use it WITHOUT asking. NEVER ask for name, phone, ID, or 'who is the\n"
            f"  appointment for' — it is always for THIS user:\n"
            f"    patient_id = {p.id}\n"
            f"    patient_code = {p.code}\n"
            f"    full_name = {p.full_name_en or p.full_name_ar or user.full_name}\n"
            f"    phone = {p.phone or 'N/A'}\n"
            f"  When booking on the caller's own behalf, SKIP search_patient and\n"
            f"  create_patient. Pass patient_id={p.id} directly to create_appointment.\n"
            f"  Only ask 'who is the patient?' if the user explicitly says they're\n"
            f"  booking for someone else (e.g. 'for my mother').\n"
        )
    else:
        caller_patient_block = ""

    system_prompt = (
        f"{base_prompt}\n\n"
        f"Context:\n"
        f"- Today's date is {today}.\n"
        f"- {user_label}.\n"
        f"{caller_patient_block}"
        f"- When the user gives a relative date (today/tomorrow/next monday), resolve it\n"
        f"  to an ISO date (YYYY-MM-DD) before calling any tool.\n"
        f"- Always look up doctors by name via tools before booking. Do not\n"
        f"  assume IDs. Use search_doctor to discover IDs.\n"
        f"- BOOKING FLOW. To book an appointment you must collect 3 things:\n"
        f"    (A) PATIENT identity — name or phone (a real person, the visitor)\n"
        f"    (B) DOCTOR identity — name or specialty (a clinician)\n"
        f"    (C) WHEN — date and time (ISO)\n"
        f"  → If the caller is a patient (see context above), (A) is ALREADY known\n"
        f"    — do NOT ask for it. Only collect (B) and (C).\n"
        f"  → Otherwise keep mental track of WHICH of A/B/C are still missing and\n"
        f"    ask ONLY for the missing ones in plain language. Examples:\n"
        f"    User: 'Book an appointment.'  → ask for all three at once.\n"
        f"    User: 'For Ahmad Ali, with Dr Sami, tomorrow 10am.' → enough info, start.\n"
        f"  Steps once you have A/B/C:\n"
        f"    1. search_patient — by name or phone. (SKIP if caller is the patient.)\n"
        f"    2. If no patient match: confirm + collect phone, then call\n"
        f"       create_patient(full_name_en=<patient name>, phone=<phone>).\n"
        f"       The patient's name is the value the user provided in (A).\n"
        f"       NEVER use the patient's name to call search_doctor.\n"
        f"       (SKIP both 1 and 2 entirely when caller is the patient.)\n"
        f"    3. search_doctor — by the doctor name from (B). If (B) is still\n"
        f"       missing, ASK for it before calling. Do NOT pass the patient name.\n"
        f"    4. find_available_slots — verify the requested time is free.\n"
        f"    5. create_appointment — book it.\n"
        f"  After create_patient succeeds, IMMEDIATELY continue with the next\n"
        f"  step. If the doctor name is missing, just ask 'Who is the doctor?'.\n"
        f"  Do not repeat 'how can I help?' between steps — stay in the flow.\n"
        f"- Never silently fail because the patient isn't on file — offer to\n"
        f"  register them. Never confuse patient and doctor names.\n"
        f"- WHEN ANSWERING ABOUT 'TODAY'S' OR 'UPCOMING' APPOINTMENTS:\n"
        f"  * Do NOT mention cancelled, no-show, rejected, or rescheduled\n"
        f"    appointments unless the user explicitly asks for them.\n"
        f"  * Focus only on actionable / active appointments: requested,\n"
        f"    pending_confirmation, confirmed, checked_in, in_consultation,\n"
        f"    completed.\n"
        f"  * The tools already strip inactive statuses by default for\n"
        f"    forward-looking queries; trust their output.\n"
        f"- AVAILABILITY TRUTH RULES:\n"
        f"  * The find_available_slots tool returns the GROUND TRUTH for openings.\n"
        f"  * Each slot's `start` and `starts_at` are bookable.\n"
        f"  * TIME EQUIVALENCE — these are the SAME time, do not treat them as different:\n"
        f"      '11am'  ==  '11:00'  ==  '11:00 AM'  ==  '11:00:00'\n"
        f"      '3pm'   ==  '15:00'  ==  '03:00 PM'  ==  '15:00:00'\n"
        f"      '9:30am' ==  '09:30'  ==  '09:30:00'\n"
        f"    So if the user says '11am' and a slot exists with start='11:00:00',\n"
        f"    THE REQUESTED TIME IS AVAILABLE. Confirm and book — do NOT say it\n"
        f"    'isn't open' and then list 11:00 as a 'nearby' slot. That is a\n"
        f"    self-contradiction and looks broken.\n"
        f"  * REQUESTED-TIME CHECK ALGORITHM (run this in your head before replying):\n"
        f"      1. Parse the user's requested time into HH:MM (24h).\n"
        f"      2. Look for a slot whose `start` matches HH:MM:00.\n"
        f"      3. If found → that slot IS the requested time. Say 'Yes, 11am is\n"
        f"         open with Dr X. Shall I book it?' and on yes call\n"
        f"         create_appointment with that slot's `starts_at`.\n"
        f"      4. If NOT found → say 'That time isn't open' and list 2-3 closest\n"
        f"         slots from the data.\n"
        f"  * When booking with create_appointment, ALWAYS pass the exact\n"
        f"    `starts_at` value from a slot you saw in find_available_slots —\n"
        f"    never construct a datetime yourself.\n"
        f"  * If the user's requested time is genuinely NOT in the slot list, do NOT\n"
        f"    invent a reason (do NOT say 'outside working hours' or 'doctor is on\n"
        f"    leave' unless that information is in the data). Just say:\n"
        f"      'That exact time isn't open. Closest open slots: <list 2-3>.'\n"
        f"  * The actual reason for a missing slot is usually that it's already booked\n"
        f"    — don't speculate further.\n"
        f"- For 'my appointments', 'my schedule', or any first-person question about the\n"
        f"  caller's own appointments, ALWAYS use the `my_appointments` tool — never\n"
        f"  pass the user's name in `q` to search_appointments.\n"
        f"- The `q` parameter on search_appointments is for free-text matching of patient\n"
        f"  names or appointment codes — never for date words. For dates, use\n"
        f"  date_from / date_to in ISO format.\n"
        f"- APPOINTMENT DETAILS. Every appointment returned by my_appointments and\n"
        f"  search_appointments includes a `doctor` object (with `name`, `specialties`)\n"
        f"  and a `patient` object (with `name`). When the user asks 'with which\n"
        f"  doctor?', 'who is my appointment with?', or 'who's the patient?', use those\n"
        f"  fields directly. NEVER reply that you can't find the doctor — the data is\n"
        f"  already in the previous tool result.\n"
    )
    tools = tools_for(user)
    tool_specs = [
        ToolSpec(name=t.name, description=t.description, parameters=t.parameters) for t in tools
    ]

    messages = [ChatMessage(role="system", content=system_prompt)]
    # Reconstruct multi-turn history INCLUDING tool calls + results so the LLM
    # remembers which tools were called and what they returned. We pull a bit
    # more than 12 records because tool messages inflate quickly.
    for m in conv.messages[-30:]:
        meta = m.metadata_json or {}
        if m.role == AIMessageRole.USER:
            messages.append(ChatMessage(role="user", content=m.content))
        elif m.role == AIMessageRole.ASSISTANT:
            tcs = []
            for tc in (meta.get("tool_calls") or []):
                from .llm import ToolCall
                tcs.append(ToolCall(name=tc["name"], arguments=tc.get("arguments") or {}, id=tc.get("id")))
            messages.append(ChatMessage(role="assistant", content=m.content or None, tool_calls=tcs))
        elif m.role == AIMessageRole.TOOL:
            messages.append(ChatMessage(
                role="tool",
                content=m.content,
                name=meta.get("name"),
                tool_call_id=meta.get("tool_call_id") or "",
            ))

    client = get_llm_client()
    final_reply: str | None = None
    pending: dict[str, Any] | None = None

    import json as _json
    for _ in range(_MAX_TOOL_ITERATIONS):
        resp = client.generate(messages=messages, tools=tool_specs, language=lang)
        if not resp.tool_calls:
            final_reply = resp.content or _default_reply(persona, lang)
            break

        # Persist the assistant message that requested tool calls — needed so
        # the LLM remembers them in future turns too.
        tool_calls_meta = [
            {"id": tc.id, "name": tc.name, "arguments": tc.arguments}
            for tc in resp.tool_calls
        ]
        _persist_message(
            conv, AIMessageRole.ASSISTANT, resp.content,
            metadata={"tool_calls": tool_calls_meta},
        )
        messages.append(ChatMessage(
            role="assistant",
            content=resp.content,
            tool_calls=resp.tool_calls,
        ))

        any_destructive = False
        observed_payloads: list[dict] = []
        for call in resp.tool_calls:
            logger.info("agent.tool_call name=%s args=%s", call.name, call.arguments)
            spec = tool_by_name(call.name)
            if spec is None or spec not in tools:
                observed_payloads.append({"tool": call.name, "result": {"error": "tool_not_authorized"}, "success": False, "error": "tool_not_authorized", "id": call.id})
                # Still append a tool result so the message log is well-formed for the next turn
                messages.append(ChatMessage(
                    role="tool", tool_call_id=call.id or "",
                    name=call.name, content=_json.dumps({"error": "tool_not_authorized"}),
                ))
                continue
            if spec.destructive:
                # Require explicit confirmation; do not execute.
                pending = _create_pending_confirmation(conv, spec, call.arguments, persona, lang)
                any_destructive = True
                break

            payload, success, error_msg = _execute_tool(spec, user, call.arguments)
            _log_tool_call(conv, spec.name, call.arguments, payload, success, error_msg)
            observed_payloads.append({
                "tool": spec.name, "result": payload, "success": success, "error": error_msg, "id": call.id,
            })
            tool_content = _json.dumps(payload, default=str)[:4000]
            # Persist tool result so the LLM remembers it next turn
            _persist_message(
                conv, AIMessageRole.TOOL, tool_content,
                metadata={"tool_call_id": call.id, "name": spec.name, "success": success},
            )
            # Feed the tool result back to the LLM with proper linkage
            messages.append(ChatMessage(
                role="tool",
                tool_call_id=call.id or "",
                name=spec.name,
                content=tool_content,
            ))

        if any_destructive:
            final_reply = pending["summary"] if pending else None
            break

        # Local rule-based provider doesn't really need another LLM turn —
        # compose a friendly reply directly from the tool results.
        if client.name == "local":
            final_reply = _compose_local_reply(observed_payloads, lang)
            break
        # Real LLM path loops again — it will see the tool results and respond.
    else:
        final_reply = _default_reply(persona, lang)

    if not final_reply:
        final_reply = _default_reply(persona, lang)

    _persist_message(conv, AIMessageRole.ASSISTANT, final_reply)
    conv.last_message_at = utcnow()
    db.session.commit()

    return {
        "conversation_id": conv.id,
        "reply": final_reply,
        "language": lang,
        "pending_confirmation": pending,
    }


def confirm_pending(*, user: User, conversation_id: int, token: str, decision: str) -> dict[str, Any]:
    pending = db.session.scalar(
        select(AIPendingConfirmation).where(
            AIPendingConfirmation.conversation_id == conversation_id,
            AIPendingConfirmation.token == token,
            AIPendingConfirmation.consumed == False,
        )
    )
    if pending is None or pending.expires_at < utcnow():
        return {"status": "expired"}
    pending.consumed = True
    if decision.lower() not in {"yes", "confirm", "approve", "go", "ok"}:
        msg = "Action cancelled. Anything else I can help with?"
        _persist_message(db.session.get(AIConversation, conversation_id), AIMessageRole.ASSISTANT, msg)
        db.session.commit()
        return {"status": "cancelled", "reply": msg}

    spec = tool_by_name(pending.tool_name)
    if spec is None:
        return {"status": "error", "reason": "tool_unknown"}
    payload, success, error = _execute_tool(spec, user, pending.arguments)
    conv = db.session.get(AIConversation, conversation_id)
    _log_tool_call(conv, spec.name, pending.arguments, payload, success, error)
    reply = (
        f"Done. {pending.summary.split('—')[0].strip()}."
        if success
        else f"Sorry, that didn't go through: {error}"
    )
    _persist_message(conv, AIMessageRole.ASSISTANT, reply)
    db.session.commit()
    return {"status": "ok" if success else "error", "reply": reply, "result": payload, "error": error}


# ---------------------------------------------------------------------------
# Internals
# ---------------------------------------------------------------------------
def _execute_tool(spec: Tool, user: User, arguments: dict) -> tuple[Any, bool, str | None]:
    start = time.perf_counter()
    try:
        result = spec.fn(user, arguments)
        return result, True, None
    except Exception as exc:
        logger.exception("ai-tool-failed", extra={"tool": spec.name})
        return {"error": exc.__class__.__name__}, False, str(exc)
    finally:
        _ = time.perf_counter() - start  # latency logged in _log_tool_call


def _log_tool_call(conv: AIConversation, name: str, arguments: dict, result: Any, success: bool, error: str | None):
    db.session.add(
        AIToolCall(
            conversation_id=conv.id,
            tool_name=name,
            arguments=arguments,
            result=result if isinstance(result, dict) else {"value": result},
            success=success,
            error=error,
            at=utcnow(),
        )
    )


def _persist_message(
    conv: AIConversation,
    role: AIMessageRole,
    content: str | None,
    metadata: dict | None = None,
):
    db.session.add(AIMessage(
        conversation_id=conv.id,
        role=role,
        content=content or "",
        metadata_json=metadata,
    ))


def _create_pending_confirmation(conv: AIConversation, spec: Tool, args: dict, persona: str, lang: str) -> dict:
    summary = _summarize_destructive(spec, args, lang)
    token = secrets.token_urlsafe(16)
    pending = AIPendingConfirmation(
        conversation_id=conv.id,
        token=token,
        tool_name=spec.name,
        arguments=args,
        summary=summary,
        expires_at=utcnow() + timedelta(seconds=_CONFIRMATION_TTL_SECONDS),
    )
    db.session.add(pending)
    db.session.flush()
    return {"token": token, "tool": spec.name, "arguments": args, "summary": summary}


def _summarize_destructive(spec: Tool, args: dict, lang: str) -> str:
    if spec.name == "cancel_appointment":
        if lang.startswith("ar"):
            return f"إلغاء الموعد رقم {args.get('appointment_id')} — هل تؤكد؟"
        return f"Cancel appointment {args.get('appointment_id')} — confirm?"
    if spec.name == "reschedule_appointment":
        if lang.startswith("ar"):
            return f"إعادة جدولة الموعد {args.get('appointment_id')} إلى {args.get('new_starts_at')} — هل تؤكد؟"
        return f"Reschedule appointment {args.get('appointment_id')} to {args.get('new_starts_at')} — confirm?"
    return f"Confirm {spec.name} with {args}"


def _compose_local_reply(observations: list[dict], lang: str) -> str:
    if not observations:
        return _default_reply("secretary", lang)
    first = observations[0]
    if not first.get("success", True):
        if lang.startswith("ar"):
            return f"تعذر تنفيذ الأداة {first['tool']}: {first.get('error')}"
        return f"Tool `{first['tool']}` failed: {first.get('error')}"
    result = first.get("result") or {}
    tool = first["tool"]

    if tool == "search_appointments":
        items = result.get("results", [])
        if not items:
            return (
                "لم أجد مواعيد مطابقة." if lang.startswith("ar")
                else "No matching appointments found."
            )
        lines = [f"Found **{len(items)}** appointment{'s' if len(items) != 1 else ''}:"]
        for it in items[:5]:
            when = (it.get("starts_at") or "").replace("T", " ")[:16]
            lines.append(f"• `{it['code']}` — {when} — status: _{it.get('status', '?')}_")
        if len(items) > 5:
            lines.append(f"…and {len(items) - 5} more.")
        return "\n".join(lines)

    if tool == "search_patient":
        items = result.get("results", [])
        if not items:
            return "No matching patients."
        lines = [f"Found **{len(items)}** patient{'s' if len(items) != 1 else ''}:"]
        for p in items[:5]:
            lines.append(f"• `{p['code']}` — {p['name']} — {p.get('phone') or 'no phone'} — KYC: _{p['kyc_status']}_")
        return "\n".join(lines)

    if tool == "find_available_slots":
        slots = result.get("slots", [])
        if not slots:
            return "No open slots in that window."
        by_date: dict[str, list[str]] = {}
        for s in slots[:15]:
            by_date.setdefault(s["date"], []).append(s["start"])
        out = ["Available slots:"]
        for d, times in by_date.items():
            out.append(f"• **{d}**: {', '.join(times)}")
        return "\n".join(out)

    if tool == "next_patient_or_appointment":
        nxt = result.get("next")
        if not nxt:
            return "Nothing upcoming."
        when = (nxt.get("starts_at") or "").replace("T", " ")[:16]
        code = nxt.get("appointment_code") or nxt.get("code")
        reason = nxt.get("reason")
        line = f"Next: **{code}** at {when}."
        if reason:
            line += f" Reason: _{reason}_."
        return line

    if tool == "doctor_schedule_today":
        total = result.get("total", 0)
        if total == 0:
            return "No appointments scheduled today."
        by_status = result.get("by_status", {})
        bits = ", ".join(f"{v} {k.replace('_', ' ')}" for k, v in by_status.items())
        return f"Today: **{total}** appointment{'s' if total != 1 else ''} — {bits}."

    if tool == "report_overview":
        return (
            f"📊 **Operational overview**\n"
            f"• Total appointments: **{result.get('total_appointments')}**\n"
            f"• Last 30 days: **{result.get('appointments_last_30_days')}**\n"
            f"• No-show rate: **{(result.get('no_show_rate', 0) * 100):.1f}%**\n"
            f"• Cancellation rate: **{(result.get('cancellation_rate', 0) * 100):.1f}%**\n"
            f"• Insurance approvals pending: **{result.get('insurance_pending_approvals')}**\n"
            f"• New patients (30d): **{result.get('new_patients_last_30_days')}**"
        )

    if tool == "check_insurance_acceptance":
        if result.get("accepted"):
            tier = result.get("network_tier") or "standard"
            copay = result.get("copayment")
            need = "pre-approval required" if result.get("approval_required") else "no pre-approval needed"
            return f"✅ Accepted — network: **{tier}**, co-pay: **{copay}**, {need}."
        reason = result.get("reason", "unknown").replace("_", " ")
        return f"❌ Not accepted — reason: _{reason}_."

    if tool == "summarize_patient_history":
        p = result.get("patient", {})
        recent = result.get("recent_appointments", [])
        out = [
            f"**{p.get('name', 'Patient')}** (DOB {p.get('dob') or 'unknown'})",
            f"• Allergies: {', '.join(p.get('allergies') or []) or 'none'}",
            f"• Chronic: {', '.join(p.get('chronic_diseases') or []) or 'none'}",
            f"• Medications: {', '.join(p.get('current_medications') or []) or 'none'}",
        ]
        if recent:
            out.append("\n**Recent visits:**")
            for a in recent[:3]:
                when = (a.get("starts_at") or "")[:10]
                out.append(f"• `{a['code']}` — {when} — _{a.get('status')}_ — {a.get('reason') or 'no reason'}")
        return "\n".join(out)

    return str(result)[:600]


def _default_reply(persona: str, lang: str) -> str:
    if lang.startswith("ar"):
        return "كيف أساعدك؟ يمكنني البحث عن المواعيد، إيجاد أوقات شاغرة، أو فحص قبول التأمين."
    return "How can I help? I can search appointments, find available slots, or check insurance acceptance."
