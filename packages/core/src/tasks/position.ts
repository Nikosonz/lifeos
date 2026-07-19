// Pure math for kanban-style manual ordering — no I/O, mirrors the role
// shared/jalali.ts plays for Jalali conversion. TaskService/SubtaskService
// own the orchestration (fetching neighbors, triggering a renumber);
// everything here is a deterministic function of position values.

export const POSITION_GAP = 1024;

// Below this gap, a midpoint computation risks floating-point precision
// loss (rounding to one of the two neighbors) — the caller renumbers the
// whole list before computing a position in this range.
export const MIN_GAP = 1e-6;

export function appendPosition(maxPosition: number | null): number {
  return (maxPosition ?? 0) + POSITION_GAP;
}

export function midpoint(a: number, b: number): number {
  return (a + b) / 2;
}

// `before`/`after` are the positions of the row that should end up
// immediately before/after the moved row. `null` for `before` means
// "insert at the very start"; `null` for `after` means "insert at the
// very end." Both non-null computes the midpoint between them.
export function relativePosition(before: number | null, after: number | null): number {
  if (before === null && after === null) return POSITION_GAP;
  if (before === null) return (after as number) - POSITION_GAP;
  if (after === null) return before + POSITION_GAP;
  return midpoint(before, after);
}

export function needsRenumber(before: number | null, after: number | null): boolean {
  if (before === null || after === null) return false;
  return Math.abs(after - before) < MIN_GAP;
}

// Describes (without performing) the outcome of renumbering N ids already
// in their desired final order: evenly spaced at POSITION_GAP intervals.
// The repository applies this atomically; kept here so the spacing
// decision has one pure, independently-testable home.
export function renumberPlan(orderedIds: string[]): Map<string, number> {
  const plan = new Map<string, number>();
  orderedIds.forEach((id, index) => {
    plan.set(id, (index + 1) * POSITION_GAP);
  });
  return plan;
}
