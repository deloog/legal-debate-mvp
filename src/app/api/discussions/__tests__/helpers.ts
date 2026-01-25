/**
 * 讨论API测试辅助函数
 */

import { prisma } from '@/lib/db/prisma';

/**
 * 创建测试用户
 */
export async function createTestUser(
  email: string,
  role: string = 'USER'
): Promise<{ id: string }> {
  const user = await prisma.user.create({
    data: {
      email,
      username: email.split('@')[0],
      name: email.split('@')[0],
      role: role as any,
      password: 'hashed_password',
    },
    select: {
      id: true,
    },
  });

  return user;
}

/**
 * 创建测试案件
 */
export async function createTestCase(
  userId: string,
  title: string = '测试案件'
): Promise<{ id: string; userId: string }> {
  const testCase = await prisma.case.create({
    data: {
      userId,
      title,
      description: '测试案件描述',
      type: 'CIVIL',
      status: 'ACTIVE',
    },
    select: {
      id: true,
      userId: true,
    },
  });

  return testCase;
}

/**
 * 创建测试讨论
 */
export async function createTestDiscussion(
  caseId: string,
  userId: string,
  content: string = '测试讨论内容'
): Promise<{ id: string; caseId: string; userId: string }> {
  const discussion = await prisma.caseDiscussion.create({
    data: {
      caseId,
      userId,
      content,
    },
    select: {
      id: true,
      caseId: true,
      userId: true,
    },
  });

  return discussion;
}

/**
 * 清理测试数据
 */
export async function cleanupTestData(userId: string): Promise<void> {
  // 先删除该用户创建的讨论
  await prisma.caseDiscussion
    .deleteMany({
      where: {
        userId,
      },
    })
    .catch(() => {});

  // 删除案件团队成员
  await prisma.caseTeamMember
    .deleteMany({
      where: {
        userId,
      },
    })
    .catch(() => {});

  // 删除案件
  await prisma.case
    .deleteMany({
      where: {
        userId,
      },
    })
    .catch(() => {});

  // 删除用户
  await prisma.user
    .delete({
      where: {
        id: userId,
      },
    })
    .catch(() => {});
}

/**
 * 创建多个测试用户
 */
export async function createMultipleTestUsers(
  count: number
): Promise<Array<{ id: string }>> {
  const users: Array<{ id: string }> = [];

  for (let i = 0; i < count; i++) {
    const email = `test_user_${Date.now()}_${i}@example.com`;
    const user = await createTestUser(email);
    users.push(user);
  }

  return users;
}

/**
 * 创建案件团队成员
 */
export async function addCaseTeamMember(
  caseId: string,
  userId: string,
  role: string = 'ASSISTANT',
  permissions?: string[]
): Promise<{ id: string }> {
  const member = await prisma.caseTeamMember.create({
    data: {
      caseId,
      userId,
      role: role as any,
      permissions: {
        customPermissions: permissions || [],
      },
    },
    select: {
      id: true,
    },
  });

  return member;
}
