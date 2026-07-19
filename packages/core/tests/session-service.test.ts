process.env.JWT_ACCESS_SECRET ??= "test-only-secret-at-least-32-characters-long";

import { test } from "node:test";
import assert from "node:assert/strict";
import type { ISessionRepository, Session } from "@lifeos/db";
import { SessionService } from "../src/auth/services/session-service";
import { UnauthorizedError } from "../src/errors/app-error";

function fakeSessionRepository(): ISessionRepository & { rows: Session[] } {
  const rows: Session[] = [];
  let n = 0;
  return {
    rows,
    async create(data) {
      const row = {
        id: `session-${n++}`,
        revokedAt: null,
        lastUsedAt: new Date(),
        createdAt: new Date(),
        ...data,
      };
      rows.push(row);
      return row;
    },
    async findByRefreshTokenHash(hash) {
      return rows.find((r) => r.refreshTokenHash === hash) ?? null;
    },
    async findById(id) {
      return rows.find((r) => r.id === id) ?? null;
    },
    async findActiveByUser(userId) {
      return rows.filter((r) => r.userId === userId && !r.revokedAt);
    },
    async rotate(id, newHash, newExpiresAt) {
      const row = rows.find((r) => r.id === id)!;
      row.refreshTokenHash = newHash;
      row.expiresAt = newExpiresAt;
      row.lastUsedAt = new Date();
      return row;
    },
    async revoke(id) {
      const row = rows.find((r) => r.id === id)!;
      row.revokedAt = new Date();
      return row;
    },
  };
}

const device = { userAgent: "test-agent", ipAddress: "127.0.0.1" };

test("createSession issues an access token and a distinct opaque refresh token", async () => {
  const service = new SessionService(fakeSessionRepository());
  const tokens = await service.createSession("user-1", device);

  assert.ok(tokens.accessToken.split(".").length === 3, "access token should be a JWT");
  assert.ok(tokens.refreshToken.length > 20);
  assert.notEqual(tokens.accessToken, tokens.refreshToken);
});

test("verifyAccessTokenAndSession resolves the session for a freshly created token", async () => {
  const service = new SessionService(fakeSessionRepository());
  const tokens = await service.createSession("user-1", device);

  const result = await service.verifyAccessTokenAndSession(tokens.accessToken);
  assert.equal(result.userId, "user-1");
});

test("refresh rotates the refresh token and invalidates the old one", async () => {
  const repo = fakeSessionRepository();
  const service = new SessionService(repo);
  const first = await service.createSession("user-1", device);

  const second = await service.refresh(first.refreshToken);
  assert.notEqual(second.refreshToken, first.refreshToken);

  await assert.rejects(() => service.refresh(first.refreshToken), UnauthorizedError);
  await service.refresh(second.refreshToken); // the rotated token still works
});

test("revoke takes effect immediately even though the JWT itself hasn't expired", async () => {
  const service = new SessionService(fakeSessionRepository());
  const tokens = await service.createSession("user-1", device);
  const { sessionId } = await service.verifyAccessTokenAndSession(tokens.accessToken);

  await service.revoke(sessionId, "user-1");

  await assert.rejects(
    () => service.verifyAccessTokenAndSession(tokens.accessToken),
    UnauthorizedError,
  );
});

test("revoke rejects when the session belongs to a different user", async () => {
  const service = new SessionService(fakeSessionRepository());
  const tokens = await service.createSession("user-1", device);
  const { sessionId } = await service.verifyAccessTokenAndSession(tokens.accessToken);

  await assert.rejects(() => service.revoke(sessionId, "someone-else"), UnauthorizedError);
});
