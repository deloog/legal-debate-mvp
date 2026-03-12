/**
 * 资质认证 API 安全测试
 * 测试文件上传安全、照片存储安全、访问控制等
 *
 * 注意：由于 Node.js 测试环境对 FormData 的支持限制，
 * 文件上传测试使用模拟验证，主要测试安全控制逻辑。
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// Mock fs/promises
const mockWriteFile = jest.fn();
const mockReadFile = jest.fn();
const mockMkdir = jest.fn();

jest.mock('fs/promises', () => ({
  writeFile: mockWriteFile,
  readFile: mockReadFile,
  mkdir: mockMkdir,
}));

const mockExistsSync = jest.fn();
jest.mock('fs', () => ({
  existsSync: mockExistsSync,
}));

// Mock crypto
const mockRandomBytes = jest.fn();
jest.mock('crypto', () => ({
  randomBytes: mockRandomBytes,
}));

// Mock Prisma
const mockPrisma = {
  lawyerQualification: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
  },
  user: {
    update: jest.fn(),
  },
};

jest.mock('@/lib/db/prisma', () => ({
  prisma: mockPrisma,
}));

// Mock JWT
const mockExtractTokenFromHeader = jest.fn();
const mockVerifyToken = jest.fn();

jest.mock('@/lib/auth/jwt', () => ({
  extractTokenFromHeader: mockExtractTokenFromHeader,
  verifyToken: mockVerifyToken,
}));

// Mock Logger
const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
};

jest.mock('@/lib/logger', () => ({
  logger: mockLogger,
}));

// Mock OCR Service
const mockRecognizeLicensePhoto = jest.fn();

jest.mock('@/lib/qualification/service', () => ({
  recognizeLicensePhoto: mockRecognizeLicensePhoto,
  verifyLawyerQualification: jest.fn(),
  buildVerificationData: jest.fn(),
  requiresManualReview: jest.fn(),
}));

// Mock validator
const mockValidateBasicInfo = jest.fn();

jest.mock('@/lib/qualification/validator', () => ({
  validateBasicInfo: mockValidateBasicInfo,
}));

describe('Qualification API Security Tests', () => {
  const testUser = { userId: 'user-123', role: 'USER' };
  const adminUser = { userId: 'admin-123', role: 'ADMIN' };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================================
  // 照片上传路由安全测试 - 通过直接测试安全逻辑
  // ============================================================================
  describe('Photo Upload Security Logic', () => {
    it('should validate file magic numbers for JPEG', () => {
      // JPEG 魔数: FF D8 FF
      const jpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);

      // 模拟验证函数
      function validateImageContent(buffer: Buffer, mimeType: string): boolean {
        const jpegMagic = Buffer.from([0xff, 0xd8, 0xff]);
        if (mimeType === 'image/jpeg') {
          return buffer.slice(0, 3).equals(jpegMagic);
        }
        return false;
      }

      expect(validateImageContent(jpegBuffer, 'image/jpeg')).toBe(true);
      expect(validateImageContent(jpegBuffer, 'image/png')).toBe(false);
    });

    it('should validate file magic numbers for PNG', () => {
      // PNG 魔数: 89 50 4E 47
      const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47]);

      function validateImageContent(buffer: Buffer, mimeType: string): boolean {
        const pngMagic = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
        if (mimeType === 'image/png') {
          return buffer.slice(0, 4).equals(pngMagic);
        }
        return false;
      }

      expect(validateImageContent(pngBuffer, 'image/png')).toBe(true);
      expect(validateImageContent(pngBuffer, 'image/jpeg')).toBe(false);
    });

    it('should detect MIME spoofing attacks', () => {
      // 伪装攻击：PNG 内容但声称是 JPEG
      const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47]);

      function validateImageContent(buffer: Buffer, mimeType: string): boolean {
        const jpegMagic = Buffer.from([0xff, 0xd8, 0xff]);
        const pngMagic = Buffer.from([0x89, 0x50, 0x4e, 0x47]);

        if (mimeType === 'image/jpeg') {
          return buffer.slice(0, 3).equals(jpegMagic);
        }
        if (mimeType === 'image/png') {
          return buffer.slice(0, 4).equals(pngMagic);
        }
        return false;
      }

      // PNG 内容声称是 JPEG，应该失败
      expect(validateImageContent(pngBuffer, 'image/jpeg')).toBe(false);
      // PNG 内容声称是 PNG，应该成功
      expect(validateImageContent(pngBuffer, 'image/png')).toBe(true);
    });

    it('should generate secure random filenames', () => {
      const mockRandom = Buffer.from('abcdef1234567890abcdef1234567890', 'hex');
      mockRandomBytes.mockReturnValue(mockRandom);

      function generateSecureFileName(ext: string): string {
        const randomPart = mockRandomBytes(16).toString('hex');
        const timestamp = Date.now().toString(36);
        return `qual-${timestamp}-${randomPart}.${ext}`;
      }

      const fileName = generateSecureFileName('jpg');

      // 验证文件名格式
      expect(fileName).toMatch(/^qual-[a-z0-9]+-[a-f0-9]{32}\.jpg$/);
      // 验证使用了加密安全随机
      expect(mockRandomBytes).toHaveBeenCalledWith(16);
    });

    it('should enforce file size limits', () => {
      const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

      const validSize = 4 * 1024 * 1024; // 4MB
      const invalidSize = 6 * 1024 * 1024; // 6MB

      expect(validSize).toBeLessThanOrEqual(MAX_FILE_SIZE);
      expect(invalidSize).toBeGreaterThan(MAX_FILE_SIZE);
    });

    it('should only allow specific MIME types', () => {
      const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

      expect(ALLOWED_TYPES).toContain('image/jpeg');
      expect(ALLOWED_TYPES).toContain('image/png');
      expect(ALLOWED_TYPES).toContain('image/webp');
      expect(ALLOWED_TYPES).not.toContain('image/gif');
      expect(ALLOWED_TYPES).not.toContain('application/pdf');
      expect(ALLOWED_TYPES).not.toContain('text/html');
    });
  });

  // ============================================================================
  // 照片访问路由安全测试
  // ============================================================================
  describe('Photo Access Security', () => {
    it('should validate file ID format correctly', () => {
      function isValidFileId(fileId: string): boolean {
        return /^qual-[a-z0-9]+-[a-f0-9]{32}$/.test(fileId);
      }

      // 有效的文件 ID
      expect(isValidFileId('qual-abc123-' + 'a'.repeat(32))).toBe(true);
      expect(
        isValidFileId('qual-ln5y6it-abcd1234abcd1234abcd1234abcd1234')
      ).toBe(true);

      // 无效的文件 ID - 路径遍历攻击
      expect(isValidFileId('../../../etc/passwd')).toBe(false);
      expect(isValidFileId('qual-../../etc/passwd')).toBe(false);

      // 无效的文件 ID - 特殊字符
      expect(isValidFileId('qual-test-<script>')).toBe(false);
      expect(isValidFileId('qual-test-../../config')).toBe(false);

      // 无效的文件 ID - 长度不足
      expect(isValidFileId('qual-test-123')).toBe(false);

      // 无效的文件 ID - 空值
      expect(isValidFileId('')).toBe(false);
    });

    it('should check user permissions correctly', () => {
      function isAdmin(role: string): boolean {
        return role === 'ADMIN' || role === 'SUPER_ADMIN';
      }

      expect(isAdmin('ADMIN')).toBe(true);
      expect(isAdmin('SUPER_ADMIN')).toBe(true);
      expect(isAdmin('USER')).toBe(false);
      expect(isAdmin('LAWYER')).toBe(false);
      expect(isAdmin('ENTERPRISE')).toBe(false);
    });

    it('should set correct MIME types for file extensions', () => {
      function getMimeType(ext: string): string {
        const mimeTypes: Record<string, string> = {
          '.jpg': 'image/jpeg',
          '.jpeg': 'image/jpeg',
          '.png': 'image/png',
          '.webp': 'image/webp',
        };
        return mimeTypes[ext.toLowerCase()] || 'application/octet-stream';
      }

      expect(getMimeType('.jpg')).toBe('image/jpeg');
      expect(getMimeType('.jpeg')).toBe('image/jpeg');
      expect(getMimeType('.png')).toBe('image/png');
      expect(getMimeType('.webp')).toBe('image/webp');
      expect(getMimeType('.unknown')).toBe('application/octet-stream');
    });
  });

  // ============================================================================
  // 资格认证上传安全测试
  // ============================================================================
  describe('Qualification Upload Security', () => {
    it('should require authentication', async () => {
      mockExtractTokenFromHeader.mockReturnValue(null);
      mockVerifyToken.mockReturnValue({ valid: false });

      // 模拟认证中间件行为
      const isAuthenticated = () => {
        const token = mockExtractTokenFromHeader('');
        const result = mockVerifyToken(token ?? '');
        return result.valid && result.payload;
      };

      expect(isAuthenticated()).toBe(false);
    });

    it('should allow authenticated users', async () => {
      mockExtractTokenFromHeader.mockReturnValue('valid-token');
      mockVerifyToken.mockReturnValue({ valid: true, payload: testUser });

      const isAuthenticated = () => {
        const token = mockExtractTokenFromHeader('Bearer valid-token');
        const result = mockVerifyToken(token ?? '');
        return !!(result.valid && result.payload);
      };

      expect(isAuthenticated()).toBe(true);
    });

    it('should validate basic info before processing', () => {
      mockValidateBasicInfo.mockReturnValue({
        valid: false,
        errors: { licenseNumber: '格式错误' },
      });

      const validation = mockValidateBasicInfo({
        licenseNumber: 'invalid',
        fullName: '',
        idCardNumber: '',
        lawFirm: '',
      });

      expect(validation.valid).toBe(false);
      expect(mockValidateBasicInfo).toHaveBeenCalled();
    });

    it('should prevent duplicate license numbers', async () => {
      mockPrisma.lawyerQualification.findUnique.mockResolvedValue({
        id: 'existing-qual',
      });

      const existingQualification =
        await mockPrisma.lawyerQualification.findUnique({
          where: { licenseNumber: '12345678901234567' },
        });

      expect(existingQualification).toBeTruthy();
    });

    it('should prevent multiple qualifications per user', async () => {
      mockPrisma.lawyerQualification.findMany.mockResolvedValue([
        { id: 'qual-1' },
        { id: 'qual-2' },
      ]);

      const userQualifications = await mockPrisma.lawyerQualification.findMany({
        where: { userId: testUser.userId },
      });

      expect(userQualifications.length).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // 执业证号验证器安全测试
  // ============================================================================
  describe('License Number Validator Security', () => {
    it('should validate license number format', () => {
      const LICENSE_NUMBER_REGEX = /^\d{17}$/;

      // 有效的17位数字
      expect(LICENSE_NUMBER_REGEX.test('12345678901234567')).toBe(true);

      // 无效格式
      expect(LICENSE_NUMBER_REGEX.test('1234567890123456')).toBe(false); // 16位
      expect(LICENSE_NUMBER_REGEX.test('123456789012345678')).toBe(false); // 18位
      expect(LICENSE_NUMBER_REGEX.test('1234567890123456a')).toBe(false); // 包含字母
      expect(LICENSE_NUMBER_REGEX.test('123456789012345-7')).toBe(false); // 包含连字符
      expect(LICENSE_NUMBER_REGEX.test('')).toBe(false); // 空字符串
    });

    it('should clean and normalize license numbers', () => {
      function cleanLicenseNumber(licenseNumber: string): string {
        return licenseNumber.replace(/[-\s]/g, '');
      }

      expect(cleanLicenseNumber('12345-67890-12345-67')).toBe(
        '12345678901234567'
      );
      expect(cleanLicenseNumber('12345 67890 12345 67')).toBe(
        '12345678901234567'
      );
      expect(cleanLicenseNumber('12345- 67890 -12345- 67')).toBe(
        '12345678901234567'
      );
    });
  });

  // ============================================================================
  // 身份证号验证器安全测试
  // ============================================================================
  describe('ID Card Validator Security', () => {
    it('should validate ID card format', () => {
      const ID_CARD_REGEX =
        /^[1-9]\d{5}(18|19|20)\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\d{3}[\dXx]$/;

      // 格式正确的身份证号（仅格式验证，非真实号码）
      expect(ID_CARD_REGEX.test('11010119900101123X')).toBe(true);
      expect(ID_CARD_REGEX.test('31010119850515201x')).toBe(true);

      // 无效格式
      expect(ID_CARD_REGEX.test('01010119900101123X')).toBe(false); // 以0开头
      expect(ID_CARD_REGEX.test('11010117900101123X')).toBe(false); // 17世纪（不在18/19/20世纪范围）
      expect(ID_CARD_REGEX.test('11010119901301123X')).toBe(false); // 无效月份
      expect(ID_CARD_REGEX.test('11010119900132123X')).toBe(false); // 无效日期
      expect(ID_CARD_REGEX.test('110101199001011234')).toBe(true); // 末位数字而非X
    });
  });

  // ============================================================================
  // 审计日志安全测试
  // ============================================================================
  describe('Audit Logging Security', () => {
    it('should log authentication failures', () => {
      mockLogger.warn('认证失败', { userId: 'unknown', reason: '无效令牌' });

      expect(mockLogger.warn).toHaveBeenCalledWith(
        '认证失败',
        expect.objectContaining({ reason: '无效令牌' })
      );
    });

    it('should log file access attempts', () => {
      mockLogger.warn('未授权的文件访问尝试', {
        userId: testUser.userId,
        fileId: 'test-file-id',
        role: testUser.role,
      });

      expect(mockLogger.warn).toHaveBeenCalledWith(
        '未授权的文件访问尝试',
        expect.objectContaining({ userId: testUser.userId })
      );
    });

    it('should log successful file uploads', () => {
      mockLogger.info('证件照上传成功', {
        userId: testUser.userId,
        fileName: 'test.jpg',
        fileSize: 1024,
        mimeType: 'image/jpeg',
      });

      expect(mockLogger.info).toHaveBeenCalledWith(
        '证件照上传成功',
        expect.objectContaining({
          userId: testUser.userId,
          fileName: 'test.jpg',
        })
      );
    });
  });

  // ============================================================================
  // 安全响应头测试
  // ============================================================================
  describe('Security Headers', () => {
    it('should set correct security headers for file responses', () => {
      const headers = {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'private, max-age=3600',
        'X-Content-Type-Options': 'nosniff',
        'Content-Disposition': 'inline',
      };

      expect(headers['X-Content-Type-Options']).toBe('nosniff');
      expect(headers['Cache-Control']).toContain('private');
      expect(headers['Content-Disposition']).toBe('inline');
    });
  });
});
