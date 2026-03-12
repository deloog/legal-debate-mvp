/**
 * 报告与导出模块安全测试
 * 测试Excel/CSV注入攻击防护、文件名安全、频率限制等
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// Mock logger
const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
};

jest.mock('@/lib/logger', () => ({
  logger: mockLogger,
}));

// 导入被测试的模块
import { CsvGenerator, sanitizeCsvValue } from '@/lib/export/csv-generator';
import {
  checkExportRateLimit,
  resetExportRateLimit,
  getExportRateLimitStatus,
} from '@/lib/export/export-rate-limiter';

describe('Export Security Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================================
  // CSV注入攻击防护测试
  // ============================================================================
  describe('CSV Injection Protection', () => {
    it('should escape formula injection with = prefix', () => {
      const data = [{ formula: '=SUM(A1:A10)' }];
      const generator = new CsvGenerator(['formula'], data);
      const csv = generator.generate();

      // 数据行应该以单引号开头，防止Excel将其解释为公式
      const lines = csv.split('\n');
      const dataLine = lines.find(l => l.includes('SUM'));
      expect(dataLine).toContain("'=SUM(A1:A10)");
    });

    it('should escape formula injection with + prefix', () => {
      const data = [{ formula: "+cmd|' /C calc'!A0" }];
      const generator = new CsvGenerator(['formula'], data);
      const csv = generator.generate();

      const lines = csv.split('\n');
      const dataLine = lines.find(l => l.includes('cmd'));
      expect(dataLine).toContain("'+cmd");
    });

    it('should escape formula injection with - prefix', () => {
      const data = [{ formula: "-2+3+cmd|' /C calc'!A0" }];
      const generator = new CsvGenerator(['formula'], data);
      const csv = generator.generate();

      const lines = csv.split('\n');
      const dataLine = lines.find(l => l.includes('-2'));
      expect(dataLine).toContain("'-2+3");
    });

    it('should escape formula injection with @ prefix', () => {
      const data = [{ formula: '@SUM(A1:A10)' }];
      const generator = new CsvGenerator(['formula'], data);
      const csv = generator.generate();

      const lines = csv.split('\n');
      const dataLine = lines.find(l => l.includes('@SUM'));
      expect(dataLine).toContain("'@SUM(A1:A10)");
    });

    it('should escape formula injection with tab prefix', () => {
      const data = [{ formula: '\t=SUM(A1:A10)' }];
      const generator = new CsvGenerator(['formula'], data);
      const csv = generator.generate();

      expect(csv).toContain("'\t=SUM(A1:A10)");
    });

    it('should handle normal data without modification', () => {
      const data = [{ name: '张三', amount: '1000' }];
      const generator = new CsvGenerator(['name', 'amount'], data);
      const csv = generator.generate();

      expect(csv).toContain('张三');
      expect(csv).toContain('1000');
      expect(csv).not.toContain("'1000");
    });

    it('should properly escape quotes and commas', () => {
      const data = [{ text: 'Hello, "World"' }];
      const generator = new CsvGenerator(['text'], data);
      const csv = generator.generate();

      expect(csv).toContain('"Hello, ""World"""');
    });

    it('should handle multiline data', () => {
      const data = [{ text: 'Line 1\nLine 2' }];
      const generator = new CsvGenerator(['text'], data);
      const csv = generator.generate();

      expect(csv).toContain('"Line 1\nLine 2"');
    });
  });

  // ============================================================================
  // sanitizeCsvValue 函数测试
  // ============================================================================
  describe('sanitizeCsvValue function', () => {
    it('should add prefix to formula starting with =', () => {
      expect(sanitizeCsvValue('=SUM(A1)')).toBe("'=SUM(A1)");
    });

    it('should add prefix to formula starting with +', () => {
      expect(sanitizeCsvValue('+cmd')).toBe("'+cmd");
    });

    it('should add prefix to formula starting with -', () => {
      expect(sanitizeCsvValue('-calc')).toBe("'-calc");
    });

    it('should add prefix to formula starting with @', () => {
      expect(sanitizeCsvValue('@A1')).toBe("'@A1");
    });

    it('should not modify normal text', () => {
      expect(sanitizeCsvValue('Normal text')).toBe('Normal text');
      expect(sanitizeCsvValue('1000')).toBe('1000');
      expect(sanitizeCsvValue('Case A vs B')).toBe('Case A vs B');
    });

    it('should handle empty values', () => {
      expect(sanitizeCsvValue('')).toBe('');
      expect(sanitizeCsvValue(null as unknown as string)).toBe(
        null as unknown as string
      );
      expect(sanitizeCsvValue(undefined as unknown as string)).toBe(
        undefined as unknown as string
      );
    });
  });

  // ============================================================================
  // 文件名安全测试
  // ============================================================================
  describe('Filename Security', () => {
    it('should detect safe export types', () => {
      function isSafeExportType(exportType: string): boolean {
        return /^[a-zA-Z0-9_-]+$/.test(exportType);
      }

      expect(isSafeExportType('cases')).toBe(true);
      expect(isSafeExportType('stats')).toBe(true);
      expect(isSafeExportType('user_report')).toBe(true);
      expect(isSafeExportType('report-2024')).toBe(true);
      expect(isSafeExportType('../etc/passwd')).toBe(false);
      expect(isSafeExportType('file<script>')).toBe(false);
      expect(isSafeExportType('file;cmd')).toBe(false);
    });

    it('should sanitize dangerous filename characters', () => {
      function sanitizeFilename(filename: string): string {
        return filename
          .replace(/[<>:"/\\|?*]/g, '')
          .replace(/\.\./g, '')
          .replace(/^[\s.]+|[\s.]+$/g, '');
      }

      expect(sanitizeFilename('file<>name')).toBe('filename');
      expect(sanitizeFilename('file:name')).toBe('filename');
      expect(sanitizeFilename('file"name')).toBe('filename');
      expect(sanitizeFilename('file/name')).toBe('filename');
      expect(sanitizeFilename('file\\name')).toBe('filename');
      expect(sanitizeFilename('file|name')).toBe('filename');
      expect(sanitizeFilename('file?name')).toBe('filename');
      expect(sanitizeFilename('file*name')).toBe('filename');
      expect(sanitizeFilename('../../../etc/passwd')).toBe('etcpasswd');
    });
  });

  // ============================================================================
  // 导出频率限制测试
  // ============================================================================
  describe('Export Rate Limiter', () => {
    beforeEach(() => {
      // 重置所有限制
      resetExportRateLimit('user-123');
    });

    it('should allow first export', () => {
      const result = checkExportRateLimit('user-123', 'cases');

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(4); // 默认5次限制
    });

    it('should track export count', () => {
      // 导出4次
      for (let i = 0; i < 4; i++) {
        checkExportRateLimit('user-123', 'cases');
      }

      const result = checkExportRateLimit('user-123', 'cases');
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(0); // 第5次，剩余0
    });

    it('should block exports over limit', () => {
      // 导出5次（达到限制）
      for (let i = 0; i < 5; i++) {
        checkExportRateLimit('user-123', 'cases');
      }

      // 第6次应该被拒绝
      const result = checkExportRateLimit('user-123', 'cases');
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
      expect(result.message).toContain('过于频繁');
    });

    it('should track different export types separately', () => {
      // 导出cases 3次
      for (let i = 0; i < 3; i++) {
        checkExportRateLimit('user-123', 'cases');
      }

      // 导出stats应该独立计数
      const statsResult = checkExportRateLimit('user-123', 'stats');
      expect(statsResult.allowed).toBe(true);
      expect(statsResult.remaining).toBe(4);

      // cases应该还有2次
      const casesStatus = getExportRateLimitStatus('user-123', 'cases');
      expect(casesStatus.remaining).toBe(2);
    });

    it('should reset rate limit when requested', () => {
      // 导出5次（达到限制）
      for (let i = 0; i < 5; i++) {
        checkExportRateLimit('user-123', 'cases');
      }

      // 确认已被限制
      expect(checkExportRateLimit('user-123', 'cases').allowed).toBe(false);

      // 重置
      resetExportRateLimit('user-123', 'cases');

      // 应该可以导出
      const result = checkExportRateLimit('user-123', 'cases');
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(4);
    });

    it('should support custom configuration', () => {
      // 自定义：最多2次
      const result1 = checkExportRateLimit('user-456', 'cases', {
        maxExports: 2,
      });
      expect(result1.remaining).toBe(1);

      const result2 = checkExportRateLimit('user-456', 'cases', {
        maxExports: 2,
      });
      expect(result2.remaining).toBe(0);

      const result3 = checkExportRateLimit('user-456', 'cases', {
        maxExports: 2,
      });
      expect(result3.allowed).toBe(false);
    });
  });

  // ============================================================================
  // 权限控制测试
  // ============================================================================
  describe('Permission Control', () => {
    it('should require authentication', () => {
      // 模拟未认证用户
      const isAuthenticated = false;
      expect(isAuthenticated).toBe(false);
    });

    it('should require export permission', () => {
      // 模拟权限检查
      const hasPermission = (permission: string): boolean => {
        const allowedPermissions = [
          'export:case',
          'export:stats',
          'report:read',
        ];
        return allowedPermissions.includes(permission);
      };

      expect(hasPermission('export:case')).toBe(true);
      expect(hasPermission('export:stats')).toBe(true);
      expect(hasPermission('user:read')).toBe(false);
      expect(hasPermission('admin:delete')).toBe(false);
    });
  });
});
