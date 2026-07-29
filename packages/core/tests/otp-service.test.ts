import { test } from "node:test";
import assert from "node:assert/strict";
import type { IOtpRepository, IUserRepository, OtpCode, OtpChannel, User } from "@lifeos/db";
import { OtpService } from "../src/auth/services/otp-service";
import { RateLimitedError, UnauthorizedError, ValidationError } from "../src/errors/app-error";
import { InMemoryRateLimitStore } from "../src/rate-limit/adapters/in-memory-rate-limit-store";
import type { RateLimitStore } from "../src/rate-limit/ports/rate-limit-store";
import { RateLimitService } from "../src/rate-limit/services/rate-limit-service";
import { sha256Hex } from "../src/auth/crypto";

// In-memory fakes — pure unit tests, no Postgres involved. Real DB-backed
// behavior is covered by the curl-driven flow against docker Postgres (see
// CLAUDE.md verification section); these tests target the business rules
// (cooldown, attempt limits, code hashing) in isolation.
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
  function makeUser(data: { phone?: string | null; email?: string | null }) {
    const user = {
      id: `user-${rows.length}`,
      phone: data.phone ?? null,
      email: data.email ?? null,
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
  }
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
      return makeUser({ phone });
    },
    async createWithEmail(email) {
      return makeUser({ email });
    },
    async update(id, data) {
      const row = rows.find((u) => u.id === id)!;
      Object.assign(row, data, { version: row.version + 1 });
      return row;
    },
    // Unused by OtpService, but IUserRepository requires it — the interface
    // is what makes this fake substitutable at all.
    async hardDelete(id) {
      const index = rows.findIndex((u) => u.id === id);
      if (index >= 0) rows.splice(index, 1);
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

function makeService(store: RateLimitStore = new InMemoryRateLimitStore()) {
  const otpRepo = fakeOtpRepository();
  const userRepo = fakeUserRepository();
  const sms = fakeSmsProvider();
  const email = fakeEmailProvider();
  const service = new OtpService(otpRepo, userRepo, sms, email, new RateLimitService(store));
  return { service, otpRepo, userRepo, sms, email };
}

// "Redis is down" — exercises the fallback path where claimCooldown fails
// open and the Postgres timestamp check has to hold the line alone.
const brokenStore: RateLimitStore = {
  async increment(): Promise<never> {
    throw new Error("connection refused");
  },
  async claim(): Promise<never> {
    throw new Error("connection refused");
  },
};

const SMS: OtpChannel = "SMS";
const EMAIL: OtpChannel = "EMAIL";

test("requestOtp sends a code via the SMS provider", async () => {
  const { service, otpRepo, sms } = makeService();

  await service.requestOtp(SMS, "+989120000001");

  assert.equal(sms.sent.length, 1);
  assert.equal(sms.sent[0]!.phone, "+989120000001");
  assert.equal(otpRepo.rows.length, 1);
});

test("requestOtp sends a code via the Email provider", async () => {
  const { service, otpRepo, email } = makeService();

  await service.requestOtp(EMAIL, "user@example.com");

  assert.equal(email.sent.length, 1);
  assert.equal(email.sent[0]!.email, "user@example.com");
  assert.equal(otpRepo.rows.length, 1);
});

test("requestOtp rejects a resend within the cooldown window", async () => {
  const { service } = makeService();
  await service.requestOtp(SMS, "+989120000002");
  await assert.rejects(() => service.requestOtp(SMS, "+989120000002"), RateLimitedError);
});

test("the resend cooldown still holds when the rate-limit store is down", async () => {
  // claimCooldown() fails open here, so the only thing left enforcing the
  // cooldown is OtpService's fallback timestamp check against the OTP
  // repository. Degrading to the racy-but-real check beats degrading to
  // no cooldown at all, given it gates SMS spend.
  const { service } = makeService(brokenStore);
  await service.requestOtp(SMS, "+989120000009");
  await assert.rejects(() => service.requestOtp(SMS, "+989120000009"), RateLimitedError);
});

test("SMS and Email cooldowns are independent even for the same string", async () => {
  const { service } = makeService();
  // Not a realistic overlap in practice (phone vs. email formats never
  // actually collide) but proves the channel scoping is real, not just a
  // documentation claim.
  const shared = "shared-identifier";
  await service.requestOtp(SMS, shared);
  await service.requestOtp(EMAIL, shared); // must not throw RateLimitedError
});

test("verifyOtp creates a new user on first successful login (SMS)", async () => {
  const { service, userRepo, sms } = makeService();

  await service.requestOtp(SMS, "+989120000003");
  const code = sms.sent[0]!.code;

  const { user, isNewUser } = await service.verifyOtp(SMS, "+989120000003", code);
  assert.equal(user.phone, "+989120000003");
  assert.equal(isNewUser, true);
  assert.equal(userRepo.rows.length, 1);
});

test("verifyOtp creates a new user on first successful login (Email)", async () => {
  const { service, userRepo, email } = makeService();

  await service.requestOtp(EMAIL, "new@example.com");
  const code = email.sent[0]!.code;

  const { user, isNewUser } = await service.verifyOtp(EMAIL, "new@example.com", code);
  assert.equal(user.email, "new@example.com");
  assert.equal(isNewUser, true);
  assert.equal(userRepo.rows.length, 1);
});

test("verifyOtp reuses the existing user on a second login", async () => {
  const { service, otpRepo, userRepo, sms } = makeService();

  await service.requestOtp(SMS, "+989120000004");
  const first = await service.verifyOtp(SMS, "+989120000004", sms.sent[0]!.code);

  // A second request-otp call this soon would legitimately hit the resend
  // cooldown (covered by its own test) — insert the next code directly to
  // isolate the "existing user is reused" behavior being tested here.
  await otpRepo.create({
    channel: SMS,
    identifier: "+989120000004",
    codeHash: sha256Hex(`${SMS}:+989120000004:222222`),
    expiresAt: new Date(Date.now() + 60_000),
  });
  const second = await service.verifyOtp(SMS, "+989120000004", "222222");

  assert.equal(first.user.id, second.user.id);
  // The distinction the whole isNewUser signal exists for: same identifier,
  // second time round, so this is a login and not a registration.
  assert.equal(first.isNewUser, true);
  assert.equal(second.isNewUser, false);
  assert.equal(userRepo.rows.length, 1);
});

test("verifyOtp with wrong code throws Unauthorized and increments attempts", async () => {
  const { service, otpRepo } = makeService();
  await service.requestOtp(SMS, "+989120000005");

  await assert.rejects(() => service.verifyOtp(SMS, "+989120000005", "000000"), UnauthorizedError);
  assert.equal(otpRepo.rows[0]!.attempts, 1);
});

test("verifyOtp with no active code throws ValidationError", async () => {
  const { service } = makeService();
  await assert.rejects(() => service.verifyOtp(SMS, "+989120000006", "123456"), ValidationError);
});

test("verifyOtp locks out after too many wrong attempts", async () => {
  const { service } = makeService();
  await service.requestOtp(SMS, "+989120000007");

  for (let i = 0; i < 5; i++) {
    await assert.rejects(() => service.verifyOtp(SMS, "+989120000007", "000000"));
  }
  await assert.rejects(() => service.verifyOtp(SMS, "+989120000007", "000000"), RateLimitedError);
});

test("OTP codes are hashed, never stored in plaintext", async () => {
  const { service, otpRepo, sms } = makeService();
  await service.requestOtp(SMS, "+989120000008");
  const plainCode = sms.sent[0]!.code;
  const stored = otpRepo.rows.find((r) => r.identifier === "+989120000008")!;
  assert.equal(stored.codeHash, sha256Hex(`${SMS}:+989120000008:${plainCode}`));
  assert.notEqual(stored.codeHash, plainCode);
});
