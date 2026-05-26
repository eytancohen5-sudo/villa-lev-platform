"use client";

// TEMPORARY: login page is unused while the shared-password gate is active.
// AuthGate handles access at every /admin/* route directly.
// This redirect prevents anyone landing on /admin/login from getting stuck.

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AdminLoginPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/admin/dashboard");
  }, [router]);
  return null;
}
