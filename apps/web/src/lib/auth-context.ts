import type { NextRequest } from "next/server";
import { authService, UnauthorizedError } from "@lifeos/core";
import type { DeviceInfo } from "@lifeos/core";

// Thin HTTP-header adapter — reading the Authorization header is web
// plumbing, but the actual token/session verification is core business
// logic (see @lifeos/core authService.verifyAccessToken), reused as-is by
// whatever future client authenticates requests the same way.
export async function requireUser(req: NextRequest) {
  const header = req.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) throw new UnauthorizedError();
  const token = header.slice("Bearer ".length);
  return authService.verifyAccessToken(token);
}

export function deviceInfoFromRequest(req: NextRequest): DeviceInfo {
  return {
    userAgent: req.headers.get("user-agent"),
    ipAddress: req.headers.get("x-forwarded-for"),
  };
}
