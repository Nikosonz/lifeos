// Maps each top-level module to the accent hue defined in globals.css
// (--module-<key>/-foreground/-subtle). This is the single place a module's
// color is decided — Nav, page headers, and calendar chips all read from
// here rather than hardcoding a hue inline.
export type ModuleKey = "finance" | "tasks" | "calendar" | "notifications" | "reports";

interface ModuleColorClasses {
  // Icon / accent text color (nav icons, page header icon+title accent).
  icon: string;
  // Active nav row / selected-state background, paired with `icon` as text.
  activeBg: string;
  // Tinted chip/badge background + matching text (calendar chips, small tags).
  chip: string;
}

const MODULE_COLORS: Record<ModuleKey, ModuleColorClasses> = {
  finance: {
    icon: "text-module-finance",
    activeBg: "bg-module-finance-subtle",
    chip: "bg-module-finance-subtle text-module-finance",
  },
  tasks: {
    icon: "text-module-tasks",
    activeBg: "bg-module-tasks-subtle",
    chip: "bg-module-tasks-subtle text-module-tasks",
  },
  calendar: {
    icon: "text-module-calendar",
    activeBg: "bg-module-calendar-subtle",
    chip: "bg-module-calendar-subtle text-module-calendar",
  },
  notifications: {
    icon: "text-module-notifications",
    activeBg: "bg-module-notifications-subtle",
    chip: "bg-module-notifications-subtle text-module-notifications",
  },
  reports: {
    icon: "text-module-reports",
    activeBg: "bg-module-reports-subtle",
    chip: "bg-module-reports-subtle text-module-reports",
  },
};

export function moduleColorClasses(moduleKey: ModuleKey): ModuleColorClasses {
  return MODULE_COLORS[moduleKey];
}
