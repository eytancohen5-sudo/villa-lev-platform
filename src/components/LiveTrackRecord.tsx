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
import {
  computeMarketPositionWithFallback,
  distinctHotelCount,
  type CoverageStatus,
  type MarketRowWithFallback,
} from "@/lib/data/marketBenchmarks";
import { MarketComparablesDrawer } from "@/components/MarketComparablesDrawer";
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
    nights: string; // bare unit suffix (e.g. "95 nights"), no "booked"
    bookingOnly: string; // "Booking only" — clarifier on YTD revenue figure
    available: string;
    sourceNote: string;
    // ── New keys for the conservatism-cushion restructure ──
    headlineConservatism: string; // template — uses {years} {year} {adrGap} {occGap} {revparGap} {gap} {marketGap}
    cushion: string;
    model: string;
    liveLabel: string;
    showDetail: string;
    hideDetail: string;
    roomsPending: string;
    villaADR: string;
    villaOccupancy: string;
    villaRevPAR: string;
    // ── Symmetric sub-section headers ──
    cushionHeader: string;
    cushionSub: string;
    history: string;
    historyYear: string;
    historyTotal: string;
    historyYoY: string;
    // ── Market comparison strip (Conservatism Check "Market" column) ──
    marketHeader: string;
    marketSub: string;
    marketBP: string;
    market: string;
    marketStandardSuite: string;
    marketDoubleSuite: string;
    marketVilla: string;
    marketBelow: string;
    marketAbove: string;
    marketOnPar: string;
    marketStatusFresh: string; // template — uses {n}
    marketStatusBackstop: string;
    marketFootnoteFresh: string; // template — uses {n}
    marketFootnoteBackstop: string;
    marketSeeComparables: string; // template — uses {n}
  }
