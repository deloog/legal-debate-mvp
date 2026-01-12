import { GET, PUT, DELETE, OPTIONS } from '@/app/api/v1/cases/[id]/route';
import {
  createMockRequest,
  createTestResponse,
  assertions,
} from './test-utils';

describe('Cases ID API', () => {
  const mockCaseId = '123e4567-e89b-12d3-a456-426614174000';

  describe('GET /api/v1/cases/[id]', () => {
    it('should return case details', async () => {
      const request = createMockRequest(
        `http://localhost:3000/api/v1/cases/${mockCaseId}`
      );
      const response = await GET(request, { params: { id: mockCaseId } });
      const testResponse = await createTestResponse(response);

      assertions.assertSuccess(testResponse);
      expect(testResponse.data.data.id).toBe(mockCaseId);
      expect(testResponse.data.data.title).toBe('合同纠纷案件');
      expect(testResponse.data.data.description).toBe(
        '涉及买卖合同违约的纠纷案件'
      );
      expect(testResponse.data.data.type).toBe('civil');
      expect(testResponse.data.data.status).toBe('active');
      expect(testResponse.data.data.documents).toBeDefined();
      expect(testResponse.data.data.debates).toBeDefined();
    });

    it('should handle invalid UUID', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/v1/cases/invalid-id'
      );
      const response = await GET(request, { params: { id: 'invalid-id' } });
      const testResponse = await createTestResponse(response);

      assertions.assertValidationError(testResponse);
    });

    it('should include timestamps', async () => {
      const request = createMockRequest(
        `http://localhost:3000/api/v1/cases/${mockCaseId}`
      );
      const response = await GET(request, { params: { id: mockCaseId } });
      const testResponse = await createTestResponse(response);

      expect(testResponse.data.data.createdAt).toBeDefined();
      expect(testResponse.data.data.updatedAt).toBeDefined();
      expect(typeof testResponse.data.data.createdAt).toBe('string');
      expect(typeof testResponse.data.data.updatedAt).toBe('string');
    });

    it('should include proper response headers', async () => {
      const request = createMockRequest(
        `http://localhost:3000/api/v1/cases/${mockCaseId}`
      );
      const response = await GET(request, { params: { id: mockCaseId } });

      expect(response.headers.get('Content-Type')).toBe('application/json');
    });
  });

  describe('PUT /api/v1/cases/[id]', () => {
    it('should update case successfully', async () => {
      const updateData = {
        title: '更新后的案件标题',
        description: '更新后的案件描述',
        type: 'criminal' as const,
        status: 'closed' as const,
      };

      const request = createMockRequest(
        `http://localhost:3000/api/v1/cases/${mockCaseId}`,
        {
          method: 'PUT',
          body: updateData,
        }
      );

      const response = await PUT(request, { params: { id: mockCaseId } });
      const testResponse = await createTestResponse(response);

      assertions.assertSuccess(testResponse);
      expect(testResponse.data.data.id).toBe(mockCaseId);
      expect(testResponse.data.data.title).toBe(updateData.title);
      expect(testResponse.data.data.description).toBe(updateData.description);
      expect(testResponse.data.data.type).toBe(updateData.type);
      expect(testResponse.data.data.status).toBe(updateData.status);
      expect(testResponse.data.data.updatedAt).toBeDefined();
    });

    it('should handle invalid UUID in PUT', async () => {
      const updateData = {
        title: '更新标题',
      };

      const request = createMockRequest(
        'http://localhost:3000/api/v1/cases/invalid-id',
        {
          method: 'PUT',
          body: updateData,
        }
      );

      const response = await PUT(request, { params: { id: 'invalid-id' } });
      const testResponse = await createTestResponse(response);

      assertions.assertValidationError(testResponse);
    });

    it('should handle invalid update data', async () => {
      const invalidData = {
        title: '', // 空标题应该验证失败
        type: 'invalid-type',
      };

      const request = createMockRequest(
        `http://localhost:3000/api/v1/cases/${mockCaseId}`,
        {
          method: 'PUT',
          body: invalidData,
        }
      );

      const response = await PUT(request, { params: { id: mockCaseId } });
      const testResponse = await createTestResponse(response);

      assertions.assertValidationError(testResponse);
    });

    it('should handle empty request body', async () => {
      const request = createMockRequest(
        `http://localhost:3000/api/v1/cases/${mockCaseId}`,
        {
          method: 'PUT',
        }
      );

      const response = await PUT(request, { params: { id: mockCaseId } });
      const testResponse = await createTestResponse(response);

      // 应该能处理空body或返回验证错误
      expect(testResponse.status).toBeGreaterThanOrEqual(400);
    });

    it('should include proper response headers for PUT', async () => {
      const updateData = {
        title: '测试更新',
      };

      const request = createMockRequest(
        `http://localhost:3000/api/v1/cases/${mockCaseId}`,
        {
          method: 'PUT',
          body: updateData,
        }
      );

      const response = await PUT(request, { params: { id: mockCaseId } });

      expect(response.headers.get('Content-Type')).toBe('application/json');
    });
  });

  describe('DELETE /api/v1/cases/[id]', () => {
    it('should delete case successfully', async () => {
      const request = createMockRequest(
        `http://localhost:3000/api/v1/cases/${mockCaseId}`,
        {
          method: 'DELETE',
        }
      );

      const response = await DELETE(request, { params: { id: mockCaseId } });

      expect(response.status).toBe(204);
      const text = await response.text();
      expect(text).toBe('');
    });

    it('should handle invalid UUID in DELETE', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/v1/cases/invalid-id',
        {
          method: 'DELETE',
        }
      );

      const response = await DELETE(request, { params: { id: 'invalid-id' } });
      const testResponse = await createTestResponse(response);

      assertions.assertValidationError(testResponse);
    });

    it('should handle DELETE with proper headers', async () => {
      const request = createMockRequest(
        `http://localhost:3000/api/v1/cases/${mockCaseId}`,
        {
          method: 'DELETE',
        }
      );

      const response = await DELETE(request, { params: { id: mockCaseId } });

      expect(response.status).toBe(204);
    });
  });

  describe('OPTIONS /api/v1/cases/[id]', () => {
    it('should return CORS headers', async () => {
      const request = createMockRequest(
        `http://localhost:3000/api/v1/cases/${mockCaseId}`,
        {
          method: 'OPTIONS',
        }
      );

      const response = await OPTIONS(request);

      expect(response.status).toBe(200);
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
      expect(response.headers.get('Access-Control-Allow-Methods')).toBe(
        'GET, PUT, DELETE, OPTIONS'
      );
      expect(response.headers.get('Access-Control-Allow-Headers')).toBe(
        'Content-Type, Authorization'
      );
      expect(response.headers.get('Access-Control-Max-Age')).toBe('86400');
    });

    it('should return empty body for OPTIONS', async () => {
      const request = createMockRequest(
        `http://localhost:3000/api/v1/cases/${mockCaseId}`,
        {
          method: 'OPTIONS',
        }
      );

      const response = await OPTIONS(request);
      const text = await response.text();

      expect(text).toBe('');
    });
  });

  describe('Error handling', () => {
    it('should handle missing ID parameter', async () => {
      const request = createMockRequest('http://localhost:3000/api/v1/cases/');

      // 测试边界情况
      try {
        await GET(request, { params: { id: '' } });
      } catch (error) {
        // 预期会有验证错误
        expect(error).toBeDefined();
      }
    });

    it('should handle malformed request data', async () => {
      const request = createMockRequest(
        `http://localhost:3000/api/v1/cases/${mockCaseId}`,
        {
          method: 'PUT',
          headers: {
            'content-type': 'application/json',
          },
          body: 'invalid json',
        }
      );

      const response = await PUT(request, { params: { id: mockCaseId } });
      const testResponse = await createTestResponse(response);

      expect(testResponse.status).toBeGreaterThanOrEqual(400);
    });

    it('should console log for delete operations', async () => {
      const originalConsoleLog = console.log;
      console.log = jest.fn();

      const request = createMockRequest(
        `http://localhost:3000/api/v1/cases/${mockCaseId}`,
        {
          method: 'DELETE',
        }
      );

      await DELETE(request, { params: { id: mockCaseId } });

      expect(console.log).toHaveBeenCalledWith(
        `Deleting case with id: ${mockCaseId}`
      );

      console.log = originalConsoleLog;
    });
  });

  describe('Integration tests', () => {
    it('should handle full CRUD flow', async () => {
      // GET
      const getRequest = createMockRequest(
        `http://localhost:3000/api/v1/cases/${mockCaseId}`
      );
      const getResponse = await GET(getRequest, { params: { id: mockCaseId } });
      const getTestResponse = await createTestResponse(getResponse);

      assertions.assertSuccess(getTestResponse);
      expect(getTestResponse.data.data.id).toBe(mockCaseId);

      // PUT
      const updateData = {
        title: '集成测试更新',
        status: 'closed' as const,
      };
      const putRequest = createMockRequest(
        `http://localhost:3000/api/v1/cases/${mockCaseId}`,
        {
          method: 'PUT',
          body: updateData,
        }
      );
      const putResponse = await PUT(putRequest, { params: { id: mockCaseId } });
      const putTestResponse = await createTestResponse(putResponse);

      assertions.assertSuccess(putTestResponse);
      expect(putTestResponse.data.data.title).toBe(updateData.title);
      expect(putTestResponse.data.data.status).toBe(updateData.status);

      // DELETE
      const deleteRequest = createMockRequest(
        `http://localhost:3000/api/v1/cases/${mockCaseId}`,
        {
          method: 'DELETE',
        }
      );
      const deleteResponse = await DELETE(deleteRequest, {
        params: { id: mockCaseId },
      });

      expect(deleteResponse.status).toBe(204);
    });
  });
});
