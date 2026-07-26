"use client";

import { useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { getAccessToken } from "@/lib/token-store";

// The landing is a public server-rendered page, but a logged-in visitor
// should land in the app, not on marketing. Tokens live only in
// localStorage (see CLAUDE.md's Known Limitations), so this check is
// structurally client-only — same trade-off as AuthGate: logged-in users
// see one frame of landing before the bounce.
export function RedirectIfAuthed() {
  const router = useRouter();
  const { locale } = useParams<{ locale: string }>();

  useEffect(() => {
    if (getAccessToken()) router.replace(`/${locale}/finance`);
  }, [router, locale]);

  return null;
}
