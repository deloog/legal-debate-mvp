/**
 * Cases API v1 转发路由测试
 * 验证根级 /api/cases 转发到 /api/v1/cases
 */

import { GET, POST } from '@/app/api/cases/route';
import { NextRequest } from 'next/server';

// Mock v1 cases route
jest.mock('@/app/api/v1/cases/route', () => ({
  GET: jest.fn().mockResolvedValue({
    status: 200,
    headers: new Map([['X-API-Version', 'v1']]),
    json: jest.fn().mockResolvedValue({ data: [], total: 0 }),
  }),
  POST: jest.fn().mockResolvedValue({
    status: 201,
    headers: new Map([['X-API-Version', 'v1']]),
    json: jest.fn().mockResolvedValue({ id: 'case-1', name: 'Test' }),
  }),
}));

describe('/api/cases v1 proxy', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should forward GET request to /api/v1/cases', async () => {
    const request = {
      url: 'http://localhost:3000/api/cases?page=1',
      method: 'GET',
      headers: new Headers(),
      nextUrl: new URL('http://localhost:3000/api/cases?page=1'),
    } as unknown as NextRequest;

    const response = await GET(request);

    expect(response.headers.get('X-Deprecated')).toBe('true');
  });

  it('should forward POST request to /api/v1/cases', async () => {
    const request = {
      url: 'http://localhost:3000/api/cases',
      method: 'POST',
      headers: new Headers([['Content-Type', 'application/json']]),
      nextUrl: new URL('http://localhost:3000/api/cases'),
      json: jest.fn().mockResolvedValue({ name: 'Test Case' }),
    } as unknown as NextRequest;

    const response = await POST(request);

    expect(response.headers.get('X-Deprecated')).toBe('true');
  });

  it('should include Link header pointing to v1', async () => {
    const request = {
      url: 'http://localhost:3000/api/cases',
      method: 'GET',
      headers: new Headers(),
      nextUrl: new URL('http://localhost:3000/api/cases'),
    } as unknown as NextRequest;

    const response = await GET(request);

    const linkHeader = response.headers.get('Link');
    expect(linkHeader).toContain('/api/v1/cases');
    expect(linkHeader).toContain('rel="successor-version"');
  });
});
