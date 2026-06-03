"use client";

// TEMPORARY: simple shared-password gate replacing Firebase RBAC.
// Full RBAC (invite/role system) is saved in src/.rbac-saved/ for
// re-implementation once it has been thoroughly tested.

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { signInAnonymously, updateProfile, GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { getAuthInstance } from "@/lib/firebase";
import { useTranslation } from "@/lib/i18n/I18nProvider";

const ADMIN_EMAIL = (process.env.NEXT_PUBLIC_ADMIN_EMAIL ?? "").toLowerCase();

const PASS_KEY = "vl-admin-pass";
const NAME_KEY = "vl-admin-name";

// Security note (BE-01): The raw password still ships in the client bundle via
// NEXT_PUBLIC_ADMIN_PASS — this hashing layer only prevents a stolen localStorage
// token from being used as a one-shot credential elsewhere. Full mitigation
// requires moving auth to a server-side secret (tracked separately).
async function sha256(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function checkStored(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  try {
    const stored = localStorage.getItem(PASS_KEY);
    if (!stored) return false;
    const expected = await sha256(process.env.NEXT_PUBLIC_ADMIN_PASS ?? "");
    return stored === expected;
  } catch {
    return false;
  }
}

export function AuthGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useTranslation();

  const [mounted, setMounted] = useState(false);
  const [authorized, setAuthorized] = useState(false);
  const [name, setName] = useState("");
  const [pass, setPass] = useState("");
  const [error, setError] = useState("");
  const [googleLoading, setGoogleLoading] = useState(false);

  useEffect(() => {
    void (async () => {
      const isAuthorized = await checkStored();

      if (isAuthorized) {
        try { setName(localStorage.getItem(NAME_KEY) ?? ""); } catch { /* private mode */ }
        setAuthorized(true);
        // Re-establish anon Firebase session on return visits. The password gate
        // persists in localStorage indefinitely, but the anon auth session can
        // expire. Without this, canEdit stays false and saves silently fail.
        const auth = getAuthInstance();
        if (auth) {
          void (async () => {
            try {
              if (typeof (auth as { authStateReady?: () => Promise<void> }).authStateReady === 'function') {
                await (auth as { authStateReady: () => Promise<void> }).authStateReady();
              }
              if (!auth.currentUser) {
                const storedName = (() => { try { return localStorage.getItem(NAME_KEY) ?? ""; } catch { return ""; } })();
                const cred = await signInAnonymously(auth);
                if (cred.user && storedName) {
                  await updateProfile(cred.user, { displayName: storedName });
                }
              }
            } catch { /* non-fatal — UI still works, writes will fail gracefully */ }
          })();
        }
      } else {
        // localStorage hash missing — check if Firebase Auth already has a live
        // non-anonymous session (e.g. Eytan's Google sign-in). Mirrors BankGate's
        // checkExistingAuth pattern: setMounted is deferred so the form never
        // flashes for an already-authenticated admin.
        const auth = getAuthInstance();
        let autoAuthorized = false;
        if (auth) {
          try {
            if (typeof (auth as { authStateReady?: () => Promise<void> }).authStateReady === 'function') {
              await (auth as { authStateReady: () => Promise<void> }).authStateReady();
            }
          } catch { /* ignore */ }
          const user = auth.currentUser;
          if (user && !user.isAnonymous) {
            const displayName = user.displayName ?? user.email ?? "Eytan";
            try {
              const hash = await sha256(process.env.NEXT_PUBLIC_ADMIN_PASS ?? "");
              localStorage.setItem(PASS_KEY, hash);
              localStorage.setItem(NAME_KEY, displayName);
            } catch { /* private mode */ }
            setName(displayName);
            setAuthorized(true);
            autoAuthorized = true;
          }
        }
        if (!autoAuthorized) {
          try { setName(localStorage.getItem(NAME_KEY) ?? ""); } catch { /* private mode */ }
        }
      }

      // Always set mounted last — component renders null until this point,
      // so the name-entry form never flashes for an authenticated admin.
      setMounted(true);
    })();
  }, []);

  // Login page and public routes bypass the gate.
  if (pathname === "/admin/login") return <>{children}</>;

  // SSR / pre-mount: render nothing to avoid flash.
  if (!mounted) return null;

  if (!authorized) {
    const handleGoogleSignIn = async () => {
      const auth = getAuthInstance();
      if (!auth) { setError("Firebase not available."); return; }
      setGoogleLoading(true);
      setError("");
      try {
        const provider = new GoogleAuthProvider();
        const cred = await signInWithPopup(auth, provider);
        const email = cred.user.email?.toLowerCase() ?? "";
        if (ADMIN_EMAIL && email !== ADMIN_EMAIL) {
          await auth.signOut();
          setError("This Google account is not authorised. Use the access code below.");
          setGoogleLoading(false);
          return;
        }
        const displayName = cred.user.displayName ?? "Eytan";
        try {
          const hash = await sha256(process.env.NEXT_PUBLIC_ADMIN_PASS ?? "");
          localStorage.setItem(PASS_KEY, hash);
          localStorage.setItem(NAME_KEY, displayName);
        } catch { /* private mode */ }
        setAuthorized(true);
        router.replace("/admin/dashboard");
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Google sign-in failed.";
        // Popup closed by user is not a real error — stay silent.
        if (!msg.includes("popup-closed") && !msg.includes("cancelled")) {
          setError(msg);
        }
      } finally {
        setGoogleLoading(false);
      }
    };

    const submit = () => {
      if (!name.trim()) { setError(t('auth.gate.nameRequired')); return; }
      void (async () => {
      const [passHash, expectedHash] = await Promise.all([
        sha256(pass),
        sha256(process.env.NEXT_PUBLIC_ADMIN_PASS ?? ""),
      ]);
      if (passHash === expectedHash) {
        try {
          localStorage.setItem(PASS_KEY, passHash);
          localStorage.setItem(NAME_KEY, name.trim());
        } catch { /* private mode */ }
        setAuthorized(true);
        router.replace("/admin/dashboard");
        // Fire-and-forget: sign in anonymously so Firestore writes get a stable
        // uid. Runs after redirect so the gate feels instant. Google-signed-in
        // users (Eytan) keep their existing session; we only create an anon
        // session when no Firebase Auth session exists.
        const auth = getAuthInstance();
        if (auth) {
          void (async () => {
            try {
              if (typeof (auth as { authStateReady?: () => Promise<void> }).authStateReady === 'function') {
                await (auth as { authStateReady: () => Promise<void> }).authStateReady();
              }
              if (!auth.currentUser) {
                const cred = await signInAnonymously(auth);
                if (cred.user && name.trim()) {
                  await updateProfile(cred.user, { displayName: name.trim() });
                }
              }
            } catch { /* non-fatal */ }
          })();
        }
      } else {
        setError(t('auth.gate.incorrectCode'));
      }
      })();
    };

    return (
      <div className="flex items-center justify-center min-h-screen bg-surface-primary">
        <div className="max-w-sm w-full bg-white rounded-xl border border-surface-tertiary p-8 space-y-4">
          <div>
            <h1 className="font-display text-xl text-text-primary">Villa Lev</h1>
            <p className="text-xs text-text-tertiary mt-0.5">{t('app.platform')}</p>
          </div>
          {/* Google sign-in — persistent identity for the administrator */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={googleLoading}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-surface-tertiary bg-white text-sm font-medium text-text-primary hover:bg-surface-secondary transition-colors disabled:opacity-50"
          >
            <svg width="16" height="16" viewBox="0 0 18 18" aria-hidden="true">
              <path fill="#4285F4" d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 0 0 2.38-5.88c0-.57-.05-.66-.15-1.18z"/>
              <path fill="#34A853" d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2a4.8 4.8 0 0 1-7.18-2.54H1.83v2.07A8 8 0 0 0 8.98 17z"/>
              <path fill="#FBBC05" d="M4.5 10.52a4.8 4.8 0 0 1 0-3.04V5.41H1.83a8 8 0 0 0 0 7.18l2.67-2.07z"/>
              <path fill="#EA4335" d="M8.98 4.18c1.17 0 2.23.4 3.06 1.2l2.3-2.3A8 8 0 0 0 1.83 5.4L4.5 7.49a4.77 4.77 0 0 1 4.48-3.3z"/>
            </svg>
            {googleLoading ? t('auth.gate.signingIn') : t('auth.gate.signInGoogle')}
          </button>

          <div className="flex items-center gap-2">
            <div className="h-px flex-1 bg-surface-tertiary" />
            <span className="text-[11px] text-text-tertiary uppercase tracking-wider">or</span>
            <div className="h-px flex-1 bg-surface-tertiary" />
          </div>

          <input
            type="text"
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder="Your name"
            className="w-full px-3 py-2 text-sm rounded-lg border border-surface-tertiary bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/30"
          />
          <input
            type="password"
            value={pass}
            onChange={(e) => setPass(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder="Access code"
            className="w-full px-3 py-2 text-sm rounded-lg border border-surface-tertiary bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/30"
          />
          {error && <p className="text-xs text-warning">{error}</p>}
          <button
            type="button"
            onClick={submit}
            className="w-full px-4 py-2.5 rounded-lg bg-brand-700 text-white text-sm font-medium hover:bg-brand-800 transition-colors"
          >
            Enter
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

// Utility — read the name the visitor entered at the gate.
// Used by scenario-save flows to tag who made the save.
export function getGateName(): string {
  if (typeof window === "undefined") return "";
  try { return localStorage.getItem(NAME_KEY) ?? ""; } catch { return ""; }
}
