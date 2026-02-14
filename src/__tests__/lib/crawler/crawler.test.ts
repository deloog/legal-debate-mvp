/**
 * 采集爬虫测试
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import { NPCCrawler } from '@/lib/crawler/npc-crawler';
import { CourtCrawler } from '@/lib/crawler/court-crawler';
import { LawCategory, LawType, LawStatus } from '@prisma/client';

describe('NPCCrawler', () => {
  let crawler: NPCCrawler;

  beforeAll(() => {
    crawler = new NPCCrawler();
  });

  describe('getDataSourceName', () => {
    it('应该返回正确的数据源名称', () => {
      expect(crawler.getDataSourceName()).toBe('npc');
    });
  });

  describe('getConfig', () => {
    it('应该返回正确的配置', () => {
      const config = crawler.getConfig();

      expect(config.name).toBe('NPCCrawler');
      expect(config.baseUrl).toBe('http://www.npc.gov.cn');
      expect(config.rateLimitDelay).toBe(2000);
    });
  });

  describe('getProgress', () => {
    it('应该返回初始进度状态', () => {
      const progress = crawler.getProgress();

      expect(progress.crawlerName).toBe('NPCCrawler');
      expect(progress.status).toBe('idle');
      expect(progress.totalItems).toBe(0);
    });
  });

  describe('parseArticle', () => {
    it('应该正确解析民法典数据', () => {
      const rawData = {
        id: 'law-001',
        title: '中华人民共和国民法典',
        lawNumber: '中华人民共和国主席令第四十五号',
        fullText: '这是民法典的完整内容。',
        publishDate: '2020-05-28',
        effectiveDate: '2021-01-01',
        category: 'CIVIL',
        lawType: 'LAW',
        issuingAuthority: '全国人民代表大会',
      };

      const result = crawler.parseArticle(rawData);

      expect(result).not.toBeNull();
      expect(result?.lawName).toBe('中华人民共和国民法典');
      expect(result?.articleNumber).toBe('全部');
      expect(result?.lawType).toBe(LawType.LAW);
      expect(result?.category).toBe(LawCategory.CIVIL);
    });

    it('应该正确处理刑事法律数据', () => {
      const rawData = {
        id: 'law-002',
        title: '中华人民共和国刑法',
        lawNumber: '中华人民共和国主席令第五十一号',
        fullText: '这是刑法修正案的完整内容。',
        publishDate: '2020-12-26',
        effectiveDate: '2021-03-01',
        category: 'CRIMINAL',
        lawType: 'LAW',
        issuingAuthority: '全国人民代表大会常务委员会',
      };

      const result = crawler.parseArticle(rawData);

      expect(result).not.toBeNull();
      expect(result?.category).toBe(LawCategory.CRIMINAL);
    });
  });
});

describe('CourtCrawler', () => {
  let crawler: CourtCrawler;

  beforeAll(() => {
    crawler = new CourtCrawler();
  });

  describe('getDataSourceName', () => {
    it('应该返回正确的数据源名称', () => {
      expect(crawler.getDataSourceName()).toBe('court');
    });
  });

  describe('parseArticle', () => {
    it('应该正确解析司法解释', () => {
      const rawData = {
        id: 'interp-001',
        title:
          '最高人民法院关于适用《中华人民共和国民法典》合同编通则若干问题的解释',
        documentNumber: '法释〔2020〕17号',
        fullText: '这是司法解释的完整内容。',
        publishDate: '2020-12-29',
        effectiveDate: '2021-01-01',
        category: 'CIVIL',
        issuingAuthority: '最高人民法院',
      };

      const result = crawler.parseArticle(rawData);

      expect(result).not.toBeNull();
      expect(result?.lawName).toBe(rawData.title);
      expect(result?.articleNumber).toBe(rawData.documentNumber);
      expect(result?.lawType).toBe(LawType.JUDICIAL_INTERPRETATION);
    });
  });
});
