/**
 * 修复剩余7条法条 - 处理特殊日期格式
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// 缺失日期的默认值
const MISSING_DATE = new Date('1970-01-01T00:00:00Z');

/**
 * 中文数字转阿拉伯数字
 */
function cnToNumber(cn) {
  const cnNums = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];
  const mapping = {};
  cnNums.forEach((v, i) => mapping[v] = i);

  // 处理 "一九八六" 格式
  if (/^[一二三四五六七八九十]+$/.test(cn)) {
    let result = 0;
    for (let char of cn) {
      if (char === '十') {
        result = result === 0 ? 10 : result * 10;
      } else {
        result = result * 10 + mapping[char];
      }
    }
    return result;
  }

  // 处理 "一九八六年" 格式中的年份
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

/**
 * 从文本中提取日期 - 增强版
 */
function extractAllDates(text) {
  if (!text) return [];

  const results = [];

  // 1. 先清理空格和特殊字符
  const cleanedText = text
    .replace(/\s+/g, '')  // 移除所有空格
    .replace(/[　]/g, ''); // 移除全角空格

  // 2. 标准格式: 2023年1月15日
  const standardRegex = /(\d{4})年(\d{1,2})月(\d{1,2})日/g;
  let match;
  while ((match = standardRegex.exec(text)) !== null) {
    const year = parseInt(match[1], 10);
    const month = parseInt(match[2], 10);
    const day = parseInt(match[3], 10);
    const date = new Date(year, month - 1, day);
    if (!isNaN(date.getTime())) {
      results.push({ date, match: match[0], type: '标准' });
    }
  }

  // 3. 中文数字格式: 一九八六年七月十二日
  const cnDateRegex = /([一二三四五六七八九十]+)年([一二三四五六七八九十]+)月([一二三四五六七八九十]+)日/g;
  while ((match = cnDateRegex.exec(text)) !== null) {
    const year = cnToNumber(match[1]);
    const month = cnToNumber(match[2]);
    const day = cnToNumber(match[3]);

    if (year && month && day) {
      const date = new Date(year, month - 1, day);
      if (!isNaN(date.getTime())) {
        results.push({ date, match: match[0], type: '中文数字' });
      }
    }
  }

  // 4. 带空格的标准格式: 2003 年8 月15 日
  const spacedRegex = /(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/g;
  while ((match = spacedRegex.exec(text)) !== null) {
    const year = parseInt(match[1], 10);
    const month = parseInt(match[2], 10);
    const day = parseInt(match[3], 10);
    const date = new Date(year, month - 1, day);
    if (!isNaN(date.getTime())) {
      results.push({ date, match: match[0], type: '带空格' });
    }
  }

  return results;
}

/**
 * 获取最佳有效日期
 */
function getBestEffectiveDate(text) {
  const dates = extractAllDates(text);
  if (dates.length === 0) return null;

  // 按日期排序，选择最早的日期
  dates.sort((a, b) => a.date - b.date);

  return dates[0];
}

async function fixRemaining() {
  console.log('='.repeat(70));
  console.log('修复剩余7条法条');
  console.log('='.repeat(70) + '\n');

  const stats = {
    success: 0,
    failed: 0,
    errors: [],
  };

  // 获取所有仍然缺失有效日期的法条
  const failedArticles = await prisma.lawArticle.findMany({
    where: {
      effectiveDate: MISSING_DATE,
    },
    select: {
      id: true,
      lawName: true,
      fullText: true,
      sourceId: true,
    },
  });

  console.log(`找到 ${failedArticles.length} 条需要修复的法条\n`);

  for (const article of failedArticles) {
    console(`🔄 ${article.lawName}`);

    // 显示找到的日期
    const dates = extractAllDates(article.fullText);
    if (dates.length > 0) {
      console.log(`   找到 ${dates.length} 个日期:`);
      dates.forEach(d => {
        console.log(`   - ${d.date.toISOString().split('T')[0]} (${d.match}, ${d.type})`);
      });
    }

    const dateResult = getBestEffectiveDate(article.fullText);

    if (dateResult) {
      // 更新数据库
      await prisma.lawArticle.update({
        where: { id: article.id },
        data: {
          effectiveDate: dateResult.date,
          updatedAt: new Date(),
        },
      });

      stats.success++;
      console.log(`   ✅ 修复成功: ${dateResult.date.toISOString().split('T')[0]}\n`);
    } else {
      stats.failed++;
      stats.errors.push(article.lawName);
      console.log(`   ❌ 无法提取日期\n`);
    }
  }

  // 输出结果
  console.log('='.repeat(70));
  console.log('修复结果');
  console.log('='.repeat(70));
  console.log(`成功: ${stats.success}`);
  console.log(`失败: ${stats.failed}`);

  if (stats.errors.length > 0) {
    console.log(`\n失败的法条:`);
    stats.errors.forEach(name => console.log(`  - ${name}`));
  }

  // 验证最终结果
  const missingAfter = await prisma.lawArticle.count({
    where: {
      effectiveDate: MISSING_DATE,
    },
  });

  const total = await prisma.lawArticle.count();
  const completeness = ((total - missingAfter) / total) * 100;

  console.log(`\n📊 最终统计:`);
  console.log(`   总法条: ${total}`);
  console.log(`   缺失有效日期: ${missingAfter}`);
  console.log(`   完整性评分: ${completeness.toFixed(2)}/100`);

  if (missingAfter === 0) {
    console.log(`\n🎉 修复完成！所有法条都有有效日期！`);
  }
}

async function main() {
  try {
    await fixRemaining();
  } catch (error) {
    console.error('修复失败:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
