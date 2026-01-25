-- CreateEnum
CREATE TYPE "DocumentTemplateType" AS ENUM ('INDICTMENT', 'DEFENSE', 'APPEARANCE', 'APPEAL', 'OTHER');

-- CreateEnum
CREATE TYPE "DocumentTemplateCategory" AS ENUM ('CIVIL', 'CRIMINAL', 'ADMINISTRATIVE', 'COMMERCIAL', 'LABOR', 'INTELLECTUAL', 'OTHER');

-- CreateEnum
CREATE TYPE "TemplateStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "document_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "DocumentTemplateType" NOT NULL DEFAULT 'INDICTMENT',
    "category" "DocumentTemplateCategory",
    "content" TEXT NOT NULL,
    "variables" JSONB NOT NULL,
    "version" TEXT NOT NULL DEFAULT '1.0',
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" TEXT NOT NULL,
    "status" "TemplateStatus" NOT NULL DEFAULT 'DRAFT',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "document_templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "document_templates_type_idx" ON "document_templates"("type");

-- CreateIndex
CREATE INDEX "document_templates_category_idx" ON "document_templates"("category");

-- CreateIndex
CREATE INDEX "document_templates_createdBy_idx" ON "document_templates"("createdBy");

-- CreateIndex
CREATE INDEX "document_templates_status_idx" ON "document_templates"("status");

-- CreateIndex
CREATE INDEX "document_templates_isPublic_idx" ON "document_templates"("isPublic");

-- CreateIndex
CREATE INDEX "document_templates_deletedAt_idx" ON "document_templates"("deletedAt");

-- CreateIndex
CREATE INDEX "document_templates_type_category_status_idx" ON "document_templates"("type", "category", "status");

-- AddForeignKey
ALTER TABLE "document_templates" ADD CONSTRAINT "document_templates_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
