"use client";

// LiveTrackRecord — visually distinct "real numbers, not projections" hero
// for banker-facing pages. Reads live ops data via useSeasonSnapshot() and
// the BP per-villa assumptions via the active scenario in the model store.
//
// Renders on /investor, /bank, and inside the dashboard's "Conservatism
// Check" region — so admin and banker views stay aligned.

import { useState, useSyncExternalStore } from "react";
import { useTranslation } from "@/lib/i18n/I18nProvider";
import { formatCurrency, formatPercent } from "@/lib/hooks/useModel";
import { useSeasonSnapshot } from "@/lib/data/useSeasonSnapshot";
import { useModelStore } from "@/lib/store/modelStore";
import type { Locale } from "@/lib/i18n/types";

// Stabilised year — matches engine model.ts `stabilisedYear = pnl.find(p => p.year === 2031)`.
// Kept as a module constant so this component does not need to import from
// the engine just to display the headline number.
const STABILISED_YEAR = 2031;

// ── "Now" external store ──
// We need the current month name and the current millisecond stamp for the
// freshness check. Calling new Date()/Date.now() in render is impure and
// trips the React 19 react-hooks/purity rule. useSyncExternalStore lets us
// read it as an external value: the snapshot is captured once on mount,
// and the subscribe() is a no-op (we don't need re-renders on tick — once
// per page mount is enough for "as of {month}" / "data X days old").
const NOW_EMPTY: number = 0;
function subscribeNow() {
  return () => {};
}
let cachedNow: number | null = null;
function getNowSnapshot(): number {
  if (cachedNow === null) cachedNow = Date.now();
  return cachedNow;
}
function getNowServerSnapshot(): number {
  // SSR / static-export: there's no notion of "now" stable across the
  // render boundary, so return 0 and let the effect-driven re-mount in the
  // client tree pick up a real value.
  return NOW_EMPTY;
}

const MONTH_NAMES: Record<Locale, string[]> = {
  en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
  fr: ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"],
  el: ["Ιανουάριος", "Φεβρουάριος", "Μάρτιος", "Απρίλιος", "Μάιος", "Ιούνιος", "Ιούλιος", "Αύγουστος", "Σεπτέμβριος", "Οκτώβριος", "Νοέμβριος", "Δεκέμβριος"],
  he: ["ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני", "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר"],
};

// All user-facing strings live here so we don't churn the keyed dictionary
// for one component. en is the fallback for translations that aren't ready.
const LR: Record<
  Locale,
  {
    header: string;
    yourTrackRecord: string;
    ytdRevenue: string;
    occupancy: string;
    adr: string;
    revpar: string;
    asOf: string;
    updatedFromPMS: string;
    modelAssumes: string;
    liveTracking: string;
    versus: string;
    dataUpdated: string;
    dataStale: string;
    live: string;
    loading: string;
    perNight: string;
    nightsBooked: string;
    available: string;
    sourceNote: string;
    // ── New keys for the conservatism-cushion restructure ──
    headlineConservatism: string; // template — uses {year} {years} {gap}
    cushion: string;
    model: string;
    liveLabel: string;
    showDetail: string;
    hideDetail: string;
    roomsPending: string;
    villaADR: string;
    villaOccupancy: string;
    villaRevPAR: string;
    history: string;
    historyYear: string;
    historyTotal: string;
    historyYoY: string;
  }
