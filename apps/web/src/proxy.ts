import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

// Next.js 16 renamed `middleware.ts` to `proxy.ts` — do NOT add a
// `middleware.ts` alongside this file, having both breaks the build.
// API routes under /api/v1 are intentionally excluded: they are
// locale-agnostic and authenticate via Bearer token, not this gate.
export default createMiddleware(routing);

export const config = {
  matcher: ["/((?!api|_next|.*\\..*).*)"],
};
