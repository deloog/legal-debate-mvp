import { PrismaClient } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import {
  UserRole,
  CaseType,
  CaseStatus,
  AnalysisStatus,
  DebateStatus,
  RoundStatus,
  ArgumentSide,
  ArgumentType,
  LegalReferenceStatus,
} from '@prisma/client';

// 环境变量检查
if ((process.env.NODE_ENV as string) !== 'demo') {
  console.error('❌ 错误：演示种子脚本只能在demo模式下运行');
  console.error('   请使用: NODE_ENV=demo npm run seed:demo');
  process.exit(1);
}

const prisma = new PrismaClient();

// 案件模板定义
const CASE_TEMPLATES = {
  required: [
    {
      type: CaseType.INTELLECTUAL,
      cases: [
        {
          title: '某科技公司著作权侵权纠纷案',
          description: '关于软件源代码著作权侵权及不正当竞争的争议案件',
          plaintiffName: '创新科技有限公司',
          defendantName: '某竞争对手公司',
          cause: '著作权侵权纠纷',
          amount: new Decimal('500000'),
          court: '北京市海淀区人民法院',
        },
        {
          title: '某品牌商标权侵权纠纷案',
          description: '关于知名商标被恶意仿冒的商标权争议案件',
          plaintiffName: '某知名品牌公司',
          defendantName: '某制假企业',
          cause: '商标权侵权纠纷',
          amount: new Decimal('200000'),
          court: '上海市浦东新区人民法院',
        },
        {
          title: '网络平台不正当竞争纠纷案',
          description: '关于网络爬虫技术和数据抓取的不正当竞争案件',
          plaintiffName: '某大型互联网公司',
          defendantName: '某数据分析公司',
          cause: '不正当竞争纠纷',
          amount: new Decimal('800000'),
          court: '广州市天河区人民法院',
        },
      ],
    },
    {
      type: CaseType.COMMERCIAL,
      cases: [
        {
          title: '设备买卖合同违约纠纷案',
          description: '关于大型设备买卖合同交付及质量问题的争议',
          plaintiffName: '某制造企业',
          defendantName: '某设备供应商',
          cause: '买卖合同纠纷',
          amount: new Decimal('1200000'),
          court: '深圳市南山区人民法院',
        },
        {
          title: '商业店铺租赁合同纠纷案',
          description: '关于商场租赁合同租金调整及违约责任的争议',
          plaintiffName: '某连锁零售企业',
          defendantName: '某物业管理公司',
          cause: '租赁合同纠纷',
          amount: new Decimal('300000'),
          court: '成都市锦江区人民法院',
        },
        {
          title: '软件开发服务合同纠纷案',
          description: '关于定制软件开发服务质量及验收标准的争议',
          plaintiffName: '某金融机构',
          defendantName: '某软件开发商',
          cause: '服务合同纠纷',
          amount: new Decimal('450000'),
          court: '杭州市西湖区人民法院',
        },
      ],
    },
    {
      type: CaseType.CIVIL,
      cases: [
        {
          title: '邻里噪音污染侵权纠纷案',
          description: '关于长期噪音污染影响正常生活的侵权责任争议',
          plaintiffName: '张某',
          defendantName: '李某',
          cause: '环境污染侵权纠纷',
          amount: new Decimal('50000'),
          court: '北京市朝阳区人民法院',
        },
        {
          title: '离婚财产分割纠纷案',
          description: '关于夫妻共同财产分割及子女抚养权的争议',
          plaintiffName: '王某',
          defendantName: '赵某',
          cause: '离婚纠纷',
          amount: new Decimal('2000000'),
          court: '上海市静安区人民法院',
        },
      ],
    },
    {
      type: CaseType.LABOR,
      cases: [
        {
          title: '加班工资支付纠纷案',
          description: '关于长期加班工资计算及支付的劳动争议案件',
          plaintiffName: '陈某',
          defendantName: '某互联网公司',
          cause: '劳动报酬纠纷',
          amount: new Decimal('150000'),
          court: '北京市海淀区人民法院',
        },
        {
          title: '工伤赔偿纠纷案',
          description: '关于工伤认定及赔偿标准的争议案件',
          plaintiffName: '刘某',
          defendantName: '某建筑公司',
          cause: '工伤赔偿纠纷',
          amount: new Decimal('300000'),
          court: '天津市滨海新区人民法院',
        },
      ],
    },
    {
      type: CaseType.CRIMINAL,
      cases: [
        {
          title: '商业秘密盗窃案',
          description: '关于员工离职后带走商业秘密的刑事案件',
          plaintiffName: '某检察院',
          defendantName: '张某',
          cause: '侵犯商业秘密罪',
          amount: new Decimal('1000000'),
          court: '某区人民法院',
        },
        {
          title: '合同诈骗案',
          description: '关于虚构项目骗取投资的合同诈骗案件',
          plaintiffName: '某检察院',
          defendantName: '某投资公司',
          cause: '合同诈骗罪',
          amount: new Decimal('5000000'),
          court: '某区人民法院',
        },
      ],
    },
    {
      type: CaseType.ADMINISTRATIVE,
      cases: [
        {
          title: '行政处罚撤销纠纷案',
          description: '关于行政处罚决定合法性及适当性的争议',
          plaintiffName: '某企业',
          defendantName: '某行政机关',
          cause: '行政处罚纠纷',
          amount: new Decimal('100000'),
          court: '某区人民法院',
        },
        {
          title: '行政许可申请驳回纠纷案',
          description: '关于行政许可申请被驳回的合法性争议',
          plaintiffName: '某申请人',
          defendantName: '某行政许可机关',
          cause: '行政许可纠纷',
          amount: new Decimal('50000'),
          court: '某区人民法院',
        },
      ],
    },
  ],
  optional: [
    {
      type: CaseType.OTHER,
      cases: [
        {
          title: '网络服务合同纠纷案',
          description: '关于网络服务平台服务条款及责任的争议',
          plaintiffName: '某用户',
          defendantName: '某网络平台',
          cause: '网络服务纠纷',
          amount: new Decimal('80000'),
          court: '某区人民法院',
        },
      ],
    },
  ],
};

