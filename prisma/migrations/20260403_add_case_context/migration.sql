-- AlterTable: 添加案情语义晶体字段
ALTER TABLE "conversations" ADD COLUMN "caseContext" JSONB;
