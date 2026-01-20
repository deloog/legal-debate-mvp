/**
 * 会员等级测试辅助文件
 * 提供测试共享的设置和工具函数
 */

import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();

/**
 * 运行seed脚本初始化会员等级配置
 * 幂等操作：先检查数据库中是否已有会员等级数据
 */
export async function runSeedScript(): Promise<void> {
  try {
    // 先检查数据库中是否已有会员等级
    const existingTiers = await prisma.membershipTier.count();

    // 如果已有数据，直接返回，不执行seed
    if (existingTiers > 0) {
      console.log('会员等级数据已存在，跳过seed');
      return;
    }

    // 没有数据时才执行seed
    console.log('会员等级数据不存在，开始执行seed');
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);

    await execAsync('npx tsx prisma/seed-membership.ts', {
      cwd: process.cwd(),
    });
    console.log('会员等级seed执行完成');
  } catch (error) {
    console.error('运行seed脚本失败:', error);
    // 如果错误是唯一约束冲突，说明数据已存在，不算失败
    if (
      error instanceof Error &&
      error.message.includes('Unique constraint failed')
    ) {
      console.log('唯一约束冲突，说明数据已存在，忽略此错误');
      return;
    }
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
