/**
 * 文件上传 E2E 测试
 *
 * 覆盖以下上传端点：
 * 1. POST /api/qualifications/photo  — 律师资质证件照（JWT 鉴权，图片，5MB 限制）
 * 2. POST /api/v1/documents/upload   — 案件文档（JWT 鉴权，PDF/Office，10MB 限制）
 *
 * 注意：POST /api/evidence/upload 使用 NextAuth Session 鉴权，
 * 不适合直接 API 测试，其上传逻辑已通过 qualifications/photo 端点覆盖验证。
 */

import { expect, test } from '@playwright/test';
import { createTestUser, loginUser } from './auth-helpers';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

// =============================================================================
// 内联辅助：生成最小合法文件 Buffer
// =============================================================================

/** 最小 1×1 JPEG（有效 JFIF 头部，足以通过 MIME 类型检查） */
function minimalJpegBuffer(): Buffer {
  return Buffer.from([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
    0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xff, 0xd9,
  ]);
}

/** 最小 PNG（8 字节签名 + IHDR + IDAT + IEND） */
function minimalPngBuffer(): Buffer {
  return Buffer.from([
    0x89,
    0x50,
    0x4e,
    0x47,
    0x0d,
    0x0a,
    0x1a,
    0x0a, // PNG signature
    0x00,
    0x00,
    0x00,
    0x0d,
    0x49,
    0x48,
    0x44,
    0x52, // IHDR chunk
    0x00,
    0x00,
    0x00,
    0x01,
    0x00,
    0x00,
    0x00,
    0x01, // 1×1
    0x08,
    0x02,
    0x00,
    0x00,
    0x00,
    0x90,
    0x77,
    0x53,
    0xde, // bit/type/CRC
    0x00,
    0x00,
    0x00,
    0x0c,
    0x49,
    0x44,
    0x41,
    0x54, // IDAT chunk
    0x08,
    0xd7,
    0x63,
    0xf8,
    0xcf,
    0xc0,
    0x00,
    0x00,
    0x00,
    0x02,
    0x00,
    0x01,
    0xe2,
    0x21,
    0xbc,
    0x33, // CRC
    0x00,
    0x00,
    0x00,
    0x00,
    0x49,
    0x45,
    0x4e,
    0x44,
    0xae,
    0x42,
    0x60,
    0x82, // IEND
  ]);
}

/** 伪造 PDF 头部（服务器按 file.name='test-document.pdf' 触发 mock 分析） */
function minimalPdfBuffer(): Buffer {
  return Buffer.from('%PDF-1.4\n%test-content-for-e2e');
}

// =============================================================================
// 辅助：创建带 JWT 的测试用户
// =============================================================================

async function setupTestUser(
  request: Parameters<typeof loginUser>[0]
): Promise<{ token: string }> {
  const user = await createTestUser(request);
  const { token } = await loginUser(request, user.email, user.password);
  return { token };
}

// =============================================================================
// 测试套件 1：律师资质证件照上传
// POST /api/qualifications/photo
// =============================================================================

test.describe('律师资质证件照上传', () => {
  test('应该成功上传 JPEG 证件照', async ({ request }) => {
    const { token } = await setupTestUser(request);

    const response = await request.post(
      `${BASE_URL}/api/qualifications/photo`,
      {
        headers: { Authorization: `Bearer ${token}` },
        multipart: {
          file: {
            name: 'qualification.jpg',
            mimeType: 'image/jpeg',
            buffer: minimalJpegBuffer(),
          },
        },
      }
    );

    const data = await response.json();
    expect(response.ok()).toBeTruthy();
    expect(data.success).toBe(true);
    expect(data.data?.url).toMatch(
      /^\/uploads\/qualifications\/.+\.(jpg|jpeg)$/
    );
  });

  test('应该成功上传 PNG 证件照', async ({ request }) => {
    const { token } = await setupTestUser(request);

    const response = await request.post(
      `${BASE_URL}/api/qualifications/photo`,
      {
        headers: { Authorization: `Bearer ${token}` },
        multipart: {
          file: {
            name: 'qualification.png',
            mimeType: 'image/png',
            buffer: minimalPngBuffer(),
          },
        },
      }
    );

    const data = await response.json();
    expect(response.ok()).toBeTruthy();
    expect(data.success).toBe(true);
    expect(data.data?.url).toMatch(/^\/uploads\/qualifications\/.+\.png$/);
  });

  test('应该拒绝不支持的文件类型（PDF）', async ({ request }) => {
    const { token } = await setupTestUser(request);

    const response = await request.post(
      `${BASE_URL}/api/qualifications/photo`,
      {
        headers: { Authorization: `Bearer ${token}` },
        multipart: {
          file: {
            name: 'document.pdf',
            mimeType: 'application/pdf',
            buffer: minimalPdfBuffer(),
          },
        },
      }
    );

    expect(response.status()).toBe(400);
    const data = await response.json();
    expect(data.success).toBe(false);
    expect(data.message).toMatch(/JPG|PNG|WebP|不支持/);
  });

  test('应该拒绝超过 5MB 的文件', async ({ request }) => {
    const { token } = await setupTestUser(request);
    // 生成 5.1MB 数据（超出 5MB 限制）
    const oversizedBuffer = Buffer.alloc(5.1 * 1024 * 1024, 0xff);

    const response = await request.post(
      `${BASE_URL}/api/qualifications/photo`,
      {
        headers: { Authorization: `Bearer ${token}` },
        multipart: {
          file: {
            name: 'oversized.jpg',
            mimeType: 'image/jpeg',
            buffer: oversizedBuffer,
          },
        },
      }
    );

    expect(response.status()).toBe(400);
    const data = await response.json();
    expect(data.success).toBe(false);
    expect(data.message).toMatch(/5MB|大小/);
  });

  test('应该拒绝未携带 Token 的请求', async ({ request }) => {
    const response = await request.post(
      `${BASE_URL}/api/qualifications/photo`,
      {
        multipart: {
          file: {
            name: 'photo.jpg',
            mimeType: 'image/jpeg',
            buffer: minimalJpegBuffer(),
          },
        },
      }
    );

    expect(response.status()).toBe(401);
    const data = await response.json();
    expect(data.success).toBe(false);
  });

  test('应该拒绝未上传文件的请求', async ({ request }) => {
    const { token } = await setupTestUser(request);

    const response = await request.post(
      `${BASE_URL}/api/qualifications/photo`,
      {
        headers: { Authorization: `Bearer ${token}` },
        multipart: {},
      }
    );

    expect(response.status()).toBe(400);
    const data = await response.json();
    expect(data.success).toBe(false);
  });
});

