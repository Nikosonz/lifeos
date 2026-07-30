import { HolidayQuery, HolidayListResponse } from "@lifeos/contracts";
import { getHolidaysForJalaliYear } from "@lifeos/core";
import { defineRoute } from "@/lib/route-handler";

// Requires standard Bearer auth like every other /api/v1 route, even though
// the payload itself isn't user-specific (fixed-Jalali-date table — see
// packages/core/src/calendar/holidays.ts for the Hijri/lunar scope cut).
export const GET = defineRoute(
  { query: HolidayQuery, response: HolidayListResponse },
  async ({ query }) => {
    const holidays = getHolidaysForJalaliYear(query.year);
    return {
      year: query.year,
      holidays: holidays.map((h) => ({
        name: h.name,
        jalaliYear: h.jalaliYear,
        jalaliMonth: h.jalaliMonth,
        jalaliDay: h.jalaliDay,
        date: h.date.toISOString(),
      })),
    };
  },
);
