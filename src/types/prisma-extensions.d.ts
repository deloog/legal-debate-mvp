/**
 * Prisma 类型扩展
 * 用于添加 report 模型到 Prisma Client 类型定义
 */

import type { Prisma } from '@prisma/client';

/**
 * Report 模型类型定义
 */
export interface Report {
  id: string;
  type: string;
  status: string;
  periodStart: Date;
  periodEnd: Date;
  filePath: string | null;
  fileSize: number | null;
  format: string;
  generatedBy: string;
  generatedAt: Date | null;
  downloadCount: number;
  content: Prisma.InputJsonValue;
  metadata: {
    generatedAt: string;
    generatedBy: string;
    generationTime: number;
    dataPoints: number;
    periodStart: string;
    periodEnd: string;
  };
  error: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Prisma Client 类型扩展
 */
declare module '.prisma/client' {
  interface PrismaClient {
    report: {
      create: (args: { data: Partial<Report> }) => Promise<Report>;
      findMany: (args?: unknown) => Promise<Report[]>;
      findUnique: (args: { where: { id: string } }) => Promise<Report | null>;
      findFirst: (args?: unknown) => Promise<Report | null>;
      update: (args: {
        where: { id: string };
        data: Partial<Report>;
      }) => Promise<Report>;
      delete: (args: { where: { id: string } }) => Promise<Report>;
      count: (args?: unknown) => Promise<number>;
    };
  }
}
