"use client";

import { useEffect } from "react";
import type { UseFormReturn, FieldValues } from "react-hook-form";

// Resets `form` only when `open` flips true or `entity`'s identity changes —
// never on any other re-render, in particular never because some unrelated
// list prop the caller derived defaults from (e.g. a wallets/categories
// array recomputed inline on every parent render) got a new reference. This
// was a real bug (BudgetFormDialog/TransactionFormDialog wiping in-progress
// input on a background refetch) — see CLAUDE.md's Web UI Architecture
// notes. `buildDefaults` is deliberately NOT part of the effect's own
// dependency array; there's simply no slot to smuggle a second, unrelated
// dependency into. Pass `entity: null` for create-mode.
export function useResetFormOnOpen<TFieldValues extends FieldValues, TEntity>(
  form: UseFormReturn<TFieldValues>,
  open: boolean,
  entity: TEntity | null,
  buildDefaults: (entity: TEntity | null) => TFieldValues,
): void {
  useEffect(() => {
    if (!open) return;
    form.reset(buildDefaults(entity));
    // buildDefaults intentionally excluded from deps, see doc comment above.
  }, [open, entity, form]);
}
