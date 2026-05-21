"""AI conversations, messages, tool calls, pending confirmations."""
from __future__ import annotations

import enum
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, Float, ForeignKey, Index, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..extensions import db
from .base import TimestampMixin


class AIMessageRole(str, enum.Enum):
    USER = "user"
    ASSISTANT = "assistant"
    SYSTEM = "system"
    TOOL = "tool"


class AIConversation(TimestampMixin, db.Model):
    __tablename__ = "ai_conversations"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    role_persona: Mapped[str] = mapped_column(String(32), nullable=False)  # secretary/doctor/patient/admin
    channel: Mapped[str] = mapped_column(String(32), default="chat", nullable=False)
    language: Mapped[str] = mapped_column(String(8), default="en", nullable=False)
    title: Mapped[str | None] = mapped_column(String(255))
    last_message_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    messages: Mapped[list["AIMessage"]] = relationship(
        back_populates="conversation", cascade="all,delete", order_by="AIMessage.id"
    )
    tool_calls: Mapped[list["AIToolCall"]] = relationship(
        back_populates="conversation", cascade="all,delete", order_by="AIToolCall.id"
    )


class AIMessage(TimestampMixin, db.Model):
    __tablename__ = "ai_messages"
    __table_args__ = (Index("ix_ai_messages_conversation", "conversation_id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    conversation_id: Mapped[int] = mapped_column(
        ForeignKey("ai_conversations.id", ondelete="CASCADE"), nullable=False
    )
    role: Mapped[AIMessageRole] = mapped_column(
        Enum(AIMessageRole, name="ai_message_role"), nullable=False
    )
    content: Mapped[str] = mapped_column(Text, nullable=False)
    metadata_json: Mapped[dict | None] = mapped_column("metadata", JSONB)

    conversation: Mapped[AIConversation] = relationship(back_populates="messages")


class AIToolCall(TimestampMixin, db.Model):
    __tablename__ = "ai_tool_calls"
    __table_args__ = (
        Index("ix_ai_tool_calls_conversation", "conversation_id"),
        Index("ix_ai_tool_calls_tool", "tool_name"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    conversation_id: Mapped[int] = mapped_column(
        ForeignKey("ai_conversations.id", ondelete="CASCADE"), nullable=False
    )
    message_id: Mapped[int | None] = mapped_column(
        ForeignKey("ai_messages.id", ondelete="SET NULL")
    )
    tool_name: Mapped[str] = mapped_column(String(128), nullable=False)
    arguments: Mapped[dict | None] = mapped_column(JSONB)
    result: Mapped[dict | None] = mapped_column(JSONB)
    success: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    error: Mapped[str | None] = mapped_column(Text)
    latency_ms: Mapped[float | None] = mapped_column(Float)
    at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    conversation: Mapped[AIConversation] = relationship(back_populates="tool_calls")


class AIPendingConfirmation(TimestampMixin, db.Model):
    __tablename__ = "ai_pending_confirmations"

    id: Mapped[int] = mapped_column(primary_key=True)
    conversation_id: Mapped[int] = mapped_column(
        ForeignKey("ai_conversations.id", ondelete="CASCADE"), nullable=False
    )
    token: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    tool_name: Mapped[str] = mapped_column(String(128), nullable=False)
    arguments: Mapped[dict] = mapped_column(JSONB, nullable=False)
    summary: Mapped[str] = mapped_column(Text, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    consumed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
