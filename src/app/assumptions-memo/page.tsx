"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "@/lib/i18n/I18nProvider";

function Section({
  id,
  title,
  children,
  open,
  onToggle,
}: {
  id: number;
  title: string;
  children: React.ReactNode;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="bg-white rounded-xl border border-surface-tertiary overflow-hidden transition-all">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-surface-secondary/20 transition-colors"
      >
        <h3 className="font-display text-lg text-text-primary">{title}</h3>
        <span className={`text-text-tertiary text-xl transition-transform ${open ? "rotate-180" : ""}`}>
          &#9662;
        </span>
      </button>
      {open && (
        <div className="px-6 pb-6 pt-0 text-sm text-text-secondary leading-relaxed space-y-3 border-t border-surface-secondary/60">
          {children}
        </div>
      )}
    </div>
  );
}

function BulletRow({ bold, rest }: { bold: string; rest: string }) {
  return (
    <p>
      <span className="font-semibold text-text-primary">{bold}</span>
      {rest}
    </p>
  );
}

export default function AssumptionsMemoPage() {
  const router = useRouter();
  const { t } = useTranslation();

  const [openSections, setOpenSections] = useState<Set<number>>(
    new Set([1, 2, 3, 4, 5, 6, 7, 8, 9])
  );

  const toggle = (id: number) => {
    setOpenSections((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  return (
    <>
      {/* Sticky top bar */}
      <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-sm border-b border-surface-tertiary print:hidden">
        <div className="max-w-4xl mx-auto px-6 py-3 flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="inline-flex items-center gap-2 text-sm text-text-secondary hover:text-text-primary transition-colors"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-4 h-4"
              aria-hidden="true"
            >
              <polyline points="15 18 9 12 15 6" />
            </svg>
            {t('memo.back')}
          </button>
          <span className="text-xs text-text-tertiary">
            {t('memo.pageTitle')} · Villa Lev Group · 24 May 2026
          </span>
        </div>
      </div>

      {/* Main content */}
      <main className="max-w-4xl mx-auto px-6 py-10 print:py-4">
        <h1 className="font-display text-3xl text-text-primary mb-2">
          {t('memo.pageTitle')}
        </h1>
        <p className="text-text-secondary text-base mb-1">
          {t('memo.subtitle')}
        </p>
        <p className="text-sm text-text-tertiary mb-6">24 May 2026</p>

        <hr className="border-surface-tertiary mb-8" />

        {/* Executive Summary — always visible */}
        <div className="bg-brand-50 border border-brand-200/60 rounded-xl px-6 py-5 mb-8">
          <h2 className="font-display text-lg text-text-primary mb-3">{t('memo.execSummary')}</h2>
          <p className="text-sm text-text-secondary leading-relaxed">
            {t('memo.execBody')}
          </p>
        </div>

        {/* 9 Collapsible Sections */}
        <div className="space-y-4 mb-8">

          {/* 1 — Occupancy */}
          <Section id={1} title={t('memo.s1')} open={openSections.has(1)} onToggle={() => toggle(1)}>
            <BulletRow bold={t('memo.s1b1')} rest={t('memo.s1b1r')} />
            <BulletRow bold={t('memo.s1b2')} rest={t('memo.s1b2r')} />
            <BulletRow bold={t('memo.s1b3')} rest={t('memo.s1b3r')} />
          </Section>

          {/* 2 — Room Rates (ADR) */}
          <Section id={2} title={t('memo.s2')} open={openSections.has(2)} onToggle={() => toggle(2)}>
            <BulletRow bold={t('memo.s2b1')} rest={t('memo.s2b1r')} />
            <BulletRow bold={t('memo.s2b2')} rest={t('memo.s2b2r')} />
            <BulletRow bold={t('memo.s2b3')} rest={t('memo.s2b3r')} />
          </Section>

          {/* 3 — Revenue Ramp */}
          <Section id={3} title={t('memo.s3')} open={openSections.has(3)} onToggle={() => toggle(3)}>
            <BulletRow bold={t('memo.s3b1')} rest={t('memo.s3b1r')} />
            <BulletRow bold={t('memo.s3b2')} rest={t('memo.s3b2r')} />
            <BulletRow bold={t('memo.s3b3')} rest={t('memo.s3b3r')} />
          </Section>

          {/* 4 — Ancillary & Events */}
          <Section id={4} title={t('memo.s4')} open={openSections.has(4)} onToggle={() => toggle(4)}>
            <BulletRow bold={t('memo.s4b1')} rest={t('memo.s4b1r')} />
            <BulletRow bold={t('memo.s4b2')} rest={t('memo.s4b2r')} />
          </Section>

          {/* 5 — Construction */}
          <Section id={5} title={t('memo.s5')} open={openSections.has(5)} onToggle={() => toggle(5)}>
            <BulletRow bold={t('memo.s5b1')} rest={t('memo.s5b1r')} />
          </Section>

          {/* 6 — Financing Cost */}
          <Section id={6} title={t('memo.s6')} open={openSections.has(6)} onToggle={() => toggle(6)}>
            <BulletRow bold={t('memo.s6b1')} rest={t('memo.s6b1r')} />
            <BulletRow bold={t('memo.s6b2')} rest={t('memo.s6b2r')} />
          </Section>

          {/* 7 — Subsidy & Grant Instruments */}
          <Section id={7} title={t('memo.s7')} open={openSections.has(7)} onToggle={() => toggle(7)}>
            <BulletRow bold={t('memo.s7b1')} rest={t('memo.s7b1r')} />
            <BulletRow bold={t('memo.s7b2')} rest={t('memo.s7b2r')} />
            <BulletRow bold={t('memo.s7b3')} rest={t('memo.s7b3r')} />
          </Section>

          {/* 8 — DSCR & Covenant Headroom */}
          <Section id={8} title={t('memo.s8')} open={openSections.has(8)} onToggle={() => toggle(8)}>
            <BulletRow bold={t('memo.s8b1')} rest={t('memo.s8b1r')} />
            <BulletRow bold={t('memo.s8b2')} rest={t('memo.s8b2r')} />
          </Section>

          {/* 9 — Structural Buffers */}
          <Section id={9} title={t('memo.s9')} open={openSections.has(9)} onToggle={() => toggle(9)}>
            <BulletRow bold={t('memo.s9b1')} rest={t('memo.s9b1r')} />
            <BulletRow bold={t('memo.s9b2')} rest={t('memo.s9b2r')} />
            <BulletRow bold={t('memo.s9b3')} rest={t('memo.s9b3r')} />
            <BulletRow bold={t('memo.s9b4')} rest={t('memo.s9b4r')} />
          </Section>

        </div>

        {/* Comparison Table */}
        <div className="mb-8">
          <h2 className="font-display text-lg text-text-primary mb-1">
            {t('memo.compTableTitle')}
          </h2>
          <p className="text-sm text-text-secondary mb-4">
            {t('memo.compTableSubtitle')}
          </p>
          <div className="overflow-x-auto rounded-xl border border-surface-tertiary">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-tertiary bg-surface-secondary border-b border-surface-tertiary">{t('memo.tCol1')}</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-tertiary bg-surface-secondary border-b border-surface-tertiary">{t('memo.tCol2')}</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-tertiary bg-surface-secondary border-b border-surface-tertiary">{t('memo.tCol3')}</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-tertiary bg-surface-secondary border-b border-surface-tertiary">{t('memo.tCol4')}</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-tertiary bg-surface-secondary border-b border-surface-tertiary">{t('memo.tCol5')}</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="px-4 py-3 text-text-secondary border-b border-surface-tertiary">{t('memo.tRow1')}</td>
                  <td className="px-4 py-3 text-text-secondary border-b border-surface-tertiary">€1,100,000</td>
                  <td className="px-4 py-3 text-text-secondary border-b border-surface-tertiary">€1,400,000</td>
                  <td className="px-4 py-3 text-text-secondary border-b border-surface-tertiary">+€300,000</td>
                  <td className="px-4 py-3 text-text-secondary border-b border-surface-tertiary">+27%</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 text-text-secondary border-b border-surface-tertiary">{t('memo.tRow2')}</td>
                  <td className="px-4 py-3 text-text-secondary border-b border-surface-tertiary">€826,000</td>
                  <td className="px-4 py-3 text-text-secondary border-b border-surface-tertiary">€1,100,000</td>
                  <td className="px-4 py-3 text-text-secondary border-b border-surface-tertiary">+€274,000</td>
                  <td className="px-4 py-3 text-text-secondary border-b border-surface-tertiary">+33%</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 text-text-secondary border-b border-surface-tertiary">{t('memo.tRow3')}</td>
                  <td className="px-4 py-3 text-text-secondary border-b border-surface-tertiary">77%</td>
                  <td className="px-4 py-3 text-text-secondary border-b border-surface-tertiary">82%</td>
                  <td className="px-4 py-3 text-text-secondary border-b border-surface-tertiary">+5pp</td>
                  <td className="px-4 py-3 text-text-secondary border-b border-surface-tertiary"></td>
                </tr>
                <tr>
                  <td className="px-4 py-3 text-text-secondary border-b border-surface-tertiary">{t('memo.tRow4')}</td>
                  <td className="px-4 py-3 text-text-secondary border-b border-surface-tertiary">€405,000</td>
                  <td className="px-4 py-3 text-text-secondary border-b border-surface-tertiary">€405,000</td>
                  <td className="px-4 py-3 text-text-secondary border-b border-surface-tertiary">—</td>
                  <td className="px-4 py-3 text-text-secondary border-b border-surface-tertiary">—</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 text-text-secondary border-b border-surface-tertiary">{t('memo.tRow5')}</td>
                  <td className="px-4 py-3 text-text-secondary border-b border-surface-tertiary">2.00×</td>
                  <td className="px-4 py-3 text-text-secondary border-b border-surface-tertiary">2.73×</td>
                  <td className="px-4 py-3 text-text-secondary border-b border-surface-tertiary">+0.73×</td>
                  <td className="px-4 py-3 text-text-secondary border-b border-surface-tertiary">+37%</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 text-text-secondary border-b border-surface-tertiary">{t('memo.tRow6')}</td>
                  <td className="px-4 py-3 text-text-secondary border-b border-surface-tertiary">€194,000</td>
                  <td className="px-4 py-3 text-text-secondary border-b border-surface-tertiary">€404,000</td>
                  <td className="px-4 py-3 text-text-secondary border-b border-surface-tertiary">+€210,000</td>
                  <td className="px-4 py-3 text-text-secondary border-b border-surface-tertiary font-semibold text-positive">+108%</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 text-text-secondary border-b border-surface-tertiary">{t('memo.tRow7')}</td>
                  <td className="px-4 py-3 text-text-secondary border-b border-surface-tertiary">25.6%</td>
                  <td className="px-4 py-3 text-text-secondary border-b border-surface-tertiary">31.8%</td>
                  <td className="px-4 py-3 text-text-secondary border-b border-surface-tertiary">+6.2pp</td>
                  <td className="px-4 py-3 text-text-secondary border-b border-surface-tertiary"></td>
                </tr>
                <tr>
                  <td className="px-4 py-3 text-text-secondary border-b border-surface-tertiary">{t('memo.tRow8')}</td>
                  <td className="px-4 py-3 text-text-secondary border-b border-surface-tertiary">9.96×</td>
                  <td className="px-4 py-3 text-text-secondary border-b border-surface-tertiary">13.05×</td>
                  <td className="px-4 py-3 text-text-secondary border-b border-surface-tertiary">+3.09×</td>
                  <td className="px-4 py-3 text-text-secondary border-b border-surface-tertiary">+31%</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-xs text-text-tertiary mt-3">
            {t('memo.compTableNote')}
          </p>
        </div>

        {/* Conclusion — always visible */}
        <div className="bg-white rounded-xl border border-surface-tertiary p-6 mb-8 space-y-4">
          <h2 className="font-display text-lg text-text-primary">{t('memo.whatThisMeans')}</h2>
          <p className="text-sm text-text-secondary leading-relaxed">
            {t('memo.conc1')}
          </p>
          <p className="text-sm text-text-secondary leading-relaxed">
            {t('memo.conc2')}
          </p>
          <p className="text-sm text-text-secondary leading-relaxed">
            {t('memo.conc3')}
          </p>
        </div>

        {/* Footer */}
        <div className="text-center py-6 border-t border-surface-tertiary">
          <p className="text-xs text-text-tertiary">
            Villa Lev Group · 24 May 2026 · {t('memo.confidential')}
          </p>
        </div>
      </main>
    </>
  );
}
