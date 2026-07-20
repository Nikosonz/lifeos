"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { getAccessToken } from "@/lib/token-store";

// Every authenticated page in this app is effectively client-rendered: auth
// tokens live only in localStorage (no cookie-based session — see
// CLAUDE.md's Known Limitations on why that's a deliberate, deferred
// decision, not an oversight), and a Server Component has no way to read
// localStorage. This gate checks token presence on mount and redirects to
// /login if absent; actual token *validity* is handled reactively by
// api-client's 401-refresh-retry flow, not here. The brief flash/blank
// render on every load is an accepted trade-off of this architecture, not
// something this pass fixes.
export function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const params = useParams<{ locale: string }>();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!getAccessToken()) {
      router.replace(`/${params.locale}/login`);
      return;
    }
    setReady(true);
  }, [router, params.locale]);

  if (!ready) return null;
  return <>{children}</>;
}
