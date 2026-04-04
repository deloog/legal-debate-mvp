/**
 * 知识检索服务
 * 根据用户消息和案情晶体，检索相关法条与指导案例，注入 AI 上下文
 */

import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

// ── 法律领域关键词映射 ──────────────────────────────────────────────────────
// 将案情晶体中的案件类型映射到数据库中对应的法律关键词，提升检索精准度

const DOMAIN_LAW_MAP: Record<string, string[]> = {
  劳动争议: ['劳动合同', '劳动关系', '工资', '解除', '赔偿金', '劳动者'],
  合同纠纷: ['合同', '违约', '履行', '解除', '损害赔偿'],
  婚姻家事: ['婚姻', '离婚', '抚养', '财产分割', '继承'],
  刑事: ['刑法', '犯罪', '量刑', '辩护', '无罪'],
  侵权责任: ['侵权', '损害', '赔偿', '过错', '责任'],
  房产纠纷: ['房屋', '土地', '买卖', '租赁', '产权'],
  公司商事: ['公司', '股东', '董事', '合并', '破产'],
  知识产权: ['著作权', '专利', '商标', '侵权', '许可'],
};

export interface RetrievedLawArticle {
  lawName: string;
  articleNumber: string;
  fullText: string;
}

export interface RetrievedGuidingCase {
  caseNo: number;
  title: string;
  holdingPoints: string;
  category: string | null;
}

export interface KnowledgeContext {
  lawArticles: RetrievedLawArticle[];
  guidingCases: RetrievedGuidingCase[];
}

// ── 从用户消息和晶体提取检索关键词 ────────────────────────────────────────

function extractSearchTerms(
  userMessage: string,
  caseType: string | null
): string[] {
  const terms: string[] = [];

  // 1. 从案件类型推断领域关键词
  if (caseType) {
    for (const [domain, keywords] of Object.entries(DOMAIN_LAW_MAP)) {
      if (caseType.includes(domain)) {
        terms.push(...keywords.slice(0, 3));
        break;
      }
    }
  }

  // 2. 从用户消息提取法律实体（法律名称 + 关键动词）
  const lawNamePattern =
    /(?:《([^》]+)》|依据([^，。,.\s]{2,15}(?:法|条例|规定|办法)))/g;
  let match: RegExpExecArray | null;
  while ((match = lawNamePattern.exec(userMessage)) !== null) {
    const term = match[1] ?? match[2];
    if (term) terms.push(term);
  }

  // 3. 高权重法律动词（直接匹配法条内容）
  const legalVerbs = [
    '违法解除',
    '经济补偿',
    '赔偿金',
    '举证责任',
    '诉讼时效',
    '连带责任',
    '不当得利',
    '合同无效',
    '撤销权',
    '优先权',
    '抵押',
    '质押',
  ];
  for (const verb of legalVerbs) {
    if (userMessage.includes(verb)) terms.push(verb);
  }

  // 去重，最多 5 个词
  return [...new Set(terms)].slice(0, 5);
}

// ── 检索相关法条（最多 3 条） ───────────────────────────────────────────────

async function retrieveLawArticles(
  terms: string[],
  caseType: string | null
): Promise<RetrievedLawArticle[]> {
  if (terms.length === 0) return [];

  try {
    const priorityLaws = getPriorityLaws(caseType);
    const conditions = terms.flatMap(term => [
      { fullText: { contains: term } },
      { lawName: { contains: term } },
    ]);

    // 两阶段：先在核心法律中检索，不足时再扩大范围
    const priority = await prisma.lawArticle.findMany({
      where: {
        status: 'VALID',
        AND: [
          { OR: conditions },
          { OR: priorityLaws.map(law => ({ lawName: { contains: law } })) },
        ],
      },
      select: {
        lawName: true,
        articleNumber: true,
        fullText: true,
        referenceCount: true,
      },
      orderBy: { referenceCount: 'desc' },
      take: 10,
    });

    let pool = deduplicateByLaw(priority);

    // 核心法律不足 3 条时，补充其他法律
    if (pool.length < 3) {
      const excludeNames = pool.map(p => p.lawName);
      const supplement = await prisma.lawArticle.findMany({
        where: {
          status: 'VALID',
          OR: conditions,
          // 排除已找到的法律（pool 为空时不加 NOT 约束）
          ...(excludeNames.length > 0
            ? { NOT: excludeNames.map(name => ({ lawName: name })) }
            : {}),
        },
        select: {
          lawName: true,
          articleNumber: true,
          fullText: true,
          referenceCount: true,
        },
        orderBy: { referenceCount: 'desc' },
        take: 10,
      });
      pool = [...pool, ...deduplicateByLaw(supplement)];
    }

    return pool.slice(0, 3).map(a => ({
      lawName: a.lawName,
      articleNumber: a.articleNumber,
      fullText:
        a.fullText.length > 300 ? a.fullText.slice(0, 300) + '…' : a.fullText,
    }));
  } catch (err) {
    logger.warn('法条检索失败', { terms, err });
    return [];
  }
}

