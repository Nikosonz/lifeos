"use client";

import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { useTranslations } from "next-intl";
import { X } from "lucide-react";
import { cn } from "@/components/utils";

// Ported from the pouyakarimi.ir portfolio site's OnboardingTour — same
// zero-dependency, localStorage-gated, first-visit spotlight tour (dimming
// overlay + a cutout over the real control via a giant box-shadow, plus a
// viewport-clamped tooltip card). Adapted to LifeOS's actual UI: targets
// the sidebar Nav, the per-page help button, and the logout button instead
// of the portfolio's language/theme/hire controls, and reads colors from
// this app's own Tailwind tokens (bg-primary/bg-card/border-border/etc.)
// instead of the portfolio's separate --accent/--surface CSS-variable set.
const STORAGE_KEY = "lifeos:onboarding-tour-seen";
const CARD_W = 300;
const CARD_EST_H = 190; // rough estimate, used only for viewport clamping
const PAD = 6; // spotlight padding around the target element

type Step = { target: string | null; titleKey: string; bodyKey: string };

const STEPS: Step[] = [
  { target: null, titleKey: "welcomeTitle", bodyKey: "welcomeBody" },
  { target: '[data-tour="nav"]', titleKey: "navTitle", bodyKey: "navBody" },
  { target: '[data-tour="page-help"]', titleKey: "helpTitle", bodyKey: "helpBody" },
  { target: '[data-tour="logout"]', titleKey: "logoutTitle", bodyKey: "logoutBody" },
];

export function OnboardingTour() {
  const t = useTranslations("Onboarding");
  const [active, setActive] = useState(false);
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);

  // First visit only — start shortly after load, giving the authenticated
  // shell (nav/page content) time to actually render before we try to
  // measure its elements.
  useEffect(() => {
    if (window.localStorage.getItem(STORAGE_KEY)) return;
    const timer = setTimeout(() => setActive(true), 1500);
    return () => clearTimeout(timer);
  }, []);

  const finish = useCallback(() => {
    setActive(false);
    window.localStorage.setItem(STORAGE_KEY, "1");
  }, []);

  const next = useCallback(() => setStep((s) => Math.min(STEPS.length - 1, s + 1)), []);
  const back = useCallback(() => setStep((s) => Math.max(0, s - 1)), []);

  // Measure the current target; treat hidden (zero-size — e.g. the
  // desktop-only sidebar on a mobile viewport) targets as "no target".
  const measure = useCallback(() => {
    const sel = STEPS[step]!.target;
    if (!sel) {
      setRect(null);
      return;
    }
    const el = document.querySelector(sel);
    const r = el?.getBoundingClientRect();
    setRect(r && r.width > 0 && r.height > 0 ? r : null);
  }, [step]);

  useEffect(() => {
    if (!active) return;
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, { passive: true });
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure);
    };
  }, [active, measure]);

  useEffect(() => {
    if (!active) return;
    const isLast = step === STEPS.length - 1;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish();
      else if (e.key === "ArrowRight") (isLast ? finish : next)();
      else if (e.key === "ArrowLeft") back();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [active, step, finish, next, back]);

  if (!active) return null;

  const isLast = step === STEPS.length - 1;
  const current = STEPS[step]!;

  // Tooltip position: below the target (above if it would overflow),
  // centered on the target and clamped to the viewport. Centered on the
  // screen when there's no target (the welcome step). The vertical clamp
  // matters for tall targets (the sidebar Nav spans nearly the full
  // viewport height) — without it, "place above" still anchors to
  // rect.top (near the very top of the page) and the translateY(-100%)
  // card renders almost entirely off-screen above the viewport.
  let cardStyle: CSSProperties;
  if (rect) {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const placeAbove = rect.bottom + 200 > vh;
    const left = Math.min(Math.max(rect.left + rect.width / 2 - CARD_W / 2, 12), vw - CARD_W - 12);
    const top = placeAbove
      ? Math.max(rect.top - 12, CARD_EST_H + 12)
      : Math.min(rect.bottom + 12, vh - CARD_EST_H - 12);
    cardStyle = placeAbove ? { top, left, transform: "translateY(-100%)" } : { top, left };
  } else {
    cardStyle = { top: "50%", left: "50%", transform: "translate(-50%, -50%)" };
  }

  return (
    <div
      className="fixed inset-0 z-100"
      role="dialog"
      aria-modal="true"
      aria-label={t("welcomeTitle")}
    >
      {rect ? (
        <div
          onClick={finish}
          className="absolute rounded-xl motion-safe:transition-all motion-safe:duration-300"
          style={{
            top: rect.top - PAD,
            left: rect.left - PAD,
            width: rect.width + PAD * 2,
            height: rect.height + PAD * 2,
            boxShadow: "0 0 0 9999px rgba(0,0,0,0.6)",
            outline: "2px solid var(--primary)",
            outlineOffset: "2px",
          }}
        />
      ) : (
        <div onClick={finish} className="absolute inset-0 bg-black/60" />
      )}

      <div
        className="bg-card border-border fixed w-[300px] max-w-[calc(100vw-24px)] rounded-2xl border p-5 shadow-xl motion-safe:animate-[slide-up_0.25s_ease-out]"
        style={cardStyle}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={finish}
          aria-label={t("skip")}
          className="text-muted-foreground hover:bg-accent hover:text-accent-foreground absolute top-3 end-3 flex size-6 items-center justify-center rounded-full transition-colors"
        >
          <X size={14} />
        </button>

        <h3 className="mb-1 text-base font-bold">{t(current.titleKey)}</h3>
        <p className="text-muted-foreground mb-4 text-sm leading-relaxed">{t(current.bodyKey)}</p>

        <div className="flex items-center justify-between">
          <div className="flex gap-1.5">
            {STEPS.map((s, i) => (
              <span
                key={s.titleKey}
                className={cn(
                  "h-1.5 rounded-full transition-all",
                  i === step ? "bg-primary w-4" : "bg-border w-1.5",
                )}
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            {step > 0 && (
              <button
                type="button"
                onClick={back}
                className="text-muted-foreground hover:text-foreground rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
              >
                {t("back")}
              </button>
            )}
            <button
              type="button"
              onClick={isLast ? finish : next}
              className="bg-primary text-primary-foreground rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-colors hover:opacity-90"
            >
              {step === 0 ? t("start") : isLast ? t("finish") : t("next")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
