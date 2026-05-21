"""LLM provider abstraction.

The agent code stays the same across providers. Add new adapters here and
flip the `LLM_PROVIDER` env variable.

The default `local` provider runs **without** an external LLM key and uses
a small rule-based router so the demo end-to-end flow keeps working — this
is what powers the "always-runnable" promise.
"""
from __future__ import annotations

import json
import logging
import re
from dataclasses import dataclass, field
from typing import Any, Iterable

from flask import current_app

logger = logging.getLogger(__name__)


@dataclass
class ToolSpec:
    name: str
    description: str
    parameters: dict[str, Any]  # JSON schema


@dataclass
class ToolCall:
    name: str
    arguments: dict[str, Any]
    id: str | None = None


@dataclass
class LLMResponse:
    content: str | None = None
    tool_calls: list[ToolCall] = field(default_factory=list)
    raw: dict | None = None


@dataclass
class ChatMessage:
    role: str  # system / user / assistant / tool
    content: str | None = None
    name: str | None = None
    tool_call_id: str | None = None
    tool_calls: list[ToolCall] = field(default_factory=list)


class LLMClient:
    name: str = "base"

    def generate(self, *, messages: list[ChatMessage], tools: list[ToolSpec], language: str = "en") -> LLMResponse:
        raise NotImplementedError


