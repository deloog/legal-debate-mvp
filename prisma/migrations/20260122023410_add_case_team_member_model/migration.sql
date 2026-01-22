-- CreateEnum
CREATE TYPE "CaseRole" AS ENUM ('LEAD', 'ASSISTANT', 'PARALEGAL', 'OBSERVER');

-- CreateTable
CREATE TABLE "case_team_members" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "CaseRole" NOT NULL DEFAULT 'ASSISTANT',
    "permissions" JSONB NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "metadata" JSONB,

    CONSTRAINT "case_team_members_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "case_team_members_caseId_idx" ON "case_team_members"("caseId");

-- CreateIndex
CREATE INDEX "case_team_members_userId_idx" ON "case_team_members"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "case_team_members_caseId_userId_key" ON "case_team_members"("caseId", "userId");

-- AddForeignKey
ALTER TABLE "case_team_members" ADD CONSTRAINT "case_team_members_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_team_members" ADD CONSTRAINT "case_team_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
