import { test } from "node:test";
import assert from "node:assert/strict";
import { expandOccurrencesInRange } from "../src/calendar/recurrence";
import type { RecurringEventInput } from "../src/calendar/recurrence";

// Reference values below were confirmed directly against rrule's own output
// via a throwaway verification script before being written here (not
// derived from memory) — see the conversation history for the script.

function baseEvent(overrides: Partial<RecurringEventInput> = {}): RecurringEventInput {
  return {
    startAt: new Date("2026-01-01T00:00:00.000Z"),
    endAt: new Date("2026-01-01T01:00:00.000Z"),
    recurrenceFreq: "DAILY",
    recurrenceInterval: 1,
    recurrenceCount: null,
    recurrenceUntil: null,
    recurrenceByWeekday: [],
    ...overrides,
  };
}

function starts(occurrences: { start: Date }[]): string[] {
  return occurrences.map((o) => o.start.toISOString());
}

test("DAILY interval 1 expands one occurrence per day inside the range", () => {
  const occurrences = expandOccurrencesInRange(baseEvent(), {
    gte: new Date("2026-01-01T00:00:00.000Z"),
    lt: new Date("2026-01-04T00:00:00.000Z"),
  });
  assert.deepEqual(starts(occurrences), [
    "2026-01-01T00:00:00.000Z",
    "2026-01-02T00:00:00.000Z",
    "2026-01-03T00:00:00.000Z",
  ]);
  assert.equal(occurrences[0]?.end.toISOString(), "2026-01-01T01:00:00.000Z");
});

test("WEEKLY with a single byWeekday resolves to that weekday going forward", () => {
  const occurrences = expandOccurrencesInRange(
    baseEvent({ recurrenceFreq: "WEEKLY", recurrenceByWeekday: [1] }),
    { gte: new Date("2026-01-01T00:00:00.000Z"), lt: new Date("2026-01-22T00:00:00.000Z") },
  );
  assert.deepEqual(starts(occurrences), [
    "2026-01-05T00:00:00.000Z",
    "2026-01-12T00:00:00.000Z",
    "2026-01-19T00:00:00.000Z",
  ]);
});

test("WEEKLY with interval 2 and no byWeekday repeats every 2 weeks on dtstart's own weekday", () => {
  const occurrences = expandOccurrencesInRange(
    baseEvent({ recurrenceFreq: "WEEKLY", recurrenceInterval: 2 }),
    { gte: new Date("2026-01-01T00:00:00.000Z"), lt: new Date("2026-02-01T00:00:00.000Z") },
  );
  assert.deepEqual(starts(occurrences), [
    "2026-01-01T00:00:00.000Z",
    "2026-01-15T00:00:00.000Z",
    "2026-01-29T00:00:00.000Z",
  ]);
});

test("WEEKLY with two byWeekday values produces both per week", () => {
  const occurrences = expandOccurrencesInRange(
    baseEvent({ recurrenceFreq: "WEEKLY", recurrenceByWeekday: [1, 3] }),
    { gte: new Date("2026-01-01T00:00:00.000Z"), lt: new Date("2026-01-15T00:00:00.000Z") },
  );
  assert.deepEqual(starts(occurrences), [
    "2026-01-05T00:00:00.000Z",
    "2026-01-07T00:00:00.000Z",
    "2026-01-12T00:00:00.000Z",
    "2026-01-14T00:00:00.000Z",
  ]);
});

test("recurrenceCount caps the total occurrences regardless of a wider range", () => {
  const occurrences = expandOccurrencesInRange(baseEvent({ recurrenceCount: 3 }), {
    gte: new Date("2026-01-01T00:00:00.000Z"),
    lt: new Date("2027-01-01T00:00:00.000Z"),
  });
  assert.deepEqual(starts(occurrences), [
    "2026-01-01T00:00:00.000Z",
    "2026-01-02T00:00:00.000Z",
    "2026-01-03T00:00:00.000Z",
  ]);
});

