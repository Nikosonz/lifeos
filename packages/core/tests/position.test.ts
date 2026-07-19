import { test } from "node:test";
import assert from "node:assert/strict";
import {
  appendPosition,
  midpoint,
  relativePosition,
  needsRenumber,
  renumberPlan,
  POSITION_GAP,
  MIN_GAP,
} from "../src/tasks/position";

test("appendPosition returns POSITION_GAP for an empty list", () => {
  assert.equal(appendPosition(null), POSITION_GAP);
});

test("appendPosition adds one gap on top of the current max", () => {
  assert.equal(appendPosition(1024), 1024 + POSITION_GAP);
});

test("midpoint returns the average of two positions", () => {
  assert.equal(midpoint(1024, 2048), 1536);
});

test("relativePosition with both neighbors null appends at POSITION_GAP", () => {
  assert.equal(relativePosition(null, null), POSITION_GAP);
});

test("relativePosition with only `after` given inserts one gap before it", () => {
  assert.equal(relativePosition(null, 1024), 1024 - POSITION_GAP);
});

test("relativePosition with only `before` given inserts one gap after it", () => {
  assert.equal(relativePosition(1024, null), 1024 + POSITION_GAP);
});

test("relativePosition with both neighbors given computes their midpoint", () => {
  assert.equal(relativePosition(1024, 2048), 1536);
});

test("needsRenumber is false whenever either neighbor is null (no gap to exhaust)", () => {
  assert.equal(needsRenumber(null, 100), false);
  assert.equal(needsRenumber(100, null), false);
  assert.equal(needsRenumber(null, null), false);
});

test("needsRenumber is false for an ordinary gap", () => {
  assert.equal(needsRenumber(1024, 2048), false);
});

test("needsRenumber is true once the gap collapses below MIN_GAP", () => {
  assert.equal(needsRenumber(1000, 1000 + MIN_GAP / 2), true);
});

test("repeatedly bisecting toward a fixed neighbor reaches MIN_GAP in a realistic number of steps", () => {
  // Mirrors the manual-verification scenario in the module plan: move a
  // task ever-closer to a fixed neighbor by halving the gap each time,
  // and confirm the renumber safeguard would actually fire before the
  // gap becomes meaningless (rather than bisecting forever).
  const before = 1024;
  let after = 2048;
  let steps = 0;
  while (!needsRenumber(before, after) && steps < 100) {
    after = midpoint(before, after);
    steps += 1;
  }
  assert.ok(steps < 100, "should reach MIN_GAP well before 100 bisections");
  assert.ok(needsRenumber(before, after));
});

test("renumberPlan spaces N ids evenly at POSITION_GAP intervals in the given order", () => {
  const plan = renumberPlan(["a", "b", "c"]);
  assert.equal(plan.get("a"), POSITION_GAP);
  assert.equal(plan.get("b"), POSITION_GAP * 2);
  assert.equal(plan.get("c"), POSITION_GAP * 3);
});

test("renumberPlan restores a gap large enough that relativePosition no longer needs a renumber", () => {
  const plan = renumberPlan(["a", "b"]);
  const a = plan.get("a")!;
  const b = plan.get("b")!;
  assert.equal(needsRenumber(a, b), false);
});
