-- Three foreign-key columns that had no index able to serve a bare
-- `WHERE <fk> = $1`, which is the predicate Postgres runs to find dependent
-- rows for ON DELETE CASCADE / SET NULL. Each one turned a delete into a
-- sequential scan of the child table:
--
--   subtasks.userId          — the only unindexed userId in the schema, and
--                              directly on the account-deletion path
--   finance_budgets.categoryId — both existing indexes lead with userId
--   tasks.projectId          — (userId, projectId) leads with userId, so it
--                              cannot serve TaskProjectRepository's
--                              softDeleteAndUnassignTasks updateMany either
--
-- NOTE for any future index migration run against a populated production
-- database: plain CREATE INDEX takes a SHARE lock, blocking every write to
-- the table until it completes. These three are safe as-is because no
-- production database exists yet and every table is empty. Once one does,
-- use CREATE INDEX CONCURRENTLY — which cannot run inside a transaction, so
-- the migration must also be marked as non-transactional. No migration in
-- this repo has needed that yet; this is where to start when one does.

-- CreateIndex
CREATE INDEX "finance_budgets_categoryId_idx" ON "finance_budgets"("categoryId");

-- CreateIndex
CREATE INDEX "subtasks_userId_idx" ON "subtasks"("userId");

-- CreateIndex
CREATE INDEX "tasks_projectId_idx" ON "tasks"("projectId");
