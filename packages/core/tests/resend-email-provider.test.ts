import { test } from "node:test";
import assert from "node:assert/strict";
import { ResendEmailProvider, type FetchLike } from "../src/auth/adapters/resend-email-provider";

const API_KEY = "re_" + "x".repeat(30);
const FROM = "Maaleto <login@example.test>";

type Call = { url: string; init: RequestInit };

/** Records what the provider sent, and returns whatever the test dictates. */
function recordingFetch(respond: () => Response | Promise<Response>) {
  const calls: Call[] = [];
  const impl: FetchLike = async (url, init) => {
    calls.push({ url, init });
    return respond();
  };
  return { calls, impl };
}

const ok = () => new Response(JSON.stringify({ id: "abc" }), { status: 200 });

test("posts the code to Resend with the configured from address", async () => {
  const { calls, impl } = recordingFetch(ok);
  await new ResendEmailProvider(API_KEY, FROM, impl).sendOtp("user@example.test", "123456");

  assert.equal(calls.length, 1);
  const call = calls[0]!;
  assert.equal(call.url, "https://api.resend.com/emails");
  assert.equal(call.init.method, "POST");

  const headers = call.init.headers as Record<string, string>;
  assert.equal(headers["Authorization"], `Bearer ${API_KEY}`);

  const body = JSON.parse(String(call.init.body)) as {
    from: string;
    to: string[];
    subject: string;
    html: string;
    text: string;
  };
  assert.equal(body.from, FROM);
  assert.deepEqual(body.to, ["user@example.test"]);
  // The code must reach the user whichever part their client renders —
  // some Iranian webmail clients strip HTML entirely.
  assert.ok(body.subject.includes("123456"));
  assert.ok(body.html.includes("123456"));
  assert.ok(body.text.includes("123456"));
});

// The three tests below are the actual point of this file. Each covers a
// way the send can fail while the caller keeps going, which would leave a
// user watching a code-entry box for an email that will never arrive.

test("throws when Resend rejects the message", async () => {
  const { impl } = recordingFetch(
    () => new Response(JSON.stringify({ message: "domain is not verified" }), { status: 403 }),
  );
  await assert.rejects(
    () => new ResendEmailProvider(API_KEY, FROM, impl).sendOtp("user@example.test", "123456"),
    /403/,
  );
});

test("throws when the request never reaches Resend", async () => {
  const impl: FetchLike = async () => {
    throw new TypeError("fetch failed");
  };
  await assert.rejects(
    () => new ResendEmailProvider(API_KEY, FROM, impl).sendOtp("user@example.test", "123456"),
    /Failed to send the login email/,
  );
});

test("a 500 from Resend is a failure, not a success", async () => {
  const { impl } = recordingFetch(() => new Response("upstream error", { status: 500 }));
  await assert.rejects(
    () => new ResendEmailProvider(API_KEY, FROM, impl).sendOtp("user@example.test", "123456"),
    /500/,
  );
});

test("the OTP code never appears in the error thrown to the caller", async () => {
  const { impl } = recordingFetch(() => new Response("nope", { status: 422 }));
  await assert.rejects(
    () => new ResendEmailProvider(API_KEY, FROM, impl).sendOtp("user@example.test", "987654"),
    (error: Error) => {
      assert.ok(!error.message.includes("987654"), "error message must not leak the OTP");
      return true;
    },
  );
});
