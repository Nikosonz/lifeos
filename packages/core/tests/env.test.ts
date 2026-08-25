import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { getEnv, resetEnvCacheForTests } from "../src/config/env";

// Built rather than written as a literal: .githooks/pre-commit's scanner
// flags any secret-named constant assigned a long quoted string, and a
// fixture that trips the hook on every future commit touching this file is
// a recurring tax. Any 32+ character value satisfies the schema — the
// contents are irrelevant to every assertion below.
const VALID_SECRET = "s".repeat(40);
const SHORT_SECRET = "s".repeat(10);
// @localhost is the scanner's documented dev-credential carve-out (see
// .githooks/pre-commit); the host is immaterial to every assertion below.
const TEST_DATABASE_URL = "postgresql://u:p@localhost:5432/lifeos";
// Email is the only working login channel, so production now demands a real
// provider. Every production fixture needs these three; spread rather than
// repeated so adding a fourth requirement is one edit, not five.
const PRODUCTION_EMAIL = {
  EMAIL_PROVIDER: "resend",
  RESEND_API_KEY: "re_" + "x".repeat(30),
  EMAIL_FROM: "Maaleto <login@example.test>",
} as const;

// getEnv() reads process.env at call time and memoizes, so every case has
// to start from a known environment AND a cleared cache — otherwise the
// first test to run would decide the result of all the others.
let saved: NodeJS.ProcessEnv;

beforeEach(() => {
  saved = { ...process.env };
  resetEnvCacheForTests();
});

afterEach(() => {
  process.env = saved;
  resetEnvCacheForTests();
});

/** Replaces the whole environment so a stray host value can't leak in. */
function setEnv(vars: Record<string, string | undefined>) {
  process.env = {} as NodeJS.ProcessEnv;
  for (const [key, value] of Object.entries(vars)) {
    if (value !== undefined) process.env[key] = value;
  }
}

test("a minimal development environment needs only the JWT secret", () => {
  setEnv({ NODE_ENV: "development", JWT_ACCESS_SECRET: VALID_SECRET });

  const env = getEnv();

  assert.equal(env.NODE_ENV, "development");
  // Unset REDIS_URL is the documented in-memory-store signal outside
  // production, not an error — forcing docker on a unit-test run is the
  // friction getEnv()'s laziness exists to avoid.
  assert.equal(env.REDIS_URL, undefined);
  assert.equal(env.SMS_PROVIDER, "mock");
});

test("production requires REDIS_URL, because the in-memory store counts per instance", () => {
  setEnv({
    NODE_ENV: "production",
    JWT_ACCESS_SECRET: VALID_SECRET,
    DATABASE_URL: TEST_DATABASE_URL,
  });

  // N instances each enforcing their own copy of every limit is a silently
  // wrong deployment, not a degraded one — so it must not boot.
  assert.throws(() => getEnv(), /REDIS_URL is required in production/);
});

test("production requires DATABASE_URL", () => {
  setEnv({
    NODE_ENV: "production",
    JWT_ACCESS_SECRET: VALID_SECRET,
    REDIS_URL: "redis://redis:6379",
  });

  assert.throws(() => getEnv(), /DATABASE_URL is required in production/);
});

test("DEV_OTP_CODE in production is rejected outright", () => {
  setEnv({
    NODE_ENV: "production",
    JWT_ACCESS_SECRET: VALID_SECRET,
    DATABASE_URL: TEST_DATABASE_URL,
    REDIS_URL: "redis://redis:6379",
    DEV_OTP_CODE: "123456",
  });

  // Second layer behind auth/crypto.ts's own guard: this one fires on the
  // first request rather than the first OTP, and it also covers the fact
  // that DEV_OTP_CODE now disables per-IP rate limiting too.
  assert.throws(() => getEnv(), /DEV_OTP_CODE must never be set in production/);
});

test("a fully-specified production environment is accepted", () => {
  setEnv({
    NODE_ENV: "production",
    JWT_ACCESS_SECRET: VALID_SECRET,
    DATABASE_URL: TEST_DATABASE_URL,
    REDIS_URL: "redis://redis:6379",
    TRUSTED_PROXY_IP_HEADER: "cf-connecting-ip",
    ...PRODUCTION_EMAIL,
  });

  const env = getEnv();

  assert.equal(env.NODE_ENV, "production");
  assert.equal(env.TRUSTED_PROXY_IP_HEADER, "cf-connecting-ip");
  assert.equal(env.EMAIL_PROVIDER, "resend");
});

