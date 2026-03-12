#!/usr/bin/env ts-node
/**
 * SAMR合同模板批量导入脚本
 * 从 summary.json 中读取240个合同URL，爬取完整内容并入库
 */

import * as fs from 'fs';
import * as path from 'path';
import { SAMRPlaywrightCrawler } from '../src/lib/crawler/samr-playwright';
import { PrismaClient } from '@prisma/client';
import type {
  ContractCategory,
  ContractTemplateData,
  ContractTemplateSource,
  TemplateVariable,
  TemplateClause,
  RiskWarning,
} from '../src/lib/crawler/contract-template-types';

const prisma = new PrismaClient();

// 数据源配置
const SAMR_CONFIG = {
  source: 'samr' as ContractTemplateSource,
  rateLimitDelay: 3000, // 请求间隔3秒
};

// 合同分类映射
const CONTRACT_CATEGORIES: Record<string, string> = {
  劳动合同: 'LABOR',
  人事: 'LABOR',
  聘用: 'LABOR',
  房屋租赁: 'LEASE',
  场地租赁: 'LEASE',
  设备租赁: 'LEASE',
  买卖: 'CIVIL',
  零售: 'CIVIL',
  农副产品: 'CIVIL',
  借款: 'CIVIL',
  民间借贷: 'CIVIL',
  建设工程: 'CONSTRUCTION',
  施工: 'CONSTRUCTION',
  装饰装修: 'CONSTRUCTION',
  房屋买卖: 'REAL_ESTATE',
  房地产开发: 'REAL_ESTATE',
  物业服务: 'REAL_ESTATE',
  运输: 'TRANSPORTATION',
  物流: 'TRANSPORTATION',
  公路货物: 'TRANSPORTATION',
  知识产权: 'INTELLECTUAL_PROPERTY',
  专利: 'INTELLECTUAL_PROPERTY',
  商标: 'INTELLECTUAL_PROPERTY',
  版权: 'INTELLECTUAL_PROPERTY',
  技术: 'INTELLECTUAL_PROPERTY',
  保险: 'FINANCIAL',
  金融: 'FINANCIAL',
  证券: 'FINANCIAL',
  服务: 'SERVICE',
  委托: 'SERVICE',
  中介: 'SERVICE',
  旅游: 'SERVICE',
  餐饮: 'SERVICE',
  承揽: 'SERVICE',
  合伙: 'COMMERCIAL',
  公司: 'COMMERCIAL',
  投资: 'COMMERCIAL',
  合作: 'COMMERCIAL',
  联营: 'COMMERCIAL',
};

// 从标题推断分类
function mapCategory(title: string): ContractCategory {
  for (const [keyword, category] of Object.entries(CONTRACT_CATEGORIES)) {
    if (title.includes(keyword)) {
      return category as ContractCategory;
    }
  }
  return 'CIVIL';
}

// 从标题推断子分类
function extractSubCategory(title: string): string {
  const keywords = [
    '劳动', '人事', '聘用', '租赁', '买卖', '借款', '建设',
    '房屋', '运输', '物流', '知识', '专利', '商标', '保险',
    '金融', '服务', '委托', '承揽', '合伙', '公司', '投资'
  ];
  for (const kw of keywords) {
    if (title.includes(kw)) return kw;
  }
  return '通用';
}

// 生成合同编码
function generateCode(title: string, index: number): string {
  const category = mapCategory(title);
  const timestamp = Date.now().toString(36).slice(-4);
  return `SAMR-${category}-${String(index).padStart(4, '0')}-${timestamp}`.toUpperCase();
}

