import { test } from "node:test";
import assert from "node:assert/strict";
import { generateOpaqueToken, generateOtpCode, sha256Hex } from "../src/auth/crypto";

test("generateOtpCode always produces a zero-padded 6-digit string", () => {
  for (let i = 0; i < 200; i++) {
    const code = generateOtpCode();
    assert.equal(code.length, 6);
    assert.match(code, /^\d{6}$/);
  }
});

test("generateOtpCode is not deterministic across calls", () => {
  const codes = new Set(Array.from({ length: 20 }, () => generateOtpCode()));
  assert.ok(codes.size > 1, "expected at least some variation across 20 draws");
});

test("generateOpaqueToken produces a sufficiently long, URL-safe, unique token", () => {
  const a = generateOpaqueToken();
  const b = generateOpaqueToken();

  assert.ok(a.length >= 40);
  assert.match(a, /^[A-Za-z0-9_-]+$/);
  assert.notEqual(a, b);
});

test("sha256Hex is deterministic and distinguishes different inputs", () => {
  assert.equal(sha256Hex("hello"), sha256Hex("hello"));
  assert.notEqual(sha256Hex("hello"), sha256Hex("world"));
  assert.match(sha256Hex("hello"), /^[0-9a-f]{64}$/);
});
