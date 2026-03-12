import { existsSync, unlinkSync } from 'fs';
import { PrismaClient } from '@prisma/client';
import { TEST_STATE_FILE, E2E_ADMIN_EMAIL } from './global-setup';

// E2E 测试律师账号邮箱（与 global-setup 保持一致）
const E2E_LAWYER_EMAIL = 'e2e-lawyer@test-internal.local';

async function globalTeardown(): Promise<void> {
  console.log('🧹 Starting E2E test global teardown...');

  const prisma = new PrismaClient();

  try {
    // -------------------------------------------------------------------------
    // 1. 清理 E2E 测试种子数据（仅清理由 global-setup 创建的固定测试账号）
    // -------------------------------------------------------------------------

    // 删除资格申请记录
    const lawyerUser = await prisma.user.findUnique({
      where: { email: E2E_LAWYER_EMAIL },
    });
    if (lawyerUser) {
      await prisma.lawyerQualification.deleteMany({
        where: { userId: lawyerUser.id },
      });
    }

    // 删除 E2E 测试账号（删除用户时 session 会级联删除）
    await prisma.user.deleteMany({
      where: { email: { in: [E2E_ADMIN_EMAIL, E2E_LAWYER_EMAIL] } },
    });

    console.log('✅ E2E seed data cleaned up');

    // -------------------------------------------------------------------------
    // 2. 删除测试状态文件
    // -------------------------------------------------------------------------
    if (existsSync(TEST_STATE_FILE)) {
      unlinkSync(TEST_STATE_FILE);
      console.log('✅ Test state file removed');
    }

    console.log('✅ E2E test global teardown completed');
  } finally {
    await prisma.$disconnect();
  }
}

export default globalTeardown;
