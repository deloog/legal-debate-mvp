-- AlterTable: 对话关联案件
ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "caseId" TEXT;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_caseId_fkey"
  FOREIGN KEY ("caseId") REFERENCES "cases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "conversations_caseId_idx" ON "conversations"("caseId");
