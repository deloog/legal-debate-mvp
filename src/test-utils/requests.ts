/**
 * 测试辅助函数 - 创建模拟的 HTTP 请求
 */

import { NextRequest } from 'next/server';

/**
 * 创建模拟的 NextRequest 用于测试 GET 请求
 */
export const createMockGetRequest = (url: string): NextRequest => {
  return {
    url,
    method: 'GET',
    headers: new Headers(),
    cookies: {
      get: () => undefined,
      getAll: () => [],
      set: () => {},
      delete: () => {},
    },
    json: async () => ({}),
    text: async () => '',
    blob: async () => new Blob(),
    formData: async () => new FormData(),
    arrayBuffer: async () => new ArrayBuffer(0),
    body: null,
    bodyUsed: false,
    clone: () => createMockGetRequest(url),
    nextUrl: {
      pathname: '',
      search: '',
      searchParams: new URLSearchParams(),
      hash: '',
      href: '',
      origin: '',
      protocol: 'http:',
      host: 'localhost',
      hostname: 'localhost',
      port: '',
      basePath: '',
    },
    page: undefined,
    ua: undefined,
  } as unknown as NextRequest;
};

/**
 * 创建模拟的 NextRequest 用于测试 POST 请求
 */
export const createMockPostRequest = (
  url: string,
  body: Record<string, unknown>
): NextRequest => {
  return {
    url,
    method: 'POST',
    headers: new Headers({ 'Content-Type': 'application/json' }),
    cookies: {
      get: () => undefined,
      getAll: () => [],
      set: () => {},
      delete: () => {},
    },
    json: async () => body,
    text: async () => JSON.stringify(body),
    blob: async () => new Blob([JSON.stringify(body)]),
    formData: async () => new FormData(),
    arrayBuffer: async () => new ArrayBuffer(0),
    body: null,
    bodyUsed: false,
    clone: () => createMockPostRequest(url, body),
    nextUrl: {
      pathname: '',
      search: '',
      searchParams: new URLSearchParams(),
      hash: '',
      href: '',
      origin: '',
      protocol: 'http:',
      host: 'localhost',
      hostname: 'localhost',
      port: '',
      basePath: '',
    },
    page: undefined,
    ua: undefined,
  } as unknown as NextRequest;
};
