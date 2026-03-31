/**
 * 共享法条检索工具
 * 被 /generate 和 /stream 路由共同使用
 */

import { prisma } from '@/lib/db/prisma';
import { LawCategory, LawStatus } from '@prisma/client';
import { logger } from '@/lib/logger';
import { extractKeywordsWithAI } from './ai-keyword-extractor';

// =============================================================================
// 案件类型 → 法条分类映射（保留用于未来 category 数据修复后）
// =============================================================================

export const CASE_TYPE_TO_LAW_CATEGORIES: Record<string, LawCategory[]> = {
  CIVIL: [LawCategory.CIVIL, LawCategory.PROCEDURE],
  CRIMINAL: [LawCategory.CRIMINAL, LawCategory.PROCEDURE],
  ADMINISTRATIVE: [LawCategory.ADMINISTRATIVE, LawCategory.PROCEDURE],
  COMMERCIAL: [LawCategory.COMMERCIAL, LawCategory.CIVIL],
  LABOR: [LawCategory.LABOR, LawCategory.CIVIL],
  INTELLECTUAL_PROPERTY: [LawCategory.INTELLECTUAL_PROPERTY, LawCategory.CIVIL],
};

export type LocalArticle = {
  id?: string; // real DB UUID
  lawName: string;
  articleNumber: string;
  fullText: string;
  category: LawCategory;
};

// =============================================================================
// 案件大类兜底关键词（仅在未识别到具体纠纷类型时使用）
// 注意：故意不包含子领域词（继承、婚姻、物权），避免跨子领域噪声
// =============================================================================

const CASE_TYPE_FALLBACK_KEYWORDS: Record<string, string[]> = {
  CIVIL: ['民法典', '合同', '违约', '债权', '债务', '损害赔偿'],
  CRIMINAL: [
    '刑法',
    '刑事诉讼',
    '犯罪',
    '刑罚',
    '量刑',
    '无罪',
    '证据',
    '侦查',
    '公诉',
  ],
  ADMINISTRATIVE: [
    '行政法',
    '行政诉讼',
    '行政处罚',
    '行政许可',
    '行政复议',
    '国家赔偿',
  ],
  COMMERCIAL: [
    '公司法',
    '合同法',
    '商法',
    '票据',
    '证券',
    '破产',
    '担保',
    '融资',
  ],
  LABOR: [
    '劳动法',
    '劳动合同',
    '劳动争议',
    '工资',
    '社会保险',
    '劳动保护',
    '解除劳动',
  ],
  INTELLECTUAL_PROPERTY: [
    '知识产权',
    '著作权',
    '专利',
    '商标',
    '著作权法',
    '专利法',
  ],
};

// =============================================================================
// 纠纷类型专属关键词
// 当从案件标题/描述中识别到具体纠纷类型时，使用这组精准词替代大类兜底词
// 每个纠纷类型词直接映射到该子领域的核心法律术语，大幅减少跨领域噪声
// =============================================================================

