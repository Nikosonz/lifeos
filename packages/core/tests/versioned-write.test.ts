import { test } from "node:test";
import assert from "node:assert/strict";
import { VersionConflictError, RecordVanishedError } from "@lifeos/db";
import { versionedWrite } from "../src/shared/versioned-write";
import { ConflictError, NotFoundError } from "../src/errors/app-error";

/**
 * Translation only. The concurrency GUARANTEE is not testable here and is
 * deliberately not tested here — a fake that throws on command proves only
 * that it was told to. `packages/db/tests/optimistic-concurrency.test.ts`
 * makes the real claim against Postgres, including two genuinely concurrent
 * writes.
 *
 * What this file owns is the mapping, which is where a mistake would be silent:
 * a db-layer error escaping untranslated reaches the route as a 500 rather
 * than a 409, and a client would see a server fault instead of a conflict.
 */

const fail = (err: Error) => () => Promise.reject(err);

test("VersionConflictError becomes a 409 carrying the current version", async () => {
  await assert.rejects(
    () => versionedWrite("Habit", "update", "user-1", 3, fail(new VersionConflictError(7))),
    (err: unknown) => {
      assert.ok(err instanceof ConflictError);
      assert.equal(err.code, "CONFLICT");
      assert.equal(err.httpStatus, 409);
      assert.deepEqual(err.details, { currentVersion: 7 });
      assert.match(err.message, /Habit was modified by another device/);
      return true;
    },
  );
});

test("RecordVanishedError becomes a 404, NOT a 409", async () => {
  // The distinction drives client behaviour: 409 means refetch and retry, 404
  // means stop. Collapsing them makes a sync client retry forever against a
  // row that will never come back.
  await assert.rejects(
    () => versionedWrite("Task", "delete", "user-1", 2, fail(new RecordVanishedError())),
    (err: unknown) => {
      assert.ok(err instanceof NotFoundError);
      assert.equal(err.httpStatus, 404);
      return true;
    },
  );
});

test("an unrelated error passes through untouched", async () => {
  const boom = new Error("connection reset");
  await assert.rejects(
    () => versionedWrite("Wallet", "update", "user-1", 1, fail(boom)),
    (err: unknown) => err === boom,
  );
});

test("a successful write returns its value unchanged", async () => {
  const result = await versionedWrite("Habit", "update", "user-1", 1, () =>
    Promise.resolve({ id: "h1", version: 2 }),
  );
  assert.deepEqual(result, { id: "h1", version: 2 });
});

test("omitting expectedVersion still runs the write (opt-out, not rejection)", async () => {
  // The adoption path: already-installed clients send nothing and must keep
  // working, since a Cafe Bazaar build cannot be force-updated.
  const result = await versionedWrite("Habit", "update", "user-1", undefined, () =>
    Promise.resolve("written"),
  );
  assert.equal(result, "written");
});
