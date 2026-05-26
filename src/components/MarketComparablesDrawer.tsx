"use client";

// MarketComparablesDrawer — right-side drill-down for the Conservatism
// Triangle hero strip. Lists every hotel from the 2025 Greek + international
// market study, filterable by country (Greek default) and tier, sortable by
// HIGH €/night (default desc).
//
// Source of truth: MARKET_2025_PER_HOTEL in src/lib/data/marketBenchmarks.ts.
// The headline strip reads MARKET_2025_BACKSTOP (Greek-only) — this drawer
// exposes the per-hotel evidence behind that headline, plus international
// hotels as corroborating context (never weighted into the headline).
//
// A11y:
//   - Renders as role="dialog" aria-modal with an aria-labelledby header.
//   - Escape closes; click on the backdrop closes.
//   - Focus moves to the close button on open; original focus restored on
//     close (basic focus trap — full trap would pull in a library).

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "@/lib/i18n/I18nProvider";
import { formatCurrency } from "@/lib/hooks/useModel";
import {
  MARKET_2025_PER_HOTEL,
  type PerHotelComparable,
  type ComparableCountryFilter,
  filterPerHotel,
  HOTEL_URLS,
} from "@/lib/data/marketBenchmarks";

type SortKey = "name" | "location" | "rooms" | "highEur" | "medEur" | "annualEur" | "tier";
type SortDir = "asc" | "desc";

// Resolve the URL the hotel name should link to. Priority:
//   1. Curated entry in HOTEL_URLS (preferred — direct hotel site, or
//      explicit booking.com property page for the 3 sites that are broken)
//   2. The per-row `url` field on PerHotelComparable (rarely populated)
//   3. booking.com search using `${name} ${location}` (last-resort fallback;
//      disambiguates listings that share a name across islands, e.g.
//      "Andronis" on Paros vs Santorini)
function urlOrBookingFallback(e: PerHotelComparable): string {
  const curated = HOTEL_URLS[e.name];
  if (curated) return curated;
  if (e.url) return e.url;
  const q = encodeURIComponent(`${e.name} ${e.location}`.trim());
  return `https://www.booking.com/searchresults.html?ss=${q}`;
}

function compare(a: number | string | null, b: number | string | null, dir: SortDir): number {
  // Nulls sort last regardless of direction so the leader rows are always real data.
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  let r: number;
  if (typeof a === "number" && typeof b === "number") r = a - b;
  else r = String(a).localeCompare(String(b));
  return dir === "asc" ? r : -r;
}

