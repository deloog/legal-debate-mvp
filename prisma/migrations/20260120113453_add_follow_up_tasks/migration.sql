-- CreateEnum
CREATE TYPE "FollowUpTaskStatus" AS ENUM ('PENDING', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "FollowUpTaskPriority" AS ENUM ('HIGH', 'MEDIUM', 'LOW');

-- CreateTable
CREATE TABLE "follow_up_tasks" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "communicationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "CommunicationType" NOT NULL DEFAULT 'PHONE',
    "summary" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "priority" "FollowUpTaskPriority" NOT NULL DEFAULT 'MEDIUM',
    "status" "FollowUpTaskStatus" NOT NULL DEFAULT 'PENDING',
    "completedAt" TIMESTAMP(3),
    "notes" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "follow_up_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "follow_up_tasks_clientId_idx" ON "follow_up_tasks"("clientId");

-- CreateIndex
CREATE INDEX "follow_up_tasks_communicationId_idx" ON "follow_up_tasks"("communicationId");

-- CreateIndex
CREATE INDEX "follow_up_tasks_userId_idx" ON "follow_up_tasks"("userId");

-- CreateIndex
CREATE INDEX "follow_up_tasks_status_idx" ON "follow_up_tasks"("status");

-- CreateIndex
CREATE INDEX "follow_up_tasks_priority_idx" ON "follow_up_tasks"("priority");

-- CreateIndex
CREATE INDEX "follow_up_tasks_dueDate_idx" ON "follow_up_tasks"("dueDate");

-- AddForeignKey
ALTER TABLE "follow_up_tasks" ADD CONSTRAINT "follow_up_tasks_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follow_up_tasks" ADD CONSTRAINT "follow_up_tasks_communicationId_fkey" FOREIGN KEY ("communicationId") REFERENCES "communication_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follow_up_tasks" ADD CONSTRAINT "follow_up_tasks_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
