import { LawArticle, LawType, LawCategory, LawStatus } from '@prisma/client';
import {
  DocumentAnalysisOutput,
  ExtractedData,
} from '@/lib/agent/doc-analyzer/core/types';

/**
 * 测试数据工厂
 */

/**
 * 创建模拟案情分析结果
 */
export function createMockCaseInfo(
  overrides: Partial<DocumentAnalysisOutput> = {}
): DocumentAnalysisOutput {
  return {
    success: true,
    extractedData: createMockExtractedData(overrides.extractedData),
    confidence: 0.9,
    processingTime: 1000,
    metadata: {
      pages: 10,
      wordCount: 5000,
      analysisModel: 'glm-4-flash',
    },
  };
}

/**
 * 创建模拟提取数据
 */
export function createMockExtractedData(
  overrides: Partial<ExtractedData> = {}
): ExtractedData {
  return {
    parties: [
      {
        type: 'plaintiff',
        name: '张三',
        role: '原告',
      },
      {
        type: 'defendant',
        name: '李四',
        role: '被告',
      },
    ],
    claims: [
      {
        type: 'PAY_PRINCIPAL',
        content: '请求被告支付合同本金10万元',
        amount: 100000,
        currency: 'CNY',
      },
      {
        type: 'PAY_INTEREST',
        content: '请求被告支付利息',
        currency: 'CNY',
      },
    ],
    timeline: [
      {
        id: '1',
        date: '2024-01-01',
        event: '签订合同',
        importance: 5,
      },
    ],
    disputeFocuses: [
      {
        id: '1',
        category: 'CONTRACT_BREACH',
        description: '被告未按合同约定履行付款义务',
        positionA: '原告认为被告构成违约',
        positionB: '被告否认违约',
        coreIssue: '被告是否构成违约',
        importance: 10,
        confidence: 0.9,
        relatedClaims: [],
        relatedFacts: [],
      },
    ],
    keyFacts: [
      {
        id: '1',
        category: 'CONTRACT_TERM',
        description: '双方签订了买卖合同',
        details: '合同约定被告应于2024年6月30日前支付全部款项',
        importance: 10,
        confidence: 0.95,
        factType: 'EXPLICIT',
        relatedDisputes: [],
      },
      {
        id: '2',
        category: 'BREACH_BEHAVIOR',
        description: '被告未按时支付款项',
        details: '截止至起诉日，被告尚未支付任何款项',
        importance: 9,
        confidence: 0.9,
        factType: 'EXPLICIT',
        relatedDisputes: [],
      },
    ],
    caseType: 'civil',
    ...overrides,
  };
}

/**
 * 创建模拟法条
 */
export function createMockArticle(
  overrides: Partial<LawArticle> = {}
): LawArticle {
  return {
    id: 'test-article-1',
    lawName: '中华人民共和国民法典',
    articleNumber: '第五百七十七条',
    fullText:
      '当事人一方不履行合同义务或者履行合同义务不符合约定的，应当承担继续履行、采取补救措施或者赔偿损失等违约责任。',
    lawType: LawType.LAW,
    category: LawCategory.CIVIL,
    subCategory: '合同编',
    tags: ['违约责任', '合同'],
    keywords: ['违约', '赔偿', '合同'],
    version: '1.0',
    effectiveDate: new Date('2021-01-01'),
    expiryDate: null,
    status: LawStatus.VALID,
    amendmentHistory: null,
    parentId: null,
    chapterNumber: '第八章',
    sectionNumber: null,
    level: 0,
    issuingAuthority: '全国人民代表大会',
    jurisdiction: '全国',
    relatedArticles: [],
    legalBasis: '《中华人民共和国民法典》',
    searchableText:
      '当事人一方不履行合同义务或者履行合同义务不符合约定的，应当承担继续履行、采取补救措施或者赔偿损失等违约责任。',
    viewCount: 0,
    referenceCount: 0,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    dataSource: 'local',
    sourceId: null,
    importedAt: null,
    lastSyncedAt: null,
    syncStatus: 'SYNCED' as const,
    ...overrides,
  };
}

/**
 * 创建模拟不适用法条
 */
export function createMockNonApplicableArticle(
  overrides: Partial<LawArticle> = {}
): LawArticle {
  return {
    ...createMockArticle({
      id: 'test-article-criminal',
      lawName: '中华人民共和国刑法',
      articleNumber: '第一百二十条',
      fullText:
        '以暴力、威胁或者其他手段强迫他人劳动的，处三年以下有期徒刑或者拘役，并处罚金；情节严重的，处三年以上十年以下有期徒刑，并处罚金。',
      lawType: LawType.LAW,
      category: LawCategory.CRIMINAL,
      subCategory: '侵犯公民人身权利、民主权利罪',
      tags: ['强迫劳动', '刑法'],
      keywords: ['强迫', '劳动', '刑事'],
      ...overrides,
    }),
  };
}

/**
 * 创建模拟过期法条
 */
export function createMockExpiredArticle(
  overrides: Partial<LawArticle> = {}
): LawArticle {
  return {
    ...createMockArticle({
      id: 'test-article-expired',
      lawName: '已废止法规',
      articleNumber: '第一条',
      fullText: '这是一条已废止的法条内容。',
      status: LawStatus.REPEALED,
      expiryDate: new Date('2020-01-01'),
      ...overrides,
    }),
  };
}

/**
 * 创建模拟地方法规
 */
export function createMockLocalArticle(
  overrides: Partial<LawArticle> = {}
): LawArticle {
  return {
    ...createMockArticle({
      id: 'test-article-local',
      lawName: '某市地方性法规',
      articleNumber: '第一条',
      fullText: '这是地方性法规内容。',
      lawType: LawType.LOCAL_REGULATION,
      jurisdiction: '某市',
      ...overrides,
    }),
  };
}

/**
 * 批量创建模拟法条
 */
export function createMockArticles(count: number = 10): LawArticle[] {
  const articles: LawArticle[] = [];

  for (let i = 1; i <= count; i++) {
    articles.push(
      createMockArticle({
        id: `test-article-${i}`,
        articleNumber: `第五百七${i}条`,
      })
    );
  }

  return articles;
}

/**
 * 创建混合法条集合（适用和不适用混合）
 */
export function createMixedArticles(): LawArticle[] {
  return [
    createMockArticle({
      id: 'civil-1',
      articleNumber: '第五百七十七条',
      fullText:
        '当事人一方不履行合同义务或者履行合同义务不符合约定的，应当承担继续履行、采取补救措施或者赔偿损失等违约责任。',
    }),
    createMockArticle({
      id: 'civil-2',
      articleNumber: '第五百八十条',
      fullText:
        '当事人一方不履行非金钱债务或者履行非金钱债务不符合约定的，对方可以请求履行，但是有下列情形之一的除外...',
    }),
    createMockArticle({
      id: 'criminal-1',
      articleNumber: '第一百二十条',
      lawName: '中华人民共和国刑法',
      fullText: '以暴力、威胁或者其他手段强迫他人劳动的...',
      category: LawCategory.CRIMINAL,
    }),
    createMockArticle({
      id: 'expired-1',
      status: LawStatus.REPEALED,
      expiryDate: new Date('2020-01-01'),
    }),
    createMockArticle({
      id: 'local-1',
      lawName: '某市地方性法规',
      lawType: LawType.LOCAL_REGULATION,
    }),
  ];
}
