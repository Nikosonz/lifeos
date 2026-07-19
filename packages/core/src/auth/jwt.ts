import { SignJWT, jwtVerify } from "jose";
import { getEnv } from "../config/env";
import { UnauthorizedError } from "../errors/app-error";

const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;

export interface AccessTokenPayload {
  sub: string; // userId
  sid: string; // sessionId
}

function accessTokenSecret() {
  return new TextEncoder().encode(getEnv().JWT_ACCESS_SECRET);
}

export async function signAccessToken(payload: AccessTokenPayload): Promise<string> {
  return new SignJWT({ sid: payload.sid })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TOKEN_TTL_SECONDS}s`)
    .sign(accessTokenSecret());
}

export async function verifyAccessToken(token: string): Promise<AccessTokenPayload> {
  try {
    const { payload } = await jwtVerify(token, accessTokenSecret());
    if (typeof payload.sub !== "string" || typeof payload.sid !== "string") {
      throw new Error("malformed access token payload");
    }
    return { sub: payload.sub, sid: payload.sid };
  } catch {
    throw new UnauthorizedError("Invalid or expired access token");
  }
}