// 从合同文本中提取变量占位符
function generateVariables(title: string, content: string): TemplateVariable[] {
  const variables: TemplateVariable[] = [];
  const variablePatterns: Array<{ pattern: RegExp; key: string; label: string; type: 'text' | 'number' | 'date' | 'select' | 'textarea' }> = [
    { pattern: /甲方[（(]名称[)）]/g, key: 'partyA_name', label: '甲方名称', type: 'text' },
    { pattern: /乙方[（(]名称[)）]/g, key: 'partyB_name', label: '乙方名称', type: 'text' },
    { pattern: /签订地点/g, key: 'sign_location', label: '签订地点', type: 'text' },
    { pattern: /签订日期/g, key: 'sign_date', label: '签订日期', type: 'date' },
    { pattern: /合同编号/g, key: 'contract_no', label: '合同编号', type: 'text' },
    { pattern: /金额|价款|报酬/g, key: 'amount', label: '金额/价款', type: 'number' },
    { pattern: /履行期限|合同期限/g, key: 'term', label: '履行期限', type: 'text' },
    { pattern: /质量标准|技术要求/g, key: 'quality_standard', label: '质量标准', type: 'textarea' },
    { pattern: /付款方式|结算方式/g, key: 'payment_method', label: '付款方式', type: 'select' },
    { pattern: /违约责任|违约金/g, key: 'penalty', label: '违约责任', type: 'textarea' },
    { pattern: /争议解决|管辖法院/g, key: 'dispute_resolution', label: '争议解决方式', type: 'select' },
  ];

  for (const { pattern, key, label, type } of variablePatterns) {
    if (pattern.test(content)) {
      variables.push({
        key,
        label,
        type,
        required: ['partyA_name', 'partyB_name', 'amount'].includes(key),
        description: `请填写${label}`,
      });
    }
  }

  return variables;
}

// 从合同文本中提取条款
function generateClauses(content: string): TemplateClause[] {
  const clauses: TemplateClause[] = [];

  // 简单提取前20个条款结构
  const lines = content.split('\n').filter(l => l.trim());
  let clauseNum = 1;
  
  const clauseTypes: Array<{ pattern: RegExp; type: import('../src/lib/crawler/contract-template-types').ClauseType }> = [
    { pattern: /当事人|甲方|乙方|双方/, type: 'PARTIES' },
    { pattern: /标的|货物|产品|服务|工作内容/, type: 'SUBJECT_MATTER' },
    { pattern: /价格|价款|金额|报酬|费用|付款|支付/, type: 'PRICE_PAYMENT' },
    { pattern: /履行|交付|验收|期限|时间|地点/, type: 'PERFORMANCE' },
    { pattern: /担保|保证|抵押|质押/, type: 'WARRANTY' },
    { pattern: /违约|责任|赔偿|损失/, type: 'LIABILITY' },
    { pattern: /争议|解决|诉讼|仲裁|管辖/, type: 'DISPUTE' },
    { pattern: /解除|终止|变更|撤销/, type: 'TERMINATION' },
    { pattern: /保密|秘密|信息/, type: 'CONFIDENTIALITY' },
    { pattern: /知识产权|专利|商标|著作权/, type: 'INTELLECTUAL_PROPERTY' },
    { pattern: /不可抗力|灾害|事件/, type: 'FORCE_MAJEURE' },
    { pattern: /法律|适用|解释/, type: 'GOVERNING_LAW' },
    { pattern: /通知|送达|联系/, type: 'NOTICE' },
  ];

  for (const line of lines.slice(0, 100)) {
    const trimmed = line.trim();
    // 匹配 "第一条"、"一、"、"1." 等格式
    if (/^(第[一二三四五六七八九十\d]+条|[一二三四五六七八九十]、|\d+[\.\、])/.test(trimmed)) {
      const title = trimmed.replace(/^(第[一二三四五六七八九十\d]+条|[一二三四五六七八九十]、|\d+[\.\、])\s*/, '').slice(0, 50);
      if (title && clauses.length < 20) {
        // 根据标题内容推断条款类型
        let clauseType: import('../src/lib/crawler/contract-template-types').ClauseType = 'MISCELLANEOUS';
        for (const { pattern, type } of clauseTypes) {
          if (pattern.test(title)) {
            clauseType = type;
            break;
          }
        }

        clauses.push({
          order: clauseNum++,
          title: title || `条款${clauseNum}`,
          type: clauseType,
          content: trimmed,
          isRequired: true,
        });
      }
    }
  }

  return clauses;
}

