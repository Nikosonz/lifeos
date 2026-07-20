import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// Deliberately placed under components/ (a `web-ui` element), not lib/
// (`web-lib`) — shadcn's generated primitives import their cn() helper from
// this exact alias by convention, and the eslint boundary rules only let
// `web-ui` import `web-ui` (never `web-lib`). See components.json's
// aliases.utils, which repoints shadcn's CLI at this path.
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
