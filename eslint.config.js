// Flat config (ESLint 9). The `boundaries` rules below are what turn
// CLAUDE.md Rules 1/2/4 ("no business logic in the client", "single source
// of truth", "reusable across every future client") from aspiration into a
// lint failure. See CLAUDE.md "Architecture Enforcement" for the full
// rationale — don't loosen these without updating that section too.
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import boundaries from "eslint-plugin-boundaries";

export default tseslint.config(
  {
    ignores: ["**/node_modules/**", "**/dist/**", "**/.next/**", "**/generated/**", ".claude/**"],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    plugins: { boundaries },
    settings: {
      // Needed for the boundaries plugin to resolve `@lifeos/*` workspace
      // packages to their real file path (not just "an external package")
      // so the element-type rules below actually apply to them.
      "import/resolver": {
        typescript: { alwaysTryTypes: true },
      },
      "boundaries/elements": [
        { type: "contracts", pattern: "packages/contracts/src/**" },
        { type: "core", pattern: "packages/core/src/**" },
        { type: "db", pattern: "packages/db/src/**" },
        { type: "web-routes", pattern: "apps/web/src/app/api/**" },
        { type: "web-app", pattern: "apps/web/src/app/**" },
        { type: "web-ui", pattern: "apps/web/src/components/**" },
        { type: "web-lib", pattern: "apps/web/src/lib/**" },
        { type: "worker", pattern: "apps/worker/src/**" },
      ],
    },
    rules: {
      "boundaries/element-types": [
        "error",
        {
          default: "disallow",
          rules: [
            { from: "contracts", allow: ["contracts"] },
            { from: "core", allow: ["contracts", "core", "db"] },
            { from: "db", allow: ["contracts", "db"] },
            // Route handlers and RSC pages call core services directly —
            // never db. This is the boundary that keeps calculations,
            // filtering, and financial/streak/report logic server-side and
            // out of every client (web today, Android/Telegram/MCP later).
            { from: "web-routes", allow: ["contracts", "core", "web-lib", "web-routes"] },
            { from: "web-app", allow: ["contracts", "core", "web-lib", "web-app", "web-ui"] },
            // UI components render only — contracts give them prop types,
            // nothing gives them a way to reach core or db.
            { from: "web-ui", allow: ["contracts", "web-ui"] },
            { from: "web-lib", allow: ["contracts", "core", "web-lib"] },
            { from: "worker", allow: ["contracts", "core", "worker"] },
          ],
        },
      ],
    },
  },
  {
    files: ["**/*.test.ts"],
    rules: {
      "boundaries/element-types": "off",
    },
  },
);
