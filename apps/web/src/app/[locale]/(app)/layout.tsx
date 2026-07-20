import { AuthGate } from "./_components/auth-gate";
import { AppShell } from "./_components/app-shell";

// A route group (parens don't add a URL segment) — everything under here
// requires auth and gets the nav shell; /login and the root redirect page
// stay outside it, matching the split the UI implementation plan settled
// on given tokens live only in localStorage (no cookie-based SSR session
// this pass — see AuthGate's own comment for why).
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGate>
      <AppShell>{children}</AppShell>
    </AuthGate>
  );
}
