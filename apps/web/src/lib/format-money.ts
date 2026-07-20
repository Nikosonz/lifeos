// Toman = Rial ÷ 10, display-scale only — see CLAUDE.md's Money & Date
// Conventions and the lifeos-domain skill. Every amount crosses the wire as
// a Rial minor-unit string (never a float, per MoneyAmountInput's contract);
// this file is the ONLY place that division happens, and it happens via
// BigInt, never parseFloat, to stay consistent with the project's
// never-float-money discipline all the way to the last mile.
const PERSIAN_DIGITS = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];

export function toPersianDigits(input: string): string {
  return input.replace(/[0-9]/g, (d) => PERSIAN_DIGITS[Number(d)]!);
}

function groupDigits(absValue: bigint): string {
  return absValue.toLocaleString("en-US"); // en-US grouping = plain "," every 3 digits, digit-set swapped separately for fa
}

// rial: a MoneyAmountInput-shaped string ("0" or a non-negative integer,
// no sign — the contract never emits negative amounts; INCOME/EXPENSE
// direction is a separate `type` field, not carried in the amount's sign).
export function formatTomanFromRial(rial: string, locale: "fa" | "en"): string {
  const toman = BigInt(rial) / 10n;
  const grouped = groupDigits(toman);
  return locale === "fa" ? toPersianDigits(grouped) : grouped;
}

// Un-grouped, un-localized Toman digits — used only to pre-fill an
// editable amount <Input> (where thousands separators would fight the
// user's cursor), as opposed to formatTomanFromRial's grouped/localized
// output for read-only display.
export function tomanRawFromRial(rial: string): string {
  return (BigInt(rial) / 10n).toString();
}

// Reverse direction: a user-typed Toman amount (plain digits, Persian or
// Latin) becomes the Rial minor-unit string the API expects.
export function parseTomanInputToRial(input: string): string {
  const latinDigits = input.replace(/[۰-۹]/g, (d) => String(PERSIAN_DIGITS.indexOf(d)));
  const digitsOnly = latinDigits.replace(/[^0-9]/g, "");
  if (digitsOnly === "") return "0";
  const toman = BigInt(digitsOnly);
  return (toman * 10n).toString();
}