// ── 检索相关指导案例（最多 2 条） ──────────────────────────────────────────

async function retrieveGuidingCases(
  terms: string[],
  caseType: string | null
): Promise<RetrievedGuidingCase[]> {
  if (terms.length === 0) return [];

  try {
    const conditions = terms.flatMap(term => [
      { title: { contains: term } },
      { holdingPoints: { contains: term } },
      { basicFacts: { contains: term } },
      ...(caseType ? [{ category: { contains: caseType.slice(0, 4) } }] : []),
    ]);

    const results = await prisma.guidingCase.findMany({
      where: { OR: conditions },
      select: {
        caseNo: true,
        title: true,
        holdingPoints: true,
        category: true,
      },
      orderBy: { caseNo: 'asc' },
      take: 2,
    });

    return results.map(c => ({
      caseNo: c.caseNo,
      title: c.title,
      holdingPoints:
        c.holdingPoints.length > 200
          ? c.holdingPoints.slice(0, 200) + '…'
          : c.holdingPoints,
      category: c.category,
    }));
  } catch (err) {
    logger.warn('指导案例检索失败', { terms, err });
    return [];
  }
}

// ── 主入口 ──────────────────────────────────────────────────────────────────

export async function retrieveKnowledge(
  userMessage: string,
  caseType: string | null
): Promise<KnowledgeContext> {
  const terms = extractSearchTerms(userMessage, caseType);
  if (terms.length === 0) {
    return { lawArticles: [], guidingCases: [] };
  }

  const [lawArticles, guidingCases] = await Promise.all([
    retrieveLawArticles(terms, caseType),
    retrieveGuidingCases(terms, caseType),
  ]);

  logger.info('知识检索完成', {
    terms,
    lawCount: lawArticles.length,
    caseCount: guidingCases.length,
  });

  return { lawArticles, guidingCases };
}

// ── 格式化为 AI 可读的上下文文本 ───────────────────────────────────────────

export function formatKnowledgeForContext(ctx: KnowledgeContext): string {
  if (ctx.lawArticles.length === 0 && ctx.guidingCases.length === 0) {
    return '';
  }

  const lines: string[] = ['【相关法律知识库】'];

  if (ctx.lawArticles.length > 0) {
    lines.push('\n▌ 相关法条');
    for (const art of ctx.lawArticles) {
      lines.push(`《${art.lawName}》${art.articleNumber}：${art.fullText}`);
    }
  }

  if (ctx.guidingCases.length > 0) {
    lines.push('\n▌ 最高法指导案例');
    for (const c of ctx.guidingCases) {
      lines.push(
        `指导案例第${c.caseNo}号《${c.title}》\n裁判要点：${c.holdingPoints}`
      );
    }
  }

  lines.push('\n（以上法律资料由律伴知识库提供，请结合具体案情判断适用性）');

  return lines.join('\n');
}

// ── 工具函数 ────────────────────────────────────────────────────────────────

function getPriorityLaws(caseType: string | null): string[] {
  if (!caseType) return ['民法典', '合同法'];
  if (caseType.includes('劳动')) return ['劳动合同法', '劳动法', '劳动争议'];
  if (caseType.includes('合同')) return ['民法典', '合同法'];
  if (caseType.includes('婚姻')) return ['婚姻法', '民法典'];
  if (caseType.includes('刑')) return ['刑法', '刑事诉讼法'];
  if (caseType.includes('侵权')) return ['民法典', '侵权责任法'];
  if (caseType.includes('房')) return ['民法典', '物权法', '城市房地产'];
  if (caseType.includes('公司')) return ['公司法', '证券法'];
  return ['民法典'];
}

function deduplicateByLaw(
  articles: {
    lawName: string;
    articleNumber: string;
    fullText: string;
    referenceCount: number;
  }[]
): {
  lawName: string;
  articleNumber: string;
  fullText: string;
  referenceCount: number;
}[] {
  // 每部法律最多取 1 条，保证覆盖面广
  const seen = new Set<string>();
  return articles.filter(a => {
    if (seen.has(a.lawName)) return false;
    seen.add(a.lawName);
    return true;
  });
}
