"use client";

import { useState, useCallback } from "react";
import { addJalaliDays, type JalaliDate } from "@lifeos/core/src/shared/jalali";

// Pure UI-navigation state for the Calendar page's Week view — mirrors
// useJalaliMonth's role for the Agenda view. Tracks a single "anchor" date
// inside the currently-viewed Saturday-start week; jalaliWeekDays(anchor)
// (called by the page, not here) resolves that to the actual 7 days shown.
// The "what week does this anchor fall in" computation stays in
// @lifeos/core/src/shared/jalali.ts — this hook only owns navigation.
export function useJalaliWeek(initial: JalaliDate) {
  const [anchor, setAnchor] = useState<JalaliDate>(initial);

  const next = useCallback(() => {
    setAnchor((d) => addJalaliDays(d, 7));
  }, []);

  const prev = useCallback(() => {
    setAnchor((d) => addJalaliDays(d, -7));
  }, []);

  const goToday = useCallback((today: JalaliDate) => {
    setAnchor(today);
  }, []);

  return { anchor, next, prev, goToday };
}