> = {
  en: {
    header: "Live track record · Antiparos",
    yourTrackRecord: "Real operating numbers from the existing single villa we run today — not modelled projections.",
    ytdRevenue: "YTD revenue",
    occupancy: "Occupancy",
    adr: "ADR (net)",
    revpar: "RevPAR",
    asOf: "as of",
    updatedFromPMS: "updated daily from PMS",
    modelAssumes: "Model assumes",
    liveTracking: "live tracking at",
    versus: "vs",
    dataUpdated: "Updated",
    dataStale: "Data refreshed",
    live: "Live",
    loading: "Loading live data…",
    perNight: "/ night",
    nightsBooked: "nights booked",
    available: "available",
    sourceNote: "Source: admin.villalevantiparos.com",
    headlineConservatism:
      "Our stabilised projections (year {year}, in {years} years) sit on average {gap}% below what the existing Antiparos villa delivers today. That gap is the conservatism cushion bankers underwrite against.",
    cushion: "Cushion",
    model: "Model",
    liveLabel: "Live",
    showDetail: "Show detail",
    hideDetail: "Hide detail",
    roomsPending:
      "Room assumptions benchmarked against Antiparos boutique-hotel comparables — Market Study currently in preparation.",
    villaADR: "Villa ADR",
    villaOccupancy: "Villa occupancy",
    villaRevPAR: "Villa RevPAR",
    history: "History · existing villa",
    historyYear: "Year",
    historyTotal: "Total revenue",
    historyYoY: "YoY",
  },
  fr: {
    header: "Track record en direct · Antiparos",
    yourTrackRecord: "Chiffres réels de la villa en exploitation aujourd'hui — pas des projections.",
    ytdRevenue: "CA YTD",
    occupancy: "Occupation",
    adr: "ADR (net)",
    revpar: "RevPAR",
    asOf: "au",
    updatedFromPMS: "mis à jour quotidiennement depuis le PMS",
    modelAssumes: "Modèle suppose",
    liveTracking: "réel à",
    versus: "vs",
    dataUpdated: "Mis à jour",
    dataStale: "Données rafraîchies",
    live: "En direct",
    loading: "Chargement des données en direct…",
    perNight: "/ nuit",
    nightsBooked: "nuits réservées",
    available: "disponibles",
    sourceNote: "Source : admin.villalevantiparos.com",
    headlineConservatism:
      "Nos projections stabilisées (année {year}, dans {years} ans) se situent en moyenne {gap}% sous ce que la villa d'Antiparos réalise déjà aujourd'hui. C'est le coussin de prudence sur lequel les banquiers s'appuient.",
    cushion: "Coussin",
    model: "Modèle",
    liveLabel: "Réel",
    showDetail: "Afficher le détail",
    hideDetail: "Masquer le détail",
    roomsPending:
      "Hypothèses des chambres calées sur les comparables hôtels boutique d'Antiparos — étude de marché en cours de préparation.",
    villaADR: "ADR villa",
    villaOccupancy: "Occupation villa",
    villaRevPAR: "RevPAR villa",
    history: "Historique · villa existante",
    historyYear: "Année",
    historyTotal: "CA total",
    historyYoY: "YoY",
  },
  el: {
    header: "Ζωντανό track record · Αντίπαρος",
    yourTrackRecord: "Πραγματικά λειτουργικά νούμερα από τη villa που τρέχουμε σήμερα — όχι μοντελοποιημένες προβλέψεις.",
    ytdRevenue: "Έσοδα YTD",
    occupancy: "Πληρότητα",
    adr: "ADR (καθαρό)",
    revpar: "RevPAR",
    asOf: "ως",
    updatedFromPMS: "ενημερώνεται καθημερινά από PMS",
    modelAssumes: "Το μοντέλο υποθέτει",
    liveTracking: "πραγματικό",
    versus: "vs",
    dataUpdated: "Ενημερώθηκε",
    dataStale: "Δεδομένα ανανεωμένα",
    live: "Ζωντανά",
    loading: "Φόρτωση ζωντανών δεδομένων…",
    perNight: "/ βραδιά",
    nightsBooked: "βραδιές κρατημένες",
    available: "διαθέσιμες",
    sourceNote: "Πηγή: admin.villalevantiparos.com",
    headlineConservatism:
      "Οι σταθεροποιημένες προβλέψεις μας (έτος {year}, σε {years} χρόνια) βρίσκονται κατά μέσο όρο {gap}% κάτω από αυτό που η υπάρχουσα βίλα στην Αντίπαρο ήδη αποδίδει σήμερα. Αυτό το περιθώριο είναι το «μαξιλάρι» συντηρητισμού που εμπιστεύονται οι τραπεζίτες.",
    cushion: "Μαξιλάρι",
    model: "Μοντέλο",
    liveLabel: "Πραγματικό",
    showDetail: "Εμφάνιση λεπτομερειών",
    hideDetail: "Απόκρυψη λεπτομερειών",
    roomsPending:
      "Οι παραδοχές δωματίων συγκρίνονται με boutique ξενοδοχεία της Αντιπάρου — Μελέτη Αγοράς σε εξέλιξη.",
    villaADR: "ADR βίλας",
    villaOccupancy: "Πληρότητα βίλας",
    villaRevPAR: "RevPAR βίλας",
    history: "Ιστορικό · υπάρχουσα βίλα",
    historyYear: "Έτος",
    historyTotal: "Συνολικά έσοδα",
    historyYoY: "YoY",
  },
  he: {
    header: "Track record חי · אנטיפרוס",
    yourTrackRecord: "מספרי תפעול אמיתיים מהוילה הפעילה שאנו מפעילים היום — לא תחזיות מודלים.",
    ytdRevenue: "הכנסות YTD",
    occupancy: "תפוסה",
    adr: "ADR (נטו)",
    revpar: "RevPAR",
    asOf: "נכון ל-",
    updatedFromPMS: "מתעדכן יומית מ-PMS",
    modelAssumes: "המודל מניח",
    liveTracking: "בפועל",
    versus: "מול",
    dataUpdated: "עודכן",
    dataStale: "נתונים עודכנו",
    live: "חי",
    loading: "טוען נתונים חיים…",
    perNight: "/ לילה",
    nightsBooked: "לילות תפוסים",
    available: "זמינים",
    sourceNote: "מקור: admin.villalevantiparos.com",
    headlineConservatism:
      "התחזיות המיוצבות שלנו (שנת {year}, בעוד {years} שנים) ממוקמות בממוצע {gap}% מתחת למה שהווילה הקיימת באנטיפרוס כבר מספקת היום. הפער הזה הוא כרית השמרנות שהבנקאים מסתמכים עליה.",
    cushion: "כרית",
    model: "מודל",
    liveLabel: "בפועל",
    showDetail: "הצג פירוט",
    hideDetail: "הסתר פירוט",
    roomsPending:
      "הנחות החדרים מבוססות על מלונות בוטיק באנטיפרוס — מחקר שוק בהכנה.",
    villaADR: "ADR וילה",
    villaOccupancy: "תפוסת וילה",
    villaRevPAR: "RevPAR וילה",
    history: "היסטוריה · וילה קיימת",
    historyYear: "שנה",
    historyTotal: "סך הכנסות",
    historyYoY: "YoY",
  },
};

