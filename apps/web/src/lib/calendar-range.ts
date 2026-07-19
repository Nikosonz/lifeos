import { jalaaliMonthRangeUtc } from "@lifeos/core";
import type { CalendarRangeQuery } from "@lifeos/contracts";

// Resolves an already-Zod-validated CalendarRangeQuery (mutually exclusive
// from/to vs. jalaliYear/jalaliMonth — see packages/contracts/src/calendar/schemas.ts)
// into a concrete UTC [gte, lt) range. Route-parameter plumbing, not
// business logic — the actual Jalali-boundary math is core's
// jalaaliMonthRangeUtc, reused verbatim.
export function resolveRangeQuery(query: CalendarRangeQuery): { gte: Date; lt: Date } {
  if (query.jalaliYear !== undefined && query.jalaliMonth !== undefined) {
    return jalaaliMonthRangeUtc(query.jalaliYear, query.jalaliMonth);
  }
  return { gte: new Date(query.from as string), lt: new Date(query.to as string) };
}
