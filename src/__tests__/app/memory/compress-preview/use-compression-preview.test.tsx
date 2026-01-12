/**
 * useCompressionPreview Hook测试
 *
 * 注意：由于 Jest 模拟 fetch 的类型限制，需要使用类型断言。
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { renderHook, act } from '@testing-library/react';
import { useCompressionPreview } from '@/app/memory/compress-preview/use-compression-preview';

// Mock fetch
global.fetch = jest.fn() as jest.MockedFunction<typeof fetch>;

describe('useCompressionPreview Hook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('初始状态应该正确', () => {
    const { result } = renderHook(() => useCompressionPreview());

    expect(result.current.preview).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('应该成功处理content压缩预览', async () => {
    const mockResponse = {
      original: {
        content: '测试内容',
        length: 4,
      },
      compressed: {
        summary: '摘要',
        keyInfo: [{ field: '摘要', value: '压缩后的摘要', importance: 1.0 }],
        length: 10,
      },
      metrics: {
        compressionRatio: 0.5,
        spaceSaved: 2,
        keyInfoCount: 1,
      },
    };

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    });

    const { result } = renderHook(() => useCompressionPreview());

    await act(async () => {
      await result.current.handlePreview({
        content: '测试内容',
        importance: 0.8,
      });
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.preview).toEqual(mockResponse);
    expect(result.current.error).toBeNull();
  });

  it('应该成功处理memoryId压缩预览', async () => {
    const mockResponse = {
      original: {
        content: '记忆内容',
        length: 4,
      },
      compressed: {
        summary: '摘要',
        keyInfo: [{ field: '摘要', value: '压缩后的摘要', importance: 1.0 }],
        length: 10,
      },
      metrics: {
        compressionRatio: 0.5,
        spaceSaved: 2,
        keyInfoCount: 1,
      },
    };

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    });

    const { result } = renderHook(() => useCompressionPreview());

    await act(async () => {
      await result.current.handlePreview({
        memoryId: 'test-memory-123',
        importance: 0.8,
      });
    });

    expect(result.current.preview).toEqual(mockResponse);
    expect(result.current.error).toBeNull();
  });

  it('应该正确处理错误响应', async () => {
    const errorMessage = '压缩失败';

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: errorMessage }),
    });

    const { result } = renderHook(() => useCompressionPreview());

    await act(async () => {
      await result.current.handlePreview({ content: '测试内容' });
    });

    expect(result.current.preview).toBeNull();
    expect(result.current.error).toBe(errorMessage);
    expect(result.current.loading).toBe(false);
  });

  it('应该正确处理网络错误', async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('网络错误'));

    const { result } = renderHook(() => useCompressionPreview());

    await act(async () => {
      await result.current.handlePreview({ content: '测试内容' });
    });

    expect(result.current.preview).toBeNull();
    expect(result.current.error).toBe('网络错误');
    expect(result.current.loading).toBe(false);
  });

  it('应该正确调用API', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        original: { content: '测试', length: 2 },
        compressed: { summary: '摘要', keyInfo: [], length: 5 },
        metrics: { compressionRatio: 0.5, spaceSaved: 1, keyInfoCount: 0 },
      }),
    });

    const { result } = renderHook(() => useCompressionPreview());

    await act(async () => {
      await result.current.handlePreview({
        content: '测试内容',
        importance: 0.9,
      });
    });

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/v1/memory/compress-preview',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content: '测试内容', importance: 0.9 }),
      }
    );
  });

  it('应该正确重置状态', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        original: { content: '测试', length: 2 },
        compressed: { summary: '摘要', keyInfo: [], length: 5 },
        metrics: { compressionRatio: 0.5, spaceSaved: 1, keyInfoCount: 0 },
      }),
    });

    const { result } = renderHook(() => useCompressionPreview());

    await act(async () => {
      await result.current.handlePreview({ content: '测试内容' });
    });

    expect(result.current.preview).not.toBeNull();

    act(() => {
      result.current.reset();
    });

    expect(result.current.preview).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('应该在加载时显示loading状态', async () => {
    let resolveFetch: (value: any) => void;
    const fetchPromise = new Promise(resolve => {
      resolveFetch = resolve;
    });

    (global.fetch as jest.Mock).mockReturnValueOnce(fetchPromise);

    const { result } = renderHook(() => useCompressionPreview());

    act(() => {
      result.current.handlePreview({ content: '测试内容' });
    });

    expect(result.current.loading).toBe(true);

    await act(async () => {
      resolveFetch({
        ok: true,
        json: async () => ({
          original: { content: '测试', length: 2 },
          compressed: { summary: '摘要', keyInfo: [], length: 5 },
          metrics: { compressionRatio: 0.5, spaceSaved: 1, keyInfoCount: 0 },
        }),
      });
    });

    expect(result.current.loading).toBe(false);
  });
});
