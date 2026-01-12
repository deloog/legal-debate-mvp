import { prisma } from './src/lib/db/prisma';

async function main() {
  // 创建测试数据
  const testCase = await prisma.case.create({
    data: {
      userId: 'test-debug-user',
      title: '调试测试案件',
      description: '用于调试API问题',
      type: 'CIVIL',
      status: 'ACTIVE',
    },
  });

  console.log('创建案件:', testCase.id);

  // 创建辩论
  const debate = await prisma.debate.create({
    data: {
      caseId: testCase.id,
      userId: testCase.userId,
      title: '调试测试辩论',
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

  console.log('创建辩论:', debate.id);
  console.log('创建轮次:', debate.rounds[0].id);
  console.log('轮次状态:', debate.rounds[0].status);
  console.log('轮次所属debate:', debate.rounds[0].debateId);

  // 清理
  await prisma.debate.deleteMany({ where: { caseId: testCase.id } });
  await prisma.case.deleteMany({ where: { userId: 'test-debug-user' } });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
