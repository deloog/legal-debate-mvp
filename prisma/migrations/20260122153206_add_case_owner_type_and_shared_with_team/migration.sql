-- CreateEnum
CREATE TYPE "OwnerType" AS ENUM ('USER', 'TEAM');

-- AlterTable
ALTER TABLE "cases" ADD COLUMN     "ownerType" "OwnerType" NOT NULL DEFAULT 'USER',
ADD COLUMN     "sharedWithTeam" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "cases_ownerType_idx" ON "cases"("ownerType");

-- CreateIndex
CREATE INDEX "cases_sharedWithTeam_idx" ON "cases"("sharedWithTeam");