const DISPUTE_SPECIFIC_KEYWORDS: Record<string, string[]> = {
  民间借贷: [
    '民间借贷',
    '借款合同',
    '借款人',
    '出借人',
    '利息',
    '还款',
    '逾期利息',
    '高利贷',
  ],
  借贷: ['借款合同', '借款人', '出借人', '利息', '还款', '债权凭证'],
  借款: ['借款合同', '借款人', '出借人', '利息', '还款', '逾期利息'],
  贷款: ['借款合同', '贷款', '利息', '还款', '金融机构', '借贷'],
  合同: ['合同', '违约', '履行', '解除合同', '损害赔偿', '违约金', '合同责任'],
  侵权: ['侵权责任', '损害赔偿', '侵权行为', '赔偿责任', '人身损害'],
  离婚: ['离婚', '婚姻', '夫妻财产', '子女抚养', '婚姻家庭', '离婚协议'],
  继承: ['继承', '遗产', '遗嘱', '法定继承', '遗赠', '继承人', '遗产分配'],
  劳动: ['劳动合同', '劳动争议', '工资', '解除劳动合同', '劳动保护', '劳动者'],
  工伤: ['工伤', '工伤保险', '劳动能力鉴定', '工伤认定', '工伤赔偿', '职业病'],
  赔偿: ['损害赔偿', '赔偿责任', '人身损害赔偿', '精神损害', '侵权赔偿'],
  买卖: ['买卖合同', '出卖人', '买受人', '所有权转移', '标的物', '货物'],
  租赁: ['租赁合同', '租金', '承租人', '出租人', '房屋租赁', '租期'],
  知识产权: ['知识产权', '著作权', '专利权', '商标权', '侵权赔偿', '许可使用'],
  著作权: ['著作权', '著作权法', '版权', '作品', '著作权侵权', '许可使用'],
  专利: ['专利权', '专利法', '发明专利', '实用新型', '专利侵权', '专利许可'],
  商标: ['商标权', '商标法', '注册商标', '商标侵权', '商标使用'],
  股权: ['股权', '股东权利', '公司法', '股权转让', '股东会', '出资'],
  债权: ['债权', '债务', '债权人', '债务人', '债权转让', '债务清偿'],
  违约: ['违约责任', '违约金', '合同违约', '损害赔偿', '继续履行'],
  担保: ['担保合同', '保证', '抵押权', '质权', '担保责任', '担保物权'],
  抵押: ['抵押权', '抵押合同', '抵押物', '担保物权', '不动产抵押'],
  房产: ['房屋', '不动产', '产权证', '房屋买卖', '房屋所有权', '物业'],
  土地: [
    '土地使用权',
    '土地承包',
    '土地征收',
    '国有土地',
    '农村土地',
    '土地管理',
  ],
  劳资: ['劳动合同', '工资', '劳动报酬', '劳动争议', '欠薪', '拖欠工资'],
  欠款: ['债务', '欠款', '还款义务', '债权债务', '借款合同', '催收'],
  信用卡: ['信用卡', '银行卡', '透支', '还款义务', '金融债务', '银行'],
  保险: ['保险合同', '保险责任', '理赔', '保险人', '被保险人', '保险利益'],
  医疗: [
    '医疗损害',
    '医疗事故',
    '医疗责任',
    '患者权利',
    '医疗纠纷',
    '侵权责任',
  ],
  交通事故: [
    '交通事故',
    '机动车',
    '道路交通安全',
    '交通责任',
    '人身损害赔偿',
    '保险赔偿',
  ],
};

// 纠纷类型优先级：高优先级词命中时，跳过同组低优先级词，避免"合同"把劳动合同法、商业银行法全拉进来
// 优先级 1（最精确）：复合具体纠纷类型
// 优先级 2（具体）：单一领域纠纷类型
// 优先级 3（泛化）：高频法律术语，仅在无高优先级匹配时使用
const DISPUTE_PRIORITY: Record<string, number> = {
  民间借贷: 1,
  交通事故: 1,
  知识产权: 1,
  著作权: 1,
  专利: 1,
  商标: 1,
  信用卡: 1,
  劳资: 1,
  借贷: 2,
  借款: 2,
  贷款: 2,
  离婚: 2,
  继承: 2,
  工伤: 2,
  买卖: 2,
  租赁: 2,
  股权: 2,
  担保: 2,
  抵押: 2,
  房产: 2,
  土地: 2,
  欠款: 2,
  保险: 2,
  医疗: 2,
  劳动: 2,
  // 以下为优先级3——宽泛词，仅在无具体纠纷词时生效
  合同: 3,
  侵权: 3,
  赔偿: 3,
  债权: 3,
  违约: 3,
};

// 纠纷类型识别正则（顺序重要：长词优先匹配避免子串干扰）
const DISPUTE_TYPE_KEYWORDS_RE =
  /民间借贷|交通事故|知识产权|著作权|专利|商标|信用卡|劳资|借贷|借款|贷款|合同|侵权|离婚|继承|劳动|工伤|赔偿|买卖|租赁|股权|债权|违约|担保|抵押|房产|土地|欠款|保险|医疗/g;

// 全国性重要法律名称特征（优先级高于地方性法规）
const NATIONAL_LAW_PATTERNS = [
  '中华人民共和国',
  '最高人民法院',
  '最高人民检察院',
  '国务院',
  '全国人民代表大会',
];

// 地方性法规特征（权重降低）
const LOCAL_LAW_RE = /省|市|自治区|特别行政区|县|镇|乡/;

// 与民事/刑事/劳动纠纷辩论无关的法律领域（税务、海关、外汇、财政等）
// 这类法律可能因为内容中出现"合同""借款"等词而被误召回，需降分排除
const IRRELEVANT_DOMAIN_RE =
  /税法|税务|印花税|增值税|所得税|关税|海关|外汇|财政|审计|会计准则|统计法|保密法|档案法|邮政法/;

// 刑事专项司法解释关键词（如"信用卡刑事案件"）
// 对民事案件类型时降分，避免刑事专项解释混入民事辩论推荐
const CRIMINAL_SPECIFIC_RE = /刑事案件|刑事犯罪|刑事责任|犯罪嫌疑|量刑标准/;

/**
 * 从案件文本中提取法律领域有效关键词
 *
 * 策略（优先级从高到低）：
 *   1. 识别具体纠纷类型 → 使用纠纷专属关键词（精准，避免跨子领域噪声）
 *   2. 未识别到具体纠纷 → 使用案件大类兜底关键词
 *   3. 从文本中直接提取2-6字有意义词（补充）
 */
