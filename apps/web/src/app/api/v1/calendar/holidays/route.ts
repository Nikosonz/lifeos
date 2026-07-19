import { HolidayQuery } from "@lifeos/contracts";
import { getHolidaysForJalaliYear } from "@lifeos/core";
import { runRoute } from "@/lib/route-handler";
import { requireUser } from "@/lib/auth-context";

// Requires standard Bearer auth like every other /api/v1 route, even though
// the payload itself isn't user-specific (fixed-Jalali-date table — see
// packages/core/src/calendar/holidays.ts for the Hijri/lunar scope cut).
export const GET = runRoute(async (req) => {
  await requireUser(req);
  const query = HolidayQuery.parse(Object.fromEntries(req.nextUrl.searchParams));
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
});