# ---------------------------------------------------------------------------
# Local rule-based provider (no external LLM call)
# ---------------------------------------------------------------------------
class LocalEchoClient(LLMClient):
    name = "local"

    # Match if ANY of these substrings appear in the normalised text.
    # We use SHORT stems (e.g. "appo" matches "appointment", "appointmet",
    # "appintment", "appt." etc.) for typo tolerance.
    _KEYWORD_INTENTS: list[tuple[list[str], str]] = [
        # High-confidence two-word triggers first
        (["report", "overview", "stats", "metric", "kpi", "dashboard"], "report_overview"),
        (["next patient", "next appoint", "next pt", "next visit", "who is next", "who's next", "who next"], "next_patient_or_appointment"),
        (["today sched", "todays sched", "today's sched", "sched today",
          "my sched", "my day", "today appoint", "today's appoint", "today appt",
          "sched for today", "todays appoint"], "doctor_schedule_today"),
        (["cancel "], "cancel_appointment"),
        (["reschedul", "re-sched", "move appoint", "change appoint", "change time", "shift appoint", "move my", "change my"], "reschedule_appointment"),
        (["book ", "make appoint", "make an appoint", "create appoint", "reserve appoint", "schedule a", "new appoint", "want appoint", "want an appoint", "make appint", "make appont", "want to book"], "book_appointment"),
        (["insur", "cover", "accept network", "pre-approval", "preapproval", "deductible", "copay"], "insurance_check"),
        (["availab", "free slot", "open slot", "slots", "open time", "free time", "what time", "any time"], "find_available_slots"),
        (["patient summary", "patient history", "patient profile", "patient info",
          "medical history", "summarize patient", "history for patient", "summary for patient"], "patient_summary"),
        (["find patient", "search patient", "look up patient", "show patient", "lookup patient", "who is patient"], "patient_search"),
        (["hi ", "hi!", "hello", "hey ", "hey!", "salam", "marhaba", "good morning", "good afternoon", "good evening"], "greeting"),
        (["help", "what can you do", "capabilities", "how to use", "what do you do"], "help"),
        # Final fallthrough: very short stems — these survive most typos.
        (["appo", "appt", "appin", "appon", "appoin", "book", "visit", "sched"], "search_appointments"),
        (["patient"], "patient_search"),
    ]

    _PHONE_RE = re.compile(r"\+?\d[\d\-\s]{6,}\d")
    _DATE_RE = re.compile(r"\b(today|tomorrow|yesterday|tonight|tmrw|\d{4}-\d{2}-\d{2})\b", re.I)
    _NAME_RE = re.compile(r"\b(for|named|called|about)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b")

    def generate(self, *, messages, tools, language="en"):
        user_text = next((m.content for m in reversed(messages) if m.role == "user"), "")
        intent = self._detect_intent(user_text)
        entities = self._extract_entities(user_text)
        allowed = {t.name for t in tools}

        plan: list[ToolCall] = []

        if intent == "search_appointments" and "search_appointments" in allowed:
            args: dict[str, Any] = {}
            if entities.get("phone"):
                args["phone"] = entities["phone"]
            if entities.get("date"):
                args["date_from"] = entities["date"]
                args["date_to"] = entities["date"]
            if entities.get("name"):
                args["q"] = entities["name"]
            # If no filters, return the most recent — still useful.
            plan.append(ToolCall("search_appointments", args))

        elif intent == "patient_search" and "search_patient" in allowed:
            args = {}
            if entities.get("phone"):
                args["phone"] = entities["phone"]
            if entities.get("name"):
                args["q"] = entities["name"]
            plan.append(ToolCall("search_patient", args))

        elif intent == "patient_summary" and entities.get("patient_id") and "summarize_patient_history" in allowed:
            plan.append(ToolCall("summarize_patient_history", {"patient_id": entities["patient_id"]}))

        elif intent == "doctor_schedule_today" and "doctor_schedule_today" in allowed:
            plan.append(ToolCall("doctor_schedule_today", {}))

        elif intent == "next_patient_or_appointment" and "next_patient_or_appointment" in allowed:
            plan.append(ToolCall("next_patient_or_appointment", {}))

        elif intent == "report_overview" and "report_overview" in allowed:
            plan.append(ToolCall("report_overview", {}))

        elif intent == "find_available_slots" and "find_available_slots" in allowed:
            if entities.get("doctor_id"):
                plan.append(ToolCall("find_available_slots", {
                    "doctor_id": entities["doctor_id"],
                    "date": entities.get("date", "today"),
                }))
            # else: missing doctor — let the textual reply ask for it

        elif intent == "insurance_check" and entities.get("patient_id") and entities.get("doctor_id") and "check_insurance_acceptance" in allowed:
            plan.append(ToolCall("check_insurance_acceptance", {
                "patient_id": entities["patient_id"],
                "doctor_id": entities["doctor_id"],
            }))

        if plan:
            return LLMResponse(content=None, tool_calls=plan, raw={"intent": intent, "entities": entities})

        return LLMResponse(
            content=self._fallback_reply(intent, language, entities, allowed),
            tool_calls=[],
            raw={"intent": intent, "entities": entities},
        )

    def _detect_intent(self, text: str) -> str:
        # Normalise: lowercase, strip smart quotes, collapse whitespace.
        norm = text.lower().replace("’", "'").replace("‘", "'")
        norm = re.sub(r"\s+", " ", norm).strip()
        for keywords, intent in self._KEYWORD_INTENTS:
            for kw in keywords:
                if kw in norm:
                    return intent
        return "smalltalk"

    def _extract_entities(self, text: str) -> dict:
        out: dict[str, Any] = {}
        if m := self._PHONE_RE.search(text):
            out["phone"] = re.sub(r"[\s\-]", "", m.group())
        if m := self._DATE_RE.search(text):
            out["date"] = m.group().lower()
        for kw in ("doctor", "Dr"):
            m = re.search(rf"{kw}\.?\s*#?(\d+)", text, re.I)
            if m:
                out["doctor_id"] = int(m.group(1))
                break
        m = re.search(r"patient\s*#?(\d+)", text, re.I)
        if m:
            out["patient_id"] = int(m.group(1))
        m = self._NAME_RE.search(text)
        if m:
            out["name"] = m.group(2)
        return out

    def _fallback_reply(self, intent: str, language: str, entities: dict, allowed_tools: set) -> str:
        ar = language.startswith("ar")
        if intent == "greeting":
            return (
                "أهلًا وسهلًا! يمكنني البحث عن المواعيد، إيجاد أوقات شاغرة، فحص التأمين، أو تلخيص جدول اليوم."
                if ar
                else "Hi there! I can search appointments, find slots, check insurance, or summarize today's schedule — just ask."
            )
        if intent == "help":
            tools_list = ", ".join(sorted(allowed_tools)[:8])
            return (
                f"Aquí tienes lo que puedo hacer: {tools_list}…" if False
                else f"Here's what I can do right now: {tools_list}. Try: 'today\\'s schedule', 'search appointments for 0791234567', or 'report overview'."
            )
        if intent == "book_appointment":
            return (
                "تمام، لحجز موعد أحتاج اسم المريض، الفرع، التخصص أو الطبيب، والوقت المناسب."
                if ar
                else "Sure — to book I need the patient, branch, doctor (or specialty), and a preferred time. Use the booking wizard for a guided flow."
            )
        if intent == "cancel_appointment":
            return (
                "أي موعد تريد إلغاءه؟ زوّدني برقم الموعد (مثلًا APT-20260514-00001) وسأطلب تأكيدك."
                if ar
                else "Which appointment should I cancel? Give me the code (e.g. APT-20260514-00001) and I'll ask you to confirm."
            )
        if intent == "reschedule_appointment":
            return (
                "حسنًا، أعطني رقم الموعد والوقت الجديد."
                if ar
                else "OK — give me the appointment code and the new date/time."
            )
        if intent == "find_available_slots":
            return (
                "لأي طبيب تريد إيجاد أوقات شاغرة؟ مثلًا: 'available slots for doctor 1 tomorrow'."
                if ar
                else "Which doctor's availability would you like to see? e.g. 'available slots for doctor 1 tomorrow'."
            )
        if intent == "insurance_check":
            return (
                "أحتاج رقم المريض ورقم الطبيب لفحص قبول التأمين، مثلًا: 'check insurance for patient 1 doctor 1'."
                if ar
                else "I need a patient and a doctor to check coverage. Try: 'check insurance for patient 1 doctor 1'."
            )
        if intent == "patient_summary":
            return (
                "أرسل لي رقم المريض، مثلًا: 'patient summary for patient 1'."
                if ar
                else "Send me a patient id, e.g. 'patient summary for patient 1'."
            )
        return (
            "أهلًا! يمكنني البحث عن المواعيد، إيجاد أوقات شاغرة، فحص التأمين، أو تلخيص جدول اليوم."
            if ar
            else "Hi! Try: 'today\\'s schedule', 'list appointments', 'next patient', 'report overview', or ask about insurance."
        )


