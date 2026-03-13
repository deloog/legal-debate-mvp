/**
 * 合同模板采集器测试用例
 */

import * as fs from 'fs';
import * as path from 'path';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';

// Mock Playwright to avoid ESM issues in Jest
jest.mock('@playwright/test', () => ({
  chromium: {
    launch: jest.fn(),
  },
  Browser: class MockBrowser {},
  BrowserContext: class MockContext {},
  Page: class MockPage {},
}));

import {
  SAMRCrawler,
  SAMR_CONFIG,
  CONTRACT_CATEGORIES,
  KNOWN_CONTRACT_TEMPLATES,
} from '@/lib/crawler/samr-crawler';

describe('SAMRCrawler', () => {
  let crawler: SAMRCrawler;
  const testOutputDir = path.resolve('data/crawled/samr-test');

  beforeAll(() => {
    crawler = new SAMRCrawler();
  });

  afterAll(() => {
    // 清理测试目录
    try {
      if (fs.existsSync(testOutputDir)) {
        fs.rmSync(testOutputDir, { recursive: true, force: true });
      }
    } catch {
      // 忽略清理错误
    }
  });

  describe('基本配置', () => {
    it('应该返回正确的数据源名称', () => {
      expect(crawler.getDataSourceName()).toBe('samr');
    });

    it('应该使用正确的SAMR域名', () => {
      const config = crawler.getConfig();
      expect(config.name).toBe('SAMRCrawler');
      // 2026-02-18 更新: samr.gov.cn (原 cont.12315.cn 无法访问)
      expect(config.baseUrl).toBe('https://www.samr.gov.cn');
    });

    it('应该配置正确的请求参数', () => {
      const config = crawler.getConfig();
      expect(config.requestTimeout).toBe(30000);
      expect(config.maxRetries).toBe(3);
    });
  });

  describe('分类映射测试', () => {
    it('应正确映射劳动类合同', () => {
      expect((crawler as any).mapCategory('劳动合同')).toBe('LABOR');
      expect((crawler as any).mapCategory('人事')).toBe('LABOR');
      expect((crawler as any).mapCategory('聘用')).toBe('LABOR');
    });

    it('应正确映射民事类合同', () => {
      expect((crawler as any).mapCategory('买卖')).toBe('CIVIL');
      expect((crawler as any).mapCategory('借款')).toBe('CIVIL');
      expect((crawler as any).mapCategory('农副产品')).toBe('CIVIL');
    });

    it('应正确映射商业类合同', () => {
      expect((crawler as any).mapCategory('合伙')).toBe('COMMERCIAL');
      expect((crawler as any).mapCategory('公司')).toBe('COMMERCIAL');
      expect((crawler as any).mapCategory('投资')).toBe('COMMERCIAL');
    });

    it('应正确映射建设工程类合同', () => {
      expect((crawler as any).mapCategory('建设工程')).toBe('CONSTRUCTION');
      expect((crawler as any).mapCategory('施工')).toBe('CONSTRUCTION');
      expect((crawler as any).mapCategory('装饰装修')).toBe('CONSTRUCTION');
    });

    it('应正确映射其他类合同', () => {
      expect((crawler as any).mapCategory('未知分类')).toBe('OTHER');
    });
  });

  describe('变量生成测试', () => {
    it('应生成正确的变量列表', () => {
      const variables = (crawler as any).generateVariables('测试合同', 'CIVIL');

      expect(Array.isArray(variables)).toBe(true);
      expect(variables.length).toBeGreaterThan(0);
    });

    it('应包含合同编号变量', () => {
      const variables = (crawler as any).generateVariables('测试合同', 'CIVIL');
      const contractNoVar = variables.find((v: any) => v.key === 'contract_no');

      expect(contractNoVar).toBeDefined();
      expect(contractNoVar.required).toBe(true);
    });

    it('应包含甲乙方信息变量', () => {
      const variables = (crawler as any).generateVariables('测试合同', 'CIVIL');

      expect(
        variables.find((v: any) => v.key === 'party_a_name')
      ).toBeDefined();
      expect(
        variables.find((v: any) => v.key === 'party_b_name')
      ).toBeDefined();
    });

    it('应根据合同类型生成不同变量', () => {
      const laborVariables = (crawler as any).generateVariables(
        '劳动合同',
        'LABOR'
      );
      const civilVariables = (crawler as any).generateVariables(
        '买卖合同',
        'CIVIL'
      );

      // 劳动合同应该有岗位变量
      expect(
        laborVariables.find((v: any) => v.key === 'position')
      ).toBeDefined();

      // 买卖合同应该有标的物变量
      expect(
        civilVariables.find((v: any) => v.key === 'subject_matter')
      ).toBeDefined();
    });
  });

  describe('条款生成测试', () => {
    it('应生成正确的条款结构', () => {
      const clauses = (crawler as any).generateClauses('测试合同', 'CIVIL');

      expect(Array.isArray(clauses)).toBe(true);
      expect(clauses.length).toBeGreaterThan(0);
    });

    it('应包含当事人条款', () => {
      const clauses = (crawler as any).generateClauses('测试合同', 'CIVIL');
      const partiesClause = clauses.find((c: any) => c.type === 'PARTIES');

      expect(partiesClause).toBeDefined();
      expect(partiesClause.isRequired).toBe(true);
    });

    it('应包含违约责任条款', () => {
      const clauses = (crawler as any).generateClauses('测试合同', 'CIVIL');
      const liabilityClause = clauses.find((c: any) => c.type === 'LIABILITY');

      expect(liabilityClause).toBeDefined();
    });

    it('应包含争议解决条款', () => {
      const clauses = (crawler as any).generateClauses('测试合同', 'CIVIL');
      const disputeClause = clauses.find((c: any) => c.type === 'DISPUTE');

      expect(disputeClause).toBeDefined();
    });

    it('条款应按顺序排列', () => {
      const clauses = (crawler as any).generateClauses('测试合同', 'CIVIL');
      const orders = clauses.map((c: any) => c.order);

      for (let i = 1; i < orders.length; i++) {
        expect(orders[i]).toBeGreaterThan(orders[i - 1]);
      }
    });
  });

  describe('风险提示生成测试', () => {
    it('应生成正确的风险提示列表', () => {
      const warnings = (crawler as any).generateRiskWarnings(
        '测试合同',
        'CIVIL'
      );

      expect(Array.isArray(warnings)).toBe(true);
      expect(warnings.length).toBeGreaterThan(0);
    });

    it('应包含高风险提示', () => {
      const warnings = (crawler as any).generateRiskWarnings(
        '测试合同',
        'CIVIL'
      );
      const highRiskWarning = warnings.find((w: any) => w.level === 'HIGH');

      expect(highRiskWarning).toBeDefined();
    });

    it('应包含法律依据', () => {
      const warnings = (crawler as any).generateRiskWarnings(
        '测试合同',
        'CIVIL'
      );
      const warningWithLegalBasis = warnings.find((w: any) => w.legalBasis);

      expect(warningWithLegalBasis).toBeDefined();
    });

    it('应根据合同类型生成特定风险提示', () => {
      const laborWarnings = (crawler as any).generateRiskWarnings(
        '劳动合同',
        'LABOR'
      );
      const constructionWarnings = (crawler as any).generateRiskWarnings(
        '建设工程施工合同',
        'CONSTRUCTION'
      );

      // 劳动合同应该有试用期相关风险提示
      expect(
        laborWarnings.find(
          (w: any) => w.title.includes('试用期') || w.title.includes('必备条款')
        )
      ).toBeDefined();

      // 建设工程应该有资质相关风险提示
      expect(
        constructionWarnings.find(
          (w: any) => w.title.includes('资质') || w.title.includes('工程款')
        )
      ).toBeDefined();
    });
  });

  describe('模板文本生成测试', () => {
    it('应生成包含标题的模板文本', () => {
      const item = {
        title: '测试合同（示范文本）',
        category: '买卖',
        publishDate: '2024-01-01',
      };
      const text = (crawler as any).generateTemplateText(item);

      expect(text).toContain('测试合同（示范文本）');
    });

    it('应生成包含当事人信息的模板', () => {
      const item = {
        title: '测试合同',
        category: '买卖',
        publishDate: '2024-01-01',
      };
      const text = (crawler as any).generateTemplateText(item);

      expect(text).toContain('甲方');
      expect(text).toContain('乙方');
    });

    it('应生成包含主要条款的模板', () => {
      const item = {
        title: '测试合同',
        category: '买卖',
        publishDate: '2024-01-01',
      };
      const text = (crawler as any).generateTemplateText(item);

      expect(text).toContain('合同标的');
      expect(text).toContain('合同价款');
      expect(text).toContain('争议解决');
    });

    it('应根据合同类型生成特定条款', () => {
      const laborItem = {
        title: '劳动合同',
        category: '劳动合同',
        publishDate: '2024-01-01',
      };
      const civilItem = {
        title: '买卖合同',
        category: '买卖',
        publishDate: '2024-01-01',
      };

      const laborText = (crawler as any).generateTemplateText(laborItem);
      const civilText = (crawler as any).generateTemplateText(civilItem);

      // 劳动合同应该包含社会保险条款
      expect(laborText).toContain('社会保险');

      // 买卖合同应该包含所有权转移相关条款
      expect(civilText).toContain('标的物');
    });
  });

  describe('使用指南生成测试', () => {
    it('应生成使用指南', () => {
      const guide = (crawler as any).generateUsageGuide('测试合同', 'CIVIL');

      expect(typeof guide).toBe('string');
      expect(guide.length).toBeGreaterThan(0);
    });

    it('应包含法律依据', () => {
      const guide = (crawler as any).generateUsageGuide('测试合同', 'CIVIL');

      expect(guide).toContain('法律依据');
    });

    it('应根据合同类型生成不同指南', () => {
      const laborGuide = (crawler as any).generateUsageGuide(
        '劳动合同',
        'LABOR'
      );
      const realEstateGuide = (crawler as any).generateUsageGuide(
        '房屋买卖合同',
        'REAL_ESTATE'
      );

      expect(laborGuide).toContain('劳动法');
      expect(realEstateGuide).toContain('房地产管理法');
    });
  });

  describe('分页采集测试', () => {
    it('应支持分页获取模板列表', async () => {
      const result = await (crawler as any).fetchContractListWithPagination(
        1,
        5
      );

      expect(result).toHaveProperty('items');
      expect(result).toHaveProperty('total');
      expect(result).toHaveProperty('hasMore');
      expect(Array.isArray(result.items)).toBe(true);
      expect(result.items.length).toBeLessThanOrEqual(5);
    });

    it('应支持按分类筛选', async () => {
      const result = await (crawler as any).fetchContractListWithPagination(
        1,
        100,
        '劳动'
      );

      expect(result.items.length).toBeGreaterThan(0);
      expect(
        result.items.every(
          (item: any) =>
            item.category.includes('劳动') || item.title.includes('劳动')
        )
      ).toBe(true);
    });
  });

  describe('统计功能测试', () => {
    it('应返回正确的统计信息', () => {
      const stats = crawler.getStats();

      expect(stats).toHaveProperty('total');
      expect(stats).toHaveProperty('success');
      expect(stats).toHaveProperty('failed');
      expect(stats).toHaveProperty('byCategory');
      expect(typeof stats.total).toBe('number');
    });

    it('统计应包含分类信息', () => {
      const stats = crawler.getStats();

      expect(stats.byCategory).toHaveProperty('LABOR');
      expect(stats.byCategory).toHaveProperty('CIVIL');
    });

    it('统计总数应与模板列表长度一致', () => {
      const stats = crawler.getStats();

      expect(stats.total).toBe(KNOWN_CONTRACT_TEMPLATES.length);
    });
  });
});

