import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import { seedContractTemplates } from './seed-contracts';

const prisma = new PrismaClient();

async function main() {
  console.log('开始种子数据创建...');

  // 预先哈希测试密码（salt rounds = 12，与 src/lib/auth/password.ts 保持一致）
  const testPasswordHash = await bcrypt.hash('test123', 12);
  const adminPasswordHash = await bcrypt.hash('admin123', 12);

  // 创建测试用户
  const testUser = await prisma.user.upsert({
    where: { email: 'test@example.com' },
    update: { password: testPasswordHash, status: 'ACTIVE' },
    create: {
      email: 'test@example.com',
      name: '测试用户',
      password: testPasswordHash,
      status: 'ACTIVE',
    },
  });

  await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: { password: adminPasswordHash, status: 'ACTIVE', role: 'ADMIN' },
    create: {
      email: 'admin@example.com',
      name: '管理员',
      password: adminPasswordHash,
      status: 'ACTIVE',
      role: 'ADMIN',
    },
  });

  console.log('用户创建完成');

  // 创建测试案例
  const testCase = await prisma.case.create({
    data: {
      userId: testUser.id,
      title: '示例民事纠纷案件',
      description: '这是一个关于服务合同纠纷的示例案件',
      type: 'CIVIL',
      status: 'DRAFT',
      metadata: {
        plaintiff: '张三',
        defendant: '某科技公司',
        disputeAmount: '100000元',
        contractDate: '2024-01-15',
      },
    },
  });

  console.log('案例创建完成');

  // 创建测试文档
  const testDocument = await prisma.document.create({
    data: {
      caseId: testCase.id,
      userId: testUser.id,
      filename: 'service_contract.pdf',
      filePath: '/uploads/documents/service_contract.pdf',
      fileType: 'PDF',
      fileSize: 1024000,
      mimeType: 'application/pdf',
      extractedData: {
        parties: ['张三', '某科技公司'],
        contractAmount: '100000元',
        contractPeriod: '2024-01-01 至 2024-12-31',
      },
      analysisResult: {
        summary: '这是一份标准的服务合同',
        risks: ['违约责任不明确', '争议解决条款不完整'],
      },
      analysisStatus: 'COMPLETED',
    },
  });

  console.log('文档创建完成');

  // 创建示例辩论
  const _testDebate = await prisma.debate.create({
    data: {
      caseId: testCase.id,
      userId: testUser.id,
      title: '合同纠纷辩论',
      status: 'DRAFT',
      currentRound: 0,
      debateConfig: {
        mode: 'standard',
        aiProvider: 'zhipu',
        timeLimit: 300,
      },
    },
  });

  console.log('辩论创建完成');

  // 创建AI交互记录
  await prisma.aIInteraction.create({
    data: {
      type: 'document_analysis',
      provider: 'zhipu',
      model: 'glm-4',
      request: {
        documentId: testDocument.id,
        analysisType: 'CONTRACT_ANALYSIS',
      },
      response: {
        summary: '这是一份标准的服务合同',
        keyPoints: ['服务范围', '付款条款', '保密协议'],
        risks: ['违约责任需要明确', '争议解决条款不完整'],
      },
      tokensUsed: 250,
      duration: 1500,
      success: true,
    },
  });

  console.log('AI交互记录创建完成');

  // 创建另一个AI交互记录
  await prisma.aIInteraction.create({
    data: {
      type: 'legal_search',
      provider: 'lawstar',
      request: {
        query: '合同违约责任',
        searchType: 'keyword',
      },
      response: {
        results: [
          {
            title: '民法典第577条',
            content:
              '当事人一方不履行合同义务或者履行合同义务不符合约定的，应当承担继续履行、采取补救措施或者赔偿损失等违约责任。',
            relevance: 0.95,
          },
        ],
      },
      tokensUsed: 100,
      duration: 800,
      success: true,
    },
  });

  console.log('法律搜索记录创建完成');

  // 创建OAuth账户示例（用于NextAuth.js等）
  await prisma.account.upsert({
    where: {
      provider_providerAccountId: {
        provider: 'google',
        providerAccountId: '123456789',
      },
    },
    update: {
      access_token: 'sample_access_token',
      refresh_token: 'sample_refresh_token',
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      token_type: 'Bearer',
      scope: 'email profile',
    },
    create: {
      userId: testUser.id,
      type: 'oauth',
      provider: 'google',
      providerAccountId: '123456789',
      access_token: 'sample_access_token',
      refresh_token: 'sample_refresh_token',
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      token_type: 'Bearer',
      scope: 'email profile',
    },
  });

  console.log('OAuth账户创建完成');

  // 创建会话示例
  await prisma.session.upsert({
    where: {
      sessionToken: 'sample_session_token_' + Math.random().toString(36),
    },
    update: {},
    create: {
      userId: testUser.id,
      sessionToken: 'sample_session_token_' + Math.random().toString(36),
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24小时后过期
    },
  });

  console.log('会话创建完成');

  // 创建示例法律依据
  const _testLegalReference = await prisma.legalReference.create({
    data: {
      caseId: testCase.id,
      source: '民法典',
      content:
        '当事人一方不履行合同义务或者履行合同义务不符合约定的，应当承担继续履行、采取补救措施或者赔偿损失等违约责任。',
      lawType: '民法',
      articleNumber: '第577条',
      retrievalQuery: '合同违约责任',
      relevanceScore: 0.95,
      metadata: {
        effectiveDate: '2021-01-01',
        category: '合同法',
      },
    },
  });

  console.log('法律依据创建完成');

  // 创建合同模板
  await seedContractTemplates();

  console.log('种子数据创建完成！');
  console.log('\n创建的数据摘要：');

  const userCount = await prisma.user.count();
  const caseCount = await prisma.case.count();
  const documentCount = await prisma.document.count();
  const debateCount = await prisma.debate.count();
  const aiInteractionCount = await prisma.aIInteraction.count();
  const legalReferenceCount = await prisma.legalReference.count();
  const accountCount = await prisma.account.count();
  const sessionCount = await prisma.session.count();
  const contractTemplateCount = await prisma.contractTemplate.count();

  console.log(`- 用户: ${userCount} 个`);
  console.log(`- 案例: ${caseCount} 个`);
  console.log(`- 文档: ${documentCount} 个`);
  console.log(`- 辩论: ${debateCount} 个`);
  console.log(`- AI交互: ${aiInteractionCount} 个`);
  console.log(`- 法律依据: ${legalReferenceCount} 个`);
  console.log(`- OAuth账户: ${accountCount} 个`);
  console.log(`- 会话: ${sessionCount} 个`);
  console.log(`- 合同模板: ${contractTemplateCount} 个`);
}

main()
  .catch(e => {
    console.error('种子数据创建失败:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