function extractLegalKeywords(caseType: string | null, text: string): string[] {
  const keywords = new Set<string>();

  // 1. 识别具体纠纷类型，按优先级过滤：有高优先级词时跳过低优先级泛化词
  const disputeMatches = [
    ...new Set(text.match(DISPUTE_TYPE_KEYWORDS_RE) ?? []),
  ];
  const minPriority = disputeMatches.reduce(
    (min, m) => Math.min(min, DISPUTE_PRIORITY[m] ?? 3),
    3
  );
  // 只处理优先级 <= min(已命中词优先级) + 0 的词
  // 即：有精确词(1级)时跳过泛化词(3级)；有具体词(2级)时也跳过泛化词(3级)
  const effectiveThreshold = minPriority <= 2 ? 2 : 3;
  for (const match of disputeMatches) {
    const priority = DISPUTE_PRIORITY[match] ?? 3;
    if (priority > effectiveThreshold) continue; // 跳过优先级太低的泛化词
    const specific = DISPUTE_SPECIFIC_KEYWORDS[match];
    if (specific) {
      specific.forEach(k => keywords.add(k));
    } else {
      keywords.add(match);
    }
  }

  // 2. 仅在未识别到任何具体纠纷类型时，才使用大类兜底词
  if (disputeMatches.length === 0 && caseType) {
    const fallback = CASE_TYPE_FALLBACK_KEYWORDS[caseType] ?? [];
    fallback.forEach(k => keywords.add(k));
  }

  // 3. 从文本中补充提取有意义的词（辅助扩展，跳过噪声）
  const NOISE_RE =
    /^(的|了|在|是|有|和|与|及|或|但|而|也|都|由|对|向|为|因|如|等|案|诉|被|原|告|被告|纠纷|案件)$/;
  const cleanedText = text.replace(/[，。、！？；：""''【】（）《》\s]/g, ' ');
  cleanedText
    .split(/\s+/)
    .filter(w => w.length >= 2 && w.length <= 6 && !NOISE_RE.test(w))
    .slice(0, 10)
    .forEach(w => keywords.add(w));

  return [...keywords].slice(0, 20);
}

/**
 * 计算法条与检索词的相关性得分
 * 综合考虑：关键词命中数、法律重要性、是否地方性法规
 */
function scoreArticle(
  lawName: string,
  searchableText: string,
  keywords: string[]
): number {
  let score = 0;
  const combinedText = lawName + ' ' + searchableText;

  for (const kw of keywords) {
    if (combinedText.includes(kw)) {
      // 法律名称中命中权重更高（4分 vs 2分）
      score += lawName.includes(kw) ? 4 : 2;
    }
  }

  // 全国性重要法律加分
  for (const pattern of NATIONAL_LAW_PATTERNS) {
    if (lawName.includes(pattern)) {
      score += 3;
      break;
    }
  }

  // 地方性法规降分
  if (LOCAL_LAW_RE.test(lawName)) {
    score -= 3;
  }

  // 无关领域法律降分（税务、海关、财政等因内容含"合同""借款"词被误召回）
  if (IRRELEVANT_DOMAIN_RE.test(lawName)) {
    score -= 8;
  }

  // 刑事专项解释在民事案件中降分
  if (CRIMINAL_SPECIFIC_RE.test(lawName)) {
    score -= 6;
  }

  return score;
}

/**
 * scoreArticle 的案件类型感知版本
 * 当案件类型明确为民事时，对刑事专项解释额外降分
 */
function scoreArticleWithContext(
  lawName: string,
  searchableText: string,
  keywords: string[],
  caseType: string | null
): number {
  let score = scoreArticle(lawName, searchableText, keywords);

  // 民事案件中刑事专项解释降分
  if (caseType === 'CIVIL' && CRIMINAL_SPECIFIC_RE.test(lawName)) {
    score -= 4;
  }

  return score;
}

// =============================================================================
// 本地 DB 检索
// =============================================================================

/**
 * 从本地数据库检索与案件相关的法律条文
 *
 * 检索策略：
 * 1. 纠纷类型专属关键词优先（识别到具体纠纷时），避免大类词引入跨子领域噪声
 * 2. 双路并行查询：按内容（searchableText）+ 按法律名称（lawName）
 *    — 名称查询确保「最高人民法院关于审理民间借贷案件...」等司法解释不被遗漏
 * 3. 多候选精排：按关键词命中数 + 国家级法律加权打分
 * 4. 每部法律最多保留 2 条（避免同一法律条款占满结果）
 */
