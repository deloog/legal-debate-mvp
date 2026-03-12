import { PrismaClient, Prisma } from '@prisma/client';
import {
  CaseTypeCategory,
  type MaterialList,
} from '../src/types/case-type-config';

const prisma = new PrismaClient();

/**
 * 民事案件类型配置数据
 */
const civilCaseTypes: Array<{
  code: string;
  name: string;
  category: CaseTypeCategory;
  baseFee: number;
  riskFeeRate?: number;
  hourlyRate?: number;
  requiredDocs: MaterialList;
  optionalDocs?: MaterialList;
  avgDuration?: number;
  complexityLevel?: number;
}> = [
  {
    code: 'LABOR_DISPUTE',
    name: '劳动争议',
    category: CaseTypeCategory.CIVIL,
    baseFee: 5000,
    riskFeeRate: 0.3,
    hourlyRate: 500,
    requiredDocs: {
      materials: [
        {
          name: '劳动合同',
          description: '原件或复印件',
          copies: 1,
          notes: '需盖公司公章',
        },
        { name: '工资流水', description: '最近12个月', copies: 1 },
        { name: '社保缴纳记录', description: '证明劳动关系', copies: 1 },
        { name: '解除/终止劳动关系通知书', description: '如有', copies: 1 },
      ],
      requirements: ['劳动争议需先经过劳动仲裁程序', '仲裁时效为一年'],
    },
    optionalDocs: {
      materials: [
        { name: '考勤记录', description: '如需证明加班', copies: 1 },
        { name: '加班证明', description: '相关证据', copies: 1 },
      ],
    },
    avgDuration: 90,
    complexityLevel: 2,
  },
  {
    code: 'CONTRACT_DISPUTE',
    name: '合同纠纷',
    category: CaseTypeCategory.CIVIL,
    baseFee: 10000,
    riskFeeRate: 0.25,
    hourlyRate: 800,
    requiredDocs: {
      materials: [
        { name: '合同原件', description: '争议相关合同', copies: 1 },
        { name: '合同履行证明', description: '付款凭证、交付单等', copies: 1 },
        { name: '违约证据', description: '对方违约的证明材料', copies: 1 },
      ],
      requirements: ['合同纠纷诉讼时效为三年', '需明确合同金额和违约金条款'],
    },
    optionalDocs: {
      materials: [
        { name: '沟通记录', description: '微信、邮件等', copies: 1 },
        { name: '公证文书', description: '重要证据建议公证', copies: 1 },
      ],
    },
    avgDuration: 120,
    complexityLevel: 3,
  },
  {
    code: 'PROPERTY_DISPUTE',
    name: '物权纠纷',
    category: CaseTypeCategory.CIVIL,
    baseFee: 8000,
    riskFeeRate: 0.2,
    hourlyRate: 600,
    requiredDocs: {
      materials: [
        { name: '产权证明', description: '房产证、不动产登记', copies: 1 },
        { name: '身份证明', description: '身份证、户口本', copies: 1 },
        { name: '争议权属证明', description: '相关权属文件', copies: 1 },
      ],
      requirements: ['需明确争议不动产的具体位置'],
    },
    avgDuration: 150,
    complexityLevel: 3,
  },
];

/**
 * 刑事案件类型配置数据
 */
const criminalCaseTypes: Array<{
  code: string;
  name: string;
  category: CaseTypeCategory;
  baseFee: number;
  riskFeeRate?: number;
  hourlyRate?: number;
  requiredDocs: MaterialList;
  optionalDocs?: MaterialList;
  avgDuration?: number;
  complexityLevel?: number;
}> = [
  {
    code: 'CRIMINAL_DEFENSE',
    name: '刑事辩护',
    category: CaseTypeCategory.CRIMINAL,
    baseFee: 20000,
    hourlyRate: 1000,
    requiredDocs: {
      materials: [
        { name: '拘留/逮捕通知书', description: '法律文书', copies: 1 },
        { name: '家属身份证', description: '原件及复印件', copies: 2 },
        { name: '亲属关系证明', description: '户口本或出生证明', copies: 1 },
      ],
      requirements: ['刑事案件家属可委托律师', '侦查阶段可会见嫌疑人'],
    },
    avgDuration: 180,
    complexityLevel: 4,
  },
  {
    code: 'CRIMINAL_APPEAL',
    name: '刑事上诉',
    category: CaseTypeCategory.CRIMINAL,
    baseFee: 30000,
    hourlyRate: 1200,
    requiredDocs: {
      materials: [
        { name: '判决书', description: '一审判决书', copies: 1 },
        { name: '上诉状', description: '草稿或正本', copies: 2 },
        { name: '证据材料', description: '新证据或补充材料', copies: 1 },
      ],
      requirements: ['上诉期：判决10日内，裁定5日内', '需向原审法院提交上诉状'],
    },
    avgDuration: 120,
    complexityLevel: 4,
  },
];

/**
 * 行政案件类型配置数据
 */
