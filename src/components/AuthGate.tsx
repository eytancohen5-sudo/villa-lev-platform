"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/data/useAuth";
import { useTranslation } from "@/lib/i18n/I18nProvider";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { loading, user, statusPending, profileMissing, signOut } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useTranslation();

  // Redirect to login when there is no user. useEffect avoids calling
  // router during render (SSR / hydration safety).
  useEffect(() => {
    if (!loading && user === null && pathname !== "/admin/login") {
      router.replace("/admin/login");
    }
  }, [loading, user, pathname, router]);

  // 1. Login page bypasses the gate entirely — prevents redirect loops.
  if (pathname === "/admin/login") {
    return <>{children}</>;
  }

  // 2. Loading — show a centered spinner until both auth and profile have fired.
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-sm text-text-tertiary animate-pulse">
          {t("auth.gate.loading")}
        </div>
      </div>
    );
  }

  // 3. No user — redirect is in flight; render nothing while waiting.
  if (user === null) {
    return null;
  }

  // 4. Pending approval — render a holding screen, NOT the page content.
  if (statusPending) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="max-w-sm w-full bg-white rounded-xl border border-surface-tertiary p-8 text-center space-y-4">
          <div className="text-2xl font-display text-text-primary">
            {t("auth.pending.title")}
          </div>
          <p className="text-sm text-text-secondary">{t("auth.pending.body")}</p>
          <button
            type="button"
            onClick={() => signOut()}
            className="px-4 py-2 rounded-lg bg-surface-secondary text-text-secondary text-sm font-medium hover:bg-surface-tertiary transition-colors"
          >
            {t("auth.pending.signOut")}
          </button>
        </div>
      </div>
    );
  }

  // 5. Profile missing — signed in but no doc and no legacy match.
  if (profileMissing) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="max-w-sm w-full bg-white rounded-xl border border-surface-tertiary p-8 text-center space-y-4">
          <div className="text-2xl font-display text-text-primary">
            {t("auth.notFound.title")}
          </div>
          <p className="text-sm text-text-secondary">{t("auth.notFound.body")}</p>
          <button
            type="button"
            onClick={() => signOut()}
            className="px-4 py-2 rounded-lg bg-surface-secondary text-text-secondary text-sm font-medium hover:bg-surface-tertiary transition-colors"
          >
            {t("auth.pending.signOut")}
          </button>
        </div>
      </div>
    );
  }

  // 6. Fully approved — render children.
  return <>{children}</>;
}