test("recurrenceUntil stops occurrences after the given instant, inclusive", () => {
  const occurrences = expandOccurrencesInRange(
    baseEvent({ recurrenceUntil: new Date("2026-01-03T00:00:00.000Z") }),
    { gte: new Date("2026-01-01T00:00:00.000Z"), lt: new Date("2027-01-01T00:00:00.000Z") },
  );
  assert.deepEqual(starts(occurrences), [
    "2026-01-01T00:00:00.000Z",
    "2026-01-02T00:00:00.000Z",
    "2026-01-03T00:00:00.000Z",
  ]);
});

test("MONTHLY from the 31st skips months with no 31st day instead of clamping", () => {
  const occurrences = expandOccurrencesInRange(
    baseEvent({
      startAt: new Date("2026-01-31T00:00:00.000Z"),
      endAt: new Date("2026-01-31T01:00:00.000Z"),
      recurrenceFreq: "MONTHLY",
    }),
    { gte: new Date("2026-01-01T00:00:00.000Z"), lt: new Date("2026-06-01T00:00:00.000Z") },
  );
  assert.deepEqual(starts(occurrences), [
    "2026-01-31T00:00:00.000Z",
    "2026-03-31T00:00:00.000Z",
    "2026-05-31T00:00:00.000Z",
  ]);
});

test("YEARLY from Feb 29 produces no occurrence in a non-leap year", () => {
  const occurrences = expandOccurrencesInRange(
    baseEvent({
      startAt: new Date("2024-02-29T00:00:00.000Z"),
      endAt: new Date("2024-02-29T01:00:00.000Z"),
      recurrenceFreq: "YEARLY",
    }),
    { gte: new Date("2025-01-01T00:00:00.000Z"), lt: new Date("2026-01-01T00:00:00.000Z") },
  );
  assert.deepEqual(occurrences, []);
});

test("YEARLY from Feb 29 resumes on the next leap year", () => {
  const occurrences = expandOccurrencesInRange(
    baseEvent({
      startAt: new Date("2024-02-29T00:00:00.000Z"),
      endAt: new Date("2024-02-29T01:00:00.000Z"),
      recurrenceFreq: "YEARLY",
    }),
    { gte: new Date("2024-01-01T00:00:00.000Z"), lt: new Date("2029-01-01T00:00:00.000Z") },
  );
  assert.deepEqual(starts(occurrences), ["2024-02-29T00:00:00.000Z", "2028-02-29T00:00:00.000Z"]);
});

test("a multi-day occurrence starting before the range is still returned (overlap, not start-based, filtering)", () => {
  // Weekly, every Monday, each occurrence spans 3 days (Mon 00:00 -> Thu 00:00).
  // Querying from Tuesday noon of the first occurrence's week must still
  // return that occurrence, since it's still ongoing at that instant.
  const occurrences = expandOccurrencesInRange(
    baseEvent({
      startAt: new Date("2026-01-05T00:00:00.000Z"), // Monday
      endAt: new Date("2026-01-08T00:00:00.000Z"), // Thursday (3-day span)
      recurrenceFreq: "WEEKLY",
      recurrenceByWeekday: [1],
    }),
    { gte: new Date("2026-01-06T12:00:00.000Z"), lt: new Date("2026-01-10T00:00:00.000Z") },
  );
  assert.deepEqual(starts(occurrences), ["2026-01-05T00:00:00.000Z"]);
  assert.equal(occurrences[0]?.end.toISOString(), "2026-01-08T00:00:00.000Z");
});

test("a range entirely before the occurrence excludes it", () => {
  const occurrences = expandOccurrencesInRange(
    baseEvent({
      startAt: new Date("2026-01-05T00:00:00.000Z"),
      endAt: new Date("2026-01-08T00:00:00.000Z"),
      recurrenceFreq: "WEEKLY",
      recurrenceByWeekday: [1],
    }),
    { gte: new Date("2026-01-01T00:00:00.000Z"), lt: new Date("2026-01-05T00:00:00.000Z") },
  );
  assert.deepEqual(occurrences, []);
});
