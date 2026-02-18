/**
 * 修复剩余7条法条 - 简单版本
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const MISSING_DATE = new Date('1970-01-01T00:00:00Z');

function cnToNumber(cn) {
  const cnNums = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];
  const mapping = {};
  cnNums.forEach((v, i) => mapping[v] = i);

  const yearMatch = cn.match(/([一二三四五六七八九十]+)年/);
  if (yearMatch) {
    let year = 0;
    for (let char of yearMatch[1]) {
      if (char === '十') {
        year = year === 0 ? 10 : year * 10;
      } else {
        year = year * 10 + mapping[char];
      }
    }
    return year;
  }
  return null;
}

function extractAllDates(text) {
  if (!text) return [];
  const results = [];

  // 带空格的标准格式
  const spacedRegex = /(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/g;
  let match;
  while ((match = spacedRegex.exec(text)) !== null) {
    const year = parseInt(match[1], 10);
    const month = parseInt(match[2], 10);
    const day = parseInt(match[3], 10);
    const date = new Date(year, month - 1, day);
    if (!isNaN(date.getTime())) {
      results.push({ date, match: match[0] });
    }
  }

  // 中文数字格式
  const cnDateRegex = /([一二三四五六七八九十]+)年([一二三四五六七八九十]+)月([一二三四五六七八九十]+)日/g;
  while ((match = cnDateRegex.exec(text)) !== null) {
    const year = cnToNumber(match[1]);
    const month = cnToNumber(match[2]);
    const day = cnToNumber(match[3]);
    if (year && month && day) {
      const date = new Date(year, month - 1, day);
      if (!isNaN(date.getTime())) {
        results.push({ date, match: match[0] });
      }
    }
  }

  return results;
}

async function fix() {
  const articles = await prisma.lawArticle.findMany({
    where: { effectiveDate: MISSING_DATE },
    select: { id: true, lawName: true, fullText: true },
  });

  console.log(`找到 ${articles.length} 条需要修复\n`);

  for (const article of articles) {
    const dates = extractAllDates(article.fullText);
    if (dates.length > 0) {
      dates.sort((a, b) => a.date - b.date);
      const best = dates[0];

      await prisma.lawArticle.update({
        where: { id: article.id },
        data: { effectiveDate: best.date, updatedAt: new Date() },
      });

      console.log(`✅ ${article.lawName}: ${best.date.toISOString().split('T')[0]}`);
    } else {
      console.log(`❌ ${article.lawName}: 无法提取日期`);
    }
  }

  // 最终统计
  const missing = await prisma.lawArticle.count({
    where: { effectiveDate: MISSING_DATE },
  });
  const total = await prisma.lawArticle.count();
  console.log(`\n最终: ${missing}/${total} 缺失, 完整性: ${((total - missing) / total * 100).toFixed(2)}/100`);
}

fix().catch(console.error).finally(() => prisma.$disconnect());
