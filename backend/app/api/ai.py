"""AI API."""
from __future__ import annotations

from flask import Blueprint, jsonify, request
from flask_jwt_extended import current_user
from sqlalchemy import select

from ..ai.agent import confirm_pending, primary_persona, run_agent
from ..ai.tools import tools_for
from ..errors import NotFound
from ..extensions import db, limiter
from ..models.ai_conversation import AIConversation, AIMessageRole
from ..rbac import require_permission

ai_bp = Blueprint("ai", __name__)


@ai_bp.post("/chat")
@require_permission("ai:chat")
@limiter.limit("30 per minute")
def chat():
    body = request.get_json() or {}
    message = (body.get("message") or "").strip()
    if not message:
        return jsonify({"error": {"code": "validation_failed", "message": "message is required"}}), 422
    resp = run_agent(
        user=current_user,
        message=message,
        conversation_id=body.get("conversation_id"),
        language=body.get("language"),
    )
    return jsonify(resp), 200


@ai_bp.post("/chat/<int:conversation_id>/confirm")
@require_permission("ai:chat")
def confirm(conversation_id: int):
    body = request.get_json() or {}
    token = body.get("token")
    decision = body.get("decision") or "no"
    if not token:
        return jsonify({"error": {"code": "validation_failed", "message": "token required"}}), 422
    res = confirm_pending(user=current_user, conversation_id=conversation_id, token=token, decision=decision)
    return jsonify(res), 200


@ai_bp.get("/conversations")
@require_permission("ai:chat")
def list_conversations():
    rows = db.session.scalars(
        select(AIConversation).where(AIConversation.user_id == current_user.id).order_by(AIConversation.id.desc())
    ).all()
    return jsonify({
        "data": [
            {
                "id": c.id, "title": c.title, "persona": c.role_persona, "language": c.language,
                "last_message_at": c.last_message_at.isoformat() if c.last_message_at else None,
                "created_at": c.created_at.isoformat(),
            }
            for c in rows[:50]
        ]
    }), 200


@ai_bp.get("/conversations/<int:conversation_id>")
@require_permission("ai:chat")
def get_conversation(conversation_id: int):
    conv = db.session.get(AIConversation, conversation_id)
    if conv is None or conv.user_id != current_user.id:
        raise NotFound()
    return jsonify({
        "id": conv.id, "persona": conv.role_persona, "language": conv.language,
        "messages": [
            {"role": m.role.value, "content": m.content, "at": m.created_at.isoformat()}
            for m in conv.messages
        ],
        "tool_calls": [
            {
                "tool": tc.tool_name, "arguments": tc.arguments,
                "result": tc.result, "success": tc.success, "error": tc.error,
                "at": tc.at.isoformat(),
            }
            for tc in conv.tool_calls
        ],
    }), 200


@ai_bp.get("/tools")
@require_permission("ai:chat", "ai:tools:read")
def list_tools():
    tools = tools_for(current_user)
    return jsonify({
        "persona": primary_persona(current_user),
        "tools": [
            {"name": t.name, "description": t.description, "destructive": t.destructive}
            for t in tools
        ],
    }), 200