// 生成风险提示
function generateRiskWarnings(title: string, category: string): RiskWarning[] {
  const risks: RiskWarning[] = [
    {
      title: '主体资格审查',
      description: '签订合同前应核实对方主体资格、履约能力和信用状况，避免与不具备签约能力的主体签订合同导致合同无效或无法履行。',
      level: 'HIGH',
      suggestion: '要求对方提供营业执照、资质证书、授权委托书等证明文件，必要时进行信用查询',
    },
    {
      title: '合同条款明确性',
      description: '合同条款应明确具体，避免使用模糊语言，防止日后产生争议时无法确定双方真实意思表示。',
      level: 'MEDIUM',
      suggestion: '对标的、数量、质量、价款、履行期限、地点和方式、违约责任等重要条款进行细化约定，必要时请专业律师审核',
    },
    {
      title: '签字盖章规范',
      description: '合同应由法定代表人或授权代理人签字并加盖公章，签字盖章不规范可能导致合同效力瑕疵。',
      level: 'HIGH',
      suggestion: '核实签字人身份和授权范围，保留授权委托书；盖章应清晰完整，骑缝章应覆盖全部页面',
    },
  ];

  // 根据分类添加特定风险
  if (category === 'LABOR') {
    risks.push({
      title: '劳动报酬约定',
      description: '劳动报酬是劳动合同的核心条款，约定不明可能导致劳动争议。',
      level: 'HIGH',
      suggestion: '明确约定工资标准（不低于当地最低工资标准）、支付方式（银行转账或现金）、支付时间（至少每月支付一次）',
    });
  } else if (category === 'LEASE') {
    risks.push({
      title: '租赁物状况确认',
      description: '租赁物的现状直接影响合同履行和退还，状况不明容易产生争议。',
      level: 'MEDIUM',
      suggestion: '签订详细的交接清单，记录租赁物的品牌、型号、数量、新旧程度、损坏情况等，拍照或录像留存',
    });
  } else if (category === 'CIVIL' && title.includes('买卖')) {
    risks.push({
      title: '标的物质量检验',
      description: '买卖合同中标的物质量是核心要素，检验期限和方法约定不明容易导致纠纷。',
      level: 'MEDIUM',
      suggestion: '明确约定质量标准、检验期限、检验方法、异议提出期限，保留检验记录',
    });
  }

  return risks;
}

// 保存合同模板到数据库
async function saveTemplate(data: ContractTemplateData): Promise<void> {
  const existing = await prisma.contractTemplate.findFirst({
    where: { sourceUrl: data.sourceUrl },
  });

  const templateData = {
    name: data.name,
    code: data.code,
    category: data.category,
    subCategory: data.subCategory,
    description: data.description,
    content: data.content || '',
    fullText: data.fullText,
    variables: data.variables as any,
    clauses: data.clauses as any,
    riskWarnings: data.riskWarnings as any,
    usageGuide: data.usageGuide,
    source: data.source,
    sourceUrl: data.sourceUrl,
    sourceId: data.sourceId,
    publishedDate: data.publishedDate,
    effectiveDate: data.effectiveDate,
    version: data.version,
    isLatest: data.isLatest,
    priority: data.priority,
    tags: data.tags || [],
    keywords: data.keywords || [],
  };

  if (existing) {
    await prisma.contractTemplate.update({
      where: { id: existing.id },
      data: templateData,
    });
    console.log(`  ✓ 更新: ${data.name}`);
  } else {
    await prisma.contractTemplate.create({
      data: templateData,
    });
    console.log(`  ✓ 新增: ${data.name}`);
  }
}

