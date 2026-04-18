"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();
  const redirected = useRef(false);

  useEffect(() => {
    if (!redirected.current) {
      redirected.current = true;
      router.replace("/admin/dashboard");
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}
