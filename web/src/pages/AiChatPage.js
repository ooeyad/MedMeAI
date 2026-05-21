import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useRef, useState } from "react";
import { Bot, Send, Sparkles, Wrench, ShieldAlert, Zap } from "lucide-react";
import { api } from "../api/client";
import { ChatMarkdown } from "../components/ChatMarkdown";
import { Avatar } from "../components/ui/Avatar";
import { useAuthStore } from "../store/auth";
const SUGGESTIONS = {
    secretary: [
        "today's schedule",
        "find appointments for 0791234567",
        "report overview",
        "check insurance acceptance for patient 1 doctor 1",
    ],
    doctor: ["next patient", "today's schedule", "summarize patient 1"],
    patient: ["next appointment", "book with dermatologist tomorrow"],
    admin: ["report overview", "doctor utilization last 30 days"],
};
export function AiChatPage() {
    const user = useAuthStore((s) => s.user);
    const persona = user?.roles?.[0] || "secretary";
    const greeting = personaGreeting(persona);
    const [conversationId, setConversationId] = useState(null);
    const [messages, setMessages] = useState([
        { role: "system", content: greeting },
    ]);
    const [text, setText] = useState("");
    const [busy, setBusy] = useState(false);
    const [tools, setTools] = useState([]);
    const endRef = useRef(null);
    useEffect(() => {
        api.get("/ai/tools").then((res) => setTools(res.data.tools || []));
    }, []);
    useEffect(() => {
        endRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, busy]);
    async function sendMessage(messageText) {
        const message = messageText.trim();
        if (!message)
            return;
        setMessages((m) => [...m, { role: "user", content: message }]);
        setBusy(true);
        try {
            const res = await api.post("/ai/chat", { message, conversation_id: conversationId });
            setConversationId(res.data.conversation_id);
            setMessages((m) => [
                ...m,
                {
                    role: "assistant",
                    content: res.data.reply,
                    pending: res.data.pending_confirmation || undefined,
                },
            ]);
        }
        catch (err) {
            setMessages((m) => [
                ...m,
                { role: "assistant", content: err.response?.data?.error?.message || "Something went wrong." },
            ]);
        }
        finally {
            setBusy(false);
        }
    }
    async function onSubmit(e) {
        e.preventDefault();
        const v = text;
        setText("");
        await sendMessage(v);
    }
    async function confirm(token, decision) {
        if (!conversationId)
            return;
        setBusy(true);
        try {
            const res = await api.post(`/ai/chat/${conversationId}/confirm`, { token, decision });
            setMessages((m) => [...m, { role: "assistant", content: res.data.reply || "Done." }]);
        }
        finally {
            setBusy(false);
        }
    }
    const suggestions = SUGGESTIONS[persona] || SUGGESTIONS.secretary;
    return (_jsxs("div", { className: "max-w-7xl mx-auto h-[calc(100vh-8rem)] grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6", children: [_jsxs("div", { className: "flex flex-col rounded-2xl bg-white shadow-card ring-1 ring-ink-200/60 overflow-hidden", children: [_jsxs("div", { className: "relative overflow-hidden bg-ai-gradient text-white px-5 py-4", children: [_jsx("div", { className: "absolute -right-10 -top-10 size-40 rounded-full bg-white/10 blur-2xl" }), _jsxs("div", { className: "relative flex items-center gap-3", children: [_jsx("div", { className: "size-10 rounded-xl bg-white/15 backdrop-blur grid place-items-center ring-1 ring-white/30", children: _jsx(Sparkles, { size: 18 }) }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsx("div", { className: "font-semibold tracking-tight", children: "AI Assistant" }), _jsxs("div", { className: "text-xs text-white/80", children: ["Connected to ", tools.length, " tools \u00B7 ", persona, " persona"] })] }), _jsxs("span", { className: "hidden md:inline-flex items-center gap-1.5 text-[11px] font-medium bg-white/15 ring-1 ring-white/30 rounded-full px-2.5 py-1 backdrop-blur", children: [_jsx("span", { className: "size-1.5 rounded-full bg-emerald-300 animate-pulse-soft" }), "Live"] })] })] }), _jsxs("div", { className: "flex-1 overflow-y-auto scrollbar-thin p-5 space-y-4 bg-gradient-to-b from-ink-50/40 to-white", children: [messages.map((m, i) => (_jsx(Bubble, { message: m, onConfirm: confirm }, i))), busy && _jsx(TypingBubble, {}), _jsx("div", { ref: endRef })] }), messages.filter((m) => m.role === "user").length === 0 && (_jsx("div", { className: "px-5 pb-3 flex flex-wrap gap-2", children: suggestions.map((s) => (_jsxs("button", { onClick: () => sendMessage(s), className: "inline-flex items-center gap-1.5 rounded-full bg-brand-50 text-brand-700 hover:bg-brand-100 px-3 py-1.5 text-xs font-medium transition", children: [_jsx(Zap, { size: 11 }), " ", s] }, s))) })), _jsxs("form", { onSubmit: onSubmit, className: "border-t border-ink-100 p-3 flex gap-2 bg-white", children: [_jsx("input", { value: text, onChange: (e) => setText(e.target.value), placeholder: "Ask the AI anything\u2026", className: "flex-1 h-11 rounded-xl border border-ink-200 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300" }), _jsxs("button", { disabled: busy || !text.trim(), className: "h-11 px-4 rounded-xl bg-brand-gradient text-white font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1.5 shadow-soft", children: [_jsx(Send, { size: 14 }), " Send"] })] })] }), _jsxs("div", { className: "flex flex-col rounded-2xl bg-white shadow-card ring-1 ring-ink-200/60 overflow-hidden", children: [_jsx("div", { className: "px-5 py-4 border-b border-ink-100", children: _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("div", { className: "size-8 rounded-lg bg-violet-50 text-violet-600 grid place-items-center", children: _jsx(Wrench, { size: 14 }) }), _jsxs("div", { children: [_jsx("div", { className: "font-semibold text-ink-800 text-sm", children: "Available tools" }), _jsx("div", { className: "text-[11px] text-ink-500", children: "Filtered by your role" })] })] }) }), _jsxs("div", { className: "flex-1 overflow-y-auto scrollbar-thin p-3 space-y-1", children: [tools.length === 0 && _jsx("div", { className: "text-xs text-ink-500 p-2", children: "Loading\u2026" }), tools.map((t) => (_jsxs("div", { className: "rounded-lg p-2.5 hover:bg-ink-50 transition group", children: [_jsxs("div", { className: "flex items-center justify-between gap-2", children: [_jsx("div", { className: "font-mono text-[11px] font-semibold text-brand-700 truncate", children: t.name }), t.destructive && (_jsxs("span", { className: "inline-flex items-center gap-1 text-[10px] font-medium text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded", children: [_jsx(ShieldAlert, { size: 10 }), " destructive"] }))] }), _jsx("div", { className: "text-[11px] text-ink-500 mt-0.5 line-clamp-2", children: t.description })] }, t.name)))] })] })] }));
}
function Bubble({ message, onConfirm, }) {
    if (message.role === "system") {
        return (_jsx("div", { className: "text-center", children: _jsx("div", { className: "inline-block max-w-xl mx-auto rounded-xl bg-ink-100/70 px-4 py-2 text-xs text-ink-600", children: message.content }) }));
    }
    const user = useAuthStore.getState().user;
    const isUser = message.role === "user";
    return (_jsxs("div", { className: `flex items-end gap-2 ${isUser ? "justify-end" : "justify-start"}`, children: [!isUser && (_jsx("div", { className: "size-7 rounded-full bg-ai-gradient text-white grid place-items-center shrink-0 shadow-soft", children: _jsx(Bot, { size: 14 }) })), _jsxs("div", { className: `max-w-[78%] rounded-2xl px-4 py-2.5 text-sm shadow-soft ${isUser
                    ? "bg-brand-600 text-white rounded-br-sm"
                    : "bg-white text-ink-800 ring-1 ring-ink-200 rounded-bl-sm"}`, children: [isUser ? (_jsx("div", { className: "whitespace-pre-wrap leading-relaxed", children: message.content })) : (_jsx(ChatMarkdown, { content: message.content })), message.pending && (_jsxs("div", { className: "mt-3 border-t border-ink-200 pt-2.5 -mx-1", children: [_jsxs("div", { className: "flex items-center gap-1.5 text-amber-700 text-[11px] font-semibold mb-1.5", children: [_jsx(ShieldAlert, { size: 12 }), " Confirmation required"] }), _jsx("pre", { className: "text-[11px] font-mono text-ink-600 bg-ink-50 rounded p-2 mb-2 overflow-auto", children: JSON.stringify(message.pending.arguments, null, 2) }), _jsxs("div", { className: "flex gap-2", children: [_jsx("button", { onClick: () => onConfirm(message.pending.token, "yes"), className: "bg-emerald-600 text-white text-xs font-medium px-3 py-1.5 rounded-md hover:bg-emerald-700 transition", children: "Confirm" }), _jsx("button", { onClick: () => onConfirm(message.pending.token, "no"), className: "bg-ink-100 text-ink-700 text-xs font-medium px-3 py-1.5 rounded-md hover:bg-ink-200 transition", children: "Cancel" })] })] }))] }), isUser && _jsx(Avatar, { name: user?.full_name, size: "sm" })] }));
}
function TypingBubble() {
    return (_jsxs("div", { className: "flex items-end gap-2 justify-start", children: [_jsx("div", { className: "size-7 rounded-full bg-ai-gradient text-white grid place-items-center shrink-0 shadow-soft", children: _jsx(Bot, { size: 14 }) }), _jsx("div", { className: "rounded-2xl rounded-bl-sm bg-white ring-1 ring-ink-200 px-4 py-3 text-ink-500", children: _jsxs("div", { className: "flex items-center gap-1.5", children: [_jsx("span", { className: "typing-dot" }), _jsx("span", { className: "typing-dot" }), _jsx("span", { className: "typing-dot" })] }) })] }));
}
function personaGreeting(role) {
    const r = role.toLowerCase();
    if (r.includes("doctor"))
        return "Hi Doctor — ask me about your next patient, today's schedule, or any patient summary.";
    if (r.includes("patient"))
        return "Hi! I can help you book, reschedule, or check your insurance coverage.";
    if (r.includes("admin") || r.includes("auditor"))
        return "Hi — ask for utilization, no-show trends, or any operational metric.";
    return "Hi! Try a sample below, or ask me anything about appointments, patients, or insurance.";
}
