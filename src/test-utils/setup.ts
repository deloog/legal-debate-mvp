import "@testing-library/jest-dom";
import React, { ReactElement } from "react";

// Mock Next.js router
jest.mock("next/navigation", () => ({
  useRouter() {
    return {
      push: jest.fn(),
      replace: jest.fn(),
      prefetch: jest.fn(),
      back: jest.fn(),
      forward: jest.fn(),
      refresh: jest.fn(),
    };
  },
  useSearchParams() {
    return new URLSearchParams();
  },
  usePathname() {
    return "/";
  },
}));

// Mock Next.js dynamic import
jest.mock("next/dynamic", () => () => {
  return function DynamicComponent(
    props: Record<string, unknown>,
  ): ReactElement {
    return React.createElement("div", {
      "data-testid": "dynamic-component",
      ...props,
    });
  };
});

// Set up global Web API polyfills before any imports
(global as any).Request = class Request {
  constructor(input: string | Request, init: RequestInit = {}) {
    this.url = typeof input === 'string' ? input : input.toString();
    this.method = init.method || 'GET';
    this.headers = new Map();
    
    if (init.headers) {
      if (init.headers instanceof Map) {
        this.headers = init.headers;
      } else {
        Object.entries(init.headers).forEach(([key, value]) => {
          this.headers.set(key, String(value));
        });
      }
    }
    
    this.body = init.body;
    this.signal = init.signal;
    this.credentials = init.credentials || 'same-origin';
    this.cache = init.cache || 'default';
    this.redirect = init.redirect || 'follow';
    this.referrer = init.referrer;
    this.referrerPolicy = init.referrerPolicy || '';
    this.integrity = init.integrity || '';
    this.keepalive = init.keepalive || false;
    this.mode = init.mode || 'cors';
  }

  url: string;
  method: string;
  headers: Map<string, string>;
  body?: BodyInit;
  signal?: AbortSignal;
  credentials: RequestCredentials;
  cache: RequestCache;
  redirect: RequestRedirect;
  referrer?: string;
  referrerPolicy: ReferrerPolicy;
  integrity: string;
  keepalive: boolean;
  mode: RequestMode;

  async json(): Promise<any> {
    if (this.body) {
      try {
        return JSON.parse(typeof this.body === 'string' ? this.body : this.body.toString());
      } catch {
        throw new Error('Invalid JSON');
      }
    }
    return {};
  }

  async text(): Promise<string> {
    return this.body ? (typeof this.body === 'string' ? this.body : this.body.toString()) : '';
  }

  async blob(): Promise<Blob> {
    return new Blob([typeof this.body === 'string' ? this.body : String(this.body || '')]);
  }

  async arrayBuffer(): Promise<ArrayBuffer> {
    const text = await this.text();
    return new TextEncoder().encode(text).buffer as ArrayBuffer;
  }

  clone(): Request {
    return new Request(this.url, {
      method: this.method,
      headers: Object.fromEntries(this.headers),
      body: this.body,
      ...this
    });
  }
};

