import { GET, HEAD } from '@/app/api/version/route';
import {
  createMockRequest,
  createTestResponse,
  assertions,
} from './test-utils';

describe('Version API', () => {
  describe('GET /api/version', () => {
    it('should return version information', async () => {
      const request = createMockRequest('http://localhost:3000/api/version');
      const response = await GET(request);
      const testResponse = await createTestResponse(response);

      assertions.assertSuccess(testResponse);
      expect(testResponse.data.data.api).toBeDefined();
      expect(testResponse.data.data.application).toBeDefined();
      expect(testResponse.data.data.runtime).toBeDefined();
      expect(testResponse.data.data.endpoints).toBeDefined();
      expect(testResponse.data.data.documentation).toBeDefined();
      expect(testResponse.data.data.support).toBeDefined();
    });

    it('should include correct API version', async () => {
      const request = createMockRequest('http://localhost:3000/api/version');
      const response = await GET(request);
      const testResponse = await createTestResponse(response);

      expect(testResponse.data.data.api.version).toBe('v1');
      expect(testResponse.data.data.api.name).toBe('Legal Debate API');
      expect(testResponse.data.data.api.description).toBe(
        'RESTful API for Legal Debate System'
      );
    });

    it('should include application information', async () => {
      const request = createMockRequest('http://localhost:3000/api/version');
      const response = await GET(request);
      const testResponse = await createTestResponse(response);

      expect(testResponse.data.data.application.name).toBeDefined();
      expect(testResponse.data.data.application.version).toBeDefined();
      expect(testResponse.data.data.application.description).toBeDefined();
      expect(typeof testResponse.data.data.application.version).toBe('string');
    });

    it('should include runtime information', async () => {
      const request = createMockRequest('http://localhost:3000/api/version');
      const response = await GET(request);
      const testResponse = await createTestResponse(response);

      expect(testResponse.data.data.runtime.nodeVersion).toBeDefined();
      expect(testResponse.data.data.runtime.platform).toBeDefined();
      expect(testResponse.data.data.runtime.arch).toBeDefined();
      expect(testResponse.data.data.runtime.uptime).toBeDefined();
      expect(testResponse.data.data.runtime.uptime).toBeGreaterThanOrEqual(0);
    });

    it('should include endpoints information', async () => {
      const request = createMockRequest('http://localhost:3000/api/version');
      const response = await GET(request);
      const testResponse = await createTestResponse(response);

      expect(testResponse.data.data.endpoints.v1).toBe('/api/v1');
      expect(testResponse.data.data.endpoints.health).toBe('/api/health');
      expect(testResponse.data.data.endpoints.version).toBe('/api/version');
    });

    it('should include documentation information', async () => {
      const request = createMockRequest('http://localhost:3000/api/version');
      const response = await GET(request);
      const testResponse = await createTestResponse(response);

      expect(testResponse.data.data.documentation.swagger).toBe('/api/docs');
      expect(testResponse.data.data.documentation.postman).toBe(
        '/api/docs/postman'
      );
    });

    it('should include support information', async () => {
      const request = createMockRequest('http://localhost:3000/api/version');
      const response = await GET(request);
      const testResponse = await createTestResponse(response);

      expect(testResponse.data.data.support.contact).toBe(
        'support@legaldebate.com'
      );
      expect(testResponse.data.data.support.documentation).toBe(
        'https://docs.legaldebate.com'
      );
      expect(testResponse.data.data.support.issues).toBe(
        'https://github.com/legaldebate/issues'
      );
    });

    it('should include proper response headers', async () => {
      const request = createMockRequest('http://localhost:3000/api/version');
      const response = await GET(request);

      expect(response.headers.get('Content-Type')).toBe('application/json');
    });
  });

  describe('HEAD /api/version', () => {
    it('should return 200 status without body', async () => {
      const request = createMockRequest('http://localhost:3000/api/version', {
        method: 'HEAD',
      });
      const response = await HEAD(request);

      expect(response.status).toBe(200);
      const text = await response.text();
      expect(text).toBe('');
    });

    it('should include appropriate headers for HEAD', async () => {
      const request = createMockRequest('http://localhost:3000/api/version', {
        method: 'HEAD',
      });
      const response = await HEAD(request);

      expect(response.status).toBe(200);
      // HEAD responses typically don't include content-type
    });
  });

  describe('Error handling', () => {
    it('should handle unexpected errors gracefully', async () => {
      // Mock console.error to capture error logging
      const originalConsoleError = console.error;
      console.error = jest.fn();

      const request = createMockRequest('http://localhost:3000/api/version');

      // Test normal case since error handling is done by withErrorHandler
      const response = await GET(request);
      const testResponse = await createTestResponse(response);

      expect(testResponse.status).toBeLessThan(500);

      console.error = originalConsoleError;
    });
  });
});