// 法条模板
const LEGAL_REFERENCES = [
  {
    lawType: '民法',
    source: '中华人民共和国民法典',
    articles: [
      {
        articleNumber: '第一千一百六十五条',
        content: '行为人因过错侵害他人民事权益造成损害的，应当承担侵权责任。',
      },
      {
        articleNumber: '第五百七十七条',
        content:
          '当事人一方不履行合同义务或者履行合同义务不符合约定的，应当承担继续履行、采取补救措施或者赔偿损失等违约责任。',
      },
    ],
  },
  {
    lawType: '著作权法',
    source: '中华人民共和国著作权法',
    articles: [
      {
        articleNumber: '第十条',
        content:
          '著作权包括下列人身权和财产权：（一）发表权；（二）署名权；（三）修改权；（四）保护作品完整权；（五）复制权；（六）发行权；（七）出租权；（八）展览权；（九）表演权；（十）放映权；（十一）广播权；（十二）信息网络传播权；（十三）摄制权；（十四）改编权；（十五）翻译权；（十六）汇编权。',
      },
      {
        articleNumber: '第四十七条',
        content:
          '有下列侵权行为的，应当根据情况，承担停止侵害、消除影响、赔礼道歉、赔偿损失等民事责任：（一）未经著作权人许可，复制、发行、表演、放映、广播、汇编、通过信息网络向公众传播其作品的。',
      },
    ],
  },
  {
    lawType: '商标法',
    source: '中华人民共和国商标法',
    articles: [
      {
        articleNumber: '第五十七条',
        content:
          '有下列行为之一的，均属侵犯注册商标专用权：（一）未经商标注册人的许可，在同一种商品上使用与其注册商标相同的商标的；（二）未经商标注册人的许可，在同一种商品上使用与其注册商标近似的商标，或者在类似商品上使用与其注册商标相同或者近似的商标，容易导致混淆的。',
      },
    ],
  },
  {
    lawType: '反不正当竞争法',
    source: '中华人民共和国反不正当竞争法',
    articles: [
      {
        articleNumber: '第二条',
        content:
          '经营者在生产经营活动中，应当遵循自愿、平等、公平、诚信的原则，遵守法律和商业道德。',
      },
      {
        articleNumber: '第十二条',
        content:
          '经营者利用网络从事生产经营活动，应当遵守本法的各项规定。经营者不得利用技术手段，通过影响用户选择或者其他方式，实施妨碍、破坏其他经营者合法提供的网络产品或者服务正常运行的行为。',
      },
    ],
  },
  {
    lawType: '劳动法',
    source: '中华人民共和国劳动法',
    articles: [
      {
        articleNumber: '第四十四条',
        content:
          '有下列情形之一的，用人单位应当按照下列标准支付高于劳动者正常工作时间工资的工资报酬：（一）安排劳动者延长工作时间的，支付不低于工资的百分之一百五十的工资报酬；（二）休息日安排劳动者工作又不能安排补休的，支付不低于工资的百分之二百的工资报酬；（三）法定休假日安排劳动者工作的，支付不低于工资的百分之三百的工资报酬。',
      },
    ],
  },
];

