"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/data/useAuth";
import { useTranslation } from "@/lib/i18n/I18nProvider";

type FormMode = "signin" | "signup";

export default function AdminLoginPage() {
  const { loading, user, signIn, doSignInEmail, doSignUpEmail } = useAuth();
  const router = useRouter();
  const { t } = useTranslation();

  const [formMode, setFormMode] = useState<FormMode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // SHOULD-FIX-1: Map safe auth error codes from useAuth to i18n keys so
  // raw Firebase codes are never rendered in the DOM.
  function mapAuthError(raw: string): string {
    const msg = raw ?? '';
    if (msg.includes('auth/invalid-credentials')) return t('auth.error.invalidCredentials');
    if (msg.includes('auth/email-in-use')) return t('auth.error.emailInUse');
    if (msg.includes('auth/too-many-requests')) return t('auth.error.tooManyRequests');
    if (msg.includes('auth/popup-blocked')) return t('auth.error.popupBlocked');
    if (msg.includes('auth/cancelled')) return t('auth.error.cancelled');
    if (msg.includes('auth/unauthorized-domain')) return t('auth.error.unauthorizedDomain');
    return t('auth.error.unknown');
  }

  // Redirect to dashboard for any signed-in user — AuthGate handles the
  // pending-approval screen and profileMissing screen there. Keeping the
  // gate logic in one place (AuthGate) prevents "stuck on login" for users
  // whose status hasn't been approved yet.
  useEffect(() => {
    if (!loading && user) {
      router.replace("/admin/dashboard");
    }
  }, [loading, user, router]);

  const handleGoogleSignIn = async () => {
    setError(null);
    setSubmitting(true);
    try {
      await signIn();
    } catch (err) {
      setError(mapAuthError((err as Error)?.message ?? ''));
    } finally {
      setSubmitting(false);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (formMode === "signup") {
      if (password !== confirmPassword) {
        setError(t("auth.login.passwordMismatch"));
        return;
      }
    }

    setSubmitting(true);
    try {
      if (formMode === "signin") {
        await doSignInEmail(email, password);
      } else {
        await doSignUpEmail(email, password, displayName || undefined);
      }
    } catch (err) {
      setError(mapAuthError((err as Error)?.message ?? ''));
    } finally {
      setSubmitting(false);
    }
  };

  // SHOULD-FIX-6: hide the form while auth state is resolving to prevent a
  // flash of the login form for returning users who are already signed in.
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-muted-foreground">{t('auth.gate.loading')}</p>
      </div>
    );
  }

  return (
    <div className="max-w-sm mx-auto py-16 px-4 space-y-6">
      {/* App title */}
      <div className="text-center">
        <h1 className="font-display text-2xl text-text-primary">{t("app.title")}</h1>
        <p className="text-xs text-text-tertiary mt-1">{t("app.platform")}</p>
      </div>

      {/* Google sign-in */}
      <button
        type="button"
        onClick={handleGoogleSignIn}
        disabled={submitting}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-surface-tertiary bg-white text-sm font-medium text-text-primary hover:bg-surface-secondary transition-colors disabled:opacity-50"
      >
        {/* Google G mark */}
        <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            fill="#4285F4"
          />
          <path
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            fill="#34A853"
          />
          <path
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
            fill="#FBBC05"
          />
          <path
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            fill="#EA4335"
          />
        </svg>
        {t("auth.login.googleBtn")}
      </button>

      {/* Divider */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-surface-tertiary" />
        <span className="text-xs text-text-tertiary">{t("auth.login.orDivider")}</span>
        <div className="flex-1 h-px bg-surface-tertiary" />
      </div>

      {/* Email / password form */}
      <form onSubmit={handleEmailSubmit} className="space-y-3">
        {formMode === "signup" && (
          <input
            type="text"
            required
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder={t("auth.login.displayNamePlaceholder")}
            className="w-full px-3 py-2 text-sm rounded-lg border border-surface-tertiary bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/30"
          />
        )}
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t("auth.login.emailPlaceholder")}
          className="w-full px-3 py-2 text-sm rounded-lg border border-surface-tertiary bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/30"
        />
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={t("auth.login.passwordPlaceholder")}
          className="w-full px-3 py-2 text-sm rounded-lg border border-surface-tertiary bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/30"
        />
        {formMode === "signup" && (
          <input
            type="password"
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder={t("auth.login.confirmPasswordPlaceholder")}
            className="w-full px-3 py-2 text-sm rounded-lg border border-surface-tertiary bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/30"
          />
        )}

        {error && (
          <p className="text-xs text-warning">{error}</p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full px-4 py-2.5 rounded-lg bg-brand-700 text-white text-sm font-medium hover:bg-brand-800 transition-colors disabled:opacity-50"
        >
          {submitting
            ? "…"
            : formMode === "signin"
              ? t("auth.login.signInBtn")
              : t("auth.login.signUpBtn")}
        </button>
      </form>

      {/* Toggle link */}
      <div className="text-center">
        <button
          type="button"
          onClick={() => {
            setFormMode((m) => (m === "signin" ? "signup" : "signin"));
            setError(null);
          }}
          className="text-xs text-text-secondary hover:text-brand-700 transition-colors underline underline-offset-2"
        >
          {formMode === "signin"
            ? t("auth.login.toggleToSignUp")
            : t("auth.login.toggleToSignIn")}
        </button>
      </div>
    </div>
  );
}
