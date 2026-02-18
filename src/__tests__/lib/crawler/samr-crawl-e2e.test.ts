/**
 * SAMR合同模板采集E2E测试
 * 2026-02-18 更新: 测试 samr.gov.cn 数据源
 */

import { describe, it, expect } from '@jest/globals';
import { SAMRCrawler, SAMR_CONFIG, KNOWN_CONTRACT_TEMPLATES } from '@/lib/crawler/samr-crawler';

describe('SAMR合同模板采集 E2E测试', () => {
  it('应该支持新的 samr.gov.cn 数据源配置', () => {
    // 验证配置已更新为新地址 (2026-02-18 更新)
    expect(SAMR_CONFIG.baseUrl).toBe('https://www.samr.gov.cn');
    expect(SAMR_CONFIG.apiBaseUrl).toBe('https://www.samr.gov.cn');
  });

  it('应该有足够的合同模板覆盖', () => {
    // 模板数量应该超过50个测试样本
    expect(KNOWN_CONTRACT_TEMPLATES.length).toBeGreaterThanOrEqual(50);
  });

  it('每个模板应该有正确的URL格式', () => {
    for (const template of KNOWN_CONTRACT_TEMPLATES) {
      // 2026-02-18 更新: 使用 samr.gov.cn URL
      expect(template.sourceUrl).toMatch(/^https:\/\/www\.samr\.gov\.cn\/View\?id=.+$/);
    }
  });

  it('模板应该覆盖多个分类', () => {
    const categories = new Set(KNOWN_CONTRACT_TEMPLATES.map(t => t.category));
    expect(categories.size).toBeGreaterThan(5);
  });

  it('采集器应该能正确运行', async () => {
    const crawler = new SAMRCrawler();

    // 运行小规模采集测试 (使用模拟数据，不依赖真实API)
    const result = await crawler.crawl({
      useRealApi: false,
      maxItems: 5,
    });

    // 由于测试环境没有数据库连接，预期会失败但不应报错
    expect(result.itemsCrawled).toBe(5);
  });
});
