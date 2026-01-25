-- CreateTable
CREATE TABLE "case_discussions" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "mentions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "case_discussions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "case_discussions_caseId_idx" ON "case_discussions"("caseId");

-- CreateIndex
CREATE INDEX "case_discussions_userId_idx" ON "case_discussions"("userId");

-- CreateIndex
CREATE INDEX "case_discussions_createdAt_idx" ON "case_discussions"("createdAt");

-- CreateIndex
CREATE INDEX "case_discussions_isPinned_idx" ON "case_discussions"("isPinned");

-- CreateIndex
CREATE INDEX "case_discussions_deletedAt_idx" ON "case_discussions"("deletedAt");

-- AddForeignKey
ALTER TABLE "case_discussions" ADD CONSTRAINT "case_discussions_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_discussions" ADD CONSTRAINT "case_discussions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
