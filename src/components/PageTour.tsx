"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useTranslation } from "@/lib/i18n/I18nProvider";
import type { Locale } from "@/lib/i18n/types";
import type { TourConfig } from "@/lib/tours/types";

// fr is forward-compat — not in Locale type yet, cast to avoid excess-property error
const LANGUAGES: { code: Locale | string; native: string; abbr: string }[] = [
  { code: "en", native: "English", abbr: "EN" },
  { code: "el", native: "Ελληνικά", abbr: "EL" },
  { code: "he", native: "עברית", abbr: "HE" },
];

// Small static UI strings used by the tour shell — kept inline so we don't
// need to extend the main translation dictionary for every new tour.
type UIStrings = { step: string; next: string; back: string; skip: string; done: string; start: string; pickLang: string; };
// fr included for forward-compat; not in Locale type yet.
const UI = {
  en: { step: "Step", next: "Next", back: "Back", skip: "Skip", done: "Got it", start: "Start the tour", pickLang: "Pick your language" },
  el: { step: "Βήμα", next: "Επόμενο", back: "Πίσω", skip: "Παράλειψη", done: "Έτοιμο", start: "Ξεκίνημα ξενάγησης", pickLang: "Επιλέξτε γλώσσα" },
  he: { step: "שלב", next: "הבא", back: "חזור", skip: "דלג", done: "סיימתי", start: "התחל את הסיור", pickLang: "בחרו את השפה" },
} as unknown as Record<Locale, UIStrings>;

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const CARD_WIDTH = 380;
const CARD_HEIGHT_EST = 230;

