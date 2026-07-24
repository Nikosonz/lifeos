"use client";

import { useEffect } from "react";
import type { UseFormReturn, FieldValues } from "react-hook-form";

// Same reset-on-open contract as useResetFormOnOpen, for a dialog whose
// edit-mode data arrives via its OWN fetch (e.g. EventFormDialog's useQuery
// for the full recurrence record, since Agenda's list items only carry
// occurrence-projection fields) rather than a synchronous prop.
// `fetchedEntity` is `undefined` while the fetch is in flight; `id: null`
// means create-mode. This hook does NOT gate loading state itself — the
// caller derives its own `isLoading` (e.g. `id !== null && fetchedEntity ===
// undefined`) and uses it to disable Save. The form must stay mounted
// throughout — conditionally unmounting it previously caused react-hook-
// form's Controller-bound fields to re-register against stale static
// defaultValues on remount (the exact bug this formalizes the fix for).
export function useResetFormOnFetchedEntity<TFieldValues extends FieldValues, TEntity>(
  form: UseFormReturn<TFieldValues>,
  open: boolean,
  id: string | null,
  fetchedEntity: TEntity | null | undefined,
  buildDefaults: (entity: TEntity) => TFieldValues,
  buildCreateDefaults: () => TFieldValues,
): void {
  useEffect(() => {
    if (!open) return;
    if (id === null) {
      form.reset(buildCreateDefaults());
      return;
    }
    if (fetchedEntity === undefined || fetchedEntity === null) return;
    form.reset(buildDefaults(fetchedEntity));
    // buildDefaults/buildCreateDefaults intentionally excluded from deps,
    // see doc comment above.
  }, [open, id, fetchedEntity, form]);
}
