/**
 * 标记数据质量问题脚本
 *
 * 功能：
 * 1. 分析所有法律条文的内容长度
 * 2. 根据长度评估质量评分
 * 3. 标记可能存在的质量问题
 * 4. 生成数据质量报告
 *
 * 使用方法：
 * npx tsx scripts/mark-quality-issues.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface QualityStats {
  total: number;
  excellent: number; // >= 50 字符
  good: number; // 20-49 字符
  fair: number; // 10-19 字符
  poor: number; // 5-9 字符
  veryPoor: number; // < 5 字符
}

// 评估质量评分
function assessQualityScore(content: string): number {
  const length = content.length;

  if (length >= 50) return 100; // 优秀
  if (length >= 20) return 70; // 良好
  if (length >= 10) return 50; // 一般
  if (length >= 5) return 20; // 较差
  return 0; // 极差
}

// 识别质量问题
function identifyQualityIssues(content: string): string[] {
  const issues: string[] = [];
  const length = content.length;

  if (length < 5) {
    issues.push('极短内容');
    issues.push('可能采集错误');
  } else if (length < 10) {
    issues.push('内容过短');
    issues.push('可能不完整');
  } else if (length < 20) {
    issues.push('内容较短');
    issues.push('需要审核');
  } else if (length < 50) {
    issues.push('内容偏短');
  }

  // 检查是否只有条文号
  if (/^第[一二三四五六七八九十百千万\d]+条$/.test(content.trim())) {
    issues.push('只有条文号');
    issues.push('内容缺失');
  }

  // 检查是否只有开头
  if (content === '违反本条例' || content === '违反本法') {
    issues.push('内容被截断');
    issues.push('需要重新采集');
  }

  return issues;
}

async function main() {
  console.log('🔍 开始分析数据质量...\n');

  // 统计信息
  const stats: QualityStats = {
    total: 0,
    excellent: 0,
    good: 0,
    fair: 0,
    poor: 0,
    veryPoor: 0,
  };

  try {
    // 获取所有NPC数据源的条文
    console.log('📊 获取所有法律条文...');
    const articles = await prisma.lawArticle.findMany({
      where: {
        dataSource: 'npc',
      },
      select: {
        id: true,
        lawName: true,
        articleNumber: true,
        fullText: true,
      },
    });

    console.log(`✅ 找到 ${articles.length} 条法律条文\n`);
    stats.total = articles.length;

    // 批量更新
    console.log('🔄 开始标记质量问题...\n');

    let updateCount = 0;
    const batchSize = 100;

    for (let i = 0; i < articles.length; i += batchSize) {
      const batch = articles.slice(i, i + batchSize);

      // 批量更新
      await Promise.all(
        batch.map(async article => {
          const qualityScore = assessQualityScore(article.fullText);
          const qualityIssues = identifyQualityIssues(article.fullText);

          // 统计
          if (qualityScore === 100) stats.excellent++;
          else if (qualityScore === 70) stats.good++;
          else if (qualityScore === 50) stats.fair++;
          else if (qualityScore === 20) stats.poor++;
          else stats.veryPoor++;

          // 更新数据库
          return prisma.lawArticle.update({
            where: { id: article.id },
            data: {
              // 注意：这些字段需要先在schema中添加
              // qualityScore: qualityScore,
              // qualityIssues: qualityIssues,

              // 临时方案：使用keywords字段存储质量信息
              keywords: [
                `quality:${qualityScore}`,
                ...qualityIssues.map(issue => `issue:${issue}`),
              ],
            },
          });
        })
      );

      updateCount += batch.length;

      if ((i + batchSize) % 1000 === 0 || i + batchSize >= articles.length) {
        const progress = Math.min(
          100,
          Math.round((updateCount / articles.length) * 100)
        );
        console.log(
          `✅ 进度: ${updateCount}/${articles.length} (${progress}%)`
        );
      }
    }

    console.log('\n✨ 标记完成！\n');

    // 输出统计报告
    console.log('📊 数据质量统计报告');
    console.log('═══════════════════════════════════════\n');

    console.log(`总条文数：${stats.total.toLocaleString()} 条\n`);

    console.log('质量分布：');
    console.log(
      `  ✅ 优秀 (≥50字符)：${stats.excellent.toLocaleString()} 条 (${((stats.excellent / stats.total) * 100).toFixed(2)}%)`
    );
    console.log(
      `  🟢 良好 (20-49字符)：${stats.good.toLocaleString()} 条 (${((stats.good / stats.total) * 100).toFixed(2)}%)`
    );
    console.log(
      `  🟡 一般 (10-19字符)：${stats.fair.toLocaleString()} 条 (${((stats.fair / stats.total) * 100).toFixed(2)}%)`
    );
    console.log(
      `  🟠 较差 (5-9字符)：${stats.poor.toLocaleString()} 条 (${((stats.poor / stats.total) * 100).toFixed(2)}%)`
    );
    console.log(
      `  🔴 极差 (<5字符)：${stats.veryPoor.toLocaleString()} 条 (${((stats.veryPoor / stats.total) * 100).toFixed(2)}%)\n`
    );

    const problematic = stats.fair + stats.poor + stats.veryPoor;
    console.log(
      `⚠️  问题条文总数：${problematic.toLocaleString()} 条 (${((problematic / stats.total) * 100).toFixed(2)}%)`
    );
    console.log(
      `✅ 正常条文总数：${(stats.excellent + stats.good).toLocaleString()} 条 (${(((stats.excellent + stats.good) / stats.total) * 100).toFixed(2)}%)\n`
    );

    // 建议
    console.log('💡 建议：');
    if (stats.veryPoor > 0) {
      console.log(
        `  🔴 ${stats.veryPoor.toLocaleString()} 条极差质量的条文需要立即重新采集`
      );
    }
    if (stats.poor > 0) {
      console.log(
        `  🟠 ${stats.poor.toLocaleString()} 条较差质量的条文需要审核`
      );
    }
    if (stats.fair > 0) {
      console.log(
        `  🟡 ${stats.fair.toLocaleString()} 条一般质量的条文建议抽样检查`
      );
    }

    console.log('\n═══════════════════════════════════════\n');

    // 查找问题最严重的法律
    console.log('🔍 查找问题最严重的法律...\n');

    const problematicLaws = await prisma.$queryRaw<
      Array<{
        lawName: string;
        total: bigint;
        problematic: bigint;
        problemRate: number;
      }>
    >`
      SELECT
        "lawName",
        COUNT(*) as total,
        COUNT(CASE WHEN LENGTH("fullText") < 20 THEN 1 END) as problematic,
        ROUND(
          COUNT(CASE WHEN LENGTH("fullText") < 20 THEN 1 END)::numeric /
          COUNT(*)::numeric * 100,
          2
        ) as "problemRate"
      FROM "LawArticle"
      WHERE "dataSource" = 'npc'
      GROUP BY "lawName"
      HAVING COUNT(CASE WHEN LENGTH("fullText") < 20 THEN 1 END) > 0
      ORDER BY "problemRate" DESC, problematic DESC
      LIMIT 20
    `;

    console.log('问题最严重的20部法律：\n');
    console.log('排名 | 法律名称 | 总条文 | 问题条文 | 问题率');
    console.log('-----|---------|--------|----------|--------');

    problematicLaws.forEach((law, index) => {
      const total = Number(law.total);
      const problematic = Number(law.problematic);
      const rate = law.problemRate;

      console.log(
        `${(index + 1).toString().padStart(4)} | ` +
          `${law.lawName.substring(0, 30).padEnd(30)} | ` +
          `${total.toString().padStart(6)} | ` +
          `${problematic.toString().padStart(8)} | ` +
          `${rate.toFixed(2)}%`
      );
    });

    console.log('\n✅ 分析完成！');
    console.log('\n📄 详细报告请查看：docs/DATA_QUALITY_ANALYSIS_REPORT.md\n');
  } catch (error) {
    console.error('❌ 分析过程中发生错误:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