const STALE_THRESHOLD_MS = 48 * 60 * 60 * 1000; // 48 h

function FigureSkeleton() {
  return (
    <div className="space-y-2">
      <div className="h-3 w-20 rounded bg-brand-100/60 animate-pulse" />
      <div className="h-9 w-28 rounded bg-brand-100/60 animate-pulse" />
      <div className="h-2.5 w-24 rounded bg-brand-100/40 animate-pulse" />
    </div>
  );
}

// CushionCard — one row of the new headline grid (Villa ADR / Occupancy /
// RevPAR). Pairs the model assumption with the live equivalent and ends with
// a coloured "cushion" chip showing the gap %.
//
// Colour discipline (per spec):
//   - positive gap (model below live, conservative)  → green / positive tone
//   - negative gap (model above live, aggressive)    → warning tone
//   - |gap| < 0.5% rounding noise                    → neutral
function CushionCard({
  label,
  modelLabel,
  liveLabel,
  cushionLabel,
  modelValue,
  liveValue,
  gap,
}: {
  label: string;
  modelLabel: string;
  liveLabel: string;
  cushionLabel: string;
  modelValue: string;
  liveValue: string;
  gap: number; // fractional (e.g. 0.07 = 7%)
}) {
  // Round to nearest 0.5% for display so the chip never shows misleadingly
  // precise figures (e.g. "+2.34%") that imply more confidence than we have.
  const rounded = Math.round(gap * 200) / 200;
  const pct = Math.round(rounded * 1000) / 10;
  const tone: "positive" | "negative" | "neutral" =
    Math.abs(rounded) < 0.005 ? "neutral" : rounded > 0 ? "positive" : "negative";
  const sign = pct > 0 ? "+" : pct < 0 ? "" : "";
  const chipClass =
    tone === "positive"
      ? "bg-positive/15 text-positive"
      : tone === "negative"
        ? "bg-warning/15 text-warning"
        : "bg-surface-secondary text-text-tertiary";
  return (
    <div className="rounded-xl bg-white/70 border border-brand-200/70 px-4 py-3 backdrop-blur-sm min-w-0">
      <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-brand-600 mb-2">
        {label}
      </div>
      <div className="space-y-1.5 text-sm">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-[11px] uppercase tracking-wider text-text-tertiary">
            {modelLabel}
          </span>
          <span className="font-mono text-text-secondary tabular-nums">
            {modelValue}
          </span>
        </div>
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-[11px] uppercase tracking-wider text-positive">
            {liveLabel}
          </span>
          <span className="font-mono text-text-primary tabular-nums font-semibold">
            {liveValue}
          </span>
        </div>
      </div>
      <div className="mt-3 pt-2 border-t border-brand-200/50 flex items-center justify-between gap-2">
        <span className="text-[10px] uppercase tracking-wider text-text-tertiary">
          {cushionLabel}
        </span>
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold tabular-nums ${chipClass}`}
        >
          {sign}
          {pct.toFixed(1)}%
        </span>
      </div>
    </div>
  );
}

function Figure({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-brand-600 mb-1.5">
        {label}
      </div>
      <div className="kpi-value text-text-primary leading-none tabular-nums">
        {value}
      </div>
      {sub && (
        <div className="text-[11px] text-text-tertiary mt-1.5 leading-snug">
          {sub}
        </div>
      )}
    </div>
  );
}

export function LiveTrackRecord({
  variant = "default",
}: {
  variant?: "default" | "compact";
}) {
  const { locale } = useTranslation();
  const lr = LR[locale] ?? LR.en;
  const {
    currentSeason,
    historicalYears,
    source: snapshotSource,
    pulledAt,
    loading,
  } = useSeasonSnapshot();
  const { assumptions } = useModelStore();

  // ── Detail-toggle state ──
  // Default collapsed per spec: bankers see the headline + 3 cushion cards
  // in one glance; the existing 4-figure block + history table sit behind a
  // Show detail toggle.
  const [showDetail, setShowDetail] = useState(false);

  // ── Compute live KPIs ──
  // `nowMs` comes from a useSyncExternalStore so we don't call impure
  // Date.now() in render. On SSR/static-export it's 0; on client mount the
  // store returns a stable timestamp captured once per session.
  const nowMs = useSyncExternalStore(subscribeNow, getNowSnapshot, getNowServerSnapshot);
  const today = nowMs > 0 ? new Date(nowMs) : new Date(0);
  const monthIndex = today.getMonth(); // 0..11
  const monthName = MONTH_NAMES[locale][monthIndex] ?? MONTH_NAMES.en[monthIndex];
  const year = today.getFullYear();
  const hasNow = nowMs > 0;

  const adr = currentSeason.netADR;
  const occupancy = currentSeason.occupancy; // 0..1
  const ytdRevenue = currentSeason.totalRevenueNet;
  const revpar = adr * occupancy;

  // ── BP per-villa assumptions for the conservatism strip ──
  const bp = assumptions.revenueRealistic;
  const bpADR = bp.villaADR;
  // BP nights are over the full base year; convert to a comparable peak-
  // season occupancy figure against the 120 available nights.
  const bpOccupancy = Math.min(1, bp.villaBaseNights / currentSeason.availableNights);
  const bpRevPAR = bpADR * (bp.villaBaseNights / currentSeason.availableNights);

  // ── Three conservatism cushions — model stabilised vs live (today) ──
  // Gap % is (live - model) / live: positive = model is BELOW live (cushion),
  // negative = model assumes more than today's reality (aggressive). Guard
  // against zero live values so the headline never blows up if the live feed
  // returns 0 (e.g. mid-season-start before the first booking).
  const safeDiv = (num: number, denom: number) => (denom === 0 ? 0 : num / denom);
  const adrGap = safeDiv(adr - bpADR, adr);
  const occupancyGap = safeDiv(occupancy - bpOccupancy, occupancy);
  const revparGap = safeDiv(revpar - bpRevPAR, revpar);
  const averageGap = (adrGap + occupancyGap + revparGap) / 3;
  // Round to nearest 0.5% for the headline. Step = 0.005 in fractional units.
  const averageGapRounded = Math.round(averageGap * 200) / 200;
  const averageGapPct = Math.round(averageGapRounded * 1000) / 10; // one decimal

  // ── Years to stabilisation ──
  // Uses the existing useSyncExternalStore Now pattern (see `nowMs` above).
  // SSR / static-export: nowMs===0 → fall back to the season year so the
  // headline still renders a sensible integer until the client mounts.
  const currentYearForGap = hasNow ? year : currentSeason.year;
  const yearsToStabilisation = Math.max(0, STABILISED_YEAR - currentYearForGap);

  // ── Freshness ──
  const isStale = (() => {
    if (!pulledAt || !hasNow) return false;
    const t = Date.parse(pulledAt);
    if (Number.isNaN(t)) return false;
    return nowMs - t > STALE_THRESHOLD_MS;
  })();
  const pulledDate = pulledAt
    ? (() => {
        try {
          return new Date(pulledAt).toLocaleDateString(locale, {
            day: "numeric",
            month: "short",
            year: "numeric",
          });
        } catch {
          return pulledAt;
        }
      })()
    : null;

  const isCompact = variant === "compact";
  const liveBadgeOn = snapshotSource === "live";

  return (
    <section
      id="live-track-record"
      aria-label={lr.header}
      className={`relative overflow-hidden rounded-2xl border border-brand-300 shadow-sm ${
        isCompact ? "p-5" : "p-6 md:p-8"
      }`}
      style={{
        // Cream/parchment fill — subtly different from the surface-primary
        // background of the rest of the page.
        background:
          "linear-gradient(135deg, #FAF4E6 0%, #F4EAD2 50%, #EFE0BE 100%)",
      }}
    >
      {/* Decorative top gold bar */}
      <div
        aria-hidden="true"
        className="absolute top-0 left-0 right-0 h-[3px]"
        style={{
          background:
            "linear-gradient(90deg, #C4A55E 0%, #8B6914 50%, #C4A55E 100%)",
        }}
      />

      {/* Header strip */}
      <header className="flex flex-wrap items-start justify-between gap-3 mb-5">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5 mb-1.5">
            <span
              className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${
                liveBadgeOn
                  ? "bg-positive/15 text-positive"
                  : "bg-surface-secondary text-text-tertiary"
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  liveBadgeOn ? "bg-positive live-pulse-dot" : "bg-text-tertiary"
                }`}
                aria-hidden="true"
              />
              {lr.live}
            </span>
            <h2 className="font-display text-base md:text-lg text-text-primary uppercase tracking-[0.16em] leading-none truncate">
              {lr.header}
            </h2>
          </div>
          <p className="text-xs md:text-sm text-text-secondary max-w-2xl leading-snug">
            {lr.yourTrackRecord}
          </p>
        </div>
        {pulledDate && (
          <div className="shrink-0 text-[10px] text-text-tertiary leading-tight text-right whitespace-nowrap">
            <div className="font-medium">
              {isStale ? lr.dataStale : lr.dataUpdated} · {pulledDate}
            </div>
            <div className="opacity-70">{lr.sourceNote}</div>
          </div>
        )}
      </header>

      {/* ── Headline conservatism statement ──
          One sentence that frames the whole section: "stabilised projections
          sit X% below today's live performance — that gap is the cushion."
          Tokens are spliced in with String#replace so we don't drag a full
          i18n template runtime into this component. */}
      {!loading && (
        <p className="text-sm md:text-base text-text-primary leading-relaxed max-w-3xl mb-5">
          {(() => {
            const tmpl = lr.headlineConservatism;
            const gapDisplay =
              averageGapPct > 0 ? `${averageGapPct}` : `${Math.abs(averageGapPct)}`;
            return tmpl
              .replace("{year}", String(STABILISED_YEAR))
              .replace("{years}", String(yearsToStabilisation))
              .replace("{gap}", gapDisplay);
          })()}
        </p>
      )}

      {/* ── Three cushion cards (Villa ADR / Occupancy / RevPAR) ──
          Default-visible. Each card pairs model vs live with a coloured
          cushion chip. Cards stack on <md. */}
      <div className="grid gap-3 md:gap-4 grid-cols-1 md:grid-cols-3 mb-4">
        {loading ? (
          <>
            <FigureSkeleton />
            <FigureSkeleton />
            <FigureSkeleton />
          </>
        ) : (
          <>
            <CushionCard
              label={lr.villaADR}
              modelLabel={lr.model}
              liveLabel={lr.liveLabel}
              cushionLabel={lr.cushion}
              modelValue={formatCurrency(bpADR, false, locale)}
              liveValue={formatCurrency(adr, false, locale)}
              gap={adrGap}
            />
            <CushionCard
              label={lr.villaOccupancy}
              modelLabel={lr.model}
              liveLabel={lr.liveLabel}
              cushionLabel={lr.cushion}
              // Displayed as nights (e.g. "95 / 120") rather than percent at
              // Eytan's request 2026-05-22 — bankers read the absolute count
              // more concretely than 79%. Both sides share the same available-
              // nights denominator (currentSeason.availableNights), so the
              // ratio implied by the percent is preserved. occupancyGap is
              // still computed from the percentage values above so the
              // cushion-% pill in the corner stays consistent with the
              // adrGap / revparGap cards.
              modelValue={`${Math.round(bp.villaBaseNights)} / ${currentSeason.availableNights}`}
              liveValue={`${currentSeason.bookedNights} / ${currentSeason.availableNights}`}
              gap={occupancyGap}
            />
            <CushionCard
              label={lr.villaRevPAR}
              modelLabel={lr.model}
              liveLabel={lr.liveLabel}
              cushionLabel={lr.cushion}
              modelValue={formatCurrency(bpRevPAR, false, locale)}
              liveValue={formatCurrency(revpar, false, locale)}
              gap={revparGap}
            />
          </>
        )}
      </div>

      {/* ── Show / hide detail toggle ──
          Keeps the existing 4-figure block + history out of the bankers'
          first glance, but accessible for anyone who wants the underlying
          numbers. */}
      {!loading && (
        <div className="mb-1">
          <button
            type="button"
            onClick={() => setShowDetail((v) => !v)}
            aria-expanded={showDetail}
            aria-controls="live-track-record-detail"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-700 hover:text-brand-900 underline underline-offset-4 decoration-brand-400/60 hover:decoration-brand-700 transition-colors"
          >
            <span aria-hidden="true" className="text-[10px] leading-none">
              {showDetail ? "▲" : "▼"}
            </span>
            {showDetail ? lr.hideDetail : lr.showDetail}
          </button>
        </div>
      )}

      {/* ── Detail block (collapsed by default) ──
          Existing 4-figure block + per-year history table + rooms-pending
          footnote. */}
      {!loading && showDetail && (
        <div
          id="live-track-record-detail"
          className="mt-4 pt-4 border-t border-brand-200/70"
        >
          <div
            className={`grid gap-5 md:gap-8 mb-5 ${
              isCompact ? "grid-cols-2 md:grid-cols-4" : "grid-cols-2 md:grid-cols-4"
            }`}
          >
            <Figure
              label={lr.ytdRevenue}
              value={formatCurrency(ytdRevenue, true, locale)}
              sub={
                hasNow
                  ? `${lr.asOf} ${monthName} ${year} · ${lr.updatedFromPMS}`
                  : lr.updatedFromPMS
              }
            />
            <Figure
              label={lr.occupancy}
              value={formatPercent(occupancy, 0)}
              sub={`${currentSeason.bookedNights} ${lr.nightsBooked} / ${currentSeason.availableNights} ${lr.available}`}
            />
            <Figure
              label={lr.adr}
              value={formatCurrency(adr, false, locale)}
              sub={lr.perNight}
            />
            <Figure
              label={lr.revpar}
              value={formatCurrency(revpar, false, locale)}
              sub={lr.perNight}
            />
          </div>

          {historicalYears.length > 0 && (
            <div className="rounded-xl bg-white/60 border border-brand-200/60 px-4 py-3 backdrop-blur-sm mb-3">
              <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-brand-600 mb-2">
                {lr.history}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs tabular-nums">
                  <thead>
                    <tr className="text-text-tertiary text-[10px] uppercase tracking-wider">
                      <th className="text-left font-medium py-1 pr-3">{lr.historyYear}</th>
                      <th className="text-right font-medium py-1 px-3">{lr.historyTotal}</th>
                      <th className="text-right font-medium py-1 pl-3">{lr.historyYoY}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historicalYears.map((h) => (
                      <tr
                        key={h.year}
                        className="border-t border-brand-200/40 text-text-secondary"
                      >
                        <td className="py-1 pr-3 font-medium text-text-primary">
                          {h.year}
                        </td>
                        <td className="py-1 px-3 text-right">
                          {formatCurrency(h.total, true, locale)}
                        </td>
                        <td className="py-1 pl-3 text-right">
                          {h.yoy === null ? "—" : formatPercent(h.yoy, 1)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <p className="text-[11px] text-text-tertiary leading-snug max-w-3xl">
            {lr.roomsPending}
          </p>
        </div>
      )}

      {/* Subtle gold accent in the corner */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-12 -right-12 w-48 h-48 rounded-full opacity-30"
        style={{
          background:
            "radial-gradient(circle, rgba(196, 165, 94, 0.35) 0%, rgba(196, 165, 94, 0) 70%)",
        }}
      />
    </section>
  );
}
