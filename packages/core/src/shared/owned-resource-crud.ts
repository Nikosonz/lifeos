import type { IAuditLogRepository } from "@lifeos/db";
import { NotFoundError } from "../errors/app-error";
import { versionedWrite } from "./versioned-write";

export interface Ownable {
  id: string;
  userId: string;
  deletedAt: Date | null;
}

export interface OwnedCrudRepository<T extends Ownable, CreateData, UpdateData> {
  // Optional: a repository whose real insert path is an upsert against a
  // different unique key (e.g. FinanceBudget's create-or-update-by-period)
  // has no plain create at all — its service never calls crud.create() and
  // writes that path by hand, but still composes getOwned/update/delete.
  create?(data: CreateData): Promise<T>;
  findById(id: string): Promise<T | null>;
  update(id: string, data: UpdateData, expectedVersion?: number): Promise<T>;
  // Optional for the same reason: a repository whose delete has a real side
  // effect beyond soft-deleting the row itself (TaskProject's delete also
  // bulk-unassigns its tasks) has no plain softDelete — its service never
  // calls crud.delete() and writes that path by hand.
  softDelete?(id: string, expectedVersion?: number): Promise<T>;
}

export interface OwnedResourceCrudConfig {
  entityName: string;
  actionPrefix: string;
}

// Shared ownership+audit skeleton for the "resource one user owns, with the
// standard create/getOwned/update/soft-delete + audit-log lifecycle" shape
// every core service in this project needs — see
// docs/decisions/0010-owned-resource-crud.md for why this exists and why
// it's composed (constructor-injected) rather than a base class services
// extend.
//
// getOwned/audit are exposed as independently-callable pieces alongside the
// create/update/delete convenience methods precisely so a service with one
// divergent step (Project's delete also unassigns tasks; Label's
// create/update translate a duplicate-name error; Budget's create checks a
// different entity's ownership) composes around that one step instead of
// this class growing a configuration knob to accommodate it.
export class OwnedResourceCrud<T extends Ownable, CreateData, UpdateData> {
  constructor(
    private readonly repository: OwnedCrudRepository<T, CreateData, UpdateData>,
    private readonly auditLogRepository: IAuditLogRepository,
    private readonly config: OwnedResourceCrudConfig,
  ) {}

  async getOwned(id: string, userId: string): Promise<T> {
    const entity = await this.repository.findById(id);
    if (!entity || entity.userId !== userId || entity.deletedAt) {
      throw new NotFoundError(this.config.entityName);
    }
    return entity;
  }

  // Metadata key is mechanically derived from entityName ("Wallet" ->
  // walletId) — verified against every existing service's audit call, zero
  // exceptions, before this class was written; see ADR-0010.
  async audit(userId: string, verb: string, id: string): Promise<void> {
    const key = `${this.config.entityName.charAt(0).toLowerCase()}${this.config.entityName.slice(1)}Id`;
    await this.auditLogRepository.record({
      userId,
      action: `${this.config.actionPrefix}.${verb}`,
      metadata: { [key]: id },
    });
  }

  // Takes CreateData only — no separate userId parameter. The audit entry's
  // userId is read off the entity the repository actually returned, not a
  // value the caller passes a second time, so it can never drift from what
  // was actually persisted.
  async create(data: CreateData): Promise<T> {
    if (!this.repository.create) {
      throw new Error(
        `OwnedResourceCrud for "${this.config.entityName}" has no create() — its repository has no plain create method`,
      );
    }
    const entity = await this.repository.create(data);
    await this.audit(entity.userId, "created", entity.id);
    return entity;
  }

  /**
   * `expectedVersion` is the optimistic-concurrency precondition (ADR-0020).
   *
   * Note what is NOT here: any comparison of `expectedVersion` against the
   * entity `getOwned` just returned. That would be check-then-act — two
   * concurrent callers both read version 3, both pass, both write. The
   * comparison belongs in the repository's own WHERE clause and nowhere else;
   * this method only forwards the value and translates what comes back.
   */
  async update(id: string, userId: string, data: UpdateData, expectedVersion?: number): Promise<T> {
    await this.getOwned(id, userId);
    const updated = await this.versionedWrite("update", userId, expectedVersion, () =>
      this.repository.update(id, data, expectedVersion),
    );
    await this.audit(userId, "updated", id);
    return updated;
  }

  async delete(id: string, userId: string, expectedVersion?: number): Promise<void> {
    if (!this.repository.softDelete) {
      throw new Error(
        `OwnedResourceCrud for "${this.config.entityName}" has no delete() — its repository has no plain softDelete method`,
      );
    }
    const softDelete = this.repository.softDelete.bind(this.repository);
    await this.getOwned(id, userId);
    await this.versionedWrite("delete", userId, expectedVersion, () =>
      softDelete(id, expectedVersion),
    );
    await this.audit(userId, "deleted", id);
  }

  /**
   * Thin binding of the shared `versionedWrite` to this instance's entity name.
   *
   * Public for the same reason `getOwned` and `audit` are (ADR-0010): a
   * service with one divergent step composes the pieces rather than this class
   * growing a configuration knob. `LabelService.updateLabel` and
   * `ProjectService.deleteProject` both bypass the bundled update/delete and
   * would otherwise leak a raw VersionConflictError straight to the route.
   */
  versionedWrite<R>(
    action: string,
    userId: string,
    expectedVersion: number | undefined,
    write: () => Promise<R>,
  ): Promise<R> {
    return versionedWrite(this.config.entityName, action, userId, expectedVersion, write);
  }
}
