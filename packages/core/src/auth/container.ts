import {
  prisma,
  UserRepository,
  OtpRepository,
  SessionRepository,
  AuditLogRepository,
} from "@lifeos/db";
import { MockSmsProvider } from "./adapters/mock-sms-provider";
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

// SMS_PROVIDER env var will select the adapter once a real one exists
// (Kavenegar/SMS.ir) — only "mock" is implemented so far.
const smsProvider = new MockSmsProvider();

const otpService = new OtpService(otpRepository, userRepository, smsProvider);
const sessionService = new SessionService(sessionRepository);

export const authService = new AuthService(
  otpService,
  sessionService,
  userRepository,
  auditLogRepository,
);
