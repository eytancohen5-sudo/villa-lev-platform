"use client";

// TEMPORARY: simple shared-password gate replacing Firebase RBAC.
// Full RBAC (invite/role system) is saved in src/.rbac-saved/ for
// re-implementation once it has been thoroughly tested.

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { signInAnonymously, updateProfile } from "firebase/auth";
import { getAuthInstance } from "@/lib/firebase";

const PASS_KEY = "vl-admin-pass";
const NAME_KEY = "vl-admin-name";

function checkStored(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return (
      localStorage.getItem(PASS_KEY) ===
      (process.env.NEXT_PUBLIC_ADMIN_PASS ?? "")
    );
  } catch {
    return false;
  }
}

export function AuthGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const [mounted, setMounted] = useState(false);
  const [authorized, setAuthorized] = useState(false);
  const [name, setName] = useState("");
  const [pass, setPass] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setMounted(true);
    setAuthorized(checkStored());
    try {
      setName(localStorage.getItem(NAME_KEY) ?? "");
    } catch { /* private mode */ }
  }, []);

  // Login page and public routes bypass the gate.
  if (pathname === "/admin/login") return <>{children}</>;

  // SSR / pre-mount: render nothing to avoid flash.
  if (!mounted) return null;

  if (!authorized) {
    const submit = () => {
      if (!name.trim()) { setError("Please enter your name."); return; }
      if (pass === (process.env.NEXT_PUBLIC_ADMIN_PASS ?? "")) {
        try {
          localStorage.setItem(PASS_KEY, pass);
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
        setError("Incorrect access code.");
      }
    };

    return (
      <div className="flex items-center justify-center min-h-screen bg-surface-primary">
        <div className="max-w-sm w-full bg-white rounded-xl border border-surface-tertiary p-8 space-y-4">
          <div>
            <h1 className="font-display text-xl text-text-primary">Villa Lev</h1>
            <p className="text-xs text-text-tertiary mt-0.5">Finance Platform</p>
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
