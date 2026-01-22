-- AlterTable
ALTER TABLE "case_team_members" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "case_team_members_deletedAt_idx" ON "case_team_members"("deletedAt");
