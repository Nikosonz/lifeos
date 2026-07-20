"use client";

import { useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { getAccessToken } from "@/lib/token-store";

// A Server Component structurally cannot decide this redirect — tokens
// live only in localStorage, and this pass deliberately does not introduce
// a cookie-based session (see CLAUDE.md's Known Limitations). Client-only
// is consistent with every other authenticated surface in this app.
export default function RootPage() {
  const router = useRouter();
  const { locale } = useParams<{ locale: string }>();

  useEffect(() => {
    router.replace(`/${locale}/${getAccessToken() ? "finance" : "login"}`);
  }, [router, locale]);

  return null;
}
