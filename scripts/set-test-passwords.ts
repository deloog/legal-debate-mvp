import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('开始设置测试用户密码...');

  const SALT_ROUNDS = 12;

  // 为测试用户设置密码: test123
  const testPasswordHash = await bcrypt.hash('test123', SALT_ROUNDS);
  await prisma.user.update({
    where: { email: 'test@example.com' },
    data: {
      password: testPasswordHash,
      status: 'ACTIVE',
    },
  });
  console.log('✓ 测试用户密码已设置: test@example.com / test123');

  // 为管理员设置密码: admin123
  const adminPasswordHash = await bcrypt.hash('admin123', SALT_ROUNDS);
  await prisma.user.update({
    where: { email: 'admin@example.com' },
    data: {
      password: adminPasswordHash,
      status: 'ACTIVE',
      role: 'ADMIN',
    },
  });
  console.log('✓ 管理员密码已设置: admin@example.com / admin123');

  console.log('\n密码设置完成！');
  console.log('\n登录信息：');
  console.log('━'.repeat(50));
  console.log('测试用户:');
  console.log('  邮箱: test@example.com');
  console.log('  密码: test123');
  console.log('━'.repeat(50));
  console.log('管理员:');
  console.log('  邮箱: admin@example.com');
  console.log('  密码: admin123');
  console.log('━'.repeat(50));
}

main()
  .catch(e => {
    console.error('设置密码失败:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