> = {
  en: {
    header: "Conservatism evidence · Antiparos",
    yourTrackRecord: "",
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
    nights: "nights",
    bookingOnly: "Booking only",
    available: "available",
    sourceNote: "Source: admin.villalevantiparos.com",
    headlineConservatism:
      "In {years} years at stabilisation, villa KPIs vs today's live Villa Lev — ADR {adrGap} · occupancy {occGap} · RevPAR {revparGap} — averaging {gap} below live performance. Room rates sit {marketGap} below the {year} Antiparos hotel market. In a hospitality market that grows every year: large, deliberate cushions.",
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
    cushionHeader: "Villa · existing property",
    cushionSub: "Stabilised projections (2031) vs today's live villa. A positive cushion means the model assumes less than live reality.",
    history: "History · existing villa",
    historyYear: "Year",
    historyTotal: "Booking revenue",
    historyYoY: "YoY",
    marketHeader: "Hotel rooms · Paros + Antiparos",
    marketSub:
      "BP per-night rates vs the Greek Islands Hotel Market Study, tier-matched and 50/50 HIGH/MED season-blended. Villa tier omitted — Villa Lev's own actuals above are the comparable.",
    marketBP: "BP",
    market: "Market",
    marketStandardSuite: "Standard suite",
    marketDoubleSuite: "Double suite",
    marketVilla: "Villa",
    marketBelow: "Below market",
    marketAbove: "Above market",
    marketOnPar: "On par",
    marketStatusFresh: "2026 capture · {n} hotels",
    marketStatusBackstop: "Market study",
    marketFootnoteFresh: "Fresh data: live 2026 medians from {n} captured Paros + Antiparos hotels.",
    marketFootnoteBackstop:
      "Source: Greek Islands Hotel Market Study — pre-computed Basic / Premium tier averages across the Cyclades comparable set. Operational-season blend of HIGH (Jul–Aug) and MED (May–Jun, Sep).",
    marketSeeComparables: "See the {n} comparables →",
  },
  fr: {
    header: "Preuve de prudence · Antiparos",
    yourTrackRecord: "",
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
    nights: "nuits",
    bookingOnly: "Réservations uniquement",
    available: "disponibles",
    sourceNote: "Source : admin.villalevantiparos.com",
    headlineConservatism:
      "Dans {years} ans à la stabilisation, KPIs villa vs Villa Lev aujourd'hui — ADR {adrGap} · occupation {occGap} · RevPAR {revparGap} — moyenne {gap} sous les performances réelles. Tarifs chambre {marketGap} sous le marché hôtelier {year} d'Antiparos. Dans un marché en croissance chaque année : marges de prudence importantes.",
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
    cushionHeader: "Villa · bien existant",
    cushionSub: "Projections stabilisées (2031) vs la villa réelle aujourd'hui. Un coussin positif signifie que le modèle suppose moins que la réalité.",
    history: "Historique · villa existante",
    historyYear: "Année",
    historyTotal: "Revenus locatifs",
    historyYoY: "YoY",
    marketHeader: "Chambres · Paros + Antiparos",
    marketSub:
      "Tarifs nuit BP vs l'étude de marché des hôtels des îles grecques, par catégorie et lissés saison (50/50 HAUTE/MOY). Catégorie villa omise — les chiffres réels de Villa Lev ci-dessus sont le comparable.",
    marketBP: "BP",
    market: "Marché",
    marketStandardSuite: "Suite standard",
    marketDoubleSuite: "Suite double",
    marketVilla: "Villa",
    marketBelow: "Sous le marché",
    marketAbove: "Au-dessus du marché",
    marketOnPar: "Au niveau",
    marketStatusFresh: "Relevé 2026 · {n} hôtels",
    marketStatusBackstop: "Étude de marché",
    marketFootnoteFresh:
      "Données fraîches : médianes 2026 sur {n} hôtels relevés à Paros + Antiparos.",
    marketFootnoteBackstop:
      "Source : étude de marché des hôtels des îles grecques — moyennes pré-calculées des catégories Basic / Premium sur l'ensemble comparable des Cyclades. Mélange saisonnier opérationnel HAUTE (juil-août) et MOY (mai-juin, sept).",
    marketSeeComparables: "Voir les {n} comparables →",
  },
  el: {
    header: "Τεκμήρια συντηρητισμού · Αντίπαρος",
    yourTrackRecord: "",
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
    nights: "βραδιές",
    bookingOnly: "Μόνο κρατήσεις",
    available: "διαθέσιμες",
    sourceNote: "Πηγή: admin.villalevantiparos.com",
    headlineConservatism:
      "Σε {years} χρόνια στη σταθεροποίηση, KPIs βίλας vs Villa Lev σήμερα — ADR {adrGap} · πληρότητα {occGap} · RevPAR {revparGap} — μέσος όρος {gap} κάτω από τα πραγματικά επίπεδα. Τιμές δωματίου {marketGap} κάτω από την αγορά Αντιπάρου {year}. Σε αγορά φιλοξενίας που αναπτύσσεται κάθε χρόνο: μεγάλα, σκόπιμα «μαξιλάρια».",
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
    cushionHeader: "Βίλα · υπάρχον ακίνητο",
    cushionSub: "Σταθεροποιημένες προβολές (2031) vs τη βίλα σήμερα. Θετικό «μαξιλάρι» σημαίνει ότι το μοντέλο παραδέχεται λιγότερα από την πραγματικότητα.",
    history: "Ιστορικό · υπάρχουσα βίλα",
    historyYear: "Έτος",
    historyTotal: "Έσοδα κρατήσεων",
    historyYoY: "YoY",
    marketHeader: "Δωμάτια ξενοδοχείου · Πάρος + Αντίπαρος",
    marketSub:
      "Τιμές BP ανά διανυκτέρευση έναντι της Μελέτης Αγοράς Ξενοδοχείων Ελληνικών Νησιών, ανά κατηγορία και με 50/50 HIGH/MED σταθμίσεις. Η κατηγορία βίλας παραλείπεται — τα πραγματικά νούμερα της Villa Lev παραπάνω είναι το συγκρίσιμο.",
    marketBP: "BP",
    market: "Αγορά",
    marketStandardSuite: "Σουίτα standard",
    marketDoubleSuite: "Σουίτα double",
    marketVilla: "Βίλα",
    marketBelow: "Κάτω από την αγορά",
    marketAbove: "Πάνω από την αγορά",
    marketOnPar: "Στο επίπεδο",
    marketStatusFresh: "Καταγραφή 2026 · {n} ξενοδοχεία",
    marketStatusBackstop: "Μελέτη αγοράς",
    marketFootnoteFresh:
      "Φρέσκα δεδομένα: διάμεσοι 2026 από {n} ξενοδοχεία Πάρου + Αντιπάρου.",
    marketFootnoteBackstop:
      "Πηγή: Μελέτη Αγοράς Ξενοδοχείων Ελληνικών Νησιών — προ-υπολογισμένοι μέσοι όροι Basic / Premium στο συγκρίσιμο σύνολο των Κυκλάδων. Λειτουργικό εποχικό blend HIGH (Ιουλ–Αυγ) και MED (Μάι–Ιουν, Σεπ).",
    marketSeeComparables: "Δείτε τα {n} συγκρίσιμα →",
  },
  he: {
    header: "עדות שמרנות · אנטיפרוס",
    yourTrackRecord: "",
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
    nights: "לילות",
    bookingOnly: "הזמנות בלבד",
    available: "זמינים",
    sourceNote: "מקור: admin.villalevantiparos.com",
    headlineConservatism:
      "בעוד {years} שנים בייצוב, KPIs הוילה מול Villa Lev היום — ADR {adrGap} · תפוסה {occGap} · RevPAR {revparGap} — ממוצע {gap} מתחת לביצועים בפועל. תעריפי חדר {marketGap} מתחת לשוק המלונות {year} באנטיפרוס. בשוק שצמח כל שנה: כריות שמרנות גדולות ומכוונות.",
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
    cushionHeader: "וילה · נכס קיים",
    cushionSub: "תחזיות מיוצבות (2031) מול הוילה כיום. כרית חיובית מעידה שהמודל מניח פחות מהמציאות.",
    history: "היסטוריה · וילה קיימת",
    historyYear: "שנה",
    historyTotal: "הכנסות מהזמנות",
    historyYoY: "YoY",
    marketHeader: "חדרי מלון · פרוס + אנטיפרוס",
    marketSub:
      "מחירי לילה של BP מול מחקר שוק מלונות האיים היווניים, התאמת קטגוריה וממוצע עונתי 50/50 (HIGH/MED). קטגוריית וילה הושמטה — הנתונים בפועל של Villa Lev למעלה הם ההשוואה.",
    marketBP: "BP",
    market: "שוק",
    marketStandardSuite: "סוויטה סטנדרטית",
    marketDoubleSuite: "סוויטה כפולה",
    marketVilla: "וילה",
    marketBelow: "מתחת לשוק",
    marketAbove: "מעל השוק",
    marketOnPar: "ברמת השוק",
    marketStatusFresh: "איסוף 2026 · {n} מלונות",
    marketStatusBackstop: "מחקר שוק",
    marketFootnoteFresh:
      "נתונים טריים: חציוני 2026 מ-{n} מלונות שנאספו בפרוס + אנטיפרוס.",
    marketFootnoteBackstop:
      "מקור: מחקר שוק מלונות האיים היווניים — ממוצעי קטגוריות Basic / Premium מחושבים מראש על פני סט המשווים בקיקלאדס. שילוב עונתי תפעולי HIGH (יולי-אוג) ו-MED (מאי-יוני, ספט).",
    marketSeeComparables: "ראו את {n} המשווים →",
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

// MarketCard — one card of the Market position strip. Pairs the BP rate
// with the market rate (tier-matched, season-blended) and ends with a
// coloured delta chip. Carries a small status pill showing whether the
// market figure is fresh 2026 capture or 2025 backstop. Colour discipline
// mirrors CushionCard above:
//   - BP below market (deltaPct < 0)   → positive tone (conservative)
//   - BP above market (deltaPct > 0)   → warning tone
//   - |delta| < 0.5% rounding noise    → neutral
function MarketCard({
  label,
  bpLabel,
  marketLabel,
  bpValue,
  marketValue,
  deltaPct,
  statusBadge,
  statusBadgeTone,
}: {
  label: string;
  bpLabel: string;
  marketLabel: string;
  bpValue: string;
  marketValue: string;
  deltaPct: number;
  statusBadge: string;
  statusBadgeTone: "fresh" | "backstop";
}) {
  const rounded = Math.round(deltaPct * 200) / 200;
  const pct = Math.round(rounded * 1000) / 10;
  const tone: "positive" | "negative" | "neutral" =
    Math.abs(rounded) < 0.005 ? "neutral" : rounded < 0 ? "positive" : "negative";
  const sign = pct > 0 ? "+" : pct < 0 ? "" : "";
  const chipClass =
    tone === "positive"
      ? "bg-positive/15 text-positive"
      : tone === "negative"
        ? "bg-warning/15 text-warning"
        : "bg-surface-secondary text-text-tertiary";
  const statusBadgeClass =
    statusBadgeTone === "fresh"
      ? "bg-positive/10 text-positive border-positive/30"
      : "bg-surface-secondary text-text-tertiary border-brand-200/60";
  return (
    <div className="rounded-xl bg-white/70 border border-brand-200/70 px-4 py-3 backdrop-blur-sm min-w-0">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-brand-600">
          {label}
        </div>
        <span
          className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-medium uppercase tracking-wider border ${statusBadgeClass}`}
        >
          {statusBadge}
        </span>
      </div>
      <div className="space-y-1.5 text-sm">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-[11px] uppercase tracking-wider text-text-tertiary">
            {bpLabel}
          </span>
          <span className="font-mono text-text-secondary tabular-nums">{bpValue}</span>
        </div>
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-[11px] uppercase tracking-wider text-text-tertiary">
            {marketLabel}
          </span>
          <span className="font-mono text-text-primary tabular-nums font-semibold">
            {marketValue}
          </span>
        </div>
      </div>
      <div className="mt-3 pt-2 border-t border-brand-200/50 flex items-center justify-end gap-2">
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

  // ── Market comparables drawer ──
  // Same drawer surfaced from ConservatismTriangle below. Opening from the
  // strip lets a banker drill from the BP-vs-market deltas straight into the
  // 2025 Greek Islands hotel set without scrolling further down the page.
  const [marketDrawerOpen, setMarketDrawerOpen] = useState(false);

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
  // YTD revenue: rental net of commissions ONLY — services intentionally
  // stripped per Eytan 2026-05-22 so the headline figure tracks pure
  // booking revenue, matching the rental-only history table below.
  const ytdRevenue = currentSeason.rentalNet;
  const revpar = adr * occupancy;

  // Prior-year rental for the YTD YoY badge. Picks the most recent year
  // strictly before currentSeason.year from historicalYears. yoy field on
  // the snapshot is computed against `total` (rental + services) so we
  // recompute on rental here to stay consistent with ytdRevenue above and
  // with the history-table YoY column.
  const priorYear = historicalYears
    .filter((h) => h.year < currentSeason.year)
    .reduce<(typeof historicalYears)[number] | null>(
      (best, h) => (!best || h.year > best.year ? h : best),
      null,
    );
  const ytdYoYRental =
    priorYear && priorYear.rental > 0
      ? (ytdRevenue - priorYear.rental) / priorYear.rental
      : null;

  // ── BP per-villa assumptions for the conservatism strip ──
  const bp = assumptions.revenueRealistic;
  const bpADR = bp.villaADR;
  // BP nights are over the full base year; convert to a comparable peak-
  // season occupancy figure against the 120 available nights.
  const bpOccupancy = Math.min(1, bp.villaBaseNights / currentSeason.availableNights);
  const bpRevPAR = bpADR * (bp.villaBaseNights / currentSeason.availableNights);

  // ── Market position rows (BP vs 2025 Greek Islands market study) ──
  // Single source of truth: pass `benchmarks=[]` so every tier falls back to
  // MARKET_2025_BACKSTOP. The 2026 booking.com capture was retired per Eytan
  // 2026-05-22 — bankers want one consistent comparable basis with the
  // ConservatismTriangle panel below (which also uses MARKET_2025_BACKSTOP)
  // and the protected business-plan xlsx, all anchored to the same 2025
  // Greek Islands Hotel Market Study. Villa row is filtered out for display
  // because Villa Lev's own live actuals (in the cushion cards above) are
  // the truer villa-tier comparable — mirrors ConservatismTriangle.tsx:18.
  // Decision and re-introduction criteria: docs/adr/0004-revert-market-strip-to-2025-only.md.
  const marketPosition = computeMarketPositionWithFallback(
    {
      suiteStandardADR: bp.suiteStandardADR,
      suiteDoubleADR: bp.suiteDoubleADR,
      villaADR: bp.villaADR,
    },
    [],
  );
  const visibleMarketRows = marketPosition.rows.filter((r) => r.metric !== "villaADR");
  // freshHotelCount / anyFresh derived from visible rows only so the footer
  // narrative matches what's actually rendered. With benchmarks=[] every row
  // is 2025-backstop, so freshHotelCount stays at 0 and the fresh footnote
  // is never rendered — kept here for future re-introduction of fresh data.
  const freshHotelCount = (() => {
    let n = 0;
    for (const row of visibleMarketRows) {
      if (row.coverageHotels > n) n = row.coverageHotels;
    }
    return n;
  })();
  const anyBackstop = visibleMarketRows.some((r) => r.status === "2025-backstop");
  const anyFresh = visibleMarketRows.some((r) => r.status === "fresh");

  // Per-row metadata for the card labels (tier copy + value formatter source).
  const marketRowLabel = (row: MarketRowWithFallback): string => {
    if (row.metric === "suiteStandardADR") return lr.marketStandardSuite;
    if (row.metric === "suiteDoubleADR") return lr.marketDoubleSuite;
    return lr.marketVilla;
  };
  const marketStatusBadge = (status: CoverageStatus, coverageHotels: number): string => {
    if (status === "fresh") {
      return lr.marketStatusFresh.replace("{n}", String(coverageHotels));
    }
    return lr.marketStatusBackstop;
  };

  // ── Three conservatism cushions — model stabilised vs live (today) ──
  // Gap % is (live - model) / live: positive = model is BELOW live (cushion),
  // negative = model assumes more than today's reality (aggressive). Guard
  // against zero live values so the headline never blows up if the live feed
  // returns 0 (e.g. mid-season-start before the first booking).
  const safeDiv = (num: number, denom: number) => (denom === 0 ? 0 : num / denom);
  const adrGap      = safeDiv(adr       - bpADR,        adr);
  const occupancyGap = safeDiv(occupancy - bpOccupancy,  occupancy);
  const revparGap   = safeDiv(revpar    - bpRevPAR,     revpar);
  const averageGap  = (adrGap + occupancyGap + revparGap) / 3;
  // Round to nearest 0.5% for the headline. Step = 0.005 in fractional units.
  const averageGapRounded = Math.round(averageGap * 200) / 200;
  const averageGapPct  = Math.round(averageGapRounded        * 1000) / 10;
  const adrGapPct      = Math.round(adrGap       * 1000) / 10;
  const occupancyGapPct = Math.round(occupancyGap * 1000) / 10;
  const revparGapPct   = Math.round(revparGap     * 1000) / 10;

  // Average delta across visible market rows (negative = BP below market = conservative).
  const marketAvgDelta =
    visibleMarketRows.length > 0
      ? visibleMarketRows.reduce((sum, r) => sum + r.deltaPct, 0) / visibleMarketRows.length
      : 0;
  const marketAvgDeltaPct = Math.round((Math.round(marketAvgDelta * 200) / 200) * 1000) / 10;

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
          {lr.yourTrackRecord && (
            <p className="text-sm md:text-base font-medium text-text-primary max-w-2xl leading-snug">
              {lr.yourTrackRecord}
            </p>
          )}
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

      {/* ── Headline conservatism statement ── */}
      {!loading && (
        <div className="rounded-xl bg-brand-50/80 border-l-[3px] border-brand-400 px-4 py-3 mb-5">
          <p className="text-sm md:text-base font-medium text-text-primary leading-relaxed max-w-3xl">
            {(() => {
              // Build a lookup of every substitution token → display string.
              const vals: Record<string, string> = {
                years:      String(yearsToStabilisation),
                year:       String(STABILISED_YEAR),
                adrGap:     `${adrGapPct > 0 ? "+" : ""}${adrGapPct}%`,
                occGap:     `${occupancyGapPct > 0 ? "+" : ""}${occupancyGapPct}%`,
                revparGap:  `${revparGapPct > 0 ? "+" : ""}${revparGapPct}%`,
                gap:        `${averageGapPct > 0 ? "+" : ""}${averageGapPct}%`,
                marketGap:  `${Math.abs(marketAvgDeltaPct)}%`,
              };
              // Split template on any {token}, render numbers as bold brand spans.
              const parts = lr.headlineConservatism.split(/(\{[^}]+\})/);
              return parts.map((part, i) => {
                const m = part.match(/^\{(.+)\}$/);
                if (m && vals[m[1]] !== undefined) {
                  return (
                    <strong key={i} className="text-brand-700 font-semibold">
                      {vals[m[1]]}
                    </strong>
                  );
                }
                return part;
              });
            })()}
          </p>
        </div>
      )}

      {/* ── Section 1 header ── */}
      {!loading && (
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 mb-2.5">
          <div className="flex items-center gap-2">
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-700">
              {lr.cushionHeader}
            </h3>
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold tabular-nums ${
                Math.abs(averageGapPct) < 0.5
                  ? "bg-surface-secondary text-text-tertiary"
                  : averageGapPct > 0
                    ? "bg-positive/15 text-positive"
                    : "bg-warning/15 text-warning"
              }`}
            >
              {averageGapPct > 0 ? "+" : ""}{averageGapPct.toFixed(1)}%
            </span>
          </div>
          <p className="text-[11px] text-text-tertiary leading-snug max-w-2xl">
            {lr.cushionSub}
          </p>
        </div>
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
              // Displayed as a night count with unit (e.g. "95 nights")
              // rather than percent or a "95 / 120" ratio, at Eytan's
              // request 2026-05-22. Bankers want the absolute count.
              // occupancyGap is still computed from the percentage values
              // above so the corner cushion-% pill stays consistent with
              // the ADR / RevPAR cards.
              modelValue={`${Math.round(bp.villaBaseNights)} ${lr.nights}`}
              liveValue={`${currentSeason.bookedNights} ${lr.nights}`}
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

      {/* ── Market position strip ──
          Surfaces the third comparator (BP vs the 2025 Greek Islands hotel
          market study) alongside the BP vs Live cushions above. Each card
          is BP-only (no Live, since the live villa doesn't operate suites
          today) with a tier-matched market figure (50/50 HIGH/MED blend).
          Villa tier intentionally omitted — Villa Lev's own actuals in
          the cushion cards above are the truer villa comparable. Anchored
          to the same dataset ConservatismTriangle below uses, so the two
          panels never contradict each other. */}
      {!loading && (
        <div className="mb-4">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 mb-2.5">
            <div className="flex items-center gap-2">
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-700">
                {lr.marketHeader}
              </h3>
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold tabular-nums ${
                  Math.abs(marketAvgDeltaPct) < 0.5
                    ? "bg-surface-secondary text-text-tertiary"
                    : marketAvgDeltaPct < 0
                      ? "bg-positive/15 text-positive"
                      : "bg-warning/15 text-warning"
                }`}
              >
                {marketAvgDeltaPct > 0 ? "+" : ""}{marketAvgDeltaPct.toFixed(1)}%
              </span>
            </div>
            <p className="text-[11px] text-text-tertiary leading-snug max-w-2xl">
              {lr.marketSub}
            </p>
          </div>
          <div className="grid gap-3 md:gap-4 grid-cols-1 md:grid-cols-2">
            {visibleMarketRows.map((row) => (
              <MarketCard
                key={row.metric}
                label={marketRowLabel(row)}
                bpLabel={lr.marketBP}
                marketLabel={lr.market}
                bpValue={formatCurrency(row.bp, false, locale)}
                marketValue={formatCurrency(row.market, false, locale)}
                deltaPct={row.deltaPct}
                statusBadge={marketStatusBadge(row.status, row.coverageHotels)}
                statusBadgeTone={row.status === "fresh" ? "fresh" : "backstop"}
              />
            ))}
          </div>
          <p className="text-[10px] text-text-tertiary leading-snug mt-2 max-w-3xl">
            {anyFresh
              ? lr.marketFootnoteFresh.replace("{n}", String(freshHotelCount))
              : ""}
            {anyFresh && anyBackstop ? " · " : ""}
            {anyBackstop ? lr.marketFootnoteBackstop : ""}
          </p>
          {/* "See the N comparables" → reuses the MarketComparablesDrawer
              that ConservatismTriangle below also opens, so bankers reach
              the same 2025 hotel set from either panel. */}
          <div className="mt-2">
            <button
              type="button"
              onClick={() => setMarketDrawerOpen(true)}
              className="text-[12px] font-medium text-brand-700 hover:text-brand-900 underline underline-offset-4 decoration-brand-400/60 hover:decoration-brand-700 transition-colors"
            >
              {lr.marketSeeComparables.replace(
                "{n}",
                // Distinct hotel count (23 Greek + 18 international = 41),
                // not raw tier-row count — matches the CTA on the
                // ConservatismTriangle strip below.
                String(distinctHotelCount()),
              )}
            </button>
          </div>
          <MarketComparablesDrawer
            open={marketDrawerOpen}
            onClose={() => setMarketDrawerOpen(false)}
          />
        </div>
      )}

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
              sub={(() => {
                // Sub line composes 3 parts (joined by " · "):
                //   1. "Booking only" — clarifier that services are excluded
                //   2. "+XX.X% vs YYYY" — YoY growth on rental vs the most
                //      recent completed year (omitted if no prior year)
                //   3. "as of {month} {year} · updated daily from PMS"
                const parts: string[] = [lr.bookingOnly];
                if (ytdYoYRental !== null && priorYear) {
                  const sign = ytdYoYRental >= 0 ? "+" : "−";
                  parts.push(
                    `${sign}${(Math.abs(ytdYoYRental) * 100).toFixed(1)}% ${lr.versus} ${priorYear.year}`,
                  );
                }
                parts.push(
                  hasNow
                    ? `${lr.asOf} ${monthName} ${year} · ${lr.updatedFromPMS}`
                    : lr.updatedFromPMS,
                );
                return parts.join(" · ");
              })()}
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
                    {/* Booking-revenue only (h.rental). 2026-05-22: was
                        h.total (rental + services) but Eytan asked for the
                        history to track booking revenue cleanly without the
                        services line. h.yoy on the snapshot is computed
                        against total, so we recompute YoY against rental
                        here. Assumes historicalYears is sorted by year
                        ascending (which it is in both the static fallback
                        and the live writer). */}
                    {historicalYears.map((h, i) => {
                      const prev = i > 0 ? historicalYears[i - 1] : null;
                      const yoyRental =
                        prev && prev.rental > 0
                          ? (h.rental - prev.rental) / prev.rental
                          : null;
                      return (
                        <tr
                          key={h.year}
                          className="border-t border-brand-200/40 text-text-secondary"
                        >
                          <td className="py-1 pr-3 font-medium text-text-primary">
                            {h.year}
                          </td>
                          <td className="py-1 px-3 text-right">
                            {formatCurrency(h.rental, true, locale)}
                          </td>
                          <td className="py-1 pl-3 text-right">
                            {yoyRental === null ? "—" : formatPercent(yoyRental, 1)}
                          </td>
                        </tr>
                      );
                    })}
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
