/**
 * Layer 1 规则基础法条关系生成器（命令行版本）
 *
 * 规则 1 — SUPERSEDES / SUPERSEDED_BY
 *   同一部法律（lawName + articleNumber），按 effectiveDate 排序
 *   → 新版本条文 SUPERSEDES 旧版本，旧版本 SUPERSEDED_BY 新版本
 *   粒度：条文级（A法第5条新版 SUPERSEDES A法第5条旧版）
 *
 * 规则 2 — CITES / CITED_BY
 *   解析 fullText 中《法律名》第X条 / 本法第X条 格式
 *   → 条文级引用（A法第3条 CITES B法第7条）
 *
 * 用法：
 *   npx ts-node --transpile-only scripts/generate-relations-layer1.ts
 *   npx ts-node --transpile-only scripts/generate-relations-layer1.ts --incremental
 *   npx ts-node --transpile-only scripts/generate-relations-layer1.ts --rule=supersedes
 *   npx ts-node --transpile-only scripts/generate-relations-layer1.ts --rule=cites
 *   npx ts-node --transpile-only scripts/generate-relations-layer1.ts --dry-run
 */

import { PrismaClient, DiscoveryMethod } from '@prisma/client';
import {
  generateLayer1Relations,
  getLastGeneratedAt,
} from '../src/lib/knowledge-graph/relation-generator';

const prisma = new PrismaClient();

const args = process.argv.slice(2);
const INCREMENTAL = args.includes('--incremental');
const DRY_RUN = args.includes('--dry-run');
const RULE = args.find(a => a.startsWith('--rule='))?.split('=')[1] as
  | 'supersedes'
  | 'cites'
  | 'implements'
  | undefined;

function fmtMs(ms: number): string {
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60_000).toFixed(1)} 分钟`;
}

async function main() {
  console.log('='.repeat(56));
  console.log('Layer 1 规则基础法条关系生成器');
  console.log(
    `  模式: ${INCREMENTAL ? '增量' : '全量'} | 规则: ${RULE ?? '全部'} | ${DRY_RUN ? '[DRY RUN - 不写入]' : '实际写入'}`
  );
  console.log('='.repeat(56));

  // 统计现有关系
  const existingCount = await prisma.lawArticleRelation.count({
    where: { discoveryMethod: DiscoveryMethod.RULE_BASED },
  });
  const totalCount = await prisma.lawArticleRelation.count();
  console.log(
    `\n当前关系总数：${totalCount.toLocaleString()} 条（其中 RULE_BASED：${existingCount.toLocaleString()} 条）`
  );

  // 确定增量时间点
  let sinceDate: Date | undefined;
  if (INCREMENTAL) {
    const lastAt = await getLastGeneratedAt(prisma);
    sinceDate = lastAt ?? undefined;
    console.log(
      `增量模式：处理 ${sinceDate ? sinceDate.toISOString().slice(0, 16) : '（首次全量）'} 之后导入的法条`
    );
  } else if (!DRY_RUN && existingCount > 0) {
    console.log(
      `\n全量模式：将清除 ${existingCount.toLocaleString()} 条旧 RULE_BASED 关系并重新生成`
    );
  }

  if (DRY_RUN) {
    console.log('\n[DRY RUN] 仅统计预估数量，不实际写入数据库\n');
    // 简单统计：多版本组数 + 条文数
    const multiVersionCount = await prisma.$queryRaw<{ cnt: bigint }[]>`
      SELECT COUNT(*) as cnt FROM (
        SELECT "lawName", "articleNumber"
        FROM law_articles
        GROUP BY "lawName", "articleNumber"
        HAVING COUNT(*) > 1
      ) t
    `;
    const articleCount = await prisma.lawArticle.count();
    console.log(
      `  多版本法条组：${Number(multiVersionCount[0].cnt).toLocaleString()} 组`
    );
    console.log(
      `  预估 SUPERSEDES 关系：~${(Number(multiVersionCount[0].cnt) * 2).toLocaleString()} 条（实际取决于版本数）`
    );
    console.log(`  待解析法条：${articleCount.toLocaleString()} 条`);
    console.log(
      '\n运行真正的生成（去掉 --dry-run）:\n  npx ts-node --transpile-only scripts/generate-relations-layer1.ts\n'
    );
    return;
  }

  // 执行生成
  console.log('\n开始生成...');
  const stats = await generateLayer1Relations(prisma, {
    sinceDate,
    rule: RULE,
    clearExisting: !INCREMENTAL && !DRY_RUN,
  });

  // 汇总统计
  const finalCount = await prisma.lawArticleRelation.count();
  const byType = await prisma.$queryRaw<
    { relationType: string; cnt: bigint }[]
  >`
    SELECT "relationType", COUNT(*) as cnt
    FROM law_article_relations
    GROUP BY "relationType"
    ORDER BY cnt DESC
  `;

  console.log('\n' + '='.repeat(56));
  console.log(`完成！耗时 ${fmtMs(stats.durationMs)}`);
  console.log(
    `  版本链关系（SUPERSEDES）：${stats.supersedesCreated.toLocaleString()} 条`
  );
  console.log(
    `  引用关系（CITES）：        ${stats.citesCreated.toLocaleString()} 条`
  );
  console.log(
    `  实施关系（IMPLEMENTS）：   ${stats.implementsCreated.toLocaleString()} 条`
  );
  console.log(
    `  本次新增合计：             ${stats.totalCreated.toLocaleString()} 条`
  );
  console.log(`  数据库关系总数：           ${finalCount.toLocaleString()} 条`);
  console.log('\n关系类型分布：');
  byType.forEach(r =>
    console.log(
      `  ${r.relationType.padEnd(16)} ${Number(r.cnt).toLocaleString()}`
    )
  );
}

main()
  .catch(e => {
    console.error('\n失败：', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
