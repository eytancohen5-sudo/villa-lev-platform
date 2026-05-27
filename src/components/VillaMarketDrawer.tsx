"use client";

// VillaMarketDrawer — right-side drill-down showing the villa sale & rental
// market study for Paros + Antiparos.
//
// Two tabs:
//   "Sale Prices"  — 29 comparable property transactions, €/m² by island.
//                    Validates the engine's €9,000/m² collateral tier
//                    (market avg 9,784 €/m² all-island / 10,446 Antiparos).
//   "Rental Rates" — 20 luxury villas from Le Collectionist + Kinglike.
//                    Validates the BP villa ADR of €3,500/night vs market
//                    avg of €3,386 blended (€4,179 peak / €2,593 shoulder).
//
// Source: src/lib/data/villaMarketSales.ts

import { useEffect, useRef, useState, useMemo } from "react";
import { useTranslation } from "@/lib/i18n/I18nProvider";
import { formatCurrency } from "@/lib/hooks/useModel";
import {
  VILLA_SALE_COMPARABLES,
  VILLA_RENTAL_COMPARABLES,
  VILLA_SALE_SUMMARY,
  VILLA_RENTAL_SUMMARY,
  VILLA_MARKET_SOURCE,
  ADR_MARKET_CONTEXT,
  type VillaSaleComparable,
  type VillaRentalComparable,
} from "@/lib/data/villaMarketSales";

type ActiveTab = "sale" | "rental";
type SaleSort = keyof Pick<VillaSaleComparable, "island" | "area" | "houseSqm" | "plotSqm" | "bedrooms" | "priceEur" | "pricePerSqm">;
type RentalSort = keyof Pick<VillaRentalComparable, "name" | "sizeSqm" | "bedrooms" | "peakEurPerNight" | "peakNetEurPerNight">;
type SortDir = "asc" | "desc";

function compare(a: number | string | null, b: number | string | null, dir: SortDir): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  const r = typeof a === "number" && typeof b === "number" ? a - b : String(a).localeCompare(String(b));
  return dir === "asc" ? r : -r;
}

