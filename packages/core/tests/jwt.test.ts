process.env.JWT_ACCESS_SECRET ??= "test-only-secret-at-least-32-characters-long";

import { test } from "node:test";
import assert from "node:assert/strict";
import { SignJWT } from "jose";
import { signAccessToken, verifyAccessToken } from "../src/auth/jwt";
import { UnauthorizedError } from "../src/errors/app-error";

test("signAccessToken produces a token verifyAccessToken accepts", async () => {
  const token = await signAccessToken({ sub: "user-1", sid: "session-1" });
  const payload = await verifyAccessToken(token);

  assert.equal(payload.sub, "user-1");
  assert.equal(payload.sid, "session-1");
});

test("verifyAccessToken rejects a tampered signature", async () => {
  const token = await signAccessToken({ sub: "user-1", sid: "session-1" });
  const tampered = token.slice(0, -1) + (token.at(-1) === "a" ? "b" : "a");

  await assert.rejects(() => verifyAccessToken(tampered), UnauthorizedError);
});

test("verifyAccessToken rejects a token signed with a different secret", async () => {
  const secret = new TextEncoder().encode("a-completely-different-secret-32-chars!!");
  const foreignToken = await new SignJWT({ sid: "session-1" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject("user-1")
    .setIssuedAt()
    .setExpirationTime("15m")
    .sign(secret);

  await assert.rejects(() => verifyAccessToken(foreignToken), UnauthorizedError);
});

test("verifyAccessToken rejects an expired token", async () => {
  const secret = new TextEncoder().encode(process.env.JWT_ACCESS_SECRET);
  const expired = await new SignJWT({ sid: "session-1" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject("user-1")
    .setIssuedAt(Math.floor(Date.now() / 1000) - 3600)
    .setExpirationTime(Math.floor(Date.now() / 1000) - 1800)
    .sign(secret);

  await assert.rejects(() => verifyAccessToken(expired), UnauthorizedError);
});

test("verifyAccessToken rejects a token missing the sid claim", async () => {
  const secret = new TextEncoder().encode(process.env.JWT_ACCESS_SECRET);
  const noSid = await new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject("user-1")
    .setIssuedAt()
    .setExpirationTime("15m")
    .sign(secret);

  await assert.rejects(() => verifyAccessToken(noSid), UnauthorizedError);
});
