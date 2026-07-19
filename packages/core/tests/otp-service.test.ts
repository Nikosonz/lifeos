import { test } from "node:test";
import assert from "node:assert/strict";
import type { IOtpRepository, IUserRepository, OtpCode, User } from "@lifeos/db";
import { OtpService } from "../src/auth/services/otp-service";
import { RateLimitedError, UnauthorizedError, ValidationError } from "../src/errors/app-error";
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
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        version: 1,
      };
      rows.push(user);
      return user;
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

test("requestOtp sends a code via the SMS provider", async () => {
  const otpRepo = fakeOtpRepository();
  const userRepo = fakeUserRepository();
  const sms = fakeSmsProvider();
  const service = new OtpService(otpRepo, userRepo, sms);

  await service.requestOtp("+989120000001");

  assert.equal(sms.sent.length, 1);
  assert.equal(sms.sent[0]!.phone, "+989120000001");
  assert.equal(otpRepo.rows.length, 1);
});

test("requestOtp rejects a resend within the cooldown window", async () => {
  const service = new OtpService(fakeOtpRepository(), fakeUserRepository(), fakeSmsProvider());
  await service.requestOtp("+989120000002");
  await assert.rejects(() => service.requestOtp("+989120000002"), RateLimitedError);
});

test("verifyOtp creates a new user on first successful login", async () => {
  const otpRepo = fakeOtpRepository();
  const userRepo = fakeUserRepository();
  const sms = fakeSmsProvider();
  const service = new OtpService(otpRepo, userRepo, sms);

  await service.requestOtp("+989120000003");
  const code = sms.sent[0]!.code;

  const user = await service.verifyOtp("+989120000003", code);
  assert.equal(user.phone, "+989120000003");
  assert.equal(userRepo.rows.length, 1);
});

test("verifyOtp reuses the existing user on a second login", async () => {
  const otpRepo = fakeOtpRepository();
  const userRepo = fakeUserRepository();
  const sms = fakeSmsProvider();
  const service = new OtpService(otpRepo, userRepo, sms);

  await service.requestOtp("+989120000004");
  const firstUser = await service.verifyOtp("+989120000004", sms.sent[0]!.code);

  // A second request-otp call this soon would legitimately hit the resend
  // cooldown (covered by its own test) — insert the next code directly to
  // isolate the "existing user is reused" behavior being tested here.
  await otpRepo.create({
    phone: "+989120000004",
    codeHash: sha256Hex("+989120000004:222222"),
    expiresAt: new Date(Date.now() + 60_000),
  });
  const secondUser = await service.verifyOtp("+989120000004", "222222");

  assert.equal(firstUser.id, secondUser.id);
  assert.equal(userRepo.rows.length, 1);
});

test("verifyOtp with wrong code throws Unauthorized and increments attempts", async () => {
  const otpRepo = fakeOtpRepository();
  const service = new OtpService(otpRepo, fakeUserRepository(), fakeSmsProvider());
  await service.requestOtp("+989120000005");

  await assert.rejects(() => service.verifyOtp("+989120000005", "000000"), UnauthorizedError);
  assert.equal(otpRepo.rows[0]!.attempts, 1);
});

test("verifyOtp with no active code throws ValidationError", async () => {
  const service = new OtpService(fakeOtpRepository(), fakeUserRepository(), fakeSmsProvider());
  await assert.rejects(() => service.verifyOtp("+989120000006", "123456"), ValidationError);
});

test("verifyOtp locks out after too many wrong attempts", async () => {
  const otpRepo = fakeOtpRepository();
  const service = new OtpService(otpRepo, fakeUserRepository(), fakeSmsProvider());
  await service.requestOtp("+989120000007");

  for (let i = 0; i < 5; i++) {
    await assert.rejects(() => service.verifyOtp("+989120000007", "000000"));
  }
  await assert.rejects(() => service.verifyOtp("+989120000007", "000000"), RateLimitedError);
});

test("OTP codes are hashed, never stored in plaintext", async () => {
  const otpRepo = fakeOtpRepository();
  const sms = fakeSmsProvider();
  const service = new OtpService(otpRepo, fakeUserRepository(), sms);
  await service.requestOtp("+989120000008");
  const plainCode = sms.sent[0]!.code;
  const stored = otpRepo.rows.find((r) => r.phone === "+989120000008")!;
  assert.equal(stored.codeHash, sha256Hex(`+989120000008:${plainCode}`));
  assert.notEqual(stored.codeHash, plainCode);
});
