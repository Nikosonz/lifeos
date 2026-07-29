-- CreateEnum
CREATE TYPE "TelemetryCrashKind" AS ENUM ('FLUTTER_ERROR', 'UNCAUGHT_ASYNC');

-- CreateEnum
CREATE TYPE "TelemetryEventName" AS ENUM ('APP_OPENED', 'SIGNUP_COMPLETED', 'LOGIN_COMPLETED', 'TRANSACTION_CREATED', 'BUDGET_CREATED', 'TASK_CREATED', 'HABIT_CHECKED_IN', 'CALENDAR_EVENT_CREATED', 'REPORT_VIEWED');

-- CreateTable
CREATE TABLE "telemetry_crashes" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "TelemetryCrashKind" NOT NULL,
    "message" TEXT NOT NULL,
    "stackTrace" TEXT NOT NULL,
    "appVersion" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "osVersion" TEXT,
    "deviceModel" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "telemetry_crashes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "telemetry_events" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" "TelemetryEventName" NOT NULL,
    "appVersion" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "telemetry_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "telemetry_crashes_userId_occurredAt_idx" ON "telemetry_crashes"("userId", "occurredAt");

-- CreateIndex
CREATE INDEX "telemetry_events_userId_occurredAt_idx" ON "telemetry_events"("userId", "occurredAt");

-- CreateIndex
CREATE INDEX "telemetry_events_name_occurredAt_idx" ON "telemetry_events"("name", "occurredAt");

-- AddForeignKey
ALTER TABLE "telemetry_crashes" ADD CONSTRAINT "telemetry_crashes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "telemetry_events" ADD CONSTRAINT "telemetry_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
