#!/usr/bin/env node
// PreToolUse hook (Bash). Blocks push/force-push, reset --hard, clean -f(d),
// branch -D, and checkout/restore "." before they execute — see
// git-guardrails-claude-code skill. Ported to Node instead of the skill's
// bundled jq-based bash script because `jq` isn't installed in this
// environment (Git Bash on Windows); this repo's other hooks already avoid
// external shell deps for the same reason (see lint-file.mjs/typecheck.mjs).
const DANGEROUS_PATTERNS = [
  /git\s+push/,
  /git\s+reset\s+--hard/,
  /git\s+clean\s+-fd/,
  /git\s+clean\s+-f\b/,
  /git\s+branch\s+-D/,
  /git\s+checkout\s+\./,
  /git\s+restore\s+\./,
  /push\s+--force/,
  /reset\s+--hard/,
];

let input = "";
process.stdin.setEncoding("utf8");
for await (const chunk of process.stdin) input += chunk;

let payload;
try {
  payload = JSON.parse(input);
} catch {
  process.exit(0);
}

const command = payload?.tool_input?.command;
if (typeof command !== "string") process.exit(0);

for (const pattern of DANGEROUS_PATTERNS) {
  if (pattern.test(command)) {
    process.stderr.write(
      `BLOCKED: '${command}' matches dangerous pattern '${pattern}'. The user has prevented you from doing this.\n`,
    );
    process.exit(2);
  }
}

process.exit(0);
