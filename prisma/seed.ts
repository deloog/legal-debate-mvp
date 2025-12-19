import { PrismaClient } from '@prisma/client';
import { AnalysisType, AnalysisStatus, MessageRole } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('开始种子数据创建...');

  // 创建测试用户
  const testUser = await prisma.user.upsert({
    where: { email: 'test@example.com' },
    update: {},
    create: {
      email: 'test@example.com',
      name: '测试用户',
    },
  });

  await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: {
      email: 'admin@example.com',
      name: '管理员',
    },
  });

  console.log('用户创建完成');

  // 创建测试文档
  const testDocument = await prisma.document.create({
    data: {
      title: '示例法律合同',
      filename: 'sample_contract.pdf',
      fileSize: 1024000,
      mimeType: 'application/pdf',
      content: '这是一个示例法律合同的内容...',
      userId: testUser.id,
    },
  });

  console.log('测试文档创建完成');

  // 创建示例分析
  await prisma.analysis.create({
    data: {
      documentId: testDocument.id,
      userId: testUser.id,
      type: AnalysisType.DOCUMENT_SUMMARY,
      result: {
        summary: '这是一份标准的服务合同',
        keyPoints: ['服务范围', '付款条款', '保密协议'],
        risks: ['违约责任需要明确', '争议解决条款不完整'],
      },
      status: AnalysisStatus.COMPLETED,
    },
  });

  // 创建另一个分析进行中
  await prisma.analysis.create({
    data: {
      documentId: testDocument.id,
      userId: testUser.id,
      type: AnalysisType.LEGAL_STRUCTURE,
      result: {},
      status: AnalysisStatus.PROCESSING,
    },
  });

  console.log('分析记录创建完成');

  // 创建聊天记录示例
  await prisma.chatMessage.createMany({
    data: [
      {
        documentId: testDocument.id,
        role: MessageRole.USER,
        content: '请分析这个合同的主要风险点',
        metadata: { timestamp: new Date().toISOString() },
      },
      {
        documentId: testDocument.id,
        role: MessageRole.ASSISTANT,
        content: '根据合同内容，我发现了以下主要风险点：1. 违约责任不明确...',
        metadata: { model: 'gpt-4', tokens: 150 },
      },
    ],
  });

  console.log('聊天记录创建完成');

  // 创建AI交互记录
  await prisma.aIInteraction.create({
    data: {
      type: 'document_analysis',
      request: {
        documentId: testDocument.id,
        analysisType: 'DOCUMENT_SUMMARY',
      },
      response: { summary: '这是一份标准的服务合同' },
      model: 'gpt-4',
      tokensUsed: 250,
      duration: 1500,
      success: true,
    },
  });

  console.log('AI交互记录创建完成');

  // 创建OAuth账户示例（用于NextAuth.js等）
  await prisma.account.create({
    data: {
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
  await prisma.session.create({
    data: {
      userId: testUser.id,
      sessionToken: 'sample_session_token_' + Math.random().toString(36),
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24小时后过期
    },
  });

  console.log('会话创建完成');

  console.log('种子数据创建完成！');
  console.log('\n创建的数据摘要：');
  console.log(`- 用户: ${await prisma.user.count()} 个`);
  console.log(`- 文档: ${await prisma.document.count()} 个`);
  console.log(`- 分析: ${await prisma.analysis.count()} 个`);
  console.log(`- 聊天消息: ${await prisma.chatMessage.count()} 个`);
  console.log(`- AI交互: ${await prisma.aIInteraction.count()} 个`);
  console.log(`- OAuth账户: ${await prisma.account.count()} 个`);
  console.log(`- 会话: ${await prisma.session.count()} 个`);
}

main()
  .catch(e => {
    console.error('种子数据创建失败:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
