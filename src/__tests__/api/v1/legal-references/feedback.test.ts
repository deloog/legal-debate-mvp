import { PUT } from '@/app/api/v1/legal-references/[id]/feedback/route';
import {
  createMockRequest,
  createTestResponse,
  assertions,
} from '../../test-utils';

// Mock PrismaClient
const mockFindUnique = jest.fn();
const mockUpdate = jest.fn();
const mockDisconnect = jest.fn();

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    legalReference: {
      findUnique: () => mockFindUnique(),
      update: () => mockUpdate(),
    },
    $disconnect: () => mockDisconnect(),
  })),
}));

/**
 * 法条反馈API单元测试
 */
describe('法条反馈API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('PUT /api/v1/legal-references/[id]/feedback', () => {
    it('应该成功确认法条适用', async () => {
      const mockLegalReference = {
        id: 'article-1',
        lawName: '中华人民共和国合同法',
        articleNumber: '第8条',
        content: '依法成立的合同，对当事人具有法律约束力。',
        metadata: {},
      };

      mockFindUnique.mockResolvedValue(mockLegalReference);
      mockUpdate.mockResolvedValue({
        ...mockLegalReference,
        metadata: {
          lawyerFeedback: {
            action: 'CONFIRMED',
            timestamp: '2024-01-01T00:00:00.000Z',
          },
        },
      });

      const request = createMockRequest(
        'http://localhost:3000/api/v1/legal-references/article-1/feedback',
        {
          method: 'PUT',
          body: {
            action: 'CONFIRMED',
          },
        }
      );

      const response = await PUT(request, {
        params: Promise.resolve({ id: 'article-1' }),
      });
      const testResponse = await createTestResponse(response);

      expect(testResponse.status).toBe(200);
      expect(testResponse.data).toBeDefined();
      expect(testResponse.success).toBe(true);
      expect(testResponse.data.metadata.lawyerFeedback.action).toBe(
        'CONFIRMED'
      );
    });

    it('应该成功移除法条并记录原因', async () => {
      const mockLegalReference = {
        id: 'article-1',
        lawName: '中华人民共和国合同法',
        articleNumber: '第8条',
        content: '依法成立的合同，对当事人具有法律约束力。',
        metadata: {},
      };

      mockFindUnique.mockResolvedValue(mockLegalReference);
      mockUpdate.mockResolvedValue({
        ...mockLegalReference,
        metadata: {
          lawyerFeedback: {
            action: 'REMOVED',
            removedReason: 'NOT_RELEVANT',
            timestamp: '2024-01-01T00:00:00.000Z',
          },
        },
      });

      const request = createMockRequest(
        'http://localhost:3000/api/v1/legal-references/article-1/feedback',
        {
          method: 'PUT',
          body: {
            action: 'REMOVED',
            removedReason: 'NOT_RELEVANT',
          },
        }
      );

      const response = await PUT(request, {
        params: Promise.resolve({ id: 'article-1' }),
      });
      const testResponse = await createTestResponse(response);

      expect(testResponse.status).toBe(200);
      expect(testResponse.data).toBeDefined();
      expect(testResponse.success).toBe(true);
      expect(testResponse.data.metadata.lawyerFeedback.action).toBe('REMOVED');
      expect(testResponse.data.metadata.lawyerFeedback.removedReason).toBe(
        'NOT_RELEVANT'
      );
    });

    it('应该支持"其他"移除原因', async () => {
      const mockLegalReference = {
        id: 'article-1',
        lawName: '中华人民共和国合同法',
        articleNumber: '第8条',
        content: '依法成立的合同，对当事人具有法律约束力。',
        metadata: {},
      };

      mockFindUnique.mockResolvedValue(mockLegalReference);
      mockUpdate.mockResolvedValue({
        ...mockLegalReference,
        metadata: {
          lawyerFeedback: {
            action: 'REMOVED',
            removedReason: 'OTHER',
            otherReason: '该法条与本案实际情况不符',
            timestamp: '2024-01-01T00:00:00.000Z',
          },
        },
      });

      const request = createMockRequest(
        'http://localhost:3000/api/v1/legal-references/article-1/feedback',
        {
          method: 'PUT',
          body: {
            action: 'REMOVED',
            removedReason: 'OTHER',
            otherReason: '该法条与本案实际情况不符',
          },
        }
      );

      const response = await PUT(request, {
        params: Promise.resolve({ id: 'article-1' }),
      });
      const testResponse = await createTestResponse(response);

      expect(testResponse.status).toBe(200);
      expect(testResponse.data).toBeDefined();
      expect(testResponse.success).toBe(true);
      expect(testResponse.data.metadata.lawyerFeedback.removedReason).toBe(
        'OTHER'
      );
      expect(testResponse.data.metadata.lawyerFeedback.otherReason).toBe(
        '该法条与本案实际情况不符'
      );
    });

    it('缺少action参数时应返回400错误', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/v1/legal-references/article-1/feedback',
        {
          method: 'PUT',
          body: {},
        }
      );

      const response = await PUT(request, {
        params: Promise.resolve({ id: 'article-1' }),
      });
      const testResponse = await createTestResponse(response);

      assertions.assertError(testResponse, 400);
      expect(testResponse.error).toBe('缺少action参数');
    });

    it('无效的action参数时应返回400错误', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/v1/legal-references/article-1/feedback',
        {
          method: 'PUT',
          body: {
            action: 'INVALID_ACTION',
          },
        }
      );

      const response = await PUT(request, {
        params: Promise.resolve({ id: 'article-1' }),
      });
      const testResponse = await createTestResponse(response);

      assertions.assertError(testResponse, 400);
      expect(testResponse.error).toBe('无效的action参数');
    });

    it('移除操作缺少removedReason时应返回400错误', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/v1/legal-references/article-1/feedback',
        {
          method: 'PUT',
          body: {
            action: 'REMOVED',
          },
        }
      );

      const response = await PUT(request, {
        params: Promise.resolve({ id: 'article-1' }),
      });
      const testResponse = await createTestResponse(response);

      assertions.assertError(testResponse, 400);
      expect(testResponse.error).toBe('移除操作需要提供removedReason参数');
    });

    it('选择"其他"原因但缺少otherReason时应返回400错误', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/v1/legal-references/article-1/feedback',
        {
          method: 'PUT',
          body: {
            action: 'REMOVED',
            removedReason: 'OTHER',
            otherReason: '   ', // 空白字符
          },
        }
      );

      const response = await PUT(request, {
        params: Promise.resolve({ id: 'article-1' }),
      });
      const testResponse = await createTestResponse(response);

      assertions.assertError(testResponse, 400);
      expect(testResponse.error).toBe(
        '选择"其他"原因时需要提供otherReason参数'
      );
    });

    it('法条不存在时应返回404错误', async () => {
      mockFindUnique.mockResolvedValue(null);

      const request = createMockRequest(
        'http://localhost:3000/api/v1/legal-references/nonexistent/feedback',
        {
          method: 'PUT',
          body: {
            action: 'CONFIRMED',
          },
        }
      );

      const response = await PUT(request, {
        params: Promise.resolve({ id: 'nonexistent' }),
      });
      const testResponse = await createTestResponse(response);

      expect(testResponse.status).toBe(404);
      expect(testResponse.error).toBeDefined();
    });

    it('应该保留现有的metadata数据', async () => {
      const mockLegalReference = {
        id: 'article-1',
        lawName: '中华人民共和国合同法',
        articleNumber: '第8条',
        content: '依法成立的合同，对当事人具有法律约束力。',
        metadata: {
          existingData: 'should be preserved',
          existingNumber: 123,
        },
      };

      mockFindUnique.mockResolvedValue(mockLegalReference);
      mockUpdate.mockResolvedValue({
        ...mockLegalReference,
        metadata: {
          existingData: 'should be preserved',
          existingNumber: 123,
          lawyerFeedback: {
            action: 'CONFIRMED',
            timestamp: '2024-01-01T00:00:00.000Z',
          },
        },
      });

      const request = createMockRequest(
        'http://localhost:3000/api/v1/legal-references/article-1/feedback',
        {
          method: 'PUT',
          body: {
            action: 'CONFIRMED',
          },
        }
      );

      const response = await PUT(request, {
        params: Promise.resolve({ id: 'article-1' }),
      });
      const testResponse = await createTestResponse(response);

      expect(testResponse.status).toBe(200);
      expect(testResponse.data).toBeDefined();
      expect(testResponse.success).toBe(true);
      expect(testResponse.data.metadata.existingData).toBe(
        'should be preserved'
      );
      expect(testResponse.data.metadata.existingNumber).toBe(123);
    });
  });
});
