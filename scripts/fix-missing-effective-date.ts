/**
 * 修复缺少有效日期的法条数据
 *
 * 使用方法:
 *   npx ts-node scripts/fix-missing-effective-date.ts [--test]
 *
 * 选项:
 *   --test    测试模式，只修复前5条验证API可用性
 */

import { PrismaClient } from '@prisma/client';
import * as https from 'https';
import * as fs from 'fs';

const prisma = new PrismaClient();

// 配置
const API_BASE = 'https://flk.npc.gov.cn';
const API_DETAIL = `${API_BASE}/law-search/search/flfgDetails`;

// SSL证书验证跳过
const insecureAgent = new https.Agent({ rejectUnauthorized: false });

// 缺失日期的默认值
const MISSING_DATE = new Date('1970-01-01T00:00:00Z');

// 修复统计
interface FixStats {
  total: number;
  success: number;
  failed: number;
  skipped: number;
  notFound: number;
  errors: Array<{ id: string; lawName: string; error: string }>;
}

// 测试模式标志
const isTestMode = process.argv.includes('--test');

/**
 * 获取法规详情
 */
function fetchDetail(bbbs: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const url = `${API_DETAIL}?bbbs=${encodeURIComponent(bbbs)}`;

    const req = https.request(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Referer': 'https://flk.npc.gov.cn/',
      },
      agent: insecureAgent,
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error('解析JSON失败'));
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(30000, () => {
      req.destroy();
      reject(new Error('请求超时'));
    });
    req.end();
  });
}

/**
 * 从文本中提取日期
 */
function extractDateFromText(text: string): Date | null {
  if (!text) return null;

  // 匹配格式: "20XX年X月X日"、"20XX.X.X"、"20XX-XX-XX"
  const patterns = [
    /(\d{4})年(\d{1,2})月(\d{1,2})日/,
    /(\d{4})\.(\d{1,2})\.(\d{1,2})/,
    /(\d{4})-(\d{1,2})-(\d{1,2})/,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const [, year, month, day] = match.map(Number);
      const date = new Date(year, month - 1, day);
      if (!isNaN(date.getTime())) {
        return date;
      }
    }
  }

  return null;
}

async function fixMissingEffectiveDate(): Promise<FixStats> {
  console.log('='.repeat(70));
  console.log(isTestMode ? '🧪 测试模式: 修复缺少有效日期的法条数据' : '🚀 修复缺少有效日期的法条数据');
  console.log('='.repeat(70) + '\n');

  const stats: FixStats = {
    total: 0,
    success: 0,
    failed: 0,
    skipped: 0,
    notFound: 0,
    errors: [],
  };

  // 1. 获取所有缺失有效日期的法条
  const missingArticles = await prisma.lawArticle.findMany({
    where: {
      effectiveDate: MISSING_DATE,
    },
    select: {
      id: true,
      lawName: true,
      articleNumber: true,
      sourceId: true,
      status: true,
    },
    take: isTestMode ? 5 : undefined,
  });

  stats.total = missingArticles.length;
  console.log(`📊 需要修复的法条数量: ${stats.total}${isTestMode ? ' (测试模式)' : ''}\n`);

  // 2. 创建修复日志记录
  const fixLogId = `fix-effective-date-${Date.now()}`;
  console.log(`🆔 修复批次ID: ${fixLogId}\n`);

  // 3. 逐个修复
  console.log('开始修复...\n');

  for (let i = 0; i < missingArticles.length; i++) {
    const article = missingArticles[i];
    const progress = `[${i + 1}/${stats.total}]`;

    if (!article.sourceId) {
      stats.skipped++;
      console.log(`${progress} ⚠️ 跳过: ${article.lawName} (无 sourceId)`);
      continue;
    }

    try {
      console.log(`${progress} 🔄 处理: ${article.lawName}`);
      console.log(`   sourceId: ${article.sourceId}`);

      // 通过 FLK API 获取详情
      const detail = await fetchDetail(article.sourceId);

      if (!detail || detail.code !== 200 || !detail.data) {
        stats.notFound++;
        stats.errors.push({
          id: article.id,
          lawName: article.lawName,
          error: 'API 返回空数据',
        });
        console.log(`${progress}   ❌ API 返回空数据`);
        continue;
      }

      console.log(`   API响应: code=${detail.code}, data exists=${!!detail.data}`);

      // 确定有效日期
      let effectiveDate: Date | null = null;

      // 优先使用 sxrq (生效日期)
      if (detail.data.sxrq) {
        effectiveDate = new Date(detail.data.sxrq);
        console.log(`   使用生效日期 sxrq: ${detail.data.sxrq}`);
      }
      // 其次使用 gbrq (公布日期)
      else if (detail.data.gbrq) {
        effectiveDate = new Date(detail.data.gbrq);
        console.log(`   使用公布日期 gbrq: ${detail.data.gbrq}`);
      }
      // 如果都没有，尝试从标题或其他字段推断
      else if (detail.data.title) {
        const extractedDate = extractDateFromText(detail.data.title);
        if (extractedDate) {
          effectiveDate = extractedDate;
          console.log(`   从标题推断日期: ${extractedDate.toISOString().split('T')[0]}`);
        }
      }

      if (!effectiveDate || isNaN(effectiveDate.getTime())) {
        stats.failed++;
        stats.errors.push({
          id: article.id,
          lawName: article.lawName,
          error: '无法确定有效日期',
        });
        console.log(`${progress}   ❌ 无法确定有效日期`);
        continue;
      }

      // 更新数据库
      await prisma.lawArticle.update({
        where: { id: article.id },
        data: {
          effectiveDate,
          updatedAt: new Date(),
        },
      });

      stats.success++;
      console.log(`${progress}   ✅ 修复成功: effectiveDate = ${effectiveDate.toISOString().split('T')[0]}`);

      // 记录修复日志
      await logFixOperation(fixLogId, article.id, article.lawName, effectiveDate);

      // 限速：避免请求过快
      await new Promise(resolve => setTimeout(resolve, isTestMode ? 200 : 500));

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      stats.failed++;
      stats.errors.push({
        id: article.id,
        lawName: article.lawName,
        error: errorMessage,
      });
      console.log(`${progress}   ❌ 错误: ${errorMessage}`);
    }
  }

  return stats;
}

