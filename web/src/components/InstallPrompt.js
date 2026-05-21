import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { Download, Share, X } from "lucide-react";
const DISMISS_KEY = "medme-install-dismissed";
function isIOS() {
    if (typeof window === "undefined")
        return false;
    const ua = window.navigator.userAgent;
    // iPad on iPadOS 13+ identifies as Mac with touch — treat as iOS.
    const isIPadOS = /Macintosh/.test(ua) && "ontouchend" in document;
    return /iPhone|iPad|iPod/i.test(ua) || isIPadOS;
}
function isStandalone() {
    if (typeof window === "undefined")
        return false;
    // Modern browsers expose this as a CSS media query; iOS also flags it as
    // navigator.standalone.
    return (window.matchMedia?.("(display-mode: standalone)").matches ||
        window.navigator.standalone === true);
}
export function InstallPrompt() {
    const [event, setEvent] = useState(null);
    const [show, setShow] = useState(false);
    const [showIosHint, setShowIosHint] = useState(false);
    useEffect(() => {
        // Already installed? Don't nag.
        if (isStandalone())
            return;
        // Recently dismissed? Respect that for 14 days.
        const dismissedAt = Number(localStorage.getItem(DISMISS_KEY) || 0);
        if (Date.now() - dismissedAt < 14 * 24 * 60 * 60 * 1000)
            return;
        if (isIOS()) {
            // iOS Safari doesn't fire beforeinstallprompt — show our own hint banner.
            // Wait a few seconds so the user can settle before we interrupt.
            const t = setTimeout(() => setShowIosHint(true), 2500);
            return () => clearTimeout(t);
        }
        function onBeforeInstall(e) {
            e.preventDefault();
            setEvent(e);
            setShow(true);
        }
        window.addEventListener("beforeinstallprompt", onBeforeInstall);
        return () => window.removeEventListener("beforeinstallprompt", onBeforeInstall);
    }, []);
    async function install() {
        if (!event)
            return;
        await event.prompt();
        const { outcome } = await event.userChoice;
        if (outcome === "accepted") {
            setShow(false);
        }
        else {
            dismiss();
        }
    }
    function dismiss() {
        localStorage.setItem(DISMISS_KEY, String(Date.now()));
        setShow(false);
        setShowIosHint(false);
    }
    // -------------------- Android / Desktop install button --------------------
    if (show) {
        return (_jsx("div", { className: "fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-96 z-50 animate-slide-up", children: _jsxs("div", { className: "bg-white rounded-2xl shadow-lift ring-1 ring-ink-200 overflow-hidden", children: [_jsxs("div", { className: "bg-brand-gradient text-white px-4 py-3 flex items-center justify-between", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Download, { size: 16 }), _jsx("span", { className: "font-semibold text-sm", children: "Install MedMeAI" })] }), _jsx("button", { onClick: dismiss, className: "text-white/80 hover:text-white", children: _jsx(X, { size: 16 }) })] }), _jsxs("div", { className: "p-4", children: [_jsx("p", { className: "text-sm text-ink-700", children: "Add MedMeAI to your home screen for a faster, full-screen experience and offline access to your data." }), _jsxs("div", { className: "mt-3 flex items-center gap-2", children: [_jsxs("button", { onClick: install, className: "bg-brand-gradient text-white text-sm font-medium rounded-lg px-4 py-2 shadow-soft inline-flex items-center gap-1.5", children: [_jsx(Download, { size: 14 }), " Install"] }), _jsx("button", { onClick: dismiss, className: "text-ink-500 hover:text-ink-800 text-sm px-3 py-2", children: "Not now" })] })] })] }) }));
    }
    // -------------------- iOS Safari hint --------------------
    if (showIosHint) {
        return (_jsx("div", { className: "fixed bottom-4 left-4 right-4 z-50 animate-slide-up", children: _jsxs("div", { className: "bg-white rounded-2xl shadow-lift ring-1 ring-ink-200 overflow-hidden", children: [_jsxs("div", { className: "bg-brand-gradient text-white px-4 py-3 flex items-center justify-between", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Share, { size: 16 }), _jsx("span", { className: "font-semibold text-sm", children: "Install MedMeAI" })] }), _jsx("button", { onClick: dismiss, className: "text-white/80 hover:text-white", children: _jsx(X, { size: 16 }) })] }), _jsxs("div", { className: "p-4", children: [_jsx("p", { className: "text-sm text-ink-700 mb-2", children: "To install MedMeAI on your iPhone:" }), _jsxs("ol", { className: "text-sm text-ink-600 space-y-1 list-decimal pl-5", children: [_jsxs("li", { children: ["Tap the", " ", _jsxs("span", { className: "inline-flex items-center gap-1 align-middle bg-ink-100 rounded px-1.5 py-0.5", children: [_jsx(Share, { size: 12 }), " Share"] }), " ", "button in Safari's toolbar"] }), _jsxs("li", { children: ["Scroll down and tap ", _jsx("span", { className: "font-medium", children: "\"Add to Home Screen\"" })] }), _jsxs("li", { children: ["Tap ", _jsx("span", { className: "font-medium", children: "Add" }), " in the top-right"] })] })] })] }) }));
    }
    return null;
}