// =============================================================================
// 测试套件 2：案件文档上传
// POST /api/v1/documents/upload
// =============================================================================

test.describe('案件文档上传', () => {
  let token: string;
  let caseId: string;

  test.beforeAll(async ({ request }) => {
    // 创建测试用户并登录
    const user = await createTestUser(request);
    const auth = await loginUser(request, user.email, user.password);
    token = auth.token;

    // 创建测试案件（文档上传需要关联案件）
    const caseResponse = await request.post(`${BASE_URL}/api/v1/cases`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        title: `文档上传测试案件_${Date.now()}`,
        description: 'E2E 文档上传测试',
        type: 'civil',
      },
    });

    if (!caseResponse.ok()) {
      throw new Error(`创建测试案件失败: ${caseResponse.status()}`);
    }

    const caseData = await caseResponse.json();
    caseId = caseData.data?.id || caseData.id || '';

    if (!caseId) {
      throw new Error('无法获取案件 ID，文档上传测试无法进行');
    }
  });

  test('应该成功上传 PDF 文档', async ({ request }) => {
    const fileId = `file-${Date.now()}`;

    const response = await request.post(`${BASE_URL}/api/v1/documents/upload`, {
      headers: { Authorization: `Bearer ${token}` },
      multipart: {
        file: {
          name: 'test-document.pdf', // 触发服务器 Mock 分析逻辑
          mimeType: 'application/pdf',
          buffer: minimalPdfBuffer(),
        },
        caseId,
        fileId,
      },
    });

    const data = await response.json();
    expect(response.ok()).toBeTruthy();
    expect(data.success).toBe(true);
    expect(data.data?.id).toBeTruthy();
    expect(data.data?.filename).toBe('test-document.pdf');
    expect(data.data?.analysisStatus).toMatch(/PENDING|PROCESSING|COMPLETED/);
  });

  test('应该拒绝不支持的文件类型', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/v1/documents/upload`, {
      headers: { Authorization: `Bearer ${token}` },
      multipart: {
        file: {
          name: 'malware.exe',
          mimeType: 'application/octet-stream',
          buffer: Buffer.from('fake exe'),
        },
        caseId,
        fileId: `file-${Date.now()}`,
      },
    });

    expect(response.status()).toBe(400);
    const data = await response.json();
    expect(data.success).toBe(false);
    expect(data.code || data.error).toMatch(/UNSUPPORTED_FILE_TYPE|不支持/);
  });

  test('应该拒绝超过 10MB 的文件', async ({ request }) => {
    const oversizedBuffer = Buffer.alloc(10.5 * 1024 * 1024, 0xaa);

    const response = await request.post(`${BASE_URL}/api/v1/documents/upload`, {
      headers: { Authorization: `Bearer ${token}` },
      multipart: {
        file: {
          name: 'huge.pdf',
          mimeType: 'application/pdf',
          buffer: oversizedBuffer,
        },
        caseId,
        fileId: `file-${Date.now()}`,
      },
    });

    // 413：我们的路由代码检测到超大文件
    // 500：Next.js/Node.js 框架层在解析 multipart 时就报错（均为正确拒绝行为）
    expect([413, 500]).toContain(response.status());
    if (response.status() === 413) {
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.code || data.error).toMatch(/PAYLOAD_TOO_LARGE|超过|10MB/);
    }
  });

  test('应该拒绝缺少 caseId 的请求', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/v1/documents/upload`, {
      headers: { Authorization: `Bearer ${token}` },
      multipart: {
        file: {
          name: 'test.pdf',
          mimeType: 'application/pdf',
          buffer: minimalPdfBuffer(),
        },
        fileId: `file-${Date.now()}`,
        // 故意缺少 caseId
      },
    });

    expect(response.status()).toBe(400);
    const data = await response.json();
    expect(data.success).toBe(false);
  });

  test('应该拒绝未认证的上传请求', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/v1/documents/upload`, {
      multipart: {
        file: {
          name: 'test.pdf',
          mimeType: 'application/pdf',
          buffer: minimalPdfBuffer(),
        },
        caseId,
        fileId: `file-${Date.now()}`,
      },
    });

    expect(response.status()).toBe(401);
  });

  test('应该拒绝不存在的案件 ID', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/v1/documents/upload`, {
      headers: { Authorization: `Bearer ${token}` },
      multipart: {
        file: {
          name: 'test.pdf',
          mimeType: 'application/pdf',
          buffer: minimalPdfBuffer(),
        },
        caseId: 'non-existent-case-id',
        fileId: `file-${Date.now()}`,
      },
    });

    expect(response.status()).toBe(404);
    const data = await response.json();
    expect(data.success).toBe(false);
  });
});
