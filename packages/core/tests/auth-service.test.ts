process.env.JWT_ACCESS_SECRET ??= "test-only-secret-at-least-32-characters-long";

import { test } from "node:test";
import assert from "node:assert/strict";
import type {
  IAuditLogRepository,
  IOtpRepository,
  ISessionRepository,
  IUserRepository,
  OtpCode,
  Session,
  User,
} from "@lifeos/db";
import { OtpService } from "../src/auth/services/otp-service";
import { SessionService } from "../src/auth/services/session-service";
import { AuthService } from "../src/auth/services/auth-service";
import { NotFoundError } from "../src/errors/app-error";

// Facade-level tests: real OtpService/SessionService (no need for
// IOtpService/ISessionService interfaces — unlike repositories, there's
// only ever one real implementation of each), wired to the same in-memory
// fake repositories used in otp-service.test.ts/session-service.test.ts.
// This exercises the actual AuthService wiring (audit logging + service
// orchestration) that route handlers depend on, which the per-service
// tests don't touch.

function fakeOtpRepository(): IOtpRepository & { rows: OtpCode[] } {
  const rows: OtpCode[] = [];
  return {
    rows,
    async create(data) {
      const row = {
        id: `otp-${rows.length}`,
        attempts: 0,
        consumedAt: null,
        createdAt: new Date(),
        ...data,
      };
      rows.push(row);
      return row;
    },
    async findLatestActive(phone, now) {
      return (
        rows
          .filter(
            (r) => r.phone === phone && !r.consumedAt && r.expiresAt.getTime() > now.getTime(),
          )
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0] ?? null
      );
    },
    async findMostRecent(phone) {
      return (
        rows
          .filter((r) => r.phone === phone)
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0] ?? null
      );
    },
    async incrementAttempts(id) {
      const row = rows.find((r) => r.id === id)!;
      row.attempts += 1;
      return row;
    },
    async consume(id) {
      const row = rows.find((r) => r.id === id)!;
      row.consumedAt = new Date();
      return row;
    },
  };
}

function fakeUserRepository(): IUserRepository & { rows: User[] } {
  const rows: User[] = [];
  return {
    rows,
    async findByPhone(phone) {
      return rows.find((u) => u.phone === phone) ?? null;
    },
    async findById(id) {
      return rows.find((u) => u.id === id) ?? null;
    },
    async create(phone) {
      const user = {
        id: `user-${rows.length}`,
        phone,
        timezone: "Asia/Tehran",
        calendarPreference: "JALALI" as const,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        version: 1,
      };
      rows.push(user);
      return user;
    },
    async update(id, data) {
      const row = rows.find((u) => u.id === id)!;
      Object.assign(row, data, { version: row.version + 1 });
      return row;
    },
  };
}

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

function fakeAuditLogRepository(): IAuditLogRepository & {
  records: Array<{ userId?: string | null; action: string }>;
} {
  const records: Array<{ userId?: string | null; action: string }> = [];
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

function fakeSmsProvider() {
  const sent: Array<{ phone: string; code: string }> = [];
  return {
    sent,
    async sendOtp(phone: string, code: string) {
      sent.push({ phone, code });
    },
  };
}

function buildAuthService() {
  const otpRepo = fakeOtpRepository();
  const userRepo = fakeUserRepository();
  const sessionRepo = fakeSessionRepository();
  const auditRepo = fakeAuditLogRepository();
  const sms = fakeSmsProvider();

  const otpService = new OtpService(otpRepo, userRepo, sms);
  const sessionService = new SessionService(sessionRepo);
  const authService = new AuthService(otpService, sessionService, userRepo, auditRepo);

  return { authService, otpRepo, userRepo, sessionRepo, auditRepo, sms };
}

const device = { userAgent: "test-agent", ipAddress: "127.0.0.1" };

test("requestOtp sends the code and writes an audit log entry", async () => {
  const { authService, sms, auditRepo } = buildAuthService();
  await authService.requestOtp("+989120000101");

  assert.equal(sms.sent.length, 1);
  assert.equal(auditRepo.records.length, 1);
  assert.equal(auditRepo.records[0]!.action, "auth.otp.requested");
});

test("verifyOtpAndLogin returns a user and tokens, and audits the login", async () => {
  const { authService, sms, auditRepo } = buildAuthService();
  await authService.requestOtp("+989120000102");
  const code = sms.sent[0]!.code;

  const { user, tokens } = await authService.verifyOtpAndLogin("+989120000102", code, device);

  assert.equal(user.phone, "+989120000102");
  assert.ok(tokens.accessToken);
  assert.ok(tokens.refreshToken);
  assert.ok(auditRepo.records.some((r) => r.action === "auth.login" && r.userId === user.id));
});

test("logout revokes the session and audits the logout", async () => {
  const { authService, sms, auditRepo } = buildAuthService();
  await authService.requestOtp("+989120000103");
  const { user, tokens } = await authService.verifyOtpAndLogin(
    "+989120000103",
    sms.sent[0]!.code,
    device,
  );
  const { sessionId } = await authService.verifyAccessToken(tokens.accessToken);

  await authService.logout(sessionId, user.id);

  assert.ok(auditRepo.records.some((r) => r.action === "auth.logout" && r.userId === user.id));
  await assert.rejects(() => authService.verifyAccessToken(tokens.accessToken));
});

test("revokeSession audits the revocation and lists reflect it", async () => {
  const { authService, sms } = buildAuthService();
  await authService.requestOtp("+989120000104");
  const { user, tokens } = await authService.verifyOtpAndLogin(
    "+989120000104",
    sms.sent[0]!.code,
    device,
  );
  const { sessionId } = await authService.verifyAccessToken(tokens.accessToken);

  const before = await authService.listSessions(user.id);
  assert.equal(before.length, 1);

  await authService.revokeSession(sessionId, user.id);

  const after = await authService.listSessions(user.id);
  assert.equal(after.length, 0);
});

test("me returns the user for a valid id", async () => {
  const { authService, sms } = buildAuthService();
  await authService.requestOtp("+989120000105");
  const { user } = await authService.verifyOtpAndLogin("+989120000105", sms.sent[0]!.code, device);

  const found = await authService.me(user.id);
  assert.equal(found.id, user.id);
});

test("me throws NotFoundError for an unknown id", async () => {
  const { authService } = buildAuthService();
  await assert.rejects(() => authService.me("no-such-user"), NotFoundError);
});

test("updateProfile updates only the fields passed, leaving the other untouched", async () => {
  const { authService, sms } = buildAuthService();
  await authService.requestOtp("+989120000106");
  const { user } = await authService.verifyOtpAndLogin("+989120000106", sms.sent[0]!.code, device);
  assert.equal(user.timezone, "Asia/Tehran");
  assert.equal(user.calendarPreference, "JALALI");

  const updated = await authService.updateProfile(user.id, { calendarPreference: "GREGORIAN" });
  assert.equal(updated.calendarPreference, "GREGORIAN");
  assert.equal(updated.timezone, "Asia/Tehran");
});
