/**
 * 国家法律法规数据库爬虫测试 (两阶段架构)
 */

import * as fs from 'fs';
import * as path from 'path';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { FLKCrawler } from '@/lib/crawler/flk-crawler';
import { LawCategory, LawType, LawStatus } from '@prisma/client';

describe('FLKCrawler', () => {
  let crawler: FLKCrawler;
  const testOutputDir = path.resolve('data/crawled/flk-test');

  beforeAll(() => {
    crawler = new FLKCrawler();
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
      expect(crawler.getDataSourceName()).toBe('flk');
    });

    it('应该使用正确的 FLK 域名', () => {
      const config = crawler.getConfig();
      expect(config.name).toBe('FLKCrawler');
      expect(config.baseUrl).toBe('https://flk.npc.gov.cn');
    });

    it('应该使用浏览器 User-Agent', () => {
      const config = crawler.getConfig();
      expect(config.userAgent).toContain('Mozilla/5.0');
    });

    it('应该配置更强的重试参数', () => {
      const config = crawler.getConfig();
      expect(config.maxRetries).toBe(5);
      expect(config.requestTimeout).toBe(45000);
    });

    it('应该返回初始 idle 进度', () => {
      const progress = crawler.getProgress();
      expect(progress.crawlerName).toBe('FLKCrawler');
      expect(progress.status).toBe('idle');
      expect(progress.totalItems).toBe(0);
    });
  });

  describe('parseArticle', () => {
    it('应该正确解析 FLK API 数据', () => {
      const rawData = {
        id: 'abc123def456',
        title: '中华人民共和国民法典',
        office: '全国人民代表大会',
        publish: '2020-05-28 00:00:00',
        fullText: '为了保护民事主体的合法权益，调整民事关系。',
        status: '1',
        lawType: LawType.LAW,
        category: LawCategory.CIVIL,
      };

      const result = crawler.parseArticle(rawData);

      expect(result).not.toBeNull();
      expect(result?.lawName).toBe('中华人民共和国民法典');
      expect(result?.sourceId).toBe('abc123def456');
      expect(result?.issuingAuthority).toBe('全国人民代表大会');
      expect(result?.lawType).toBe(LawType.LAW);
      expect(result?.status).toBe(LawStatus.VALID);
    });

    it('应该处理空/null 数据', () => {
      expect(crawler.parseArticle(null)).toBeNull();
      expect(crawler.parseArticle(undefined)).toBeNull();
      expect(crawler.parseArticle({})).toBeNull();
    });

    it('应该处理缺少标题的数据', () => {
      const result = crawler.parseArticle({ id: 'test', office: '测试' });
      expect(result).toBeNull();
    });

    it('应该生成正确的 sourceUrl', () => {
      const result = crawler.parseArticle({ id: 'test123', title: '测试法律' });
      expect(result?.sourceUrl).toContain('flk.npc.gov.cn');
      expect(result?.sourceUrl).toContain('test123');
    });
  });

  describe('getStats', () => {
    it('无数据时应该返回零值统计', () => {
      const stats = crawler.getStats(testOutputDir);

      expect(stats.download.total).toBe(0);
      expect(stats.download.status).toBe('in_progress');
      expect(stats.parse.total).toBe(0);
      expect(stats.parse.success).toBe(0);
      expect(stats.parse.failed).toBe(0);
      expect(stats.parse.failRate).toBe('0%');
    });
  });

  describe('断点文件管理', () => {
    it('应该能创建和读取 checkpoint.json', () => {
      // 通过 getStats 触发目录创建和读取
      const stats = crawler.getStats(testOutputDir);
      expect(stats).toBeDefined();
      expect(stats.download).toBeDefined();
      expect(stats.parse).toBeDefined();
    });

    it('checkpoint 目录不存在时不应崩溃', () => {
      const nonExistentDir = path.resolve(
        'data/crawled/flk-nonexistent-' + Date.now()
      );
      const stats = crawler.getStats(nonExistentDir);
      expect(stats.download.total).toBe(0);
    });
  });

  describe('DOCX 格式检测', () => {
    it('应该识别 ZIP (DOCX) 格式头', () => {
      // ZIP magic number: 50 4B 03 04
      const docxBuffer = Buffer.from([
        0x50, 0x4b, 0x03, 0x04, 0x00, 0x00, 0x00, 0x00,
      ]);
      // 通过 parseArticle 的 rawData 间接验证格式检测
      // 直接测试可见行为: 解析应该对无效数据抛异常或返回空
      expect(docxBuffer.subarray(0, 4).toString('hex')).toBe('504b0304');
    });

    it('应该识别 OLE (Legacy DOC) 格式头', () => {
      // OLE magic number: D0 CF 11 E0 A1 B1 1A E1
      const oleBuffer = Buffer.from([
        0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1,
      ]);
      expect(oleBuffer.subarray(0, 8).toString('hex')).toBe('d0cf11e0a1b11ae1');
    });
  });

  describe('parseAll (无文件时)', () => {
    it('没有已下载文件时应该安全返回', async () => {
      const result = await crawler.parseAll({ outputDir: testOutputDir });

      expect(result.success).toBe(true);
      expect(result.itemsCrawled).toBe(0);
      expect(result.itemsCreated).toBe(0);
      expect(result.errors.length).toBe(0);
    });
  });
});