(global as any).Response = class Response {
  constructor(body?: BodyInit, init: any = {}) {
    this.body = body;
    this.status = init.status || 200;
    this.statusText = init.statusText || 'OK';
    this.headers = new Map();
    this.url = init.url || '';
    this.ok = this.status >= 200 && this.status < 300;
    this.redirected = init.redirected || false;
    this.type = init.type || 'basic';
    
    if (init.headers) {
      if (init.headers instanceof Map) {
        this.headers = init.headers;
      } else if (init.headers.get) {
        this.headers = init.headers;
      } else {
        Object.entries(init.headers).forEach(([key, value]) => {
          this.headers.set(key, String(value));
        });
      }
    }
    
    if (typeof body === 'object' && body !== null && !init.headers?.get?.('Content-Type')) {
      this.headers.set('Content-Type', 'application/json');
    }

    // Add header property for compatibility with existing tests
    this.header = {
      get: (name: string) => this.headers.get(name.toLowerCase()),
      set: (name: string, value: string) => this.headers.set(name.toLowerCase(), value),
      has: (name: string) => this.headers.has(name.toLowerCase()),
      delete: (name: string) => this.headers.delete(name.toLowerCase()),
      entries: () => Array.from(this.headers.entries()),
      keys: () => Array.from(this.headers.keys()),
      values: () => Array.from(this.headers.values()),
      forEach: (callback: (value: string, key: string) => void) => {
        this.headers.forEach(callback);
      },
    };
  }

  body?: BodyInit;
  status: number;
  statusText: string;
  headers: Map<string, string>;
  url: string;
  ok: boolean;
  redirected: boolean;
  type: ResponseType;
  header: {
    get(name: string): string | undefined;
    set(name: string, value: string): void;
    has(name: string): boolean;
    delete(name: string): boolean;
    entries(): Array<[string, string]>;
    keys(): string[];
    values(): string[];
    forEach(callback: (value: string, key: string) => void): void;
  };

  static json(data: any, init: any = {}): Response {
    return new Response(JSON.stringify(data), {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...init.headers
      }
    });
  }

  static redirect(url: string, status: number = 302): Response {
    return new Response(null, {
      status,
      headers: { Location: url }
    });
  }

  static error(): Response {
    return new Response(null, { status: 500, statusText: 'Internal Server Error' });
  }

  async json(): Promise<any> {
    const text = await this.text();
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }

  async text(): Promise<string> {
    return this.body ? (typeof this.body === 'string' ? this.body : this.body.toString()) : '';
  }

  async blob(): Promise<Blob> {
    const body = this.body;
    if (body === null || body === undefined) {
      return new Blob([]);
    }
    if (typeof body === 'string') {
      return new Blob([body]);
    }
    if (body instanceof ReadableStream) {
      // Handle ReadableStream by converting to text first
      return new Blob(['stream']);
    }
    return new Blob([String(body)]);
  }

  async arrayBuffer(): Promise<ArrayBuffer> {
    const buffer = new TextEncoder().encode(await this.text()).buffer;
    return buffer as ArrayBuffer;
  }

  clone(): Response {
    return new Response(this.body, {
      status: this.status,
      statusText: this.statusText,
      headers: Object.fromEntries(this.headers),
      url: this.url
    });
  }
};

(global as any).Headers = class Headers {
  constructor(init: HeadersInit = {}) {
    this.headers = new Map();
    if (typeof init === 'object') {
      if (init instanceof Map) {
        this.headers = init;
      } else if (Array.isArray(init)) {
        init.forEach(([key, value]) => {
          this.headers.set(key, value);
        });
      } else {
        Object.entries(init).forEach(([key, value]) => {
          this.headers.set(key, String(value));
        });
      }
    }
  }

  headers: Map<string, string>;

  set(name: string, value: string): void {
    this.headers.set(name, value);
  }

  get(name: string): string | undefined {
    return this.headers.get(name);
  }

  has(name: string): boolean {
    return this.headers.has(name);
  }

  delete(name: string): boolean {
    return this.headers.delete(name);
  }

  append(name: string, value: string): void {
    const existing = this.get(name);
    if (existing) {
      this.set(name, `${existing}, ${value}`);
    } else {
      this.set(name, value);
    }
  }

  entries(): IterableIterator<[string, string]> {
    return this.headers.entries();
  }

  keys(): IterableIterator<string> {
    return this.headers.keys();
  }

  values(): IterableIterator<string> {
    return this.headers.values();
  }

  forEach(callback: (value: string, key: string, map: Map<string, string>) => void): void {
    this.headers.forEach(callback);
  }
};

// Mock Next.js server module
jest.mock('next/server', () => {
  const MockHeaders = (global as any).Headers;
  const MockRequest = (global as any).Request;
  const MockResponse = (global as any).Response;

  // Add static methods to NextResponse
  MockResponse.next = jest.fn(() => {
    const response = new MockResponse(null);
    // Ensure headers are properly initialized for NextResponse.next()
    return response;
  });
  
  return {
    NextRequest: MockRequest,
    NextResponse: MockResponse,
  };
});

// Suppress console warnings in tests
const originalWarn = console.warn;
beforeAll(() => {
  console.warn = (...args: unknown[]) => {
    if (
      typeof args[0] === "string" &&
      args[0].includes("act() is deprecated")
    ) {
      return;
    }
    originalWarn(...args);
  };
});

afterAll(() => {
  console.warn = originalWarn;
});

// Global test cleanup
afterEach(() => {
  jest.clearAllMocks();
});
