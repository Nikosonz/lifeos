// The one abstraction boundary in the auth module that genuinely needs an
// interface (as opposed to a concrete db repository): SMS delivery is the
// part that actually differs between environments (mock locally/CI, a real
// Iranian provider — Kavenegar/SMS.ir — in production), so it's swappable
// via this port rather than a repository class.
export interface SmsProvider {
  sendOtp(phone: string, code: string): Promise<void>;
}
