import {
  prisma,
  UserRepository,
  OtpRepository,
  SessionRepository,
  AuditLogRepository,
} from "@lifeos/db";
import { rateLimitService } from "../rate-limit/container";
import { getEnv } from "../config/env";
import { MockSmsProvider } from "./adapters/mock-sms-provider";
import { MockEmailProvider } from "./adapters/mock-email-provider";
import { ResendEmailProvider } from "./adapters/resend-email-provider";
import type { EmailProvider } from "./ports/email-provider";
import { OtpService } from "./services/otp-service";
import { SessionService } from "./services/session-service";
import { AuthService } from "./services/auth-service";

// Composition root for the auth module — the only file in the whole
// monorepo that wires a db repository into a service. apps/web and
// apps/worker import `authService` from here and never touch @lifeos/db
// directly (enforced by the ESLint boundaries config).
const userRepository = new UserRepository(prisma);
const otpRepository = new OtpRepository(prisma);
const sessionRepository = new SessionRepository(prisma);
const auditLogRepository = new AuditLogRepository(prisma);

// SMS has no real adapter yet (Kavenegar/SMS.ir is a separate task), and
// MockSmsProvider refuses to run in production rather than silently
// swallowing a login attempt — see its own comment.
const smsProvider = new MockSmsProvider();

// Selection is deferred to the first send, not done here at module scope.
// This file is re-exported by packages/core's barrel, so anything importing
// @lifeos/core evaluates it at import time — reading getEnv() here would
// mean every module that transitively touches the barrel needs a complete,
// valid environment merely to load, which is exactly the coupling env.ts's
// lazy memoization exists to avoid.
let resolvedEmailProvider: EmailProvider | undefined;

function selectEmailProvider(): EmailProvider {
  const env = getEnv();
  if (env.EMAIL_PROVIDER === "resend") {
    // Non-null assertions are safe here and nowhere else: env.ts's
    // superRefine rejects "resend" without both values, and getEnv() throws
    // on a failed parse, so reaching this line guarantees they are set.
    return new ResendEmailProvider(env.RESEND_API_KEY!, env.EMAIL_FROM!);
  }
  return new MockEmailProvider();
}

const emailProvider: EmailProvider = {
  async sendOtp(email, code) {
    resolvedEmailProvider ??= selectEmailProvider();
    return resolvedEmailProvider.sendOtp(email, code);
  },
};

const otpService = new OtpService(
  otpRepository,
  userRepository,
  smsProvider,
  emailProvider,
  rateLimitService,
);
const sessionService = new SessionService(sessionRepository);

export const authService = new AuthService(
  otpService,
  sessionService,
  userRepository,
  auditLogRepository,
);
