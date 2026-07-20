"use client";

import { useState } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { makeQueryClient } from "@/lib/query-client";

// Follows TanStack Query's official Next.js App Router pattern: the client
// is created inside useState's initializer so it's stable across re-renders
// but fresh per component-tree mount (never a module-level singleton, which
// would leak cached data across unrelated users under RSC). Nothing here
// does SSR data-fetching yet (every authenticated page is client-rendered
// per the auth-gate design), but this is the correct shape from day one.
export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => makeQueryClient());
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
