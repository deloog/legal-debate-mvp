/**
 * 重置指定邮箱用户密码
 *
 * 用法：
 *   npx tsx scripts/reset-user-password.ts deloog@qq.com TestPass123
 *
 * 说明：
 * - 会直接更新数据库中的 password 字段（bcryptjs 哈希）
 * - 若用户不存在，会返回非 0 退出码
 * - 若用户被删除，也会返回非 0 退出码
 */

import { PrismaClient } from '@prisma/client';
import { hashPassword, validatePassword } from '@/lib/auth/password';

const prisma = new PrismaClient();

async function main() {
  const [, , email, newPassword] = process.argv;

  if (!email || !newPassword) {
    console.error(
      '用法: npx tsx scripts/reset-user-password.ts <email> <newPassword>'
    );
    process.exit(1);
  }

  const validation = validatePassword(newPassword);
  if (!validation.valid) {
    console.error(`密码不符合要求: ${validation.errors.join('；')}`);
    process.exit(1);
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      status: true,
      deletedAt: true,
    },
  });

  if (!user) {
    console.error(`未找到用户: ${email}`);
    process.exit(1);
  }

  if (user.deletedAt) {
    console.error(`用户已被删除，不能重置密码: ${email}`);
    process.exit(1);
  }

  const hashedPassword = await hashPassword(newPassword);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      password: hashedPassword,
      status: 'ACTIVE',
      passwordResetToken: null,
      passwordResetExpires: null,
      updatedAt: new Date(),
    },
  });

  console.log(`已重置密码: ${email}`);
  console.log(`当前状态: ${user.status} -> ACTIVE`);
}

main()
  .catch(error => {
    console.error('重置密码失败:');
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
