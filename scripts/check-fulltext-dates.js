/**
 * 检查缺失有效日期法条的 fullText 中是否包含日期信息
 */

const { PrismaClient } = require('@prisma/client');
const https = require('https');

const prisma = new PrismaClient();

// 缺失日期的默认值
const MISSING_DATE = new Date('1970-01-01T00:00:00Z');

/**
 * 从文本中提取日期
 */
function extractDateFromText(text) {
  if (!text) return null;

  // 匹配格式列表（按优先级排序）
  const patterns = [
    // "20XX年X月X日公布"
    /(\d{4})年(\d{1,2})月(\d{1,2})日公布/,
    // "20XX年X月X日施行"
    /(\d{4})年(\d{1,2})月(\d{1,2})日施行/,
    // "自20XX年X月X日起施行"
    /自(\d{4})年(\d{1,2})月(\d{1,2})日起施行/,
    // "20XX年X月X日修订"
    /(\d{4})年(\d{1,2})月(\d{1,2})日修订/,
    // "20XX年X月X日"
    /(\d{4})年(\d{1,2})月(\d{1,2})日/,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const [, year, month, day] = match.slice(1).map(Number);
      const date = new Date(year, month - 1, day);
      if (!isNaN(date.getTime())) {
        return { date, match: match[0] };
      }
    }
  }

  return null;
}

async function checkFullTextDates() {
  console.log('='.repeat(70));
  console.log('检查缺失有效日期法条的 fullText 日期信息');
  console.log('='.repeat(70) + '\n');

  // 获取缺失有效日期的法条及其 fullText
  const missingArticles = await prisma.lawArticle.findMany({
    where: {
      effectiveDate: MISSING_DATE,
    },
    select: {
      id: true,
      lawName: true,
      fullText: true,
      sourceId: true,
    },
    take: 10,
  });

  console.log(`检查 ${missingArticles.length} 条缺失有效日期的法条...\n`);

  let foundInFullText = 0;
  let notFoundInFullText = 0;

  for (const article of missingArticles) {
    console.log(`\n📄 ${article.lawName}`);
    console.log(`   ID: ${article.id}`);
    console.log(`   sourceId: ${article.sourceId}`);

    // 检查 fullText 前500字符
    const textPreview = article.fullText ? article.fullText.substring(0, 500) : '';
    console.log(`   内容预览: ${textPreview.substring(0, 200)}...`);

    // 尝试提取日期
    const result = extractDateFromText(article.fullText || '');
    if (result) {
      console.log(`   ✅ 从fullText中找到日期: ${result.date.toISOString().split('T')[0]} (匹配: "${result.match}")`);
      foundInFullText++;
    } else {
      console.log(`   ❌ 未在fullText中找到日期`);
      notFoundInFullText++;
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log('统计结果');
  console.log('='.repeat(70));
  console.log(`从fullText中找到日期: ${foundInFullText}`);
  console.log(`未在fullText中找到日期: ${notFoundInFullText}`);
}

async function main() {
  try {
    await checkFullTextDates();
  } catch (error) {
    console.error('检查失败:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
