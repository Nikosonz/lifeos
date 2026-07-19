import { test } from "node:test";
import assert from "node:assert/strict";
import { PhoneNumber, RequestOtpInput, VerifyOtpInput, RefreshInput } from "../src/auth/schemas";

test("PhoneNumber accepts E.164-ish numbers with or without a leading +", () => {
  assert.equal(PhoneNumber.parse("+989123456789"), "+989123456789");
  assert.equal(PhoneNumber.parse("989123456789"), "989123456789");
});

test("PhoneNumber rejects malformed numbers", () => {
  assert.throws(() => PhoneNumber.parse("0123456789")); // leading zero disallowed
  assert.throws(() => PhoneNumber.parse("12345")); // too short
  assert.throws(() => PhoneNumber.parse("not-a-phone"));
  assert.throws(() => PhoneNumber.parse(""));
});

test("RequestOtpInput requires a valid phone field", () => {
  assert.deepEqual(RequestOtpInput.parse({ phone: "+989123456789" }), { phone: "+989123456789" });
  assert.throws(() => RequestOtpInput.parse({}));
  assert.throws(() => RequestOtpInput.parse({ phone: "bad" }));
});

test("VerifyOtpInput requires exactly a 6-character code", () => {
  assert.doesNotThrow(() => VerifyOtpInput.parse({ phone: "+989123456789", code: "123456" }));
  assert.throws(() => VerifyOtpInput.parse({ phone: "+989123456789", code: "12345" }));
  assert.throws(() => VerifyOtpInput.parse({ phone: "+989123456789", code: "1234567" }));
});

test("RefreshInput requires a non-empty refreshToken", () => {
  assert.doesNotThrow(() => RefreshInput.parse({ refreshToken: "abc" }));
  assert.throws(() => RefreshInput.parse({ refreshToken: "" }));
  assert.throws(() => RefreshInput.parse({}));
});
