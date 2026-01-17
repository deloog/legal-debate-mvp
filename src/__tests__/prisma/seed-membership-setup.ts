/**
 * 会员等级测试辅助文件
 * 提供测试共享的设置和工具函数
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { PrismaClient } from '@prisma/client';

const execAsync = promisify(exec);
export const prisma = new PrismaClient();

/**
 * 运行seed脚本初始化会员等级配置
 */
export async function runSeedScript(): Promise<void> {
  try {
    await execAsync('npx tsx prisma/seed-membership.ts', {
      cwd: process.cwd(),
    });
  } catch (error) {
    console.error('运行seed脚本失败:', error);
    throw error;
  }
}

/**
 * 清理测试数据
 */
export async function cleanupTestData(): Promise<void> {
  // 清理等级限制
  await prisma.tierLimit.deleteMany();

  // 清理会员等级
  await prisma.membershipTier.deleteMany();
}
