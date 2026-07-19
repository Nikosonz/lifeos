import { tehranMidnightUtc } from "../shared/jalali";

// Fixed-Jalali-date Iranian public holidays only. Deliberately excludes
// Hijri/lunar-based holidays (Eid al-Fitr, Eid al-Adha, Ashura, Tasua,
// Arbaeen, ...) — those shift against the Jalali calendar every Gregorian
// year and would need either a Hijri conversion library or manual per-year
// entry, both out of scope for this pass. Month/day are the same every
// Jalali year, which is what makes a year-independent static table correct
// here at all.
interface FixedHoliday {
  month: number;
  day: number;
  name: string;
}

const FIXED_HOLIDAYS: FixedHoliday[] = [
  { month: 1, day: 1, name: "Nowruz" },
  { month: 1, day: 2, name: "Nowruz Holiday" },
  { month: 1, day: 3, name: "Nowruz Holiday" },
  { month: 1, day: 4, name: "Nowruz Holiday" },
  { month: 1, day: 12, name: "Islamic Republic Day" },
  { month: 1, day: 13, name: "Nature Day (Sizdah Bedar)" },
  { month: 3, day: 14, name: "Death of Imam Khomeini" },
  { month: 3, day: 15, name: "15 Khordad Uprising" },
  { month: 11, day: 22, name: "Islamic Revolution Victory" },
  { month: 12, day: 29, name: "Oil Industry Nationalization Day" },
];

export interface Holiday {
  name: string;
  jalaliYear: number;
  jalaliMonth: number;
  jalaliDay: number;
  date: Date;
}

export function getHolidaysForJalaliYear(year: number): Holiday[] {
  return FIXED_HOLIDAYS.map((h) => ({
    name: h.name,
    jalaliYear: year,
    jalaliMonth: h.month,
    jalaliDay: h.day,
    date: tehranMidnightUtc(year, h.month, h.day),
  }));
}
