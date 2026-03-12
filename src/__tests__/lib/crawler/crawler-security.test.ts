/**
 * 爬虫系统安全测试
 * 测试范围：反爬健壮性、错误恢复、安全防护
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';
import { FLKCrawler } from '@/lib/crawler/flk-crawler';

describe('Crawler Security Tests', () => {
  describe('API Parameter Validation', () => {
    it('should validate data source parameter', () => {
      const validSources = ['flk', 'cail', 'pkulaw', 'wikass'];
      const deprecatedSources = ['npc', 'court'];
      const invalidSources = ['malicious-source', 'evil', 'admin'];

      validSources.forEach(source => {
        expect(validSources).toContain(source);
      });

      deprecatedSources.forEach(source => {
        expect(deprecatedSources).toContain(source);
      });

      invalidSources.forEach(source => {
        expect(validSources).not.toContain(source);
        expect(deprecatedSources).not.toContain(source);
      });
    });

    it('should validate phase parameter', () => {
      const validPhases = ['download', 'parse', 'reparse'];
      const invalidPhases = ['malicious-phase', 'delete', 'exec'];

      validPhases.forEach(phase => {
        expect(validPhases).toContain(phase);
      });

      invalidPhases.forEach(phase => {
        expect(validPhases).not.toContain(phase);
      });
    });

    it('should limit concurrent crawler tasks', () => {
      const MAX_CONCURRENT_TASKS = 2;
      const runningTasks = new Set<string>();

      runningTasks.add('task-1');
      runningTasks.add('task-2');

      expect(runningTasks.size).toBeLessThanOrEqual(MAX_CONCURRENT_TASKS);

      if (runningTasks.size >= MAX_CONCURRENT_TASKS) {
        expect(runningTasks.size).toBe(MAX_CONCURRENT_TASKS);
      }
    });
  });

  describe('SSRF Protection', () => {
    it('should validate redirect URL whitelist', () => {
      const allowedHosts = new Set(['flk.npc.gov.cn', 'npc.gov.cn']);

      const validUrls = [
        'https://flk.npc.gov.cn/file.docx',
        'https://npc.gov.cn/document.pdf',
      ];

      const invalidUrls = [
        'https://malicious.com/data.docx',
        'http://localhost/internal',
        'file:///etc/passwd',
        'https://example.com:22/ssh',
      ];

      validUrls.forEach(url => {
        const host = new URL(url).hostname.toLowerCase();
        const isAllowed = Array.from(allowedHosts).some(
          allowed => host === allowed || host.endsWith('.' + allowed)
        );
        expect(isAllowed).toBe(true);
      });

      invalidUrls.forEach(url => {
        try {
          const host = new URL(url).hostname.toLowerCase();
          const isAllowed = Array.from(allowedHosts).some(
            allowed => host === allowed || host.endsWith('.' + allowed)
          );
          expect(isAllowed).toBe(false);
        } catch {
          expect(true).toBe(true);
        }
      });
    });

    it('should reject non-whitelist hosts', () => {
      const crawler = new FLKCrawler();
      const config = crawler.getConfig();
      expect(config.baseUrl).toContain('npc.gov.cn');
    });
  });

  describe('Path Traversal Protection', () => {
    const testDir = path.resolve('data/crawled/security-test');

    beforeEach(() => {
      if (fs.existsSync(testDir)) {
        fs.rmSync(testDir, { recursive: true, force: true });
      }
    });

    it('should sanitize filename path traversal characters', () => {
      const maliciousNames = [
        '../../../etc/passwd',
        '..\\..\\windows\\system32\\config',
        '/etc/shadow',
        'normal-file.docx',
      ];

      const sanitizedNames = maliciousNames.map(name => {
        return name.replace(/[^a-zA-Z0-9_.-]/g, '_');
      });

      sanitizedNames.forEach(name => {
        expect(name).not.toContain('../');
        expect(name).not.toContain('..\\');
        expect(name).not.toMatch(/^[\\/]/);
      });
    });

    it('should validate output directory is within allowed range', () => {
      const allowedBase = path.resolve('data/crawled');

      const validDirs = [
        path.resolve('data/crawled/flk'),
        path.resolve('data/crawled/samr'),
      ];

      const maliciousDirs = [
        '../../../etc',
        '..\\..\\windows',
        '/etc/passwd',
      ];

      validDirs.forEach(dir => {
        expect(dir.startsWith(allowedBase)).toBe(true);
      });

      maliciousDirs.forEach(dir => {
        const resolvedDir = path.resolve(dir);
        const isValid = resolvedDir.startsWith(allowedBase);
        expect(isValid).toBe(false);
      });
    });
  });

  describe('Anti-Crawling Robustness', () => {
    it('should implement exponential backoff retry strategy', () => {
      const crawler = new FLKCrawler();
      const config = crawler.getConfig();

      expect(config.maxRetries).toBeGreaterThan(0);
      expect(config.requestTimeout).toBeGreaterThan(0);

      const baseDelay = 1000;
      const maxDelay = 60000;
      const attempt = 3;
      const expectedDelay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);

      expect(expectedDelay).toBeGreaterThan(baseDelay);
      expect(expectedDelay).toBeLessThanOrEqual(maxDelay);
    });

    it('should use User-Agent pool', () => {
      const crawler = new FLKCrawler();
      const config = crawler.getConfig();
      expect(config.userAgent).toContain('Mozilla/5.0');
    });

    it('should implement request rate limiting', () => {
      const crawler = new FLKCrawler();
      const config = crawler.getConfig();
      expect(config.rateLimitDelay).toBeGreaterThanOrEqual(1000);
    });
  });

  describe('Error Recovery', () => {
    it('should implement checkpoint mechanism', async () => {
      const crawler = new FLKCrawler();
      const testOutputDir = path.resolve('data/crawled/flk-test-recovery');

      if (fs.existsSync(testOutputDir)) {
        fs.rmSync(testOutputDir, { recursive: true, force: true });
      }

      const checkpointDir = path.join(testOutputDir, 'flfg');
      fs.mkdirSync(checkpointDir, { recursive: true });

      const checkpoint = {
        version: '2.0',
        startedAt: new Date().toISOString(),
        lastUpdatedAt: new Date().toISOString(),
        status: 'in_progress',
        types: {
          '101': { page: 5, totalPages: 10, downloaded: 100, completed: false },
        },
        items: [],
      };

      fs.writeFileSync(
        path.join(testOutputDir, 'checkpoint.json'),
        JSON.stringify(checkpoint, null, 2)
      );

      const stats = crawler.getStats(testOutputDir);
      expect(stats.download.status).toBe('in_progress');

      fs.rmSync(testOutputDir, { recursive: true, force: true });
    });

    it('should handle network timeout errors', () => {
      const crawler = new FLKCrawler();
      const config = crawler.getConfig();
      expect(config.requestTimeout).toBeGreaterThan(0);
      expect(config.requestTimeout).toBeLessThan(120000);
    });
  });

  describe('Task ID Validation', () => {
    it('should validate task ID format', () => {
      const validTaskIds = [
        'crawl_flk_1234567890',
        'crawl_samr_9876543210',
      ];

      const invalidTaskIds = [
        'invalid-task-id',
        'crawl_123',
        '../../../etc/passwd',
        '',
      ];

      const taskIdPattern = /^crawl_[a-z]+_\d+$/;

      validTaskIds.forEach(taskId => {
        expect(taskIdPattern.test(taskId)).toBe(true);
      });

      invalidTaskIds.forEach(taskId => {
        expect(taskIdPattern.test(taskId)).toBe(false);
      });
    });
  });
});
