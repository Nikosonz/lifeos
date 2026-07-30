import { z } from "zod";

/**
 * The response shape for a mutation with nothing to return — 13 DELETE routes,
 * logout, session revoke, and request-otp all send exactly `{ ok: true }`.
 *
 * It was the single most-returned shape in the API and the only one with no
 * contract at all, which is precisely why two clients had already invented
 * their own: `calendar-api.ts` and `habits-api.ts` each carried an inline
 * `z.object({ ok: z.boolean() })`. Two ad-hoc copies of an undeclared shape is
 * how a wire format drifts without anyone editing a contract file.
 *
 * `z.boolean()` rather than `z.literal(true)`: a route that wants to report a
 * no-op should be able to say `{ ok: false }` without needing a second schema,
 * and no client branches on the value today.
 */
export const OkResponse = z.object({ ok: z.boolean() });
export type OkResponse = z.infer<typeof OkResponse>;