/**
 * 记录修复操作到日志
 */
async function logFixOperation(
  batchId: string,
  articleId: string,
  lawName: string,
  effectiveDate: Date
): Promise<void> {
  try {
    await prisma.systemConfig.create({
      data: {
        key: `fix-effective-date-log`,
        value: {
          batchId,
          articleId,
          lawName,
          effectiveDate: effectiveDate.toISOString(),
          fixedAt: new Date().toISOString(),
        },
        type: 'OBJECT',
        category: 'data-fix',
        description: `修复法条有效日期 - ${batchId}`,
      },
    });
  } catch (error) {
    console.error('记录修复日志失败:', error);
  }
}

/**
 * 验证修复结果
 */
async function verifyFix(): Promise<void> {
  console.log('\n' + '='.repeat(70));
  console.log('验证修复结果');
  console.log('='.repeat(70) + '\n');

  // 检查修复后的数量
  const missingAfter = await prisma.lawArticle.count({
    where: {
      effectiveDate: MISSING_DATE,
    },
  });

  const total = await prisma.lawArticle.count();

  console.log(`📊 修复后缺少有效日期的法条: ${missingAfter}/${total}`);

  if (missingAfter === 0) {
    console.log('\n🎉 修复完成！所有法条都有有效日期。');

    // 计算完整性评分
    const completenessScore = ((total - missingAfter) / total) * 100;
    console.log(`\n📈 完整性评分: ${completenessScore.toFixed(2)}/100`);
  } else {
    console.log(`\n⚠️  仍有 ${missingAfter} 条法条缺少有效日期。`);
  }
}

async function main() {
  console.log(`\n🚀 开始${isTestMode ? '测试' : ''}修复缺少有效日期的法条数据...\n`);

  try {
    // 执行修复
    const stats = await fixMissingEffectiveDate();

    // 验证结果
    await verifyFix();

    // 输出总结
    console.log('\n' + '='.repeat(70));
    console.log(isTestMode ? '🧪 测试结果' : '修复任务完成');
    console.log('='.repeat(70));
    console.log(`总数量: ${stats.total}`);
    console.log(`成功: ${stats.success}`);
    console.log(`失败: ${stats.failed}`);

    if (stats.failed > 0) {
      console.log(`\n失败详情:`);
      stats.errors.forEach(e => {
        console.log(`  - ${e.lawName}: ${e.error}`);
      });
    }

    if (isTestMode && stats.success > 0) {
      console.log('\n✅ 测试成功！API 可用，可以运行完整修复。');
      console.log('运行命令: npx ts-node scripts/fix-missing-effective-date.ts');
    }

  } catch (error) {
    console.error('修复过程出错:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// 运行
main().catch(console.error);
