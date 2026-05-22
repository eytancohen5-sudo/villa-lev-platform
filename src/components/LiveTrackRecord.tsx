"use client";

// LiveTrackRecord — visually distinct "real numbers, not projections" hero
// for banker-facing pages. Reads live ops data via useSeasonSnapshot() and
// the BP per-villa assumptions via the active scenario in the model store.
//
// Renders on /investor, /bank, and inside the dashboard's "Conservatism
// Check" region — so admin and banker views stay aligned.

import { useSyncExternalStore } from "react";
import { useTranslation } from "@/lib/i18n/I18nProvider";
import { formatCurrency, formatPercent } from "@/lib/hooks/useModel";
import { useSeasonSnapshot } from "@/lib/data/useSeasonSnapshot";
import { useModelStore } from "@/lib/store/modelStore";
import type { Locale } from "@/lib/i18n/types";

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
    source: snapshotSource,
    pulledAt,
    loading,
  } = useSeasonSnapshot();
  const { assumptions } = useModelStore();

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

      {/* Four prominent figures */}
      <div
        className={`grid gap-5 md:gap-8 mb-5 ${
          isCompact ? "grid-cols-2 md:grid-cols-4" : "grid-cols-2 md:grid-cols-4"
        }`}
      >
        {loading ? (
          <>
            <FigureSkeleton />
            <FigureSkeleton />
            <FigureSkeleton />
            <FigureSkeleton />
          </>
        ) : (
          <>
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
          </>
        )}
      </div>

      {/* Conservatism strip — model vs live */}
      {!loading && (
        <div className="rounded-xl bg-white/60 border border-brand-200/60 px-4 py-3 backdrop-blur-sm">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-text-tertiary font-medium uppercase tracking-wider text-[10px]">
                {lr.modelAssumes}
              </span>
              <span className="font-mono text-text-secondary">
                {formatCurrency(bpADR, false, locale)} ADR · {formatPercent(bpOccupancy, 0)}
              </span>
            </div>
            <span className="text-text-tertiary">{lr.versus}</span>
            <div className="flex items-center gap-2">
              <span className="text-positive font-medium uppercase tracking-wider text-[10px]">
                {lr.liveTracking}
              </span>
              <span className="font-mono text-text-primary font-semibold">
                {formatCurrency(adr, false, locale)} ADR · {formatPercent(occupancy, 0)}
              </span>
            </div>
          </div>
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