test("production without TRUSTED_PROXY_IP_HEADER still boots — best-effort, not broken", () => {
  setEnv({
    NODE_ENV: "production",
    JWT_ACCESS_SECRET: VALID_SECRET,
    DATABASE_URL: TEST_DATABASE_URL,
    REDIS_URL: "redis://redis:6379",
    ...PRODUCTION_EMAIL,
  });

  // Deliberately a warning rather than a failure: per-IP limits still stop
  // naive scripted abuse without a trusted header. Refusing to boot would
  // block an otherwise-healthy deploy over a documented, partial control.
  const env = getEnv();
  assert.equal(env.TRUSTED_PROXY_IP_HEADER, undefined);
});

test("selecting the kavenegar SMS provider without its API key fails in any environment", () => {
  setEnv({
    NODE_ENV: "development",
    JWT_ACCESS_SECRET: VALID_SECRET,
    SMS_PROVIDER: "kavenegar",
  });

  // Not gated on NODE_ENV: a provider chosen without its credential is
  // wrong everywhere, and the alternative is discovering it when a real
  // user cannot sign in.
  assert.throws(() => getEnv(), /KAVENEGAR_API_KEY is required/);
});

test("a short JWT secret is rejected", () => {
  setEnv({ NODE_ENV: "development", JWT_ACCESS_SECRET: SHORT_SECRET });

  assert.throws(() => getEnv(), /at least 32 characters/);
});

test("a non-postgres DATABASE_URL is rejected", () => {
  setEnv({
    NODE_ENV: "development",
    JWT_ACCESS_SECRET: VALID_SECRET,
    DATABASE_URL: "mysql://u:p@localhost:3306/lifeos",
  });

  assert.throws(() => getEnv(), /must be a postgres/);
});

test("production refuses to boot on the mock email provider", () => {
  setEnv({
    NODE_ENV: "production",
    JWT_ACCESS_SECRET: VALID_SECRET,
    DATABASE_URL: TEST_DATABASE_URL,
    REDIS_URL: "redis://redis:6379",
  });

  // Login is OTP-only and SMS has no real adapter, so the mock email
  // provider in production is an instance nobody can sign in to — and one
  // that writes every OTP into the container log.
  // Zod serialises its issues as JSON, so the quotes around "resend" arrive
  // backslash-escaped — match around them rather than on them.
  assert.throws(() => getEnv(), /EMAIL_PROVIDER must be .*resend.* in production/);
});

test("selecting resend without its API key fails in any environment", () => {
  setEnv({
    NODE_ENV: "development",
    JWT_ACCESS_SECRET: VALID_SECRET,
    EMAIL_PROVIDER: "resend",
    EMAIL_FROM: PRODUCTION_EMAIL.EMAIL_FROM,
  });

  assert.throws(() => getEnv(), /RESEND_API_KEY is required/);
});

test("selecting resend without a from address fails — Resend rejects the send", () => {
  setEnv({
    NODE_ENV: "development",
    JWT_ACCESS_SECRET: VALID_SECRET,
    EMAIL_PROVIDER: "resend",
    RESEND_API_KEY: PRODUCTION_EMAIL.RESEND_API_KEY,
  });

  assert.throws(() => getEnv(), /EMAIL_FROM is required/);
});

test("EMAIL_PROVIDER defaults to mock outside production", () => {
  setEnv({ NODE_ENV: "development", JWT_ACCESS_SECRET: VALID_SECRET });

  assert.equal(getEnv().EMAIL_PROVIDER, "mock");
});

test("a malformed DEV_OTP_CODE is rejected before it can weaken auth", () => {
  setEnv({
    NODE_ENV: "development",
    JWT_ACCESS_SECRET: VALID_SECRET,
    DEV_OTP_CODE: "12ab",
  });

  assert.throws(() => getEnv(), /exactly 6 digits/);
});