export function MarketComparablesDrawer({
  open,
  onClose,
  defaultCountryFilter = "Greek",
}: {
  open: boolean;
  onClose: () => void;
  defaultCountryFilter?: ComparableCountryFilter;
}) {
  const { t, locale, dir } = useTranslation();
  const [countryFilter, setCountryFilter] = useState<ComparableCountryFilter>(defaultCountryFilter);
  const [activeTiers, setActiveTiers] = useState<Set<PerHotelComparable["tier"]>>(
    () => new Set<PerHotelComparable["tier"]>(["Basic", "Premium", "Luxury"]),
  );
  const [includeVilla, setIncludeVilla] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("highEur");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // Re-derive activeTiers when includeVilla toggles, but never blow away the
  // user's explicit Basic/Premium/Luxury selections.
  useEffect(() => {
    setActiveTiers((prev) => {
      const next = new Set(prev);
      if (includeVilla) next.add("Villa");
      else next.delete("Villa");
      return next;
    });
  }, [includeVilla]);

  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const lastFocusRef = useRef<HTMLElement | null>(null);

  // Open/close side effects: move focus, restore focus, lock body scroll,
  // wire Escape.
  useEffect(() => {
    if (!open) return;
    lastFocusRef.current = document.activeElement as HTMLElement | null;
    const focusFrame = requestAnimationFrame(() => closeBtnRef.current?.focus());
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      cancelAnimationFrame(focusFrame);
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      lastFocusRef.current?.focus?.();
    };
  }, [open, onClose]);

  // Pre-compute the filtered + sorted row list. Keep all rows visible on
  // initial mount even if `open=false` so the React tree stays stable; CSS
  // controls visibility via translate-x.
  const rows = useMemo(() => {
    const byCountry = filterPerHotel(MARKET_2025_PER_HOTEL, countryFilter);
    const byTier = byCountry.filter((e) => activeTiers.has(e.tier));
    const out = [...byTier];
    out.sort((a, b) => {
      const av: number | string | null = (a as Record<string, unknown>)[sortKey] as
        | number
        | string
        | null;
      const bv: number | string | null = (b as Record<string, unknown>)[sortKey] as
        | number
        | string
        | null;
      return compare(av ?? null, bv ?? null, sortDir);
    });
    return out;
  }, [countryFilter, activeTiers, sortKey, sortDir]);

  // Header click handler — toggle dir if same key, otherwise switch to the
  // new key with the sensible default (desc for numbers, asc for strings).
  const handleHeaderClick = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      const isNumeric = key === "rooms" || key === "highEur" || key === "medEur" || key === "annualEur";
      setSortDir(isNumeric ? "desc" : "asc");
    }
  };

  const headerArrow = (key: SortKey) =>
    sortKey === key ? (sortDir === "asc" ? "▲" : "▼") : "";

  // Drawer slides from the *end* edge: right in LTR, left in RTL. The class
  // construction takes the dir into account so Hebrew users see it slide in
  // from the left.
  const slideFromEdge = dir === "rtl" ? "left-0" : "right-0";
  const closedTransform = dir === "rtl" ? "-translate-x-full" : "translate-x-full";

  return (
    <>
      {/* Backdrop */}
      <div
        aria-hidden={!open}
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-black/30 transition-opacity duration-200 ${
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      />

      {/* Panel */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="market-drawer-title"
        aria-hidden={!open}
        className={`fixed top-0 ${slideFromEdge} z-50 h-screen w-full max-w-2xl bg-white shadow-2xl flex flex-col transition-transform duration-300 ease-out ${
          open ? "translate-x-0" : closedTransform
        }`}
      >
        {/* Header */}
        <header className="flex items-start justify-between gap-3 px-5 py-4 border-b border-surface-tertiary bg-surface-secondary">
          <div className="min-w-0">
            <h2
              id="market-drawer-title"
              className="text-sm font-semibold text-text-primary uppercase tracking-[0.12em]"
            >
              {t("drawer.title")}
            </h2>
            <p className="text-[11px] text-text-tertiary mt-1">
              {t("drawer.countLabel").replace("{n}", String(rows.length))}
            </p>
          </div>
          <button
            ref={closeBtnRef}
            type="button"
            onClick={onClose}
            aria-label={t("drawer.close")}
            className="shrink-0 rounded-md p-1.5 text-text-tertiary hover:text-text-primary hover:bg-white border border-transparent hover:border-surface-tertiary transition-colors"
          >
            <span aria-hidden="true" className="text-lg leading-none">✕</span>
          </button>
        </header>

        {/* Filters */}
        <div className="px-5 py-3 border-b border-surface-tertiary bg-white/60 space-y-2.5">
          <div className="flex flex-wrap items-center gap-1.5">
            {(["Greek", "International", "All"] as ComparableCountryFilter[]).map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => setCountryFilter(opt)}
                aria-pressed={countryFilter === opt}
                className={`text-[11px] px-2.5 py-1 rounded-full border transition-colors ${
                  countryFilter === opt
                    ? "bg-brand-600 text-white border-brand-600"
                    : "bg-white text-text-secondary border-surface-tertiary hover:border-brand-300"
                }`}
              >
                {opt === "Greek"
                  ? t("drawer.filterGreek")
                  : opt === "International"
                    ? t("drawer.filterInternational")
                    : t("drawer.filterAll")}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {(["Basic", "Premium", "Luxury"] as PerHotelComparable["tier"][]).map((tier) => {
              const active = activeTiers.has(tier);
              return (
                <button
                  key={tier}
                  type="button"
                  onClick={() =>
                    setActiveTiers((prev) => {
                      const next = new Set(prev);
                      if (next.has(tier)) next.delete(tier);
                      else next.add(tier);
                      return next;
                    })
                  }
                  aria-pressed={active}
                  className={`text-[11px] px-2.5 py-1 rounded-md border transition-colors ${
                    active
                      ? "bg-positive/15 text-positive border-positive/40"
                      : "bg-white text-text-tertiary border-surface-tertiary hover:border-brand-300"
                  }`}
                >
                  {tier === "Basic"
                    ? t("drawer.tierBasic")
                    : tier === "Premium"
                      ? t("drawer.tierPremium")
                      : t("drawer.tierLuxury")}
                </button>
              );
            })}
            <label className="inline-flex items-center gap-1.5 text-[11px] text-text-secondary ms-2">
              <input
                type="checkbox"
                checked={includeVilla}
                onChange={(e) => setIncludeVilla(e.target.checked)}
                className="rounded border-surface-tertiary"
              />
              {t("drawer.showVilla")}
            </label>
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto">
          {rows.length === 0 ? (
            <p className="px-5 py-8 text-sm text-text-tertiary text-center">
              {t("drawer.empty")}
            </p>
          ) : (
            <table className="w-full text-xs tabular-nums">
              <thead className="sticky top-0 bg-surface-secondary/95 backdrop-blur">
                <tr className="text-text-tertiary text-[10px] uppercase tracking-wider">
                  <Th onClick={() => handleHeaderClick("name")} arrow={headerArrow("name")} align="start">
                    {t("drawer.colHotel")}
                  </Th>
                  <Th onClick={() => handleHeaderClick("location")} arrow={headerArrow("location")} align="start">
                    {t("drawer.colLocation")}
                  </Th>
                  <Th onClick={() => handleHeaderClick("rooms")} arrow={headerArrow("rooms")} align="end">
                    {t("drawer.colRooms")}
                  </Th>
                  <Th onClick={() => handleHeaderClick("highEur")} arrow={headerArrow("highEur")} align="end">
                    {t("drawer.colHighEur")}
                  </Th>
                  <Th onClick={() => handleHeaderClick("medEur")} arrow={headerArrow("medEur")} align="end">
                    {t("drawer.colMedEur")}
                  </Th>
                  <Th onClick={() => handleHeaderClick("annualEur")} arrow={headerArrow("annualEur")} align="end">
                    {t("drawer.colAnnual")}
                  </Th>
                  <Th onClick={() => handleHeaderClick("tier")} arrow={headerArrow("tier")} align="start">
                    {t("drawer.colTier")}
                  </Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr
                    key={`${r.name}::${r.location}::${r.tierRaw}::${i}`}
                    className="border-t border-surface-tertiary/60 hover:bg-surface-secondary/40"
                  >
                    <td className="px-3 py-2 text-text-primary font-medium">
                      <a
                        href={urlOrBookingFallback(r)}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={t("market.openInNewTab").replace("{name}", r.name)}
                        className="underline decoration-surface-tertiary hover:decoration-brand-600"
                      >
                        {r.name}
                      </a>
                    </td>
                    <td className="px-3 py-2 text-text-secondary">{r.location}</td>
                    <td className="px-3 py-2 text-right text-text-secondary">{r.rooms ?? "—"}</td>
                    <td className="px-3 py-2 text-right text-text-primary font-semibold">
                      {r.highEur === null ? "—" : formatCurrency(r.highEur, false, locale)}
                    </td>
                    <td className="px-3 py-2 text-right text-text-secondary">
                      {r.medEur === null ? "—" : formatCurrency(r.medEur, false, locale)}
                    </td>
                    <td className="px-3 py-2 text-right text-text-secondary">
                      {r.annualEur === null ? "—" : formatCurrency(r.annualEur, false, locale)}
                    </td>
                    <td className="px-3 py-2 text-text-tertiary text-[11px]">
                      {r.tier} <span className="opacity-60">· {r.tierRaw}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footnote */}
        <footer className="px-5 py-3 border-t border-surface-tertiary bg-surface-secondary/60">
          <p className="text-[10px] leading-snug text-text-tertiary">
            {t("drawer.sourceFootnote")}
          </p>
        </footer>
      </aside>
    </>
  );
}

function Th({
  children,
  onClick,
  arrow,
  align,
}: {
  children: React.ReactNode;
  onClick: () => void;
  arrow: string;
  align: "start" | "end";
}) {
  return (
    <th
      scope="col"
      className={`px-3 py-2 font-medium ${align === "end" ? "text-end" : "text-start"} select-none`}
    >
      <button
        type="button"
        onClick={onClick}
        className="inline-flex items-center gap-1 hover:text-text-primary uppercase tracking-wider"
      >
        {children}
        {arrow && <span aria-hidden="true">{arrow}</span>}
      </button>
    </th>
  );
}
