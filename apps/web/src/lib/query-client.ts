import { QueryClient } from "@tanstack/react-query";
import { ApiError } from "./api-client";

// A fresh QueryClient per request/mount — see ./query-provider.tsx for why
// this isn't a module-level singleton (that would leak cached data across
// unrelated users/requests under React Server Components).
export function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: (failureCount, error) => {
          // Don't retry auth/validation/not-found errors — only transient
          // ones. ApiError.status is always populated by apiFetch.
          if (error instanceof ApiError && error.status < 500) return false;
          return failureCount < 2;
        },
      },
    },
  });
}
