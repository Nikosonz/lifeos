"use client";

import { useState, useCallback } from "react";

export interface JalaliYearMonth {
  year: number;
  month: number;
}

// Pure UI-navigation state for the Dashboard/Budgets month picker — the
// actual "what belongs to this Jalali month" computation stays 100%
// server-side (see packages/core/src/shared/jalali.ts); this hook only
// tracks which month the user is currently looking at and handles the
// month-12 -> next-year-month-1 (and month-1 -> prior-year-month-12)
// rollover when navigating.
export function useJalaliMonth(initial: JalaliYearMonth) {
  const [value, setValue] = useState<JalaliYearMonth>(initial);

  const next = useCallback(() => {
    setValue((v) =>
      v.month === 12 ? { year: v.year + 1, month: 1 } : { year: v.year, month: v.month + 1 },
    );
  }, []);

  const prev = useCallback(() => {
    setValue((v) =>
      v.month === 1 ? { year: v.year - 1, month: 12 } : { year: v.year, month: v.month - 1 },
    );
  }, []);

  return { ...value, next, prev };
}
