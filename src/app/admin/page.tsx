"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AdminPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/admin/dashboard");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
