import { ReactNode, useEffect } from "react";
import { CheckCircle2, Filter, RotateCcw, X } from "lucide-react";
import clsx from "clsx";

/**
 * Responsive filter container.
 *
 * - On `lg` (desktop) screens: renders as an inline sticky sidebar, always visible.
 * - On smaller screens: renders as a bottom-sheet overlay with backdrop + Done
 *   button. The page content stays visible underneath when closed.
 *
 * The `open` state is irrelevant on lg — the panel is always there. On mobile,
 * it slides up from the bottom when `open` is true.
 */
export function FilterDrawer({
  open,
  onClose,
  onReset,
  activeFilterCount,
  children,
}: {
  open: boolean;
  onClose: () => void;
  onReset?: () => void;
  activeFilterCount: number;
  children: ReactNode;
}) {
  // Lock body scroll while the mobile sheet is open
  useEffect(() => {
    if (!open) return;
    const isLg = window.matchMedia("(min-width: 1024px)").matches;
    if (isLg) return; // desktop: nothing to lock
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, [open]);

  return (
    <>
      {/* ============= Desktop sidebar (always visible at lg+) ============= */}
      <aside className="hidden lg:block">
        <div className="rounded-2xl bg-white shadow-card ring-1 ring-ink-200/60 overflow-hidden lg:sticky lg:top-20">
          <div className="px-4 py-3 border-b border-ink-100 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold text-ink-800">
              <Filter size={14} /> Filters
              {activeFilterCount > 0 && (
                <span className="bg-brand-100 text-brand-700 text-[10px] rounded-full px-1.5 py-0.5 font-semibold">
                  {activeFilterCount}
                </span>
              )}
            </div>
            {activeFilterCount > 0 && onReset && (
              <button
                onClick={onReset}
                className="text-xs text-ink-500 hover:text-ink-800 inline-flex items-center gap-1"
              >
                <RotateCcw size={11} /> Clear
              </button>
            )}
          </div>
          <div className="p-4 space-y-5 max-h-[calc(100vh-12rem)] overflow-y-auto scrollbar-thin">
            {children}
          </div>
        </div>
      </aside>

      {/* ============= Mobile bottom-sheet (only on < lg, only when open) ============= */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          {/* Backdrop */}
          <button
            type="button"
            aria-label="Close filters"
            onClick={onClose}
            className="absolute inset-0 bg-ink-900/40 backdrop-blur-sm animate-fade-in"
          />
          {/* Sheet */}
          <div
            className={clsx(
              "absolute left-0 right-0 bottom-0 bg-white rounded-t-2xl shadow-lift",
              "flex flex-col max-h-[90vh] animate-slide-up",
            )}
            style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
          >
            {/* Drag handle */}
            <div className="pt-2 flex justify-center">
              <div className="w-10 h-1.5 rounded-full bg-ink-200" />
            </div>
            {/* Header */}
            <div className="px-4 py-3 border-b border-ink-100 flex items-center justify-between">
              <div className="flex items-center gap-2 text-base font-semibold text-ink-800">
                <Filter size={16} /> Filters
                {activeFilterCount > 0 && (
                  <span className="bg-brand-100 text-brand-700 text-[10px] rounded-full px-1.5 py-0.5 font-semibold">
                    {activeFilterCount}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3">
                {activeFilterCount > 0 && onReset && (
                  <button
                    onClick={onReset}
                    className="text-xs text-ink-500 hover:text-ink-800 inline-flex items-center gap-1"
                  >
                    <RotateCcw size={11} /> Clear
                  </button>
                )}
                <button onClick={onClose} className="text-ink-400 hover:text-ink-700">
                  <X size={20} />
                </button>
              </div>
            </div>
            {/* Body */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5 scrollbar-thin">
              {children}
            </div>
            {/* Footer */}
            <div className="border-t border-ink-100 p-3">
              <button
                onClick={onClose}
                className="w-full inline-flex items-center justify-center gap-1.5 bg-brand-gradient text-white text-sm font-medium rounded-lg px-4 py-3 shadow-soft"
              >
                <CheckCircle2 size={16} /> Show results
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