// 批量导入主函数
async function batchImport(): Promise<void> {
  console.log('=== SAMR合同模板批量导入 ===\n');

  // 1. 读取 summary.json
  const summaryPath = path.resolve('data/crawled/samr-search/summary.json');
  if (!fs.existsSync(summaryPath)) {
    console.error('错误: 找不到 summary.json');
    process.exit(1);
  }

  const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf-8'));
  const items: Array<{ title: string; sourceUrl: string }> = summary.items || [];
  
  console.log(`读取到 ${items.length} 个合同模板URL\n`);

  // 2. 初始化爬虫
  const crawler = new SAMRPlaywrightCrawler({
    headless: true,
    timeout: 60000,
    rateLimitDelay: 3000,
  });

  // 3. 统计
  let success = 0;
  let failed = 0;
  let skipped = 0;
  const errors: string[] = [];

  // 4. 逐个处理
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const index = i + 1;
    
    console.log(`[${index}/${items.length}] ${item.title}`);

    // 检查是否已存在
    const existing = await prisma.contractTemplate.findFirst({
      where: { sourceUrl: item.sourceUrl },
    });
    
    if (existing?.content && existing.content.length > 500) {
      console.log(`  ⏭ 已存在完整内容，跳过`);
      skipped++;
      continue;
    }

    try {
      // 爬取详情页
      const detail = await crawler.gotoDetail(item.sourceUrl);
      
      if (!detail.content || detail.content.length < 100) {
        console.log(`  ⚠ 内容为空或太短，跳过`);
        skipped++;
        continue;
      }

      // 构建合同数据
      const category = mapCategory(item.title);
      const subCategory = extractSubCategory(item.title);
      const content = detail.content;
      
      const templateData: ContractTemplateData = {
        name: item.title.replace(/[（(]示范文本[)）]/g, '').trim(),
        code: generateCode(item.title, index),
        category,
        subCategory,
        description: `${subCategory}合同示范文本，由国家市场监督管理总局发布。`,
        source: SAMR_CONFIG.source,
        sourceUrl: item.sourceUrl,
        sourceId: item.sourceUrl.split('?id=')[1] || String(index),
        publishedDate: detail.publishDate ? new Date(detail.publishDate) : new Date(),
        effectiveDate: detail.publishDate ? new Date(detail.publishDate) : new Date(),
        fullText: content,
        content: content.slice(0, 20000), // 限制主内容长度
        variables: generateVariables(item.title, content),
        clauses: generateClauses(content),
        riskWarnings: generateRiskWarnings(item.title, category),
        usageGuide: `本${subCategory}合同示范文本适用于${subCategory}场景。使用时请根据实际交易情况填写相关条款，必要时请咨询专业律师。`,
        version: '1.0',
        isLatest: true,
        priority: 'P2',
        tags: [subCategory, '示范文本', 'samr', '官方'],
        keywords: [item.title, subCategory, '合同模板', '示范文本'],
      };

      // 保存到数据库
      await saveTemplate(templateData);
      success++;

      // 延迟避免被封
      await new Promise(resolve => setTimeout(resolve, SAMR_CONFIG.rateLimitDelay));

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.log(`  ✗ 失败: ${errorMsg.slice(0, 100)}`);
      errors.push(`${item.title}: ${errorMsg}`);
      failed++;
    }
  }

  // 5. 关闭爬虫
  await crawler.close();

  // 6. 输出统计
  console.log('\n=== 导入完成 ===');
  console.log(`总计: ${items.length}`);
  console.log(`成功: ${success}`);
  console.log(`跳过: ${skipped}`);
  console.log(`失败: ${failed}`);
  
  if (errors.length > 0) {
    console.log(`\n错误详情 (${errors.length}个):`);
    errors.slice(0, 10).forEach(e => console.log(`  - ${e.slice(0, 100)}`));
  }

  await prisma.$disconnect();
}

// 运行
batchImport().catch(async (error) => {
  console.error('导入失败:', error);
  await prisma.$disconnect();
  process.exit(1);
});
