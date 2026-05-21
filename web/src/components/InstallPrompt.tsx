import { useEffect, useState } from "react";
import { Download, Share, X } from "lucide-react";

import { isNative } from "../core/native";

const DISMISS_KEY = "medme-install-dismissed";

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

function isIOS(): boolean {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent;
  // iPad on iPadOS 13+ identifies as Mac with touch — treat as iOS.
  const isIPadOS = /Macintosh/.test(ua) && "ontouchend" in document;
  return /iPhone|iPad|iPod/i.test(ua) || isIPadOS;
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  // Modern browsers expose this as a CSS media query; iOS also flags it as
  // navigator.standalone.
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (window.navigator as any).standalone === true
  );
}

export function InstallPrompt() {
  const [event, setEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [show, setShow] = useState(false);
  const [showIosHint, setShowIosHint] = useState(false);

  useEffect(() => {
    // Already running in the native Capacitor shell? Definitely don't nag.
    if (isNative) return;
    // Already installed as a PWA? Don't nag.
    if (isStandalone()) return;
    // Recently dismissed? Respect that for 14 days.
    const dismissedAt = Number(localStorage.getItem(DISMISS_KEY) || 0);
    if (Date.now() - dismissedAt < 14 * 24 * 60 * 60 * 1000) return;

    if (isIOS()) {
      // iOS Safari doesn't fire beforeinstallprompt — show our own hint banner.
      // Wait a few seconds so the user can settle before we interrupt.
      const t = setTimeout(() => setShowIosHint(true), 2500);
      return () => clearTimeout(t);
    }

    function onBeforeInstall(e: Event) {
      e.preventDefault();
      setEvent(e as BeforeInstallPromptEvent);
      setShow(true);
    }
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstall);
  }, []);

  async function install() {
    if (!event) return;
    await event.prompt();
    const { outcome } = await event.userChoice;
    if (outcome === "accepted") {
      setShow(false);
    } else {
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
    return (
      <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-96 z-50 animate-slide-up">
        <div className="bg-white rounded-2xl shadow-lift ring-1 ring-ink-200 overflow-hidden">
          <div className="bg-brand-gradient text-white px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Download size={16} />
              <span className="font-semibold text-sm">Install MedMeAI</span>
            </div>
            <button onClick={dismiss} className="text-white/80 hover:text-white">
              <X size={16} />
            </button>
          </div>
          <div className="p-4">
            <p className="text-sm text-ink-700">
              Add MedMeAI to your home screen for a faster, full-screen experience and
              offline access to your data.
            </p>
            <div className="mt-3 flex items-center gap-2">
              <button
                onClick={install}
                className="bg-brand-gradient text-white text-sm font-medium rounded-lg px-4 py-2 shadow-soft inline-flex items-center gap-1.5"
              >
                <Download size={14} /> Install
              </button>
              <button
                onClick={dismiss}
                className="text-ink-500 hover:text-ink-800 text-sm px-3 py-2"
              >
                Not now
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // -------------------- iOS Safari hint --------------------
  if (showIosHint) {
    return (
      <div className="fixed bottom-4 left-4 right-4 z-50 animate-slide-up">
        <div className="bg-white rounded-2xl shadow-lift ring-1 ring-ink-200 overflow-hidden">
          <div className="bg-brand-gradient text-white px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Share size={16} />
              <span className="font-semibold text-sm">Install MedMeAI</span>
            </div>
            <button onClick={dismiss} className="text-white/80 hover:text-white">
              <X size={16} />
            </button>
          </div>
          <div className="p-4">
            <p className="text-sm text-ink-700 mb-2">
              To install MedMeAI on your iPhone:
            </p>
            <ol className="text-sm text-ink-600 space-y-1 list-decimal pl-5">
              <li>
                Tap the{" "}
                <span className="inline-flex items-center gap-1 align-middle bg-ink-100 rounded px-1.5 py-0.5">
                  <Share size={12} /> Share
                </span>{" "}
                button in Safari's toolbar
              </li>
              <li>
                Scroll down and tap <span className="font-medium">"Add to Home Screen"</span>
              </li>
              <li>Tap <span className="font-medium">Add</span> in the top-right</li>
            </ol>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
