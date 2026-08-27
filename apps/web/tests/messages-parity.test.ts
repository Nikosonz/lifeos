import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * fa.json and en.json must describe exactly the same set of strings.
 *
 * A missing key does not throw at build time and does not fail typecheck —
 * next-intl renders the key path itself, so the page ships with a literal
 * `Landing.faqOfflineA` where a sentence should be, in production, on one
 * locale only. That is invisible to anyone testing in the other locale,
 * which for this repo means invisible to everyone (fa is the default, and
 * the marketing surface is where an English-speaking visitor lands first).
 *
 * The landing rewrite took the Landing namespace from 27 keys to ~98 across
 * both files, which is the point at which "just keep them in sync by hand"
 * stops being a plan.
 *
 * This checks SHAPE, not translation quality: a key present in both with an
 * untranslated value passes, and should — catching that needs a human.
 * Empty strings are allowed for the same reason (fa's `translated`-style
 * keys are deliberately empty where a note applies to one locale only).
 */

const MESSAGES = path.resolve(import.meta.dirname, "../src/messages");

function load(locale: string): Record<string, unknown> {
  return JSON.parse(readFileSync(path.join(MESSAGES, `${locale}.json`), "utf8"));
}

/** Resolves a dotted leaf path back to its value. */
function valueAt(root: Record<string, unknown>, dotted: string): unknown {
  let node: unknown = root;
  for (const part of dotted.split(".")) node = (node as Record<string, unknown>)[part];
  return node;
}

/** Every leaf path, e.g. "Landing.faqFreeQ". Order-independent. */
function leafPaths(value: unknown, prefix = ""): string[] {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return [prefix];
  }
  return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) =>
    leafPaths(child, prefix ? `${prefix}.${key}` : key),
  );
}

const fa = load("fa");
const en = load("en");

test("fa and en declare the same message keys", () => {
  const faPaths = new Set(leafPaths(fa));
  const enPaths = new Set(leafPaths(en));

  const missingFromEn = [...faPaths].filter((p) => !enPaths.has(p)).sort();
  const missingFromFa = [...enPaths].filter((p) => !faPaths.has(p)).sort();

  assert.deepEqual(missingFromEn, [], `keys in fa.json but not en.json: ${missingFromEn}`);
  assert.deepEqual(missingFromFa, [], `keys in en.json but not fa.json: ${missingFromFa}`);
});

test("both locales agree on which values are objects and which are strings", () => {
  // A namespace turned into a string in one locale (or vice versa) produces
  // the same silent breakage as a missing key, and set-equality of leaf
  // paths above would not catch a leaf that is an object in one file.
  const typeOf = (root: Record<string, unknown>, dotted: string): string => {
    const node = valueAt(root, dotted);
    if (node === null) return "null";
    return Array.isArray(node) ? "array" : typeof node;
  };

  for (const dotted of leafPaths(fa)) {
    assert.equal(
      typeOf(fa, dotted),
      typeOf(en, dotted),
      `${dotted} has a different value type in fa.json and en.json`,
    );
  }
});

test("every message value is a string or an array of strings", () => {
  // next-intl renders strings; HelpGuide's `items` keys are string arrays read
  // via t.raw(). A number or boolean that sneaks in works until someone
  // adds an ICU argument to it and it stops being formattable.
  for (const [name, messages] of [
    ["fa", fa],
    ["en", en],
  ] as const) {
    for (const dotted of leafPaths(messages)) {
      const node = valueAt(messages, dotted);
      if (Array.isArray(node)) {
        node.forEach((item, i) =>
          assert.equal(typeof item, "string", `${dotted}[${i}] is not a string in ${name}.json`),
        );
      } else {
        assert.equal(typeof node, "string", `${dotted} is not a string in ${name}.json`);
      }
    }
  }
});

test("array-valued messages have the same length in both locales", () => {
  // A five-item list in fa and a four-item list in en renders a page that
  // is missing a bullet in one language only — the same silent, one-locale
  // breakage a missing key causes, which set-equality above cannot see.
  for (const dotted of leafPaths(fa)) {
    const faValue = valueAt(fa, dotted);
    if (!Array.isArray(faValue)) continue;
    const enValue = valueAt(en, dotted);
    assert.ok(Array.isArray(enValue), `${dotted} is an array in fa.json but not in en.json`);
    assert.equal(
      (enValue as unknown[]).length,
      faValue.length,
      `${dotted} has ${faValue.length} items in fa.json and ${(enValue as unknown[]).length} in en.json`,
    );
  }
});

test("the Landing namespace is populated in both locales", () => {
  // A guard against the whole namespace being emptied by a bad merge: the
  // landing is the only page an anonymous visitor sees, and next-intl would
  // render key paths rather than fail.
  for (const [name, messages] of [
    ["fa", fa],
    ["en", en],
  ] as const) {
    const landing = messages.Landing as Record<string, string> | undefined;
    assert.ok(landing, `${name}.json has no Landing namespace`);
    assert.ok(
      Object.keys(landing).length > 50,
      `${name}.json Landing has only ${Object.keys(landing).length} keys`,
    );
    assert.ok(landing.ctaPrimary, `${name}.json Landing.ctaPrimary is empty`);
  }
});

test("the landing never advertises phone sign-up", () => {
  // The regression this exists for: the CTA said «شروع با شماره موبایل» /
  // "Start with your phone number" while MockSmsProvider fails closed in
  // production, so POST /api/v1/auth/request-otp with a phone returns 400.
  // Every visitor who clicked it hit a dead end. If a real SmsProvider is
  // ever wired up, delete this test in the same commit — not before.
  const ctaFa = valueAt(fa, "Landing.ctaPrimary");
  const ctaEn = valueAt(en, "Landing.ctaPrimary");
  assert.equal(typeof ctaFa, "string", "fa Landing.ctaPrimary is missing");
  assert.equal(typeof ctaEn, "string", "en Landing.ctaPrimary is missing");

  assert.ok(
    !(ctaFa as string).includes("موبایل") && !(ctaFa as string).includes("شماره"),
    `fa Landing.ctaPrimary offers phone sign-in: ${ctaFa}`,
  );
  assert.ok(
    !/phone|mobile/i.test(ctaEn as string),
    `en Landing.ctaPrimary offers phone sign-in: ${ctaEn}`,
  );
  assert.ok(/ایمیل/.test(ctaFa as string), "fa Landing.ctaPrimary should name the email channel");
  assert.ok(/email/i.test(ctaEn as string), "en Landing.ctaPrimary should name the email channel");
});
