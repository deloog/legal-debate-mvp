/**
 * Just-Laws 数据转换脚本
 *
 * 将 https://github.com/ImCa0/just-laws 的数据转换为标准格式
 * 用于导入到系统
 */

import { LawCategory, LawType, PrismaClient } from '@prisma/client';
import { createHash } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

// Just-Laws 数据接口定义
interface JustLawsData {
  title: string;
  article: string;
  content: string;
  law_type?: string;
  category?: string;
  effective_date?: string;
  issuing_authority?: string;
}

// 类别映射
const CATEGORY_MAP: Record<string, LawCategory> = {
  宪法: LawCategory.OTHER,
  民事: LawCategory.CIVIL,
  刑事: LawCategory.CRIMINAL,
  行政: LawCategory.ADMINISTRATIVE,
  商事: LawCategory.COMMERCIAL,
  经济: LawCategory.ECONOMIC,
  劳动: LawCategory.LABOR,
  知识产权: LawCategory.INTELLECTUAL_PROPERTY,
  诉讼: LawCategory.PROCEDURE,
  其他: LawCategory.OTHER,
};

// 法律类型映射
const LAW_TYPE_MAP: Record<string, LawType> = {
  宪法: LawType.CONSTITUTION,
  法律: LawType.LAW,
  行政法规: LawType.ADMINISTRATIVE_REGULATION,
  地方性法规: LawType.LOCAL_REGULATION,
  司法解释: LawType.JUDICIAL_INTERPRETATION,
  部门规章: LawType.DEPARTMENTAL_RULE,
  其他: LawType.OTHER,
};

/**
 * 映射类别
 */
function mapCategory(category?: string): LawCategory {
  if (!category) return LawCategory.OTHER;
  return CATEGORY_MAP[category] || LawCategory.OTHER;
}

/**
 * 映射法律类型
 */
function mapLawType(lawType?: string): LawType {
  if (!lawType) return LawType.LAW;
  return LAW_TYPE_MAP[lawType] || LawType.LAW;
}

/**
 * 生成可搜索文本
 */
function generateSearchableText(data: JustLawsData): string {
  const parts = [data.title, data.article, data.content];

  return parts.filter(Boolean).join(' ').toLowerCase();
}

/**
 * 转换单条数据
 */
function convertArticle(data: JustLawsData): {
  lawName: string;
  articleNumber: string;
  fullText: string;
  lawType: LawType;
  category: LawCategory;
  subCategory?: string;
  effectiveDate: string;
  issuingAuthority?: string;
  searchableText: string;
  keywords: string[];
  tags: string[];
  level: number;
  sourceId: string;
} {
  const category = mapCategory(data.category);
  const lawType = mapLawType(data.law_type);
  const searchableText = generateSearchableText(data);

  // 生成唯一标识
  const sourceId = createHash('md5')
    .update(`${data.title}|${data.article}`)
    .digest('hex');

  // 提取关键词
  const keywords: string[] = [];
  const content = data.content || '';

  // 从内容中提取常见法律关键词
  const keywordPatterns = [
    /法律/g,
    /法规/g,
    /规定/g,
    /办法/g,
    /条例/g,
    /权益/g,
    /义务/g,
    /责任/g,
    /赔偿/g,
    /处罚/g,
    /民事/g,
    /刑事/g,
    /行政/g,
    /经济/g,
    /合同/g,
  ];

  for (const pattern of keywordPatterns) {
    const matches = content.match(pattern);
    if (matches) {
      keywords.push(...matches);
    }
  }

  return {
    lawName: data.title,
    articleNumber: data.article,
    fullText: data.content,
    lawType,
    category,
    subCategory: undefined,
    effectiveDate: data.effective_date || '2020-01-01',
    issuingAuthority: data.issuing_authority,
    searchableText,
    keywords: [...new Set(keywords)].slice(0, 10), // 最多10个关键词
    tags: ['just-laws'],
    level: 3,
    sourceId,
  };
}

/**
 * 转换并导入 Just-Laws 数据
 */
async function convertAndImport(filePath: string) {
  console.log(`[Just-Laws转换] 开始处理: ${filePath}`);

  // 读取数据文件
  const fileContent = fs.readFileSync(filePath, 'utf-8');
  let rawData: JustLawsData[];

  try {
    // 尝试解析为JSON
    rawData = JSON.parse(fileContent);
  } catch {
    // 如果不是JSON，尝试解析为每一行一个JSON对象
    const lines = fileContent.split('\n').filter(line => line.trim());
    rawData = lines.map(line => JSON.parse(line)).filter(Boolean);
  }

  console.log(`[Just-Laws转换] 共读取 ${rawData.length} 条数据`);

  if (!Array.isArray(rawData)) {
    throw new Error('数据格式错误：必须是数组或每行一个JSON对象');
  }

  // 转换数据
  const convertedData = rawData.map(convertArticle);
  console.log(`[Just-Laws转换] 转换完成`);

  // 导出为标准格式
  const outputData = {
    dataSource: 'just-laws',
    articles: convertedData,
  };

  const outputPath = path.join(
    path.dirname(filePath),
    `just-laws-converted-${Date.now()}.json`
  );

  fs.writeFileSync(outputPath, JSON.stringify(outputData, null, 2));
  console.log(`[Just-Laws转换] 转换后数据已保存: ${outputPath}`);

  console.log(`[Just-Laws转换] 完成处理 ${convertedData.length} 条法条`);
}

/**
 * 主函数
 */
async function main() {
  const filePath = process.argv[2];

  if (!filePath) {
    console.error('用法: npm run import:convert-just-laws <数据文件路径>');
    console.error(
      '示例: npm run import:convert-just-laws data/just-laws/data.json'
    );
    process.exit(1);
  }

  if (!fs.existsSync(filePath)) {
    console.error(`文件不存在: ${filePath}`);
    process.exit(1);
  }

  try {
    await convertAndImport(filePath);
  } catch (error) {
    console.error('[Just-Laws转换] 发生错误:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// 运行脚本
if (require.main === module) {
  main();
}

export { convertAndImport, convertArticle };
