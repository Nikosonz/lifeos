#!/usr/bin/env node
// PostToolUse hook (Edit|Write). Lints the just-edited TS/TSX file with this
// project's own ESLint config and blocks (exit 2) with the errors on stderr
// so Claude fixes them immediately instead of at the next `npm run lint`.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(fileURLToPath(import.meta.url), "../../..");

let input = "";
process.stdin.setEncoding("utf8");
for await (const chunk of process.stdin) input += chunk;

let payload;
try {
  payload = JSON.parse(input);
} catch {
  process.exit(0); // no parseable payload — nothing to lint
}

const filePath = payload?.tool_input?.file_path;
if (!filePath || !/\.(ts|tsx)$/.test(filePath)) process.exit(0);

const relative = path.relative(projectRoot, filePath).replace(/\\/g, "/");
if (
  !relative ||
  relative.startsWith("..") ||
  relative.includes("/generated/") ||
  relative.includes("/.next/") ||
  relative.includes("/node_modules/")
) {
  process.exit(0);
}

if (!existsSync(filePath)) process.exit(0);

const eslintBin = path.join(projectRoot, "node_modules", "eslint", "bin", "eslint.js");
const result = spawnSync(process.execPath, [eslintBin, "--max-warnings", "0", filePath], {
  cwd: projectRoot,
  encoding: "utf8",
});

if (result.status !== 0) {
  process.stderr.write(result.stdout || "");
  process.stderr.write(result.stderr || "");
  process.exit(2);
}

process.exit(0);
