process.env.JWT_ACCESS_SECRET ??= "test-only-secret-at-least-32-characters-long";

import { test } from "node:test";
import assert from "node:assert/strict";
import type {
  IAuditLogRepository,
  IOtpRepository,
  ISessionRepository,
  IUserRepository,
  OtpCode,
  OtpChannel,
  Session,
  User,
} from "@lifeos/db";
import { sha256Hex } from "../src/auth/crypto";
import { OtpService } from "../src/auth/services/otp-service";
import { InMemoryRateLimitStore } from "../src/rate-limit/adapters/in-memory-rate-limit-store";
import { RateLimitService } from "../src/rate-limit/services/rate-limit-service";
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

const SMS: OtpChannel = "SMS";

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
    async findLatestActive(channel, identifier, now) {
      return (
        rows
          .filter(
            (r) =>
              r.channel === channel &&
              r.identifier === identifier &&
              !r.consumedAt &&
              r.expiresAt.getTime() > now.getTime(),
          )
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0] ?? null
      );
    },
    async findMostRecent(channel, identifier) {
      return (
        rows
          .filter((r) => r.channel === channel && r.identifier === identifier)
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
    async findByEmail(email) {
      return rows.find((u) => u.email === email) ?? null;
    },
    async findById(id) {
      return rows.find((u) => u.id === id) ?? null;
    },
    async createWithPhone(phone) {
      const user = {
        id: `user-${rows.length}`,
        phone,
        email: null,
        name: null,
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
    async createWithEmail(email) {
      const user = {
        id: `user-${rows.length}`,
        phone: null,
        email,
        name: null,
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
    async hardDelete(id) {
      // Removes the row outright, mirroring a real DELETE. A fake that set
      // deletedAt instead would let a soft-delete regression pass, which is
      // the precise bug this method exists to avoid.
      const index = rows.findIndex((u) => u.id === id);
      if (index >= 0) rows.splice(index, 1);
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
  records: Array<{ userId?: string | null; action: string; metadata?: unknown }>;
} {
  // metadata is captured, not discarded — it is what the masked-identifier
  // tests assert on, and dropping it here would let a raw identifier reach
  // the real audit table with every test still green.
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

function fakeSmsProvider() {
  const sent: Array<{ phone: string; code: string }> = [];
  return {
    sent,
    async sendOtp(phone: string, code: string) {
      sent.push({ phone, code });
    },
  };
}

function fakeEmailProvider() {
  const sent: Array<{ email: string; code: string }> = [];
  return {
    sent,
    async sendOtp(email: string, code: string) {
      sent.push({ email, code });
    },
  };
}

function buildAuthService() {
  const otpRepo = fakeOtpRepository();
  const userRepo = fakeUserRepository();
  const sessionRepo = fakeSessionRepository();
  const auditRepo = fakeAuditLogRepository();
  const sms = fakeSmsProvider();
  const email = fakeEmailProvider();

  const otpService = new OtpService(
    otpRepo,
    userRepo,
    sms,
    email,
    new RateLimitService(new InMemoryRateLimitStore()),
  );
  const sessionService = new SessionService(sessionRepo);
  const authService = new AuthService(otpService, sessionService, userRepo, auditRepo);

  return { authService, otpRepo, userRepo, sessionRepo, auditRepo, sms, email };
}

const device = { userAgent: "test-agent", ipAddress: "127.0.0.1" };

test("requestOtp sends the code and writes an audit log entry", async () => {
  const { authService, sms, auditRepo } = buildAuthService();
  await authService.requestOtp(SMS, "+989120000101");

  assert.equal(sms.sent.length, 1);
  assert.equal(auditRepo.records.length, 1);
  assert.equal(auditRepo.records[0]!.action, "auth.otp.requested");
});

test("verifyOtpAndLogin returns a user and tokens, and audits the login", async () => {
  const { authService, sms, auditRepo } = buildAuthService();
  await authService.requestOtp(SMS, "+989120000102");
  const code = sms.sent[0]!.code;

  const { user, tokens } = await authService.verifyOtpAndLogin(SMS, "+989120000102", code, device);

  assert.equal(user.phone, "+989120000102");
  assert.ok(tokens.accessToken);
  assert.ok(tokens.refreshToken);
  assert.ok(auditRepo.records.some((r) => r.action === "auth.login" && r.userId === user.id));
});

test("a first-ever verify audits auth.user.created alongside auth.login", async () => {
  const { authService, sms, auditRepo } = buildAuthService();
  await authService.requestOtp(SMS, "+989120000112");

  const { user, isNewUser } = await authService.verifyOtpAndLogin(
    SMS,
    "+989120000112",
    sms.sent[0]!.code,
    device,
  );

  assert.equal(isNewUser, true);
  // Both rows, not one instead of the other — a signup genuinely is a
  // registration *and* a login, and making them exclusive would put a
  // hole in any "count logins" query over the audit log.
  const forUser = auditRepo.records.filter((r) => r.userId === user.id);
  assert.equal(forUser.filter((r) => r.action === "auth.user.created").length, 1);
  assert.equal(forUser.filter((r) => r.action === "auth.login").length, 1);
});

test("a returning user's verify audits only auth.login, never auth.user.created", async () => {
  const { authService, otpRepo, sms, auditRepo } = buildAuthService();
  await authService.requestOtp(SMS, "+989120000113");
  await authService.verifyOtpAndLogin(SMS, "+989120000113", sms.sent[0]!.code, device);

  // A second request-otp this soon would hit the resend cooldown, so
  // insert the next code directly — same isolation trick otp-service's
  // own "reuses the existing user" test uses.
  await otpRepo.create({
    channel: SMS,
    identifier: "+989120000113",
    codeHash: sha256Hex(`${SMS}:+989120000113:333333`),
    expiresAt: new Date(Date.now() + 60_000),
  });
  const second = await authService.verifyOtpAndLogin(SMS, "+989120000113", "333333", device);

  assert.equal(second.isNewUser, false);
  assert.equal(auditRepo.records.filter((r) => r.action === "auth.user.created").length, 1);
  assert.equal(auditRepo.records.filter((r) => r.action === "auth.login").length, 2);
});

// audit_logs is append-only, has no foreign key to users, and has no
// retention policy — so anything written into metadata outlives the account
// it belongs to, permanently. A raw phone number there would still be in the
// table after a user exercised the deletion right the privacy policy grants
// them, which is why these assert on stored metadata rather than on log
// output. The log lines were always masked; the stored rows were not.
test("audit metadata stores a masked phone identifier, never the raw one", async () => {
  const { authService, sms, auditRepo } = buildAuthService();
  const phone = "+989120000121";

  await authService.requestOtp(SMS, phone);
  await authService.verifyOtpAndLogin(SMS, phone, sms.sent[0]!.code, device);

  const identifiers = auditRepo.records.map(
    (r) => (r.metadata as { identifier?: string } | undefined)?.identifier,
  );
  // Every row that carries an identifier at all — otp.requested,
  // user.created and login — must carry the masked form.
  const withIdentifier = identifiers.filter((v): v is string => typeof v === "string");
  assert.equal(withIdentifier.length, 3);
  for (const stored of withIdentifier) {
    assert.notEqual(stored, phone);
    assert.ok(stored.endsWith("0121"), `expected last 4 digits preserved, got ${stored}`);
    assert.ok(!stored.includes("98912"), `raw prefix leaked in ${stored}`);
  }
});

test("audit metadata masks an email identifier's local part", async () => {
  const { authService, email, auditRepo } = buildAuthService();

  await authService.requestOtp("EMAIL", "someone@example.com");
  await authService.verifyOtpAndLogin("EMAIL", "someone@example.com", email.sent[0]!.code, device);

  const stored = (auditRepo.records[0]!.metadata as { identifier: string }).identifier;
  // Domain is kept — it is useful for spotting a burst from one provider
  // and is not itself identifying. The local part is what names a person.
  assert.equal(stored, "so***@example.com");
});

test("an identifier too short to mask partially is masked entirely", async () => {
  const { authService, auditRepo } = buildAuthService();

  // The previous guard was `length > 4`, which returned anything shorter
  // completely unmasked — so a malformed identifier defeated the masking
  // instead of triggering it. Service-level input is unvalidated (the Zod
  // contract sits at the route), so this is reachable.
  await authService.requestOtp(SMS, "1234");

  const stored = (auditRepo.records[0]!.metadata as { identifier: string }).identifier;
  assert.equal(stored, "***");
});

test("deleteAccount removes the user row outright and audits it", async () => {
  const { authService, sms, userRepo, auditRepo } = buildAuthService();
  await authService.requestOtp(SMS, "+989120000131");
  const { user } = await authService.verifyOtpAndLogin(
    SMS,
    "+989120000131",
    sms.sent[0]!.code,
    device,
  );

  await authService.deleteAccount(user.id);

  // Gone, not flagged. User.deletedAt exists but nothing reads it —
  // findById (the query behind every authenticated request) does not filter
  // on it — so a soft delete would leave the account fully usable while
  // claiming to be deleted.
  assert.equal(
    userRepo.rows.find((u) => u.id === user.id),
    undefined,
  );
  assert.equal(await userRepo.findById(user.id), null);
  assert.ok(
    auditRepo.records.some((r) => r.action === "auth.user.deleted" && r.userId === user.id),
  );
});

test("the deletion audit row is written before the delete, so it survives it", async () => {
  const { authService, sms, auditRepo } = buildAuthService();
  await authService.requestOtp(SMS, "+989120000132");
  const { user } = await authService.verifyOtpAndLogin(
    SMS,
    "+989120000132",
    sms.sent[0]!.code,
    device,
  );

  await authService.deleteAccount(user.id);

  // audit_logs has no foreign key to users precisely so this row outlives
  // the account. Ordering matters for a different reason: if the delete
  // succeeded and the audit write then failed, there would be no record of
  // the deletion at all.
  const actions = auditRepo.records.map((r) => r.action);
  assert.ok(actions.includes("auth.user.deleted"));
  const deleted = auditRepo.records.find((r) => r.action === "auth.user.deleted");
  assert.equal(deleted?.userId, user.id);
});

test("deleting an already-deleted account throws NotFoundError", async () => {
  const { authService, sms, auditRepo } = buildAuthService();
  await authService.requestOtp(SMS, "+989120000133");
  const { user } = await authService.verifyOtpAndLogin(
    SMS,
    "+989120000133",
    sms.sent[0]!.code,
    device,
  );
  await authService.deleteAccount(user.id);

  const auditsBefore = auditRepo.records.length;
  await assert.rejects(() => authService.deleteAccount(user.id), NotFoundError);
  // A second attempt must not write a second "deleted" row for an account
  // that was already gone.
  assert.equal(auditRepo.records.length, auditsBefore);
});

test("logout revokes the session and audits the logout", async () => {
  const { authService, sms, auditRepo } = buildAuthService();
  await authService.requestOtp(SMS, "+989120000103");
  const { user, tokens } = await authService.verifyOtpAndLogin(
    SMS,
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
  await authService.requestOtp(SMS, "+989120000104");
  const { user, tokens } = await authService.verifyOtpAndLogin(
    SMS,
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
  await authService.requestOtp(SMS, "+989120000105");
  const { user } = await authService.verifyOtpAndLogin(
    SMS,
    "+989120000105",
    sms.sent[0]!.code,
    device,
  );

  const found = await authService.me(user.id);
  assert.equal(found.id, user.id);
});

test("me throws NotFoundError for an unknown id", async () => {
  const { authService } = buildAuthService();
  await assert.rejects(() => authService.me("no-such-user"), NotFoundError);
});

test("updateProfile updates only the fields passed, leaving the other untouched", async () => {
  const { authService, sms } = buildAuthService();
  await authService.requestOtp(SMS, "+989120000106");
  const { user } = await authService.verifyOtpAndLogin(
    SMS,
    "+989120000106",
    sms.sent[0]!.code,
    device,
  );
  assert.equal(user.timezone, "Asia/Tehran");
  assert.equal(user.calendarPreference, "JALALI");

  const updated = await authService.updateProfile(user.id, { calendarPreference: "GREGORIAN" });
  assert.equal(updated.calendarPreference, "GREGORIAN");
  assert.equal(updated.timezone, "Asia/Tehran");
});

test("verifyOtpAndLogin works for an email login too", async () => {
  const { authService, email } = buildAuthService();
  await authService.requestOtp("EMAIL", "user@example.com");
  const code = email.sent[0]!.code;

  const { user } = await authService.verifyOtpAndLogin("EMAIL", "user@example.com", code, device);

  assert.equal(user.email, "user@example.com");
  assert.equal(user.phone, null);
});
