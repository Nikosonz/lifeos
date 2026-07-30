import { Prisma } from "../../generated/prisma/index";

/**
 * Optimistic-concurrency support for repository writes — see ADR-0020.
 *
 * These errors are translated from Prisma's P2025 here, in the db package, so
 * `packages/core` never touches a Prisma error — the same rule
 * `TaskLabelRepository` already follows for P2002.
 */

/** The row exists but has moved on; `currentVersion` is what it holds now. */
export class VersionConflictError extends Error {
  constructor(readonly currentVersion: number) {
    super(`Record was modified concurrently (current version ${currentVersion})`);
    this.name = "VersionConflictError";
  }
}

/** The row is gone entirely — hard-deleted between the ownership check and the write. */
export class RecordVanishedError extends Error {
  constructor() {
    super("Record no longer exists");
    this.name = "RecordVanishedError";
  }
}

/**
 * Builds the `where` for a version-checked write.
 *
 * The comparison MUST live in the write's own `where`, never in JavaScript
 * between a read and a write. The obvious-looking alternative —
 *
 *     const row = await findById(id);
 *     if (row.version !== expected) throw conflict;
 *     await update(id, data);
 *
 * — is check-then-act: two concurrent requests both read version 3, both pass
 * the check, and both write, reproducing the exact lost update the feature
 * exists to prevent while appearing to fix it.
 *
 * Prisma 6.2.1 permits a non-unique filter alongside the unique one
 * (`WhereUniqueInput` is `Prisma.AtLeast<{ id?, …, version? }, "id">`), so this
 * stays a single statement that still returns the updated row.
 */
export function versionedWhere(
  id: string,
  expectedVersion: number | undefined,
): { id: string; version?: number } {
  return expectedVersion === undefined ? { id } : { id, version: expectedVersion };
}

/**
 * Runs a version-checked write, translating a zero-row match into the right
 * error.
 *
 * P2025 is ambiguous: it means EITHER the version moved OR the row was deleted
 * outright. A sync client must not confuse the two — 409 means "refetch and
 * retry", 404 means "it is gone, stop retrying" — and conflating them makes a
 * client retry forever against a row that will never come back. So the failure
 * path (and only the failure path) re-reads by id to tell them apart.
 *
 * `expectedVersion === undefined` means the caller opted out of the check
 * entirely, so P2025 can only mean the row vanished; no re-read is needed to
 * know that, but running the same branch keeps one code path.
 */
export async function runVersionedWrite<T>(
  write: () => Promise<T>,
  rereadVersion: () => Promise<{ version: number } | null>,
): Promise<T> {
  try {
    return await write();
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      const current = await rereadVersion();
      throw current ? new VersionConflictError(current.version) : new RecordVanishedError();
    }
    throw err;
  }
}
