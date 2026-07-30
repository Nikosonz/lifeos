import { VersionConflictError, RecordVanishedError } from "@lifeos/db";
import type { ConflictDetails } from "@lifeos/contracts";
import { NotFoundError, ConflictError } from "../errors/app-error";
import { logger } from "../logging/logger";

/**
 * Wraps one optimistic-concurrency-checked write (ADR-0020).
 *
 * A free function rather than a method on `OwnedResourceCrud` because not
 * every service has one: `TaskService` predates that class and carries its own
 * ownership check and audit calls. Putting the concurrency concern here means
 * both shapes translate identically instead of TaskService growing a private
 * copy that drifts.
 *
 * Note what this does NOT do: compare `expectedVersion` against anything. The
 * comparison lives in the repository's WHERE clause and only there. Comparing
 * here — after a read, before a write — would be check-then-act, where two
 * concurrent callers both observe version 3, both pass, and both write.
 *
 * Two failure modes come back from the db layer and must not be merged:
 *
 *   VersionConflictError -> 409, "refetch and retry"
 *   RecordVanishedError  -> 404, "it is gone, stop retrying"
 *
 * Collapsing the second into the first makes a sync client retry forever
 * against a row that will never return.
 *
 * The absent-precondition warn is the adoption gate. `expectedVersion` is
 * optional only because an installed Cafe Bazaar build cannot be
 * force-updated; when this log goes quiet across a release, the contract can
 * be flipped to required as an observation rather than a guess.
 */
export async function versionedWrite<R>(
  entityName: string,
  action: string,
  userId: string,
  expectedVersion: number | undefined,
  write: () => Promise<R>,
): Promise<R> {
  if (expectedVersion === undefined) {
    logger.warn(
      { event: "concurrency.unversioned_write", entity: entityName, action, userId },
      `${action} without expectedVersion — last-write-wins`,
    );
  }
  try {
    return await write();
  } catch (err) {
    if (err instanceof VersionConflictError) {
      const details: ConflictDetails = { currentVersion: err.currentVersion };
      throw new ConflictError(`${entityName} was modified by another device`, details);
    }
    if (err instanceof RecordVanishedError) throw new NotFoundError(entityName);
    throw err;
  }
}
