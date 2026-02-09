-- CreateEnum
CREATE TYPE "ExportType" AS ENUM ('CASES', 'CONSULTATIONS', 'CONTRACTS', 'STATS', 'MEMBERSHIPS', 'DOCUMENTS');

-- CreateEnum
CREATE TYPE "ExportFormat" AS ENUM ('CSV', 'EXCEL', 'PDF', 'JSON');

-- CreateEnum
CREATE TYPE "ExportTaskStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateTable
CREATE TABLE "export_tasks" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "exportType" "ExportType" NOT NULL,
    "format" "ExportFormat" NOT NULL,
    "status" "ExportTaskStatus" NOT NULL DEFAULT 'PENDING',
    "filePath" TEXT,
    "fileSize" INTEGER DEFAULT 0,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "export_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "export_tasks_userId_idx" ON "export_tasks"("userId");

-- CreateIndex
CREATE INDEX "export_tasks_status_idx" ON "export_tasks"("status");

-- CreateIndex
CREATE INDEX "export_tasks_exportType_idx" ON "export_tasks"("exportType");

-- CreateIndex
CREATE INDEX "export_tasks_createdAt_idx" ON "export_tasks"("createdAt");

-- AddForeignKey
ALTER TABLE "export_tasks" ADD CONSTRAINT "export_tasks_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
