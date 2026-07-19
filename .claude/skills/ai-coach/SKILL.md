---
name: ai-coach
description: Use when building any AI-powered feature (natural-language capture, AI coach/reviews, budget/schedule/habit suggestions) — P2 per the roadmap, not built yet. The one rule that matters is provider abstraction, because direct OpenAI/Anthropic access doesn't work from Iran.
---

# Building AI features in LifeOS

Deliberately P2 (after Finance, Tasks, Calendar, Reports) — see the
roadmap in the original plan. When this work starts, the one
architectural decision that must be right from the first line of code:

## Provider abstraction is not optional

OpenAI and Anthropic APIs are not directly reachable/billable from Iran
(see `lifeos-domain` skill). Every AI capability needs a port/adapter
pair from day one, exactly like `SmsProvider`
(`packages/core/src/auth/ports/sms-provider.ts`) is the existing example
to copy:

```
packages/core/src/ai/
  ports/ai-provider.ts       // interface: extractTransaction(text), generateReview(context), ...
  adapters/mock-ai-provider.ts   // dev/test — deterministic fake output
  adapters/<real-provider>-adapter.ts  // whatever proxy/intermediary API actually works from Iran
  services/*.ts              // business logic: what to DO with the extraction, not how to get it
```

Never call an AI SDK directly from a core service or a route handler —
always through the `AiProvider` interface. This is the same reasoning as
the SMS provider: swapping the backing implementation later must touch
only the `adapters/` file.

## Every AI feature still follows Rule 1

"AI extracts a transaction from natural language" does **not** mean the
AI response is trusted and persisted directly. The flow is: AI provider
extracts structured data (amount, category, date) → the _same_ Finance/Task
core service that a manual form submission calls validates and persists
it. The AI provider is an input adapter producing a `CreateTransactionInput`-
shaped result, not a second write path that bypasses the module's own
validation and business rules.

## Smart features from the spec, and where they live

AI Coach, Daily/Weekly Review, Budget Suggestions, Schedule Suggestions,
Habit Suggestions, Productivity/Financial Analysis — each is a
`packages/core/src/ai/services/*.ts` service that:

1. Pulls the relevant data via the _other_ modules' core services
   (Finance, Tasks, Habits) — never queries their Prisma models directly;
   that would violate module isolation (Rule 5) the same way a
   cross-module direct-DB read would.
2. Calls the `AiProvider` interface to generate the actual
   suggestion/summary text.
3. Returns a plain result the route handler maps to a contract shape —
   same pattern as every other module.

## Mock-first development

Build and test every AI feature against `MockAiProvider` (deterministic,
no network call) the same way Auth was built and verified against
`MockSmsProvider` before any real provider existed. Don't block feature
development on having real provider access sorted out.
