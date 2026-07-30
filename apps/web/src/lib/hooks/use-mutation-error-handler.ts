"use client";

import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ConflictDetails } from "@lifeos/contracts";
import { ApiError } from "../api-client";

/**
 * A 409 that specifically means "another device wrote this row first".
 *
 * `CONFLICT` is NOT one condition. Three server paths raise it today:
 *
 *   1. an optimistic-concurrency failure (`versioned-write.ts`)
 *   2. an `Idempotency-Key` replayed with a different body (`transaction-service.ts`)
 *   3. a duplicate label name (`label-service.ts`)
 *
 * Only the first is resolved by "someone else changed this, here is the fresh
 * copy" — telling a user that about a duplicate label name would be simply
 * false. `details.currentVersion` is what separates them, which is the concrete
 * reason ADR-0020 put a payload on the error at all rather than leaving 409
 * bare: without it a client can see *that* it conflicted but not *why*, and
 * has no correct message to show.
 */
function isVersionConflict(error: unknown): error is ApiError {
  return (
    error instanceof ApiError &&
    error.code === "CONFLICT" &&
    ConflictDetails.safeParse(error.details).success
  );
}

/**
 * The `onError` handler for every mutation on a page.
 *
 * Non-conflict errors behave exactly as the hand-written
 * `(error) => toast.error(error.message)` they replace, so adopting this is a
 * no-op for them. What it adds is that a version conflict refetches before
 * telling the user anything — by the time they read the message the list
 * underneath has already been replaced with the other device's data, so
 * "review it and try again" is advice they can immediately act on rather than
 * an instruction to go and refresh the page themselves.
 *
 * `queryKeyPrefix` is the same broad prefix the page's own success path
 * invalidates ("finance", "tasks", …) — see CLAUDE.md on why invalidation here
 * is deliberately broad rather than precise.
 */
export function useMutationErrorHandler(queryKeyPrefix: string): (error: Error) => void {
  const queryClient = useQueryClient();
  const c = useTranslations("Common");

  return useCallback(
    (error: Error) => {
      if (isVersionConflict(error)) {
        queryClient.invalidateQueries({ queryKey: [queryKeyPrefix] });
        toast.error(c("conflictError"));
        return;
      }
      toast.error(error.message);
    },
    [queryClient, queryKeyPrefix, c],
  );
}
