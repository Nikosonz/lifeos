---
name: task-module
description: Use when building the Task module (tasks, subtasks, projects, kanban, priorities, deadlines) — not built yet. Applies the Module Pattern plus the ordering/status-transition rules a task/kanban system needs to get right.
---

# Building the Task module

Not started yet (P0 per the roadmap, after Finance). Follow
`backend-architecture` for the general shape; this covers what's specific
to tasks/projects.

## Likely model shape (draft — confirm against the actual spec before migrating)

`Project` (user-owned, optional — a task can be projectless), `Task`
(project FK nullable, title, description, status, priority, deadline,
position — for manual kanban ordering), `Subtask` (task FK, same
completion semantics as Task but simpler), `Label`/`Tag` (many-to-many
with Task). All get the sync-ready fields per the standard convention.

## Rules this module needs that Auth didn't

- **Status transitions are business logic**, not just a column update —
  if "done" triggers anything (streak counting for a linked habit,
  productivity-score recalculation, a notification), that transition
  logic lives in the Task core service, not in the route handler and
  definitely not inferred client-side from the new status value alone.
- **Kanban ordering (`position`) is a server-owned integer/fractional
  index**, recalculated by the core service on reorder — the client
  sends "I moved task X between Y and Z," never "set position to 17.5"
  directly. This keeps the ordering algorithm swappable without a client
  API change (Rule 4).
- **Calendar/timeline views are read-projections of the same Task data**,
  not a separate model — don't let a "Calendar" feature grow its own
  parallel task-like schema. If Task needs a `scheduledAt` or
  `dueDate` distinct from `deadline`, add the column; don't fork the
  entity.
- **Productivity score / dashboard task counts** are Rule-1 territory
  exactly like Finance's reports — computed in core, never client-side.

## AI capture

Same principle as Finance: natural-language task creation ("remind me to
call the dentist tomorrow") should call the same Task core service a
manual form submission calls. The NLP extraction is an input adapter, not
a second task-creation code path.
