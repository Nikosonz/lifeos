import { defineConfig } from "tsup";

// ADR-0005's consequence: raw `tsc` emit produces extensionless relative
// imports that plain Node ESM can't resolve (only bundler resolution can).
// tsup/esbuild is a real bundler, so it resolves and inlines everything it
// can — including @lifeos/core and @lifeos/contracts, which ship raw
// TypeScript source with no build step of their own (see their package.json
// `main` fields). Verified directly: bundling one of them into dist/index.js
// and running `node dist/index.js` (no tsx) works.
//
// @lifeos/db is marked external, but this is UNVERIFIED and will not work
// as-is the moment the worker's first real job imports it (directly or via
// @lifeos/core): @lifeos/db's own `main` field also points at raw
// TypeScript, so an external, unbundled reference to it produces
// `ERR_UNKNOWN_FILE_EXTENSION` at runtime under plain Node — confirmed by a
// throwaway smoke test (import logger from "@lifeos/core", rebuild, run).
// Its generated Prisma client also loads native engine binaries via
// __dirname-relative paths, which inlining would likely break anyway. Fix
// this for real before the first worker job that touches the database:
// either give packages/db its own compiled build output, or run the
// worker's dist output via `node --import tsx` instead of plain `node`
// (keeping tsx as a genuine runtime — not just dev — dependency). Don't
// solve it speculatively now; no worker logic touches the database yet.
export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  target: "node22",
  platform: "node",
  clean: true,
  noExternal: ["@lifeos/core", "@lifeos/contracts"],
  external: ["@lifeos/db", "@prisma/client"],
});
