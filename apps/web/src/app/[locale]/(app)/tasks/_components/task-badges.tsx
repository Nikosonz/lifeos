import type { TaskStatus, TaskPriority } from "@lifeos/contracts";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/components/utils";

// Shared between the task list row and the create/edit dialog so status/
// priority always render identically wherever they appear.
const STATUS_KEY: Record<TaskStatus, string> = {
  TODO: "statusTodo",
  IN_PROGRESS: "statusInProgress",
  DONE: "statusDone",
  CANCELLED: "statusCancelled",
};

const PRIORITY_KEY: Record<TaskPriority, string> = {
  LOW: "priorityLow",
  MEDIUM: "priorityMedium",
  HIGH: "priorityHigh",
  URGENT: "priorityUrgent",
};

export function statusMessageKey(status: TaskStatus): string {
  return STATUS_KEY[status];
}

export function priorityMessageKey(priority: TaskPriority): string {
  return PRIORITY_KEY[priority];
}

export function StatusBadge({ status, label }: { status: TaskStatus; label: string }) {
  const variant =
    status === "DONE" ? "default" : status === "IN_PROGRESS" ? "secondary" : "outline";
  return (
    <Badge variant={variant} className={cn(status === "CANCELLED" && "text-muted-foreground")}>
      {label}
    </Badge>
  );
}

export function PriorityBadge({ priority, label }: { priority: TaskPriority; label: string }) {
  const variant =
    priority === "URGENT"
      ? "destructive"
      : priority === "HIGH"
        ? "default"
        : priority === "MEDIUM"
          ? "secondary"
          : "outline";
  return <Badge variant={variant}>{label}</Badge>;
}
