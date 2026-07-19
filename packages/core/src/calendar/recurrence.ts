import { createRequire } from "node:module";

// rrule resolves to two DIFFERENT builds depending on the runtime: plain
// Node/tsx (test runner) follows "main" (the CJS build, dist/es5/rrule.js),
// while Turbopack (Next.js build/dev) follows the bundler-only "module"
// field (the real-ESM build, dist/esm/index.js) — and those two builds
// disagree on whether RRule is a default or named export, so neither a
// plain named import nor a plain default import works in both runtimes at
// once (verified empirically — see ADR-0008). Forcing a CJS require via
// createRequire sidesteps the ESM default-vs-named ambiguity entirely in
// both runtimes, since property access on a CJS exports object doesn't
// depend on static export detection the way ESM imports do.
const require = createRequire(import.meta.url);
const { RRule } = require("rrule") as typeof import("rrule");

export type RecurrenceFreq = "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";

// JS Date.getDay() convention: 0=Sunday..6=Saturday. rrule's own weekday
// enum is Monday-based (RRule.MO..RRule.SU) — this array is the only place
// that difference is allowed to matter; nothing past this module ever
// sees an rrule.Weekday value.
const JS_WEEKDAY_TO_RRULE = [RRule.SU, RRule.MO, RRule.TU, RRule.WE, RRule.TH, RRule.FR, RRule.SA];

const FREQ_TO_RRULE: Record<RecurrenceFreq, number> = {
  DAILY: RRule.DAILY,
  WEEKLY: RRule.WEEKLY,
  MONTHLY: RRule.MONTHLY,
  YEARLY: RRule.YEARLY,
};

export interface RecurringEventInput {
  startAt: Date;
  endAt: Date;
  recurrenceFreq: RecurrenceFreq;
  recurrenceInterval: number;
  recurrenceCount: number | null;
  recurrenceUntil: Date | null;
  recurrenceByWeekday: number[];
}

export interface Occurrence {
  start: Date;
  end: Date;
}

// Expands a recurring event's occurrences that OVERLAP [range.gte, range.lt)
// — not just occurrences whose start falls inside it. A multi-day/allDay
// event's occurrence can start before range.gte and still be "in range"
// for part of the window, so the candidate search is widened by the
// event's own duration on the early side before filtering to true overlap.
export function expandOccurrencesInRange(
  event: RecurringEventInput,
  range: { gte: Date; lt: Date },
): Occurrence[] {
  const duration = event.endAt.getTime() - event.startAt.getTime();
  const byweekday = event.recurrenceByWeekday.map((day) => {
    const weekday = JS_WEEKDAY_TO_RRULE[day];
    if (!weekday) throw new Error(`Invalid weekday index: ${day}`);
    return weekday;
  });

  const rule = new RRule({
    freq: FREQ_TO_RRULE[event.recurrenceFreq],
    interval: event.recurrenceInterval,
    dtstart: event.startAt,
    ...(event.recurrenceCount !== null ? { count: event.recurrenceCount } : {}),
    ...(event.recurrenceUntil !== null ? { until: event.recurrenceUntil } : {}),
    ...(byweekday.length > 0 ? { byweekday } : {}),
  });

  const searchStart = new Date(range.gte.getTime() - duration);
  const candidates = rule.between(searchStart, range.lt, true);

  return candidates
    .map((start) => ({ start, end: new Date(start.getTime() + duration) }))
    .filter((occ) => occ.start < range.lt && occ.end > range.gte);
}