const administrativeCaseTypes: Array<{
  code: string;
  name: string;
  category: CaseTypeCategory;
  baseFee: number;
  riskFeeRate?: number;
  hourlyRate?: number;
  requiredDocs: MaterialList;
  optionalDocs?: MaterialList;
  avgDuration?: number;
  complexityLevel?: number;
}> = [
  {
    code: 'ADMIN_RECONSIDERATION',
    name: '行政复议',
    category: CaseTypeCategory.ADMINISTRATIVE,
    baseFee: 8000,
    hourlyRate: 600,
    requiredDocs: {
      materials: [
        { name: '行政复议申请书', description: '一式两份', copies: 2 },
        { name: '身份证明', description: '身份证复印件', copies: 1 },
        {
          name: '行政决定书',
          description: '争议的具体行政行为文件',
          copies: 1,
        },
      ],
      requirements: ['复议期限：知道行政行为60日内', '需明确被申请人'],
    },
    avgDuration: 60,
    complexityLevel: 3,
  },
  {
    code: 'ADMIN_LITIGATION',
    name: '行政诉讼',
    category: CaseTypeCategory.ADMINISTRATIVE,
    baseFee: 15000,
    hourlyRate: 800,
    requiredDocs: {
      materials: [
        { name: '起诉状', description: '一式两份', copies: 2 },
        { name: '身份证明', description: '身份证复印件', copies: 1 },
        { name: '证据材料', description: '支持起诉的证据', copies: 1 },
        { name: '行政决定书', description: '争议文件', copies: 1 },
      ],
      requirements: [
        '诉讼期限：知道行政行为6个月内',
        '行政诉讼期间不停止行政执行',
      ],
    },
    avgDuration: 120,
    complexityLevel: 4,
  },
];

/**
 * 非诉案件类型配置数据
 */
const nonLitigationCaseTypes: Array<{
  code: string;
  name: string;
  category: CaseTypeCategory;
  baseFee: number;
  riskFeeRate?: number;
  hourlyRate?: number;
  requiredDocs: MaterialList;
  optionalDocs?: MaterialList;
  avgDuration?: number;
  complexityLevel?: number;
}> = [
  {
    code: 'LEGAL_COUNSEL',
    name: '法律顾问',
    category: CaseTypeCategory.NON_LITIGATION,
    baseFee: 50000,
    hourlyRate: 500,
    requiredDocs: {
      materials: [
        { name: '企业营业执照', description: '复印件', copies: 1 },
        { name: '公司章程', description: '最新版本', copies: 1 },
        { name: '股东会决议', description: '聘请律师的决议', copies: 1 },
      ],
      requirements: ['法律顾问服务通常按年计费', '服务内容可根据需求定制'],
    },
    avgDuration: 365,
    complexityLevel: 2,
  },
  {
    code: 'DUE_DILIGENCE',
    name: '尽职调查',
    category: CaseTypeCategory.NON_LITIGATION,
    baseFee: 30000,
    hourlyRate: 800,
    requiredDocs: {
      materials: [
        { name: '尽职调查委托书', description: '授权文件', copies: 1 },
        { name: '目标企业基本信息', description: '工商信息等', copies: 1 },
      ],
      requirements: ['调查范围和内容需明确', '需配合提供相关资料'],
    },
    avgDuration: 30,
    complexityLevel: 3,
  },
  {
    code: 'CONTRACT_REVIEW',
    name: '合同审查',
    category: CaseTypeCategory.NON_LITIGATION,
    baseFee: 5000,
    hourlyRate: 600,
    requiredDocs: {
      materials: [
        { name: '待审查合同', description: '电子版或纸质版', copies: 1 },
        { name: '合同背景说明', description: '交易背景和需求', copies: 1 },
      ],
      requirements: ['需明确审查重点和关注事项'],
    },
    avgDuration: 7,
    complexityLevel: 2,
  },
];

/**
 * 清空现有案件类型配置
 */
async function clearExistingCaseTypeConfigs(): Promise<void> {
  await prisma.caseTypeConfig.deleteMany({});
}

/**
 * 创建案件类型配置
 */
async function createCaseTypeConfigs(): Promise<void> {
  const allConfigs = [
    ...civilCaseTypes,
    ...criminalCaseTypes,
    ...administrativeCaseTypes,
    ...nonLitigationCaseTypes,
  ];

  for (const config of allConfigs) {
    await prisma.caseTypeConfig.create({
      data: {
        code: config.code,
        name: config.name,
        category: config.category,
        baseFee: config.baseFee,
        riskFeeRate: config.riskFeeRate ?? null,
        hourlyRate: config.hourlyRate ?? null,
        requiredDocs: config.requiredDocs as never,
        optionalDocs: config.optionalDocs
          ? (config.optionalDocs as unknown as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        avgDuration: config.avgDuration ?? null,
        complexityLevel: config.complexityLevel ?? 2,
        isActive: true,
        sortOrder: 0,
      },
    });
  }
}

/**
 * 主函数
 */
async function main(): Promise<void> {
  console.log('开始导入案件类型配置数据...');

  try {
    // 清空现有数据
    await clearExistingCaseTypeConfigs();
    console.log('已清空现有案件类型配置数据');

    // 创建新数据
    await createCaseTypeConfigs();
    console.log('案件类型配置数据导入完成');

    // 统计
    const count = await prisma.caseTypeConfig.count();
    console.log(`共导入 ${count} 条案件类型配置`);
  } catch (error) {
    console.error('导入案件类型配置数据失败:', error);
    throw error;
  }
}

// 执行种子数据
main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async error => {
    console.error(error);
    await prisma.$disconnect();

    process.exit(1);
  });
