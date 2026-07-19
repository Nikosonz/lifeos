#!/usr/bin/env node
// Stop hook. Runs once per turn (not per-edit — a full-monorepo typecheck pass
// is too slow to run after every Edit/Write). Skips entirely if no .ts/.tsx
// file changed this turn; otherwise runs `tsc --noEmit` per workspace and
// blocks (exit 2) with the errors on stderr so Claude fixes them before
// actually stopping.
//
// Invokes `node <tsc-bin>.js` directly (never `npx`/`tsc.cmd`) — Windows
// .cmd shims don't spawn reliably from a hook's non-shell exec form.
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
  payload = {};
}

// Avoid forcing a second consecutive continuation if tsc is still failing
// after the first forced fix attempt this turn.
if (payload.stop_hook_active) process.exit(0);

const status = spawnSync("git", ["status", "--porcelain"], { cwd: projectRoot, encoding: "utf8" });
const changedTsFiles = (status.stdout || "")
  .split("\n")
  .some((line) => /\.tsx?$/.test(line.trim()));

if (!changedTsFiles) process.exit(0);

const workspaces = [
  "packages/contracts",
  "packages/core",
  "packages/db",
  "apps/web",
  "apps/worker",
];

const tscBin = path.join(projectRoot, "node_modules", "typescript", "bin", "tsc");

let stdout = "";
let stderr = "";
let failed = false;

for (const ws of workspaces) {
  const tsconfigPath = path.join(projectRoot, ws, "tsconfig.json");
  if (!existsSync(tsconfigPath)) continue;

  const result = spawnSync(process.execPath, [tscBin, "--noEmit", "-p", tsconfigPath], {
    cwd: projectRoot,
    encoding: "utf8",
  });

  if (result.status !== 0) {
    failed = true;
    stdout += `\n--- ${ws} ---\n${result.stdout || ""}`;
    stderr += result.stderr || "";
  }
}

if (failed) {
  process.stderr.write(stdout);
  process.stderr.write(stderr);
  process.exit(2);
}

process.exit(0);
