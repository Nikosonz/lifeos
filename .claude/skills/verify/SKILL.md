---
name: verify
description: Cold-start recipe for driving the LifeOS auth API end-to-end against real Postgres. Use before trusting any change to packages/core/src/auth/**, apps/web/src/app/api/v1/auth/**, or apps/web/src/lib/{route-handler,auth-context}.ts.
---

# LifeOS verify recipe

Verification here means: real Postgres (Docker), real `next dev`, real curl
against `/api/v1`. Not `npm test` (that's fakes + business rules, already
covered by CI) and not `tsc`/lint (those only prove it compiles).

## Setup

```bash
cd "d:\Claude Code\app"
docker compose ps                          # postgres/redis should show healthy;
docker compose up -d                       # if not, start them (Docker Desktop
                                            # must already be running — see CLAUDE.md)
cd apps/web
mkdir -p .tmp
(npm run dev > .tmp/dev.log 2>&1 &)
sleep 3
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/fa   # expect 200
```

`apps/web/.env` and `packages/db/.env` must already exist (see CLAUDE.md
Database section) — this is local-only, not committed.

## Drive the auth flow

The OTP code never leaves the machine (mock SMS provider) — it's in the pino
log as `"event":"..."` isn't set on that specific line, grep for the phone
instead:

```bash
PHONE="+98912xxxxxxx"   # pick a fresh number each run — OTPs are single-use
curl -s -X POST http://localhost:3000/api/v1/auth/request-otp \
  -H "content-type: application/json" -d "{\"phone\":\"$PHONE\"}"

sleep 1
CODE=$(tail -20 apps/web/.tmp/dev.log | grep -o "\"phone\":\"$PHONE\",\"code\":\"[0-9]*\"" \
  | tail -1 | grep -o '"code":"[0-9]*"' | grep -o '[0-9]*')

curl -s -X POST http://localhost:3000/api/v1/auth/verify-otp \
  -H "content-type: application/json" -d "{\"phone\":\"$PHONE\",\"code\":\"$CODE\"}"
# → { user: {...}, tokens: { accessToken, refreshToken, expiresAt } }
```

From there: `GET /api/v1/me`, `GET /api/v1/auth/sessions`,
`DELETE /api/v1/auth/sessions/:id`, `POST /api/v1/auth/refresh`,
`POST /api/v1/auth/logout` all take `Authorization: Bearer <accessToken>`.

**Gotcha — bash variables don't persist across separate Bash tool calls.**
Every step above that depends on a previous step's `$ACCESS`/`$SID`/`$CODE`
must run in the _same_ tool invocation, or the variable is empty and you get
a confusing 401/308 that looks like an app bug but isn't. Chain the whole
flow in one script.

**Gotcha — OTP codes are single-use.** Reusing a phone number with a stale
code gives `VALIDATION_ERROR: "No active code for this phone number"` — not
a bug, request a fresh code.

## Worth re-driving after touching...

- `otp-service.ts` / `session-service.ts`: full request-otp → verify → me →
  sessions → revoke → confirm 401 sequence (see CLAUDE.md Testing section
  for the exact sequence proven to work).
- `route-handler.ts`: specifically the dynamic route
  (`DELETE /api/v1/auth/sessions/[id]`) — a bad `Ctx` default type here
  passes `tsc --noEmit` fine but fails `next build`'s generated route
  validator (`.next/types/validator.ts`), which nothing except an actual
  build catches. Run `npm run build` (not just typecheck) after any change
  to `runRoute`'s generic signature.
- Anything touching session ownership: probe cross-user (user B tries to
  revoke user A's session id) — must get `UNAUTHORIZED: "Session not
found"`, and user A's session must still be listed afterward.
- Structured logging changes: `grep -E '"event":' apps/web/.tmp/dev.log`
  and check the fields are what you expect (phone masked, no raw OTP code
  outside the mock-provider line).

## Cleanup

```bash
powershell.exe -NoProfile -Command "Get-Process -Name node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue"
```

Leave the Postgres/Redis containers running between sessions — they're
cheap and other work (migrations, further verification) needs them anyway.
