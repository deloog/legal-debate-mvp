-- Migration: add_argument_metadata
-- Adds metadata column to Argument table for storing verification data

-- Add metadata column to arguments table
ALTER TABLE "arguments" ADD COLUMN IF NOT EXISTS "metadata" JSONB;

-- Add comment for documentation
COMMENT ON COLUMN "arguments"."metadata" IS '扩展元数据，用于存储验证数据等动态信息';
