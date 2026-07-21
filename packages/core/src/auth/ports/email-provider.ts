// Mirrors SmsProvider exactly — email OTP delivery is the other channel
// that genuinely differs between environments (mock locally/CI, a real
// transactional-email provider — Resend/SES/etc. — in production), so it's
// swappable via this port rather than a repository class.
export interface EmailProvider {
  sendOtp(email: string, code: string): Promise<void>;
}
