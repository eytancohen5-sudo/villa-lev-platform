"use client";

import { useEffect, useState } from "react";
import { signInAnonymously } from "firebase/auth";
import { getAuthInstance } from "@/lib/firebase";
import { useTranslation } from "@/lib/i18n/I18nProvider";

const BANK_NAME_KEY = "vl-bank-name";

export function getBankName(): string | null {
  if (typeof sessionStorage === "undefined") return null;
  try { return sessionStorage.getItem(BANK_NAME_KEY); } catch { return null; }
}

export function BankGate({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const [ready, setReady] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setMounted(true);

    // 1. If name was already entered this session, skip immediately.
    if (getBankName()) { setReady(true); return; }

    // 2. If the user is already signed in with a non-anonymous account (e.g.
    //    the admin using Google auth navigates to /bank), skip the name prompt.
    //    We await authStateReady() so we don't race the IndexedDB restore.
    const auth = getAuthInstance();
    if (!auth) return;
    const checkExistingAuth = async () => {
      try {
        if (typeof (auth as { authStateReady?: () => Promise<void> }).authStateReady === "function") {
          await (auth as { authStateReady: () => Promise<void> }).authStateReady();
        }
      } catch { /* ignore */ }
      const user = auth.currentUser;
      if (user && !user.isAnonymous) {
        // Store display name so usePresence can pick it up from getBankName().
        const displayName = user.displayName ?? user.email ?? "Admin";
        try { sessionStorage.setItem(BANK_NAME_KEY, displayName.slice(0, 120)); } catch { /* private mode */ }
        setReady(true);
      }
    };
    void checkExistingAuth();
  }, []);

  // SSR: render nothing to avoid hydration flash.
  if (!mounted) return null;

  if (ready) return <>{children}</>;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim().slice(0, 120);
    if (!trimmed) { setError(t("bankGate.nameRequired")); return; }

    setLoading(true);
    setError("");
    try {
      // Write name BEFORE signInAnonymously so onAuthStateChanged in
      // usePresence fires after getBankName() already returns the value.
      sessionStorage.setItem(BANK_NAME_KEY, trimmed);
      const auth = getAuthInstance();
      if (auth && !auth.currentUser) {
        await signInAnonymously(auth);
      }
      setReady(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("bankGate.error"));
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface-primary flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Wordmark */}
        <p className="text-xs font-semibold tracking-[0.2em] uppercase text-text-tertiary mb-8 text-center">
          Villa Lev Group
        </p>

        <div className="bg-white rounded-2xl border border-surface-tertiary shadow-lg p-8">
          <h1 className="font-display text-xl text-text-primary mb-1">
            {t("bankGate.heading")}
          </h1>
          <p className="text-sm text-text-secondary mb-6">
            {t("bankGate.subtext")}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("bankGate.namePlaceholder")}
              autoFocus
              autoComplete="name"
              maxLength={120}
              className="w-full px-3 py-2.5 rounded-lg border border-surface-tertiary bg-surface-primary text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-brand-400/40 focus:border-brand-400 transition-colors"
            />

            {error && (
              <p className="text-xs text-warning">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 disabled:opacity-50 transition-colors"
            >
              {loading ? t("bankGate.loading") : t("bankGate.cta")}
            </button>
          </form>
        </div>

        <p className="text-[11px] text-text-tertiary text-center mt-6">
          {t("bankGate.confidential")}
        </p>
      </div>
    </div>
  );
}
