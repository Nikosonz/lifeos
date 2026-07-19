---
name: telegram
description: Use when building the Telegram bot client for LifeOS (P2 per the roadmap) — not built yet. Same "thin client, no duplicated logic" principle as mcp and backend-architecture, plus Telegram-specific auth and notification considerations.
---

# Building the Telegram client for LifeOS

Not started yet (P2, alongside AI agents/MCP/public API). Telegram is
explicitly named as both a client (CLAUDE.md intro) and a notification
channel (original spec's Notification module) — those are two different
things, don't conflate them.

## As a client (bot commands / conversational interface)

Same principle as every other client: the bot's command handlers call
`/api/v1` routes (or the underlying `packages/core` services if the bot
runs in-process rather than as a separate service) — never reimplement
"add a task" or "log an expense" logic in the bot layer. A Telegram
message like "I spent 250,000 Tomans on lunch" should go through the same
AI-extraction → core-service path described in `ai-coach`, with Telegram
as just the input/output surface.

## Auth is the interesting problem here

Telegram bots don't have a browser to redirect through for OTP entry the
normal way. Likely pattern (confirm against the actual spec before
building): the bot collects the phone number via a message, calls
`POST /api/v1/auth/request-otp` the same way the web client does, then
the user replies with the code, and the bot calls
`POST /api/v1/auth/verify-otp` — same endpoints, same flow, just driven
by chat messages instead of form fields. Store the resulting access/
refresh tokens associated with the Telegram chat ID (encrypted at rest,
same secret-hygiene bar as any other credential — see the `security`
skill), refresh them the same way the web client does.

## As a notification channel

This is separate from the bot-as-client work — "Telegram" appears in the
Notification module's channel list (Push, Email, SMS, Telegram, In-App).
That's LifeOS _sending_ a message to a user's Telegram chat (e.g. a
reminder, a budget alert), which needs the chat ID captured once (via the
bot flow above) and then a simple send-message call from
`packages/core`'s notification service — not the same code path as the
bot handling inbound commands, but not a reason to build two separate
Telegram integrations either. One Telegram Bot API client, used both for
inbound command handling and outbound notification sends.

## Don't build this speculatively

No code exists for this yet — this skill is guidance for when the work
starts, not a scaffold to create now.