describe('SAMR_CONFIG常量', () => {
  it('应正确配置SAMR_CONFIG', () => {
    expect(SAMR_CONFIG.name).toBe('SAMRCrawler');
    expect(SAMR_CONFIG.source).toBe('samr');
    // 2026-02-18 更新: samr.gov.cn (原 cont.12315.cn 无法访问)
    expect(SAMR_CONFIG.baseUrl).toBe('https://www.samr.gov.cn');
  });
});

describe('CONTRACT_CATEGORIES常量', () => {
  it('应包含所有主要分类', () => {
    expect(CONTRACT_CATEGORIES).toHaveProperty('劳动合同');
    expect(CONTRACT_CATEGORIES).toHaveProperty('买卖');
    expect(CONTRACT_CATEGORIES).toHaveProperty('建设工程');
    expect(CONTRACT_CATEGORIES).toHaveProperty('房屋租赁');
    expect(CONTRACT_CATEGORIES).toHaveProperty('知识产权');
  });

  it('应有正确的分类映射值', () => {
    expect(CONTRACT_CATEGORIES['劳动合同']).toBe('LABOR');
    expect(CONTRACT_CATEGORIES['买卖']).toBe('CIVIL');
    expect(CONTRACT_CATEGORIES['建设工程']).toBe('CONSTRUCTION');
    expect(CONTRACT_CATEGORIES['房屋租赁']).toBe('LEASE');
  });
});

describe('KNOWN_CONTRACT_TEMPLATES常量', () => {
  it('应有合同模板列表', () => {
    expect(Array.isArray(KNOWN_CONTRACT_TEMPLATES)).toBe(true);
    expect(KNOWN_CONTRACT_TEMPLATES.length).toBeGreaterThan(0);
  });

  it('每个模板应有必需字段', () => {
    KNOWN_CONTRACT_TEMPLATES.forEach(template => {
      expect(template).toHaveProperty('id');
      expect(template).toHaveProperty('title');
      expect(template).toHaveProperty('category');
      expect(template).toHaveProperty('publishDate');
      expect(template).toHaveProperty('sourceUrl');
    });
  });

  it('应覆盖多个合同类型', () => {
    const categories = new Set(KNOWN_CONTRACT_TEMPLATES.map(t => t.category));

    expect(categories.size).toBeGreaterThan(5);
  });
});
