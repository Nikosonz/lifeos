-- CreateEnum
CREATE TYPE "OtpChannel" AS ENUM ('SMS', 'EMAIL');

-- DropIndex
DROP INDEX "otp_codes_phone_createdAt_idx";

-- AlterTable
ALTER TABLE "otp_codes" DROP COLUMN "phone",
ADD COLUMN     "channel" "OtpChannel" NOT NULL,
ADD COLUMN     "identifier" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "email" TEXT,
ALTER COLUMN "phone" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "otp_codes_channel_identifier_createdAt_idx" ON "otp_codes"("channel", "identifier", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
