/**
 * 司法部法律法规数据导入脚本
 *
 * 数据源：https://flk.npc.gov.cn/
 *
 * 使用方法：
 * npm run import:judiciary -- data/judiciary-laws.json
 */

import {
  LawCategory,
  LawStatus,
  LawType,
  Prisma,
  PrismaClient,
} from '@prisma/client';
import { createHash } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

// 司法部数据接口定义
interface JudiciaryLawData {
  lawName: string;
  articleNumber: string;
  fullText: string;
  category: string;
  subCategory?: string;
  effectiveDate: string;
  expiryDate?: string;
  lawType: string;
  issuingAuthority: string;
  jurisdiction?: string;
  keywords?: string[];
  tags?: string[];
  level?: string;
}

// 类别映射
const CATEGORY_MAP: Record<string, LawCategory> = {
  民事: LawCategory.CIVIL,
  刑事: LawCategory.CRIMINAL,
  行政: LawCategory.ADMINISTRATIVE,
  商事: LawCategory.COMMERCIAL,
  经济: LawCategory.ECONOMIC,
  劳动: LawCategory.LABOR,
  知识产权: LawCategory.INTELLECTUAL_PROPERTY,
  诉讼: LawCategory.PROCEDURE,
  宪法: LawCategory.OTHER,
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

// 等级映射
const LEVEL_MAP: Record<string, number> = {
  宪法: 0,
  法律: 1,
  行政法规: 2,
  部门规章: 3,
  地方性法规: 4,
  司法解释: 2,
};

/**
 * 生成可搜索文本
 */
function generateSearchableText(data: JudiciaryLawData): string {
  const parts = [
    data.lawName,
    data.articleNumber,
    data.fullText,
    data.keywords?.join(' ') || '',
    data.tags?.join(' ') || '',
    data.category,
    data.subCategory || '',
  ];

  return parts.filter(Boolean).join(' ').toLowerCase();
}

/**
 * 映射类别
 */
function mapCategory(category: string): LawCategory {
  return CATEGORY_MAP[category] || LawCategory.OTHER;
}

/**
 * 映射法律类型
 */
function mapLawType(lawType: string): LawType {
  return LAW_TYPE_MAP[lawType] || LawType.OTHER;
}

/**
 * 映射等级
 */
function mapLevel(level?: string): number {
  return level ? LEVEL_MAP[level] || 5 : 3;
}

/**
 * 导入司法部数据
 */
async function importJudiciaryData(filePath: string) {
  console.log(`[导入司法部数据] 开始导入: ${filePath}`);

  // 读取数据文件
  const fileContent = fs.readFileSync(filePath, 'utf-8');
  const rawData: JudiciaryLawData[] = JSON.parse(fileContent);

  console.log(`[导入司法部数据] 共读取 ${rawData.length} 条数据`);

  let successCount = 0;
  let skipCount = 0;
  let errorCount = 0;
  const errors: Array<{ data: JudiciaryLawData; error: string }> = [];

  for (const data of rawData) {
    try {
      // 验证必填字段
      if (!data.lawName || !data.articleNumber || !data.fullText) {
        console.warn(
          `[导入司法部数据] 跳过无效数据: ${data.lawName} ${data.articleNumber}`
        );
        skipCount++;
        continue;
      }

      // 映射字段
      const category = mapCategory(data.category);
      const lawType = mapLawType(data.lawType);
      const level = mapLevel(data.level);
      const searchableText = generateSearchableText(data);

      // 生成唯一标识
      const sourceId = createHash('md5')
        .update(`${data.lawName}|${data.articleNumber}`)
        .digest('hex');

      // 导入或更新法条
      await prisma.lawArticle.upsert({
        where: {
          lawName_articleNumber: {
            lawName: data.lawName,
            articleNumber: data.articleNumber,
          },
        },
        update: {
          fullText: data.fullText,
          category,
          subCategory: data.subCategory,
          effectiveDate: new Date(data.effectiveDate),
          expiryDate: data.expiryDate ? new Date(data.expiryDate) : null,
          lawType,
          issuingAuthority: data.issuingAuthority,
          jurisdiction: data.jurisdiction,
          keywords: data.keywords || [],
          tags: data.tags || [],
          level,
          searchableText,
          updatedAt: new Date(),
        },
        create: {
          lawName: data.lawName,
          articleNumber: data.articleNumber,
          fullText: data.fullText,
          category,
          subCategory: data.subCategory,
          effectiveDate: new Date(data.effectiveDate),
          expiryDate: data.expiryDate ? new Date(data.expiryDate) : null,
          lawType,
          issuingAuthority: data.issuingAuthority,
          jurisdiction: data.jurisdiction,
          keywords: data.keywords || [],
          tags: data.tags || [],
          level,
          searchableText,
          status: LawStatus.VALID,
          dataSource: 'judiciary',
          sourceId,
          importedAt: new Date(),
          syncStatus: 'SYNCED',
          viewCount: 0,
          referenceCount: 0,
        },
      } as Prisma.LawArticleUpsertArgs);

      successCount++;

      if (successCount % 100 === 0) {
        console.log(
          `[导入司法部数据] 已处理 ${successCount}/${rawData.length}`
        );
      }
    } catch (error) {
      errorCount++;
      errors.push({
        data,
        error: error instanceof Error ? error.message : String(error),
      });
      console.error(
        `[导入司法部数据] 导入失败: ${data.lawName} ${data.articleNumber}`,
        error
      );
    }
  }

  console.log('\n[导入司法部数据] 导入完成');
  console.log(`  成功: ${successCount}`);
  console.log(`  跳过: ${skipCount}`);
  console.log(`  失败: ${errorCount}`);

  if (errors.length > 0) {
    const errorLogPath = path.join(
      path.dirname(filePath),
      `import-errors-${Date.now()}.json`
    );
    fs.writeFileSync(errorLogPath, JSON.stringify(errors, null, 2));
    console.log(`  错误日志: ${errorLogPath}`);
  }
}

/**
 * 主函数
 */
async function main() {
  const filePath = process.argv[2];

  if (!filePath) {
    console.error('用法: npm run import:judiciary <数据文件路径>');
    console.error('示例: npm run import:judiciary data/judiciary-laws.json');
    process.exit(1);
  }

  if (!fs.existsSync(filePath)) {
    console.error(`文件不存在: ${filePath}`);
    process.exit(1);
  }

  try {
    await importJudiciaryData(filePath);
  } catch (error) {
    console.error('[导入司法部数据] 发生错误:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// 运行脚本
if (require.main === module) {
  main();
}

export { importJudiciaryData };
