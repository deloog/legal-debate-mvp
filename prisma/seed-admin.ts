/**
 * 管理员账户Seed脚本
 *
 * 用途：为系统创建默认管理员账户，用于E2E测试和管理后台
 *
 * 使用方法：
 * 1. 确保.env文件中DATABASE_URL配置正确
 * 2. 运行: npx tsx prisma/seed-admin.ts
 * 3. 或在package.json中添加脚本: "seed-admin": "tsx prisma/seed-admin.ts"
 *
 * 注意事项：
 * - 此脚本会创建/更新管理员账户，不会删除现有数据
 * - 密码使用bcrypt加密，生产环境请修改默认密码
 * - 管理员角色：ADMIN（可访问企业审核等管理功能）
 */

import { PrismaClient, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

/**
 * 管理员配置
 * 生产环境请修改这些配置
 */
const ADMIN_CONFIG = {
  email: 'admin@example.com',
  name: '系统管理员',
  password: 'Admin@123', // 生产环境请使用强密码
  role: UserRole.SUPER_ADMIN,
};

/**
 * 密码加密
 * @param password 明文密码
 * @returns 加密后的密码
 */
async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

/**
 * 创建或更新管理员账户
 */
async function createOrUpdateAdmin() {
  console.log('🔧 开始创建/更新管理员账户...');

  // 加密密码
  const hashedPassword = await hashPassword(ADMIN_CONFIG.password);

  // 创建或更新管理员用户
  const admin = await prisma.user.upsert({
    where: { email: ADMIN_CONFIG.email },
    update: {
      name: ADMIN_CONFIG.name,
      password: hashedPassword,
      role: ADMIN_CONFIG.role,
      status: 'ACTIVE',
    },
    create: {
      email: ADMIN_CONFIG.email,
      name: ADMIN_CONFIG.name,
      password: hashedPassword,
      role: ADMIN_CONFIG.role,
      status: 'ACTIVE',
    },
  });

  console.log(`✅ 管理员账户创建成功：${admin.email}`);
  console.log(`   姓名：${admin.name}`);
  console.log(`   角色：${admin.role}`);
  console.log(`   状态：${admin.status}`);
  console.log('\n⚠️  生产环境请立即修改默认密码！');

  return admin;
}

/**
 * 创建测试企业账户（用于企业审核测试）
 */
async function createTestEnterpriseAccount() {
  console.log('\n🔧 创建测试企业账户（用于企业审核测试）...');

  // 创建企业用户
  const enterpriseUser = await prisma.user.upsert({
    where: { email: 'enterprise@example.com' },
    update: {},
    create: {
      email: 'enterprise@example.com',
      name: '测试企业用户',
      password: await hashPassword('Enterprise@123'),
      role: UserRole.ENTERPRISE,
      status: 'ACTIVE',
    },
  });

  // 创建企业账户
  const enterpriseAccount = await prisma.enterpriseAccount.upsert({
    where: { userId: enterpriseUser.id },
    update: {
      status: 'PENDING',
    },
    create: {
      userId: enterpriseUser.id,
      enterpriseName: '测试企业有限公司',
      creditCode: '91110000123456789X',
      legalPerson: '张三',
      industryType: '科技服务',
      status: 'PENDING',
    },
  });

  console.log(`✅ 测试企业账户创建成功：${enterpriseAccount.enterpriseName}`);
  console.log(`   状态：${enterpriseAccount.status}`);
  console.log(`   用户邮箱：${enterpriseUser.email}`);

  return enterpriseAccount;
}

/**
 * 输出摘要信息
 */
async function printSummary() {
  console.log('\n📊 Seed执行完成摘要：');

  const adminCount = await prisma.user.count({
    where: { role: UserRole.ADMIN },
  });

  const enterpriseCount = await prisma.enterpriseAccount.count({
    where: { status: 'PENDING' },
  });

  console.log(`- 管理员账户：${adminCount} 个`);
  console.log(`- 待审核企业：${enterpriseCount} 个`);
  console.log('\n🎉 管理员账户Seed执行完成！');
}

/**
 * 主函数
 */
async function main() {
  try {
    await createOrUpdateAdmin();
    await createTestEnterpriseAccount();
    await printSummary();
  } catch (error) {
    console.error('❌ Seed执行失败：', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// 执行主函数
main();