export function VillaMarketDrawer({ open, onClose, initialTab = "sale", onlyTab }: { open: boolean; onClose: () => void; initialTab?: ActiveTab; onlyTab?: ActiveTab }) {
  const { t, locale, dir } = useTranslation();
  const [activeTab, setActiveTab] = useState<ActiveTab>(onlyTab ?? initialTab);

  // Re-sync tab when initialTab/onlyTab changes (e.g. opened from rental vs sale trigger)
  useEffect(() => { if (open) setActiveTab(onlyTab ?? initialTab); }, [open, initialTab, onlyTab]);

  // Sale tab state
  const [islandFilter, setIslandFilter] = useState<"All" | "Antiparos" | "Paros">("All");
  const [plotFilter, setPlotFilter] = useState<"all" | "large" | "small">("all");
  const [saleSort, setSaleSort] = useState<SaleSort>("pricePerSqm");
  const [saleSortDir, setSaleSortDir] = useState<SortDir>("desc");

  // Rental tab state
  const [rentalSort, setRentalSort] = useState<RentalSort>("peakNetEurPerNight");
  const [rentalSortDir, setRentalSortDir] = useState<SortDir>("desc");

  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const lastFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    lastFocusRef.current = document.activeElement as HTMLElement | null;
    const frame = requestAnimationFrame(() => closeBtnRef.current?.focus());
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); onClose(); } };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { cancelAnimationFrame(frame); document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; lastFocusRef.current?.focus?.(); };
  }, [open, onClose]);

  const saleRows = useMemo(() => {
    let rows = [...VILLA_SALE_COMPARABLES];
    if (islandFilter !== "All") rows = rows.filter(r => r.island === islandFilter);
    if (plotFilter !== "all") rows = rows.filter(r => r.plotCategory === plotFilter);
    rows.sort((a, b) => compare((a as Record<string, unknown>)[saleSort] as number | string, (b as Record<string, unknown>)[saleSort] as number | string, saleSortDir));
    return rows;
  }, [islandFilter, plotFilter, saleSort, saleSortDir]);

  // Top 12 by gross peak — fixed selection; user can re-sort within those 12
  const rentalTop12 = useMemo(() =>
    [...VILLA_RENTAL_COMPARABLES]
      .sort((a, b) => b.peakEurPerNight - a.peakEurPerNight)
      .slice(0, 12),
  []);
  const rentalRows = useMemo(() => {
    const rows = [...rentalTop12];
    rows.sort((a, b) => compare((a as Record<string, unknown>)[rentalSort] as number | string, (b as Record<string, unknown>)[rentalSort] as number | string, rentalSortDir));
    return rows;
  }, [rentalTop12, rentalSort, rentalSortDir]);
  const top12AvgGrossPeak   = useMemo(() => Math.round(rentalTop12.reduce((s, r) => s + r.peakEurPerNight, 0) / rentalTop12.length), [rentalTop12]);
  const top12AvgNetPeak     = useMemo(() => Math.round(rentalTop12.reduce((s, r) => s + r.peakNetEurPerNight, 0) / rentalTop12.length), [rentalTop12]);
  const levVsTop12NetPct    = Math.round(((ADR_MARKET_CONTEXT.bpVillaADR - top12AvgNetPeak) / top12AvgNetPeak) * 100);

  const handleSaleHeader = (key: SaleSort) => {
    if (saleSort === key) setSaleSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSaleSort(key); setSaleSortDir(typeof VILLA_SALE_COMPARABLES[0][key] === "number" ? "desc" : "asc"); }
  };
  const handleRentalHeader = (key: RentalSort) => {
    if (rentalSort === key) setRentalSortDir(d => d === "asc" ? "desc" : "asc");
    else { setRentalSort(key); setRentalSortDir(typeof VILLA_RENTAL_COMPARABLES[0][key] === "number" ? "desc" : "asc"); }
  };
  const saleArrow = (key: SaleSort) => saleSort === key ? (saleSortDir === "asc" ? "▲" : "▼") : "";
  const rentalArrow = (key: RentalSort) => rentalSort === key ? (rentalSortDir === "asc" ? "▲" : "▼") : "";

  const slideFromEdge = dir === "rtl" ? "left-0" : "right-0";
  const closedTransform = dir === "rtl" ? "-translate-x-full" : "translate-x-full";

  // Compute filtered averages for the summary bar
  const filteredAvgPpm = saleRows.length ? Math.round(saleRows.reduce((s, r) => s + r.pricePerSqm, 0) / saleRows.length) : 0;

  return (
    <>
      <div aria-hidden={!open} onClick={onClose} className={`fixed inset-0 z-40 bg-black/30 transition-opacity duration-200 ${open ? "opacity-100" : "opacity-0 pointer-events-none"}`} />

      <aside
        role="dialog" aria-modal="true" aria-labelledby="villa-drawer-title" aria-hidden={!open}
        className={`fixed top-0 ${slideFromEdge} z-50 h-screen w-full max-w-2xl bg-white shadow-2xl flex flex-col transition-transform duration-300 ease-out ${open ? "translate-x-0" : closedTransform}`}
      >
        {/* Header */}
        <header className="flex items-start justify-between gap-3 px-5 py-4 border-b border-surface-tertiary bg-surface-secondary">
          <div className="min-w-0">
            <h2 id="villa-drawer-title" className="text-sm font-semibold text-text-primary uppercase tracking-[0.12em]">
              {t("villaDrawer.title")}
            </h2>
            <p className="text-[11px] text-text-tertiary mt-1">
              {t("villaDrawer.subtitle").replace("{sale}", String(VILLA_MARKET_SOURCE.saleProperties)).replace("{rental}", String(VILLA_MARKET_SOURCE.rentalProperties))}
            </p>
          </div>
          <button ref={closeBtnRef} type="button" onClick={onClose} aria-label={t("drawer.close")}
            className="shrink-0 rounded-md p-1.5 text-text-tertiary hover:text-text-primary hover:bg-white border border-transparent hover:border-surface-tertiary transition-colors">
            <span aria-hidden="true" className="text-lg leading-none">✕</span>
          </button>
        </header>

        {/* Tab switcher — hidden when onlyTab is set */}
        {!onlyTab && (
          <div className="flex border-b border-surface-tertiary bg-white/60">
            {(["sale", "rental"] as ActiveTab[]).map(tab => (
              <button key={tab} type="button" onClick={() => setActiveTab(tab)}
                className={`flex-1 px-4 py-2.5 text-[12px] font-semibold transition-colors border-b-2 ${activeTab === tab ? "border-brand-600 text-brand-700" : "border-transparent text-text-tertiary hover:text-text-primary"}`}>
                {tab === "sale" ? t("villaDrawer.tabSale") : t("villaDrawer.tabRental")}
              </button>
            ))}
          </div>
        )}

        {/* SALE TAB */}
        {activeTab === "sale" && (
          <>
            {/* Summary bar */}
            <div className="px-5 py-2.5 bg-brand-50 border-b border-brand-100 flex flex-wrap gap-x-6 gap-y-1 text-[11px]">
              <span className="text-text-tertiary">{t("villaDrawer.saleAvg")}: <span className="font-semibold text-brand-700">{filteredAvgPpm.toLocaleString()} €/m²</span></span>
              <span className="text-text-tertiary">{t("villaDrawer.collateralTier")}: <span className="font-semibold text-positive">9,000 €/m²</span> <span className="text-text-tertiary">({t("villaDrawer.conservative")})</span></span>
              <span className="text-text-tertiary">{saleRows.length} {t("villaDrawer.properties")}</span>
            </div>

            {/* Filters */}
            <div className="px-5 py-2.5 border-b border-surface-tertiary bg-white/60 flex flex-wrap gap-1.5">
              {(["All", "Antiparos", "Paros"] as const).map(opt => (
                <button key={opt} type="button" onClick={() => setIslandFilter(opt)} aria-pressed={islandFilter === opt}
                  className={`text-[11px] px-2.5 py-1 rounded-full border transition-colors ${islandFilter === opt ? "bg-brand-600 text-white border-brand-600" : "bg-white text-text-secondary border-surface-tertiary hover:border-brand-300"}`}>
                  {opt}
                </button>
              ))}
              <span className="text-text-tertiary text-[11px] self-center mx-1">·</span>
              {(["all", "large", "small"] as const).map(opt => (
                <button key={opt} type="button" onClick={() => setPlotFilter(opt)} aria-pressed={plotFilter === opt}
                  className={`text-[11px] px-2.5 py-1 rounded-full border transition-colors ${plotFilter === opt ? "bg-amber-600 text-white border-amber-600" : "bg-white text-text-secondary border-surface-tertiary hover:border-amber-300"}`}>
                  {opt === "all" ? t("villaDrawer.allPlots") : opt === "large" ? t("villaDrawer.largePlots") : t("villaDrawer.smallPlots")}
                </button>
              ))}
            </div>

            {/* Sale table */}
            <div className="flex-1 overflow-auto">
              <table className="w-full text-xs tabular-nums">
                <thead className="sticky top-0 bg-surface-secondary/95 backdrop-blur">
                  <tr className="text-text-tertiary text-[10px] uppercase tracking-wider">
                    <Th onClick={() => handleSaleHeader("island")} arrow={saleArrow("island")} align="start">{t("villaDrawer.colIsland")}</Th>
                    <Th onClick={() => handleSaleHeader("area")} arrow={saleArrow("area")} align="start">{t("villaDrawer.colArea")}</Th>
                    <Th onClick={() => handleSaleHeader("houseSqm")} arrow={saleArrow("houseSqm")} align="end">{t("villaDrawer.colHouseSqm")}</Th>
                    <Th onClick={() => handleSaleHeader("plotSqm")} arrow={saleArrow("plotSqm")} align="end">{t("villaDrawer.colPlotSqm")}</Th>
                    <Th onClick={() => handleSaleHeader("bedrooms")} arrow={saleArrow("bedrooms")} align="end">{t("villaDrawer.colBeds")}</Th>
                    <Th onClick={() => handleSaleHeader("priceEur")} arrow={saleArrow("priceEur")} align="end">{t("villaDrawer.colPrice")}</Th>
                    <Th onClick={() => handleSaleHeader("pricePerSqm")} arrow={saleArrow("pricePerSqm")} align="end">{t("villaDrawer.colPpm")}</Th>
                  </tr>
                </thead>
                <tbody>
                  {saleRows.map(r => (
                    <tr key={r.id} className="border-t border-surface-tertiary/60 hover:bg-surface-secondary/40">
                      <td className="px-3 py-2 text-text-primary font-medium">{r.island}</td>
                      <td className="px-3 py-2 text-text-secondary">{r.area}</td>
                      <td className="px-3 py-2 text-right text-text-secondary">{r.houseSqm}</td>
                      <td className="px-3 py-2 text-right text-text-tertiary text-[11px]">{r.plotSqm.toLocaleString()}</td>
                      <td className="px-3 py-2 text-right text-text-secondary">{r.bedrooms}</td>
                      <td className="px-3 py-2 text-right text-text-primary font-semibold">{formatCurrency(Math.round(r.priceEur / 1000) * 1000, false, locale).replace("€", "€ ")}</td>
                      <td className={`px-3 py-2 text-right font-semibold ${r.pricePerSqm >= 9000 ? "text-positive" : "text-text-secondary"}`}>
                        {r.pricePerSqm.toLocaleString()} €
                        {!r.seaView && <span className="ms-1 text-[10px] text-text-tertiary opacity-60">no view</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <footer className="px-5 py-3 border-t border-surface-tertiary bg-surface-secondary/60">
              <p className="text-[10px] leading-snug text-text-tertiary">{t("villaDrawer.saleFootnote")}</p>
            </footer>
          </>
        )}

        {/* RENTAL TAB */}
        {activeTab === "rental" && (
          <>
            {/* Summary bar */}
            <div className="px-5 py-2.5 bg-brand-50 border-b border-brand-100 flex flex-wrap gap-x-6 gap-y-1 text-[11px]">
              <span className="text-text-tertiary">{t("villaDrawer.mktGrossPeakAvg")}: <span className="font-semibold text-text-secondary">{top12AvgGrossPeak.toLocaleString()} €</span></span>
              <span className="text-text-tertiary">{t("villaDrawer.mktNetPeakAvg")}: <span className="font-semibold text-brand-700">{top12AvgNetPeak.toLocaleString()} €</span></span>
              <span className="text-text-tertiary">BP ADR: <span className="font-semibold text-positive">€{ADR_MARKET_CONTEXT.bpVillaADR.toLocaleString()}</span> <span className={levVsTop12NetPct >= 0 ? "text-positive" : "text-amber-700"}>({levVsTop12NetPct > 0 ? "+" : ""}{levVsTop12NetPct}% {t("villaDrawer.vsNetMarket")})</span></span>
              <span className="text-text-tertiary">{t("villaDrawer.showingTop12")}</span>
            </div>

            {/* Rental table */}
            <div className="flex-1 overflow-auto">
              <table className="w-full text-xs tabular-nums">
                <thead className="sticky top-0 bg-surface-secondary/95 backdrop-blur">
                  <tr className="text-text-tertiary text-[10px] uppercase tracking-wider">
                    <Th onClick={() => handleRentalHeader("name")} arrow={rentalArrow("name")} align="start">{t("villaDrawer.colVillaName")}</Th>
                    <Th onClick={() => handleRentalHeader("sizeSqm")} arrow={rentalArrow("sizeSqm")} align="end">{t("villaDrawer.colHouseSqm")}</Th>
                    <Th onClick={() => handleRentalHeader("bedrooms")} arrow={rentalArrow("bedrooms")} align="end">{t("villaDrawer.colBeds")}</Th>
                    <Th onClick={() => handleRentalHeader("peakEurPerNight")} arrow={rentalArrow("peakEurPerNight")} align="end">{t("villaDrawer.colGrossPeak")}</Th>
                    <th scope="col" className="px-3 py-2 font-medium text-end text-[10px] uppercase tracking-wider text-amber-600">{t("villaDrawer.colOtaDeduct")}</th>
                    <Th onClick={() => handleRentalHeader("peakNetEurPerNight")} arrow={rentalArrow("peakNetEurPerNight")} align="end">{t("villaDrawer.colNetPeak")}</Th>
                  </tr>
                </thead>
                <tbody>
                  {rentalRows.map(r => (
                    <tr key={r.name} className="border-t border-surface-tertiary/60 hover:bg-surface-secondary/40">
                      <td className="px-3 py-2 text-text-primary font-medium">{r.name}</td>
                      <td className="px-3 py-2 text-right text-text-secondary">{r.sizeSqm}</td>
                      <td className="px-3 py-2 text-right text-text-secondary">{r.bedrooms}</td>
                      <td className="px-3 py-2 text-right text-text-secondary">{r.peakEurPerNight.toLocaleString()} €</td>
                      <td className="px-3 py-2 text-right text-amber-600 text-[11px]">−{(r.peakEurPerNight - r.peakNetEurPerNight).toLocaleString()} €</td>
                      <td className="px-3 py-2 text-right text-text-primary font-semibold">{r.peakNetEurPerNight.toLocaleString()} €</td>
                    </tr>
                  ))}
                  {/* Recap row */}
                  <tr className="border-t-2 border-brand-200 bg-brand-50">
                    <td className="px-3 py-2 text-text-primary font-semibold text-[11px]">{t("villaDrawer.recapRow")}</td>
                    <td className="px-3 py-2 text-right text-text-tertiary text-[11px]">—</td>
                    <td className="px-3 py-2 text-right text-text-tertiary text-[11px]">—</td>
                    <td className="px-3 py-2 text-right font-semibold text-text-secondary">{top12AvgGrossPeak.toLocaleString()} €</td>
                    <td className="px-3 py-2 text-right text-amber-600 font-semibold text-[11px]">−{(top12AvgGrossPeak - top12AvgNetPeak).toLocaleString()} €</td>
                    <td className="px-3 py-2 text-right font-semibold text-brand-700">{top12AvgNetPeak.toLocaleString()} €</td>
                  </tr>
                  {/* Villa Lev comparison row */}
                  <tr className="border-t border-brand-200 bg-positive/5">
                    <td className="px-3 py-2 text-positive font-semibold text-[11px]">Villa Lev — BP ADR</td>
                    <td className="px-3 py-2 text-right text-text-tertiary text-[11px]">~475</td>
                    <td className="px-3 py-2 text-right text-text-tertiary text-[11px]">6</td>
                    <td className="px-3 py-2 text-right text-text-tertiary text-[11px]">—</td>
                    <td className="px-3 py-2 text-right text-text-tertiary text-[11px]">—</td>
                    <td className="px-3 py-2 text-right font-bold text-positive">
                      €{ADR_MARKET_CONTEXT.bpVillaADR.toLocaleString()}
                      <span className={`ms-1.5 text-[10px] font-normal ${levVsTop12NetPct >= 0 ? "text-positive" : "text-amber-700"}`}>
                        ({levVsTop12NetPct > 0 ? "+" : ""}{levVsTop12NetPct}% {t("villaDrawer.vsNetMarket")})
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* OTA note */}
            <div className="px-5 py-2 border-t border-surface-tertiary bg-amber-50/60">
              <p className="text-[10px] text-amber-700">{t("villaDrawer.otaNote")}</p>
            </div>

            <footer className="px-5 py-3 border-t border-surface-tertiary bg-surface-secondary/60">
              <p className="text-[10px] leading-snug text-text-tertiary">{t("villaDrawer.rentalFootnote")}</p>
            </footer>
          </>
        )}
      </aside>
    </>
  );
}

function Th({ children, onClick, arrow, align }: { children: React.ReactNode; onClick: () => void; arrow: string; align: "start" | "end" }) {
  return (
    <th scope="col" className={`px-3 py-2 font-medium ${align === "end" ? "text-end" : "text-start"} select-none`}>
      <button type="button" onClick={onClick} className="inline-flex items-center gap-1 hover:text-text-primary uppercase tracking-wider">
        {children}
        {arrow && <span aria-hidden="true">{arrow}</span>}
      </button>
    </th>
  );
}
