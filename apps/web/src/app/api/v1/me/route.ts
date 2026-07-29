import { NextResponse } from "next/server";
import { UpdateProfileInput, DeleteAccountInput } from "@lifeos/contracts";
import { authService } from "@lifeos/core";
import type { User } from "@lifeos/core";
import { runRoute } from "@/lib/route-handler";
import { requireUser } from "@/lib/auth-context";

function toResponse(user: User) {
  return {
    id: user.id,
    phone: user.phone,
    email: user.email,
    name: user.name,
    createdAt: user.createdAt.toISOString(),
    timezone: user.timezone,
    calendarPreference: user.calendarPreference,
  };
}

export const GET = runRoute(async (req) => {
  const { userId } = await requireUser(req);
  const user = await authService.me(userId);
  return toResponse(user);
});

export const PATCH = runRoute(async (req) => {
  const { userId } = await requireUser(req);
  const input = UpdateProfileInput.parse(await req.json());
  const user = await authService.updateProfile(userId, {
    // `name` passes through `null` deliberately — unlike the other two,
    // its contract is `.nullable().optional()`, so an explicit null is a
    // real instruction to clear the name, not an absent field.
    ...(input.name !== undefined ? { name: input.name } : {}),
    ...(input.timezone !== undefined ? { timezone: input.timezone } : {}),
    ...(input.calendarPreference !== undefined
      ? { calendarPreference: input.calendarPreference }
      : {}),
  });
  return toResponse(user);
});

// Irreversible: deletes the account and cascades to every row it owns.
// Requires `{ confirm: true }` in the body (see DeleteAccountInput) so it
// cannot be triggered by a stray DELETE with no payload.
//
// Returns 204 with no body rather than the deleted user — there is nothing
// left to represent, and echoing the record back would be the one response
// guaranteed to describe something that no longer exists.
export const DELETE = runRoute(async (req) => {
  const { userId } = await requireUser(req);
  DeleteAccountInput.parse(await req.json());
  await authService.deleteAccount(userId);
  return new NextResponse(null, { status: 204 });
});