async function main() {
  console.log('🚀 开始创建演示种子数据...');

  const startTime = Date.now();
  const stats = {
    users: 0,
    cases: 0,
    documents: 0,
    debates: 0,
    rounds: 0,
    arguments: 0,
    legalReferences: 0,
    aiInteractions: 0,
  };

  try {
    // 创建演示用户
    const demoUser = await prisma.user.upsert({
      where: { email: 'demo.lawyer@example.com' },
      update: {},
      create: {
        email: 'demo.lawyer@example.com',
        name: '演示律师',
        username: 'demo.lawyer',
        role: UserRole.LAWYER,
        status: 'ACTIVE' as any,
        organizationId: 'demo-law-firm',
        phone: '13800138000',
        address: '北京市朝阳区某某律师事务所',
        bio: '专业处理知识产权和商业纠纷案件',
      },
    });
    stats.users++;

    console.log('✅ 演示用户创建完成');

    // 创建所有案件
    const allCases = [];
    for (const category of [
      ...CASE_TEMPLATES.required,
      ...CASE_TEMPLATES.optional,
    ]) {
      for (const caseTemplate of category.cases) {
        const caseData = await prisma.case.create({
          data: {
            userId: demoUser.id,
            title: caseTemplate.title,
            description: caseTemplate.description,
            type: category.type,
            status: CaseStatus.ACTIVE,
            plaintiffName: caseTemplate.plaintiffName,
            defendantName: caseTemplate.defendantName,
            cause: caseTemplate.cause,
            amount: caseTemplate.amount,
            court: caseTemplate.court,
            metadata: {
              createdFor: 'demo',
              complexity: 'medium',
              estimatedDuration: '6-12个月',
            },
          },
        });
        allCases.push(caseData);
        stats.cases++;

        console.log(`📄 案件创建: ${caseTemplate.title}`);
      }
    }

    // 为每个案件创建完整的数据
    for (const caseData of allCases) {
      // 创建文档
      const __document = await prisma.document.create({
        data: {
          caseId: caseData.id,
          userId: demoUser.id,
          filename: `${caseData.title.replace(/[^\w\u4e00-\u9fa5]/g, '_')}.pdf`,
          filePath: `/uploads/demo/case_${caseData.id}/document.pdf`,
          fileType: 'PDF',
          fileSize: 2048000,
          mimeType: 'application/pdf',
          extractedData: {
            pages: Math.floor(Math.random() * 50) + 10,
            title: caseData.title,
            summary: caseData.description,
            keyPoints: ['事实清楚', '证据充分', '法律适用明确'],
          },
          analysisStatus: AnalysisStatus.COMPLETED,
          analysisResult: {
            summary: '文档分析完成，未发现明显问题',
            risks: ['诉讼时效风险', '证据完整性风险'],
            confidence: 0.85,
          },
        },
      });
      stats.documents++;

      // 创建辩论
      const debate = await prisma.debate.create({
        data: {
          caseId: caseData.id,
          userId: demoUser.id,
          title: `${caseData.title} - 法律辩论`,
          status: DebateStatus.IN_PROGRESS,
          currentRound: 1,
          debateConfig: {
            mode: 'STANDARD',
            timeLimit: 300,
            aiProviders: ['zhipu', 'deepseek'],
            maxRounds: 3,
          },
        },
      });
      stats.debates++;

      // 创建辩论轮次和论点
      for (let roundNum = 1; roundNum <= 2; roundNum++) {
        const round = await prisma.debateRound.create({
          data: {
            debateId: debate.id,
            roundNumber: roundNum,
            status:
              roundNum === 1 ? RoundStatus.COMPLETED : RoundStatus.IN_PROGRESS,
            startedAt: new Date(
              Date.now() - (2 - roundNum) * 24 * 60 * 60 * 1000
            ),
            completedAt:
              roundNum === 1
                ? new Date(Date.now() - 24 * 60 * 60 * 1000)
                : null,
          },
        });
        stats.rounds++;

        // 为每轮创建论点
        const argumentData = [
          {
            side: ArgumentSide.PLAINTIFF,
            content: `根据相关法律规定，原告的诉讼请求具有充分的法律依据和事实基础。`,
          },
          {
            side: ArgumentSide.DEFENDANT,
            content: `被告认为原告的诉讼请求缺乏事实依据，请求法院依法驳回原告的诉讼请求。`,
          },
          {
            side: ArgumentSide.PLAINTIFF,
            content: `原告提供的证据充分证明了被告的违约行为，应当承担相应的法律责任。`,
          },
        ];

        for (const arg of argumentData) {
          const argument = await prisma.argument.create({
            data: {
              roundId: round.id,
              side: arg.side,
              content: arg.content,
              type: ArgumentType.MAIN_POINT,
              aiProvider: roundNum % 2 === 0 ? 'deepseek' : 'zhipu',
              generationTime: Math.floor(Math.random() * 2000) + 1000,
              confidence: Math.random() * 0.3 + 0.7,
            },
          });
          stats.arguments++;

          // 创建AI交互记录
          await prisma.aIInteraction.create({
            data: {
              type: 'argument_generation',
              provider: argument.aiProvider!,
              model:
                argument.aiProvider === 'deepseek'
                  ? 'deepseek-chat'
                  : 'glm-4-flash',
              request: {
                prompt: `为${arg.side === ArgumentSide.PLAINTIFF ? '原告' : '被告'}生成辩论论点`,
                caseId: caseData.id,
                roundNumber: roundNum,
              },
              response: {
                content: arg.content,
                tokens: Math.floor(Math.random() * 200) + 100,
              },
              tokensUsed: Math.floor(Math.random() * 200) + 100,
              duration: argument.generationTime,
              cost: Number((Math.random() * 0.01 + 0.001).toFixed(4)),
              success: true,
            },
          });
          stats.aiInteractions++;
        }
      }

      // 为案件创建法条引用
      const selectedReferences = LEGAL_REFERENCES.slice(0, 5);
      for (const ref of selectedReferences) {
        const article =
          ref.articles[Math.floor(Math.random() * ref.articles.length)];

        await prisma.legalReference.create({
          data: {
            caseId: caseData.id,
            source: ref.source,
            content: article.content,
            lawType: ref.lawType,
            articleNumber: article.articleNumber,
            retrievalQuery: `${caseData.cause}相关法律规定`,
            relevanceScore: Math.random() * 0.3 + 0.7,
            applicabilityScore: Math.random() * 0.3 + 0.7,
            applicabilityReason: `该法条适用于${caseData.cause}案件的法律适用`,
            status: LegalReferenceStatus.VALID,
            category: '核心法条',
            tags: [caseData.cause, ref.lawType].filter(
              (t): t is string => t !== null
            ),
            hitCount: Math.floor(Math.random() * 10) + 1,
            lastAccessed: new Date(),
          },
        });
        stats.legalReferences++;
      }
    }

    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    console.log('\n🎉 演示种子数据创建完成！');
    console.log('⏱️ 用时:', `${duration}秒`);
    console.log('📊 创建统计:');
    console.log(`   👤 用户: ${stats.users} 个`);
    console.log(`   📁 案件: ${stats.cases} 个`);
    console.log(`   📄 文档: ${stats.documents} 个`);
    console.log(`   🗣️ 辩论: ${stats.debates} 个`);
    console.log(`   🔄 轮次: ${stats.rounds} 个`);
    console.log(`   💬 论点: ${stats.arguments} 个`);
    console.log(`   ⚖️ 法条: ${stats.legalReferences} 个`);
    console.log(`   🤖 AI交互: ${stats.aiInteractions} 个`);
    console.log('\n✨ 演示数据已准备就绪，可以开始系统演示！');
  } catch (error) {
    console.error('❌ 创建演示数据时发生错误:', error);
    throw error;
  }
}

main()
  .catch(e => {
    console.error('❌ 演示种子数据创建失败:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