# ---------------------------------------------------------------------------
# OpenAI / Anthropic adapters (best-effort, gated on key presence)
# ---------------------------------------------------------------------------
class OpenAIClient(LLMClient):
    name = "openai"

    def __init__(self):
        from openai import OpenAI
        self._client = OpenAI(api_key=current_app.config["OPENAI_API_KEY"])
        self._model = current_app.config["OPENAI_MODEL"]

    def generate(self, *, messages, tools, language="en"):
        oai_tools = [
            {"type": "function", "function": {"name": t.name, "description": t.description, "parameters": t.parameters}}
            for t in tools
        ]
        oai_messages: list[dict] = []
        for m in messages:
            if m.role == "assistant" and m.tool_calls:
                oai_messages.append({
                    "role": "assistant",
                    "content": m.content,
                    "tool_calls": [
                        {
                            "id": tc.id or f"call_{i}",
                            "type": "function",
                            "function": {"name": tc.name, "arguments": json.dumps(tc.arguments or {})},
                        }
                        for i, tc in enumerate(m.tool_calls)
                    ],
                })
            elif m.role == "tool":
                oai_messages.append({
                    "role": "tool",
                    "tool_call_id": m.tool_call_id or "",
                    "content": m.content or "",
                })
            else:
                oai_messages.append({"role": m.role, "content": m.content or ""})

        resp = self._client.chat.completions.create(
            model=self._model, messages=oai_messages, tools=oai_tools or None, temperature=0,
        )
        choice = resp.choices[0].message
        tool_calls: list[ToolCall] = []
        for tc in (choice.tool_calls or []):
            try:
                args = json.loads(tc.function.arguments or "{}")
            except json.JSONDecodeError:
                args = {}
            tool_calls.append(ToolCall(name=tc.function.name, arguments=args, id=tc.id))
        return LLMResponse(content=choice.content, tool_calls=tool_calls, raw=resp.model_dump())


class AnthropicClient(LLMClient):
    name = "anthropic"

    def __init__(self):
        import anthropic
        self._client = anthropic.Anthropic(api_key=current_app.config["ANTHROPIC_API_KEY"])
        self._model = current_app.config["ANTHROPIC_MODEL"]

    def generate(self, *, messages, tools, language="en"):
        system = next((m.content for m in messages if m.role == "system"), "")
        anth_messages: list[dict] = []
        for m in messages:
            if m.role == "system":
                continue
            if m.role == "assistant" and m.tool_calls:
                blocks: list[dict] = []
                if m.content:
                    blocks.append({"type": "text", "text": m.content})
                for tc in m.tool_calls:
                    blocks.append({
                        "type": "tool_use",
                        "id": tc.id or f"call_{len(blocks)}",
                        "name": tc.name,
                        "input": tc.arguments or {},
                    })
                anth_messages.append({"role": "assistant", "content": blocks})
            elif m.role == "tool":
                anth_messages.append({
                    "role": "user",
                    "content": [{
                        "type": "tool_result",
                        "tool_use_id": m.tool_call_id or "",
                        "content": m.content or "",
                    }],
                })
            else:
                anth_messages.append({"role": m.role, "content": m.content or ""})

        anth_tools = [
            {"name": t.name, "description": t.description, "input_schema": t.parameters}
            for t in tools
        ]
        resp = self._client.messages.create(
            model=self._model, max_tokens=1024, system=system, messages=anth_messages,
            tools=anth_tools or None,
        )
        content_parts: list[str] = []
        tool_calls: list[ToolCall] = []
        for block in resp.content:
            if block.type == "text":
                content_parts.append(block.text)
            elif block.type == "tool_use":
                tool_calls.append(ToolCall(name=block.name, arguments=block.input or {}, id=block.id))
        return LLMResponse(content="\n".join(content_parts) or None, tool_calls=tool_calls, raw=resp.model_dump())


# ---------------------------------------------------------------------------
def get_llm_client() -> LLMClient:
    provider = (current_app.config.get("LLM_PROVIDER") or "local").lower()
    try:
        if provider == "openai" and current_app.config.get("OPENAI_API_KEY"):
            return OpenAIClient()
        if provider == "anthropic" and current_app.config.get("ANTHROPIC_API_KEY"):
            return AnthropicClient()
    except Exception:  # pragma: no cover - graceful fallback
        logger.exception("llm-init-failed; falling back to local provider")
    return LocalEchoClient()
