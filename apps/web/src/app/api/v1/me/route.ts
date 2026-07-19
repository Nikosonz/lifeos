import { UpdateProfileInput } from "@lifeos/contracts";
import { authService } from "@lifeos/core";
import type { User } from "@lifeos/core";
import { runRoute } from "@/lib/route-handler";
import { requireUser } from "@/lib/auth-context";

function toResponse(user: User) {
  return {
    id: user.id,
    phone: user.phone,
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
    ...(input.timezone !== undefined ? { timezone: input.timezone } : {}),
    ...(input.calendarPreference !== undefined
      ? { calendarPreference: input.calendarPreference }
      : {}),
  });
  return toResponse(user);
});
