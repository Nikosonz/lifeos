-- NotificationType goes from a closed Prisma enum to a plain String column
-- (ADR-0011). Existing enum values are valid text already, so this is a
-- lossless in-place cast rather than the drop-and-recreate Prisma's
-- generator defaults to when a column has data (that path would delete
-- every existing notification's `type` value).
-- AlterTable
ALTER TABLE "notifications" ALTER COLUMN "type" TYPE TEXT USING "type"::TEXT;

-- DropEnum
DROP TYPE "NotificationType";
