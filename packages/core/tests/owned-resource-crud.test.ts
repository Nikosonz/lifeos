import { test } from "node:test";
import assert from "node:assert/strict";
import type { IAuditLogRepository } from "@lifeos/db";
import {
  OwnedResourceCrud,
  type Ownable,
  type OwnedCrudRepository,
} from "../src/shared/owned-resource-crud";
import { NotFoundError } from "../src/errors/app-error";

// A minimal stand-in entity/repository — deliberately shaped like every
// real repository this class composes with (create/findById/update/
// softDelete), per docs/decisions/0010-owned-resource-crud.md.
interface FakeThing extends Ownable {
  id: string;
  userId: string;
  deletedAt: Date | null;
  name: string;
}

function fakeRepository(): Omit<
  OwnedCrudRepository<FakeThing, { userId: string; name: string }, { name?: string }>,
  "create" | "softDelete"
> & {
  rows: FakeThing[];
  create: (data: { userId: string; name: string }) => Promise<FakeThing>;
  softDelete: (id: string) => Promise<FakeThing>;
} {
  const rows: FakeThing[] = [];
  return {
    rows,
    async create(data) {
      const row: FakeThing = { id: `thing-${rows.length}`, deletedAt: null, ...data };
      rows.push(row);
      return row;
    },
    async findById(id) {
      return rows.find((r) => r.id === id) ?? null;
    },
    async update(id, data) {
      const row = rows.find((r) => r.id === id)!;
      Object.assign(row, data);
      return row;
    },
    async softDelete(id) {
      const row = rows.find((r) => r.id === id)!;
      row.deletedAt = new Date();
      return row;
    },
  };
}

function fakeAuditLogRepository(): IAuditLogRepository & {
  records: Array<{ userId?: string | null; action: string; metadata?: unknown }>;
} {
  const records: Array<{ userId?: string | null; action: string; metadata?: unknown }> = [];
  return {
    records,
    async record(data) {
      records.push(data);
      return {
        id: `audit-${records.length}`,
        createdAt: new Date(),
        userId: data.userId ?? null,
        action: data.action,
        metadata: null,
      };
    },
  };
}

function buildCrud() {
  const repository = fakeRepository();
  const auditLogRepository = fakeAuditLogRepository();
  const crud = new OwnedResourceCrud(repository, auditLogRepository, {
    entityName: "Thing",
    actionPrefix: "test.thing",
  });
  return { crud, repository, auditLogRepository };
}

test("getOwned returns the entity when it exists, is owned, and isn't deleted", async () => {
  const { crud, repository } = buildCrud();
  const thing = await repository.create({ userId: "user-1", name: "A" });

  const found = await crud.getOwned(thing.id, "user-1");
  assert.equal(found.id, thing.id);
});

test("getOwned throws NotFoundError for an unknown id", async () => {
  const { crud } = buildCrud();
  await assert.rejects(() => crud.getOwned("no-such-id", "user-1"), NotFoundError);
});

test("getOwned throws NotFoundError for a thing owned by a different user", async () => {
  const { crud, repository } = buildCrud();
  const thing = await repository.create({ userId: "user-1", name: "A" });

  await assert.rejects(() => crud.getOwned(thing.id, "user-2"), NotFoundError);
});

test("getOwned throws NotFoundError for a soft-deleted thing, even for its real owner", async () => {
  const { crud, repository } = buildCrud();
  const thing = await repository.create({ userId: "user-1", name: "A" });
  await crud.delete(thing.id, "user-1");

  await assert.rejects(() => crud.getOwned(thing.id, "user-1"), NotFoundError);
});

test("audit writes the action and auto-derives the metadata key from entityName", async () => {
  const { crud, auditLogRepository } = buildCrud();

  await crud.audit("user-1", "frobnicated", "thing-7");

  assert.equal(auditLogRepository.records.length, 1);
  assert.equal(auditLogRepository.records[0]!.action, "test.thing.frobnicated");
  assert.deepEqual(auditLogRepository.records[0]!.metadata, { thingId: "thing-7" });
});

test("create derives the audit entry's userId from the entity the repository returned, not a passed-in value", async () => {
  const { crud, auditLogRepository } = buildCrud();

  const thing = await crud.create({ userId: "user-1", name: "A" });

  assert.equal(auditLogRepository.records.length, 1);
  assert.equal(auditLogRepository.records[0]!.userId, thing.userId);
  assert.equal(auditLogRepository.records[0]!.action, "test.thing.created");
  assert.deepEqual(auditLogRepository.records[0]!.metadata, { thingId: thing.id });
});

test("update rejects a thing owned by a different user before touching the repository", async () => {
  const { crud, repository } = buildCrud();
  const thing = await repository.create({ userId: "user-1", name: "A" });

  await assert.rejects(() => crud.update(thing.id, "user-2", { name: "Hijacked" }), NotFoundError);
  assert.equal(repository.rows[0]!.name, "A");
});

test("update saves the change and writes an audit entry", async () => {
  const { crud, repository, auditLogRepository } = buildCrud();
  const thing = await repository.create({ userId: "user-1", name: "A" });

  const updated = await crud.update(thing.id, "user-1", { name: "B" });

  assert.equal(updated.name, "B");
  assert.equal(auditLogRepository.records.length, 1);
  assert.equal(auditLogRepository.records[0]!.action, "test.thing.updated");
  assert.deepEqual(auditLogRepository.records[0]!.metadata, { thingId: thing.id });
});

test("delete rejects a thing owned by a different user and doesn't soft-delete it", async () => {
  const { crud, repository } = buildCrud();
  const thing = await repository.create({ userId: "user-1", name: "A" });

  await assert.rejects(() => crud.delete(thing.id, "user-2"), NotFoundError);
  assert.equal(repository.rows[0]!.deletedAt, null);
});

test("create throws a clear error when the repository has no create() (e.g. Budget's upsert-only repository)", async () => {
  const repository = fakeRepository();
  const auditLogRepository = fakeAuditLogRepository();
  const repositoryWithoutCreate = {
    findById: repository.findById,
    update: repository.update,
    softDelete: repository.softDelete,
  };
  const crud = new OwnedResourceCrud(repositoryWithoutCreate, auditLogRepository, {
    entityName: "Thing",
    actionPrefix: "test.thing",
  });

  await assert.rejects(() => crud.create({ userId: "user-1", name: "A" }), /has no create/);
});

test("delete throws a clear error when the repository has no softDelete() (e.g. Project's unassign-on-delete repository)", async () => {
  const repository = fakeRepository();
  const auditLogRepository = fakeAuditLogRepository();
  const thing = await repository.create({ userId: "user-1", name: "A" });
  const repositoryWithoutSoftDelete = {
    create: repository.create,
    findById: repository.findById,
    update: repository.update,
  };
  const crud = new OwnedResourceCrud(repositoryWithoutSoftDelete, auditLogRepository, {
    entityName: "Thing",
    actionPrefix: "test.thing",
  });

  await assert.rejects(() => crud.delete(thing.id, "user-1"), /has no delete/);
});

test("delete soft-deletes and writes an audit entry", async () => {
  const { crud, repository, auditLogRepository } = buildCrud();
  const thing = await repository.create({ userId: "user-1", name: "A" });

  await crud.delete(thing.id, "user-1");

  assert.ok(repository.rows[0]!.deletedAt);
  assert.equal(auditLogRepository.records.length, 1);
  assert.equal(auditLogRepository.records[0]!.action, "test.thing.deleted");
  assert.deepEqual(auditLogRepository.records[0]!.metadata, { thingId: thing.id });
});