export function PageTour({
  open,
  onClose,
  config,
}: {
  open: boolean;
  onClose: () => void;
  config: TourConfig;
}) {
  const { locale, setLocale } = useTranslation();
  const ui = UI[locale];

  const [step, setStep] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);

  // Refs used to coordinate between user-driven step changes (click/keyboard,
  // which should scroll the section into view) and scroll-driven step changes
  // (user manually scrolls — we only re-anchor the spotlight, never re-scroll).
  const stepRef = useRef(step);
  const skipScrollIntoViewRef = useRef(false);
  // When the user clicks Next/Back/keyboard we suppress scroll-sync for 1 s
  // so the smooth-scroll animation can't bounce us back to the previous step.
  const scrollSyncSuppressedUntilRef = useRef<number>(0);
  useEffect(() => {
    stepRef.current = step;
  }, [step]);

  // Reset to first step every time the tour opens.
  useEffect(() => {
    if (open) {
      setStep(0);
      skipScrollIntoViewRef.current = false;
    }
  }, [open]);

  // Track target rect & optionally scroll into view on step change.
  useEffect(() => {
    if (!open) return;
    const s = config.steps[step];
    const skip = skipScrollIntoViewRef.current;
    skipScrollIntoViewRef.current = false;

    if (!s.target) {
      setRect(null);
      if (!skip) window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    const el = document.querySelector(s.target);
    if (!el) {
      setRect(null);
      return;
    }
    if (!skip) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    const update = () => {
      const r = el.getBoundingClientRect();
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    };
    const initial = window.setTimeout(update, 80);
    const settled = window.setTimeout(update, 500);
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, { passive: true });
    return () => {
      window.clearTimeout(initial);
      window.clearTimeout(settled);
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update);
    };
  }, [step, open, config]);

  // Scroll-driven step sync — when the user scrolls the page, advance the
  // tour to whichever target section is closest to the upper-third of the
  // viewport. Welcome step (no target) is preserved until the user clicks
  // Start, so accidental scrolls don't dismiss it.
  //
  // Oscillation guard: after the user clicks Next/Back the current step's
  // target is set. We only sync to a different step if (a) the 2.5 s
  // post-click suppression window has expired AND (b) the current target is
  // no longer visible in the viewport. This prevents adjacent sections that
  // are simultaneously visible from bouncing the tour back.
  useEffect(() => {
    if (!open) return;
    let raf = 0;
    const handler = () => {
      // Don't sync while we're still on welcome.
      if (stepRef.current === 0 && !config.steps[0].target) return;
      // Don't sync for 2.5 s after a user-initiated Next/Back.
      if (Date.now() < scrollSyncSuppressedUntilRef.current) return;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const vh = window.innerHeight;

        // If the current step has no target (centered informational card),
        // don't sync — the user must click Next/Back to leave it.
        const currentStep = config.steps[stepRef.current];
        if (!currentStep.target) return;

        // If the current step's target is still visible, stay on it —
        // the user hasn't scrolled past it.
        const currentEl = document.querySelector(currentStep.target);
        if (currentEl) {
          const cr = currentEl.getBoundingClientRect();
          if (cr.bottom > 80 && cr.top < vh - 80) return;
        }

        const targetCenter = vh * 0.4;
        let bestIdx = -1;
        let bestDist = Infinity;
        config.steps.forEach((s, i) => {
          if (!s.target) return;
          const el = document.querySelector(s.target);
          if (!el) return;
          const r = el.getBoundingClientRect();
          if (r.bottom < 80 || r.top > vh - 80) return;
          const elCenter = r.top + r.height / 2;
          const dist = Math.abs(elCenter - targetCenter);
          if (dist < bestDist) {
            bestDist = dist;
            bestIdx = i;
          }
        });
        if (bestIdx >= 0 && bestIdx !== stepRef.current) {
          skipScrollIntoViewRef.current = true;
          setStep(bestIdx);
        }
      });
    };
    window.addEventListener("scroll", handler, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", handler);
    };
  }, [open, config]);

  const finish = useCallback(() => {
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(config.storageKey, "1");
      } catch {
        // ignore (private mode etc.)
      }
    }
    onClose();
  }, [onClose, config.storageKey]);

  const goNext = useCallback(() => {
    scrollSyncSuppressedUntilRef.current = Date.now() + 2500;
    setStep((s) => Math.min(config.steps.length - 1, s + 1));
  }, [config.steps.length]);

  const goBack = useCallback(() => {
    scrollSyncSuppressedUntilRef.current = Date.now() + 2500;
    setStep((s) => Math.max(0, s - 1));
  }, []);

  // Keyboard nav
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        finish();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        scrollSyncSuppressedUntilRef.current = Date.now() + 2500;
        goNext();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        scrollSyncSuppressedUntilRef.current = Date.now() + 2500;
        goBack();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, finish, goNext, goBack]);

  if (!open) return null;

  const current = config.steps[step];
  const isFirst = step === 0;
  const isLast = step === config.steps.length - 1;
  const isWelcome = !current.target;

  // Tooltip placement next to spotlight — clamped to viewport so even tall
  // sections (where rect may extend below the viewport) keep the card visible.
  let tooltipStyle: React.CSSProperties = {};
  if (rect && current.target && typeof window !== "undefined") {
    const vh = window.innerHeight;
    const vw = window.innerWidth;
    const visibleTop = Math.max(0, rect.top);
    const visibleBottom = Math.min(vh, rect.top + rect.height);
    const spaceAbove = visibleTop;
    const spaceBelow = vh - visibleBottom;
    const placeBelow =
      spaceBelow >= CARD_HEIGHT_EST + 24 || spaceBelow >= spaceAbove;
    let top = placeBelow ? visibleBottom + 16 : visibleTop - CARD_HEIGHT_EST - 16;
    top = Math.max(16, Math.min(top, vh - CARD_HEIGHT_EST - 16));
    let left = rect.left + rect.width / 2 - CARD_WIDTH / 2;
    left = Math.max(16, Math.min(left, vw - CARD_WIDTH - 16));
    tooltipStyle = { top, left, width: CARD_WIDTH };
  }

  return (
    <div
      className="fixed inset-0 z-[100]"
      role="dialog"
      aria-modal="true"
      aria-label="Page tour"
      style={{ pointerEvents: "none" }}
    >
      {isWelcome && (
        <div
          className="absolute inset-0 tour-backdrop backdrop-blur-sm"
          style={{ pointerEvents: "auto" }}
          onClick={finish}
        />
      )}

      {!isWelcome && rect && (
        <div
          className="absolute tour-spotlight"
          style={{
            top: rect.top - 8,
            left: rect.left - 8,
            width: rect.width + 16,
            height: rect.height + 16,
          }}
        />
      )}

      <div
        className={`absolute bg-white rounded-2xl border border-brand-200 shadow-2xl p-6 ${
          isWelcome ? "tour-welcome-in" : "tour-card-in"
        }`}
        style={
          isWelcome
            ? {
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
                width: "min(460px, calc(100vw - 32px))",
                pointerEvents: "auto",
              }
            : { ...tooltipStyle, pointerEvents: "auto" }
        }
      >
        <div className="flex items-center justify-between mb-3">
          <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-text-tertiary">
            {ui.step} {step + 1} / {config.steps.length}
          </span>
          <button
            onClick={finish}
            aria-label="Close tour"
            className="w-6 h-6 inline-flex items-center justify-center rounded-full text-text-tertiary hover:text-text-primary hover:bg-surface-secondary transition-colors text-sm"
          >
            ×
          </button>
        </div>

        <h3 className="font-display text-xl text-text-primary mb-2">
          {current.title[locale]}
        </h3>
        <p className="text-sm text-text-secondary leading-relaxed mb-4">
          {current.body[locale]}
        </p>

        {isWelcome && config.showLanguagePicker && (
          <div className="mb-5 pt-4 border-t border-surface-tertiary/60">
            <div className="text-[10px] font-medium uppercase tracking-[0.12em] text-text-tertiary mb-2">
              {ui.pickLang}
            </div>
            <div className="grid grid-cols-2 gap-2">
              {LANGUAGES.map((lang) => {
                const isActive = locale === lang.code;
                return (
                  <button
                    key={lang.code}
                    onClick={() => setLocale(lang.code as Locale)}
                    className={`flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-sm transition-all ${
                      isActive
                        ? "bg-brand-500 text-white border border-brand-500 shadow-sm"
                        : "bg-white text-text-secondary border border-surface-tertiary hover:border-brand-300 hover:bg-surface-secondary"
                    }`}
                    aria-pressed={isActive}
                  >
                    <span className="font-display">{lang.native}</span>
                    <span
                      className={`font-mono text-[10px] ${isActive ? "text-white/80" : "text-text-tertiary"}`}
                    >
                      {lang.abbr}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex items-center gap-1.5 mb-4">
          {config.steps.map((_, i) => (
            <span
              key={i}
              className={`h-1 rounded-full transition-all duration-300 ease-out ${
                i === step
                  ? "w-8 bg-brand-500"
                  : i < step
                    ? "w-2 bg-brand-300"
                    : "w-2 bg-surface-tertiary"
              }`}
            />
          ))}
        </div>

        <div className="flex items-center justify-between">
          <button
            onClick={finish}
            className="text-xs text-text-tertiary hover:text-text-primary transition-colors"
          >
            {ui.skip}
          </button>
          <div className="flex items-center gap-2">
            {!isFirst && (
              <button
                onClick={goBack}
                className="px-3 py-1.5 text-xs rounded-lg border border-surface-tertiary text-text-secondary hover:bg-surface-secondary transition-colors"
              >
                {ui.back}
              </button>
            )}
            {isLast ? (
              <button
                onClick={finish}
                className="px-4 py-1.5 text-xs font-medium rounded-lg bg-brand-500 text-white hover:bg-brand-600 transition-colors"
              >
                {ui.done}
              </button>
            ) : (
              <button
                onClick={goNext}
                className="px-4 py-1.5 text-xs font-medium rounded-lg bg-brand-500 text-white hover:bg-brand-600 transition-colors"
              >
                {isWelcome ? ui.start : ui.next}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Tour trigger button + auto-open hook ────────────────────

export function TourButton({
  onClick,
  pulsing,
}: {
  onClick: () => void;
  pulsing?: boolean;
}) {
  const { locale } = useTranslation();
  const labels = {
    en: "Take the tour",
    el: "Ξενάγηση",
    he: "התחל סיור",
  } as Record<string, string>;
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium uppercase tracking-wider rounded-lg border border-brand-200 bg-brand-50 text-brand-600 hover:bg-brand-100 hover:border-brand-300 transition-colors ${
        pulsing ? "tour-trigger-pulse" : ""
      }`}
      aria-label="Take page tour"
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 16 16"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="8" cy="5" r="0.85" fill="currentColor" />
        <path d="M8 7.5v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
      {labels[locale]}
    </button>
  );
}

/**
 * Hook: tracks "never seen" state for the tour pulse hint, but does NOT
 * auto-open the modal. Tours are opt-in — users invoke them via the
 * "Take the tour" button. Auto-popups are condescending for the credit-
 * committee audience this app targets.
 *
 * Returns `[open, setOpen, neverSeen]`. `neverSeen` is null until the
 * localStorage flag is read on mount, then `true` if not yet seen, `false`
 * otherwise. Use that to drive the pulsing trigger button.
 */
export function usePageTour(storageKey: string): [
  boolean,
  (next: boolean) => void,
  boolean | null,
] {
  const [open, setOpen] = useState(false);
  const [neverSeen, setNeverSeen] = useState<boolean | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    let seen = false;
    try {
      seen = localStorage.getItem(storageKey) === "1";
    } catch {
      seen = true;
    }
    setNeverSeen(!seen);
  }, [storageKey]);

  return [open, setOpen, neverSeen];
}
