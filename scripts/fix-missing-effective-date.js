/**
 * 修复缺少有效日期的法条数据 (CommonJS)
 *
 * 使用方法:
 *   node scripts/fix-missing-effective-date.js [--test]
 *
 * 选项:
 *   --test    测试模式，只修复前5条验证API可用性
 */

const { PrismaClient } = require('@prisma/client');
const https = require('https');

const prisma = new PrismaClient();

// 配置
const API_BASE = 'https://flk.npc.gov.cn';
const API_DETAIL = `${API_BASE}/law-search/search/flfgDetails`;

// SSL证书验证跳过
const insecureAgent = new https.Agent({ rejectUnauthorized: false });

// 缺失日期的默认值
const MISSING_DATE = new Date('1970-01-01T00:00:00Z');

// 测试模式标志
const isTestMode = process.argv.includes('--test');

/**
 * 获取法规详情
 */
function fetchDetail(bbbs) {
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
 * 从文本中提取所有日期
 */
function extractAllDates(text) {
  if (!text) return [];

  const results = [];
  const cleanedText = text.replace(/\s+/g, ' ');

  // 使用更精确的匹配模式
  const dateRegex = /(\d{4})年(\d{1,2})月(\d{1,2})日/g;
  let match;

  while ((match = dateRegex.exec(cleanedText)) !== null) {
    const year = parseInt(match[1], 10);
    const month = parseInt(match[2], 10);
    const day = parseInt(match[3], 10);
    const date = new Date(year, month - 1, day);

    if (!isNaN(date.getTime())) {
      results.push({ date, match: match[0] });
    }
  }

  return results;
}

/**
 * 获取最佳有效日期
 * 通常法规的有效日期是最初的施行日期
 */
function getBestEffectiveDate(text) {
  const dates = extractAllDates(text);
  if (dates.length === 0) return null;

  // 选择最早的有效日期（法规通常从最初颁布日开始生效）
  dates.sort((a, b) => a.date - b.date);

  return dates[0];
}

async function fixMissingEffectiveDate() {
  console.log('='.repeat(70));
  console.log(isTestMode ? '🧪 测试模式: 修复缺少有效日期的法条数据' : '🚀 修复缺少有效日期的法条数据');
  console.log('='.repeat(70) + '\n');

  const stats = {
    total: 0,
    success: 0,
    failed: 0,
    skipped: 0,
    notFound: 0,
    errors: [],
    batchId: `fix-effective-date-${Date.now()}`,
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
      fullText: true,
    },
    take: isTestMode ? 5 : undefined,
  });

  stats.total = missingArticles.length;
  console.log(`📊 需要修复的法条数量: ${stats.total}${isTestMode ? ' (测试模式)' : ''}\n`);

  console.log(`🆔 修复批次ID: ${stats.batchId}\n`);

  // 2. 逐个修复
  console.log('开始修复...\n');

  for (let i = 0; i < missingArticles.length; i++) {
    const article = missingArticles[i];
    const progress = `[${i + 1}/${stats.total}]`;

    if (!article.sourceId && !article.fullText) {
      stats.skipped++;
      console.log(`${progress} ⚠️ 跳过: ${article.lawName} (无 sourceId 且无 fullText)`);
      continue;
    }

    try {
      console.log(`${progress} 🔄 处理: ${article.lawName}`);

      let effectiveDate = null;
      let dateSource = '';

      // 1. 优先从 FLK API 获取
      if (article.sourceId) {
        try {
          const detail = await fetchDetail(article.sourceId);

          if (detail && detail.code === 200 && detail.data) {
            if (detail.data.sxrq) {
              effectiveDate = new Date(detail.data.sxrq);
              dateSource = 'FLK API sxrq';
            } else if (detail.data.gbrq) {
              effectiveDate = new Date(detail.data.gbrq);
              dateSource = 'FLK API gbrq';
            }
          }
        } catch (apiError) {
          // API请求失败，继续尝试从fullText获取
        }
      }

      // 2. 从 fullText 中提取日期
      if (!effectiveDate && article.fullText) {
        const dateResult = getBestEffectiveDate(article.fullText);
        if (dateResult) {
          effectiveDate = dateResult.date;
          dateSource = `fullText (${dateResult.match})`;
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
      console.log(`${progress}   ✅ ${effectiveDate.toISOString().split('T')[0]} (${dateSource})`);

      // 限速：避免请求过快
      await new Promise(resolve => setTimeout(resolve, isTestMode ? 200 : 300));

    } catch (error) {
      const errorMessage = error.message;
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
 * 验证修复结果
 */
async function verifyFix() {
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
  const fixed = total - 22562 + (22562 - missingAfter); // 计算修复的数量

  console.log(`📊 修复后缺少有效日期的法条: ${missingAfter}/${total}`);

  if (missingAfter === 0) {
    console.log('\n🎉 修复完成！所有法条都有有效日期。');
    console.log('📈 完整性评分: 100/100');
  } else {
    console.log(`\n⚠️  仍有 ${missingAfter} 条法条缺少有效日期。`);
    const completeness = ((total - missingAfter) / total) * 100;
    console.log(`📈 完整性评分: ${completeness.toFixed(2)}/100`);
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
    console.log(`✅ 成功: ${stats.success}`);
    console.log(`❌ 失败: ${stats.failed}`);

    if (stats.errors.length > 0) {
      console.log(`\n失败列表 (前10条):`);
      stats.errors.slice(0, 10).forEach(e => {
        console.log(`  - ${e.lawName}: ${e.error}`);
      });
    }

    if (isTestMode && stats.success > 0) {
      console.log('\n✅ 测试通过！运行完整修复: node scripts/fix-missing-effective-date.js');
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
