import { test } from "node:test";
import assert from "node:assert/strict";
import type { ITaskProjectRepository, IAuditLogRepository, TaskProject, Task } from "@lifeos/db";
import { ProjectService } from "../src/tasks/services/project-service";
import { NotFoundError } from "../src/errors/app-error";

function fakeProjectRepository(
  tasks: Task[] = [],
): ITaskProjectRepository & { rows: TaskProject[] } {
  const rows: TaskProject[] = [];
  return {
    rows,
    async create(data) {
      const row: TaskProject = {
        id: `project-${rows.length}`,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        version: 1,
        ...data,
        description: data.description ?? null,
        color: data.color ?? null,
      };
      rows.push(row);
      return row;
    },
    async findById(id) {
      return rows.find((p) => p.id === id) ?? null;
    },
    async findByUserId(userId) {
      return rows.filter((p) => p.userId === userId && !p.deletedAt);
    },
    async update(id, data) {
      const row = rows.find((p) => p.id === id)!;
      Object.assign(row, data, { version: row.version + 1 });
      return row;
    },
    async softDeleteAndUnassignTasks(id) {
      const row = rows.find((p) => p.id === id)!;
      row.deletedAt = new Date();
      row.version += 1;
      for (const task of tasks) {
        if (task.projectId === id) task.projectId = null;
      }
      return row;
    },
  };
}

function fakeAuditLogRepository(): IAuditLogRepository {
  return {
    async record(data) {
      return {
        id: "audit-0",
        createdAt: new Date(),
        userId: data.userId ?? null,
        action: data.action,
        metadata: null,
      };
    },
  };
}

test("createProject then listProjects returns the created project for its owner", async () => {
  const service = new ProjectService(fakeProjectRepository(), fakeAuditLogRepository());
  await service.createProject("user-1", { name: "Website Redesign" });

  const projects = await service.listProjects("user-1");
  assert.equal(projects.length, 1);
  assert.equal(projects[0]?.name, "Website Redesign");
});

test("updateProject throws NotFoundError for a project owned by a different user", async () => {
  const service = new ProjectService(fakeProjectRepository(), fakeAuditLogRepository());
  const project = await service.createProject("user-1", { name: "Website Redesign" });

  await assert.rejects(
    () => service.updateProject(project.id, "user-2", { name: "Hijacked" }),
    NotFoundError,
  );
});

test("deleteProject soft-deletes and bulk-unassigns the project from its tasks", async () => {
  const task: Task = {
    id: "task-1",
    userId: "user-1",
    projectId: "project-0",
    title: "Design homepage",
    description: null,
    status: "TODO",
    priority: "MEDIUM",
    deadline: null,
    completedAt: null,
    position: 1024,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    version: 1,
  };
  const projectRepo = fakeProjectRepository([task]);
  const service = new ProjectService(projectRepo, fakeAuditLogRepository());
  const project = await service.createProject("user-1", { name: "Website Redesign" });
  task.projectId = project.id;

  await service.deleteProject(project.id, "user-1");

  const projects = await service.listProjects("user-1");
  assert.equal(projects.length, 0);
  assert.equal(task.projectId, null);
});
