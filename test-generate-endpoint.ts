import { prisma } from './src/lib/db/prisma';

async function main() {
  // 1. 创建测试数据
  const user = await prisma.user.findUnique({
    where: { email: 'e2e-single-round@test.com' },
  });

  if (!user) {
    console.error('用户不存在');
    return;
  }

  const testCase = await prisma.case.create({
    data: {
      userId: user.id,
      title: '测试案件',
      description: '测试描述',
      type: 'CIVIL',
      status: 'ACTIVE',
    },
  });

  console.log('案件ID:', testCase.id);

  // 2. 创建辩论
  const debate = await prisma.debate.create({
    data: {
      caseId: testCase.id,
      userId: user.id,
      title: '测试辩论',
      status: 'IN_PROGRESS',
      currentRound: 1,
      debateConfig: {},
      rounds: {
        create: {
          roundNumber: 1,
          status: 'IN_PROGRESS',
        },
      },
    },
    include: {
      rounds: true,
    },
  });

  console.log('辩论ID:', debate.id);
  console.log('轮次ID:', debate.rounds[0].id);
  console.log('轮次状态:', debate.rounds[0].status);
  console.log('轮次所属辩论:', debate.rounds[0].debateId);

  // 3. 测试fetch调用
  try {
    const response = await fetch(
      `http://localhost:3000/api/v1/debates/${debate.id}/rounds/${debate.rounds[0].id}/generate`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          applicableArticles: ['mock-article-id-1', 'mock-article-id-2'],
        }),
      }
    );

    console.log('响应状态:', response.status);
    const result = await response.text();
    console.log('响应内容:', result);
  } catch (error) {
    console.error('请求失败:', error);
  }

  // 清理
  await prisma.debateRound.deleteMany({ where: { debateId: debate.id } });
  await prisma.debate.deleteMany({ where: { caseId: testCase.id } });
  await prisma.case.deleteMany({ where: { id: testCase.id } });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