export async function searchLocalLawArticles(
  caseType: string | null,
  keywords: string,
  limit = 6,
  aiKeywords: string[] = []
): Promise<LocalArticle[]> {
  const staticKeywords = extractLegalKeywords(caseType, keywords);

  // 合并 AI 关键词（去重，AI词优先放前面以提升精度）
  const merged = new Set<string>([...aiKeywords, ...staticKeywords]);
  const legalKeywords = [...merged].slice(0, 20);

  if (legalKeywords.length === 0) {
    logger.warn('[law-search] 无有效法律关键词，跳过本地检索');
    return [];
  }

  logger.info(`[law-search] 提取关键词：[${legalKeywords.join(', ')}]`);

  const validStatuses = [LawStatus.VALID, LawStatus.AMENDED];

  try {
    // 双路并行查询
    const contentQueries = legalKeywords.map(kw =>
      prisma.lawArticle.findMany({
        where: {
          status: { in: validStatuses },
          searchableText: { contains: kw },
          fullText: { not: '' }, // 过滤空内容
        },
        select: {
          id: true,
          lawName: true,
          articleNumber: true,
          fullText: true,
          category: true,
          searchableText: true,
        },
        take: 8,
      })
    );
    const nameQueries = legalKeywords.map(kw =>
      prisma.lawArticle.findMany({
        where: {
          status: { in: validStatuses },
          lawName: { contains: kw },
          fullText: { not: '' }, // 过滤空内容
        },
        select: {
          id: true,
          lawName: true,
          articleNumber: true,
          fullText: true,
          category: true,
          searchableText: true,
        },
        take: 5,
      })
    );
    const allBatches = await Promise.all([...contentQueries, ...nameQueries]);

    // 去重合并
    const seen = new Set<string>();
    const candidates: (typeof allBatches)[0] = [];
    for (const batch of allBatches) {
      for (const article of batch) {
        const key = `${article.lawName}|${article.articleNumber}`;
        if (!seen.has(key)) {
          seen.add(key);
          candidates.push(article);
        }
      }
    }

    if (candidates.length === 0) return [];

    // 打分 + 排序（同时过滤内容过短的垃圾数据）
    const scored = candidates
      .map(a => ({
        article: a,
        score: scoreArticleWithContext(
          a.lawName,
          a.searchableText ?? '',
          legalKeywords,
          caseType
        ),
      }))
      .filter(
        s => s.score > 0 && s.article.fullText.replace(/\s/g, '').length >= 15
      )
      .sort((a, b) => b.score - a.score);

    // 每部法律最多保留 2 条
    const lawCount: Record<string, number> = {};
    const results: LocalArticle[] = [];
    for (const { article } of scored) {
      const count = lawCount[article.lawName] ?? 0;
      if (count >= 2) continue;
      lawCount[article.lawName] = count + 1;
      results.push({
        id: article.id,
        lawName: article.lawName,
        articleNumber: article.articleNumber,
        fullText: article.fullText,
        category: article.category,
      });
      if (results.length >= limit) break;
    }

    logger.info(
      `[law-search] 候选 ${candidates.length} 条 → 精排后 ${results.length} 条（前3：${results
        .slice(0, 3)
        .map(r => r.lawName.slice(0, 15))
        .join(' / ')}）`
    );
    return results;
  } catch (err) {
    logger.error('本地法条检索失败:', err);
    return [];
  }
}

// =============================================================================
// 合并检索入口
// =============================================================================

/**
 * 执行完整的法条检索流程（仅本地数据库）
 */
export async function searchAllLawArticles(
  caseType: string | null,
  caseTitle: string,
  caseDescription: string | null,
  localLimit = 6,
  _lawstarLimit = 4
): Promise<{
  articles: LocalArticle[];
  localCount: number;
  lawstarCount: number;
}> {
  // 阶段1：AI关键词提取（15s 兜底，AI客户端自身设10s超时，失败自动降级到静态规则）
  const aiKeywords = await Promise.race([
    extractKeywordsWithAI(caseType, caseTitle, caseDescription),
    new Promise<string[]>(resolve => setTimeout(() => resolve([]), 15000)),
  ]);

  if (aiKeywords.length > 0) {
    logger.info(
      `[law-search] AI关键词提取成功（${aiKeywords.length}个），与静态规则合并`
    );
  } else {
    logger.info('[law-search] AI关键词提取未返回结果，使用静态规则');
  }

  const articles = await searchLocalLawArticles(
    caseType,
    [caseTitle, caseDescription ?? ''].join(' '),
    localLimit,
    aiKeywords
  );

  logger.info(`[law-search] 本地DB检索到 ${articles.length} 条相关法条`);

  return {
    articles,
    localCount: articles.length,
    lawstarCount: 0,
  };
}
