/**
 * 中间件测试 - 模拟对象定义
 * 避免Next.js依赖问题，专注于测试中间件逻辑
 */

// 模拟基本的Web API接口
interface MockRequestInit {
  method?: string;
  headers?: Record<string, string>;
  body?: any;
}

interface MockResponseInit {
  status?: number;
  headers?: Record<string, string>;
}

interface MockHeadersData {
  get(name: string): string | undefined;
  set(name: string, value: string): void;
  has(name: string): boolean;
  delete(name: string): void;
  entries(): Array<[string, string]>;
  keys(): string[];
  values(): string[];
  forEach(callback: (value: string, key: string) => void): void;
  append?(name: string, value: string): void;
  getSetCookie?(): string[];
  [Symbol.iterator]?: () => Iterator<[string, string], any, undefined>;
}

// 模拟Request类
class MockRequest {
  public url: string;
  public method: string;
  public headers: Map<string, string>;
  public body: any;
  public cache: string = 'default';
  public credentials: string = 'same-origin';
  public destination: string = '';
  public integrity: string = '';
  public keepalive: boolean = false;
  public mode: string = 'cors';
  public redirect: string = 'follow';
  public referrer: string = '';
  public referrerPolicy: string = '';
  public signal: AbortSignal = new AbortController().signal;

  constructor(url: string | RequestInfo, init: MockRequestInit = {}) {
    this.url = typeof url === 'string' ? url : url.toString();
    this.method = init.method || 'GET';
    this.headers = new Map();
    this.body = init.body;

    if (init.headers) {
      Object.entries(init.headers).forEach(([key, value]) => {
        this.headers.set(key.toLowerCase(), value);
      });
    }
  }

  async json(): Promise<any> {
    return typeof this.body === 'string' ? JSON.parse(this.body) : this.body;
  }

  async text(): Promise<string> {
    return typeof this.body === 'string' ? this.body : JSON.stringify(this.body);
  }

  clone(): MockRequest {
    return new MockRequest(this.url, {
      method: this.method,
      headers: Object.fromEntries(this.headers),
      body: this.body,
    });
  }
}

// 模拟Response类
class MockResponse {
  public body: any;
  public status: number;
  public headers: Map<string, string>;
  public ok: boolean;
  public redirected: boolean = false;
  public statusText: string = '';
  public trailer: Promise<Record<string, string>> = Promise.resolve({});
  public type: string = 'default';
  public url: string = '';

  constructor(body: any = null, init: MockResponseInit = {}) {
    this.body = body;
    this.status = init.status || 200;
    this.ok = this.status >= 200 && this.status < 300;
    this.headers = new Map();

    if (init.headers) {
      Object.entries(init.headers).forEach(([key, value]) => {
        this.headers.set(key.toLowerCase(), value);
      });
    }
  }

  static json(data: any, init: MockResponseInit = {}): MockResponse {
    return new MockResponse(JSON.stringify(data), {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...init.headers,
      },
    });
  }

  static error(): MockResponse {
    return new MockResponse(null, { status: 500 });
  }

  static redirect(url: string, status: number = 302): MockResponse {
    return new MockResponse(null, {
      status,
      headers: { Location: url },
    });
  }

  async json(): Promise<any> {
    return typeof this.body === 'string' ? JSON.parse(this.body) : this.body;
  }

  async text(): Promise<string> {
    return typeof this.body === 'string' ? this.body : JSON.stringify(this.body);
  }

  get header(): MockHeadersData {
    const headerObj: Record<string, string> = {};
    this.headers.forEach((value, key) => {
      headerObj[key] = value;
    });

    return {
      get: (name: string) => this.headers.get(name),
      set: (name: string, value: string) => {
        this.headers.set(name.toLowerCase(), value);
      },
      has: (name: string) => this.headers.has(name.toLowerCase()),
      delete: (name: string) => {
        this.headers.delete(name.toLowerCase());
      },
      entries: () => Array.from(this.headers.entries()),
      keys: () => Array.from(this.headers.keys()),
      values: () => Array.from(this.headers.values()),
      forEach: (callback: (value: string, key: string) => void) => {
        this.headers.forEach(callback);
      },
    };
  }

  clone(): MockResponse {
    return new MockResponse(this.body, {
      status: this.status,
      headers: Object.fromEntries(this.headers),
    });
  }
}

// 模拟Headers类
class MockHeaders implements MockHeadersData {
  private data: Map<string, string>;

  constructor(init: Record<string, string> = {}) {
    this.data = new Map();
    Object.entries(init).forEach(([key, value]) => {
      this.data.set(key.toLowerCase(), value);
    });
  }

  set(name: string, value: string): void {
    this.data.set(name.toLowerCase(), value);
  }

  get(name: string): string | undefined {
    return this.data.get(name.toLowerCase());
  }

  has(name: string): boolean {
    return this.data.has(name.toLowerCase());
  }

  delete(name: string): void {
    this.data.delete(name.toLowerCase());
  }

  append(name: string, value: string): void {
    const existing = this.get(name);
    if (existing) {
      this.set(name, `${existing}, ${value}`);
    } else {
      this.set(name, value);
    }
  }

  getSetCookie(): string[] {
    const cookies: string[] = [];
    this.data.forEach((value, key) => {
      if (key.toLowerCase() === 'set-cookie') {
        cookies.push(value);
      }
    });
    return cookies;
  }

  entries(): Array<[string, string]> {
    return Array.from(this.data.entries());
  }

  keys(): string[] {
    return Array.from(this.data.keys());
  }

  values(): string[] {
    return Array.from(this.data.values());
  }

  forEach(callback: (value: string, key: string) => void): void {
    this.data.forEach(callback);
  }

  [Symbol.iterator](): Iterator<[string, string], any, undefined> {
    return this.data.entries()[Symbol.iterator]();
  }
}

// 模拟Next.js的NextResponse
class MockNextResponse extends MockResponse {
  static next(): MockResponse {
    const response = new MockResponse(null, { status: 200 });
    return response;
  }
  
  static json(data: any, init: MockResponseInit = {}): MockResponse {
    const response = new MockResponse(JSON.stringify(data), {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...init.headers,
      },
    });
    return response;
  }
}

// 设置全局模拟对象
(global as any).Request = MockRequest;
(global as any).Response = MockResponse;
(global as any).Headers = MockHeaders;
(global as any).NextResponse = MockNextResponse;

// 模拟console方法
const originalConsole = {
  log: console.log,
  warn: console.warn,
  error: console.error,
};

beforeEach(() => {
  // Mock console for testing
  console.log = jest.fn();
  console.warn = jest.fn();
  console.error = jest.fn();
});

afterEach(() => {
  console.log = originalConsole.log;
  console.warn = originalConsole.warn;
  console.error = originalConsole.error;
});

// 基本测试以确保mocks工作正常
describe('Mock Objects', () => {
  it('should create MockRequest correctly', () => {
    const request = new MockRequest('http://localhost:3000/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    
    expect(request.url).toBe('http://localhost:3000/test');
    expect(request.method).toBe('POST');
    expect(request.headers.get('content-type')).toBe('application/json');
  });

  it('should create MockResponse correctly', () => {
    const response = new MockResponse('test data', { status: 200 });
    
    expect(response.body).toBe('test data');
    expect(response.status).toBe(200);
    expect(response.ok).toBe(true);
  });

  it('should create MockNextResponse.next() correctly', () => {
    const response = MockNextResponse.next();
    
    expect(response.status).toBe(200);
    expect(response.ok).toBe(true);
  });
});

// 导出模拟对象供其他测试文件使用
export {
  MockRequest,
  MockResponse,
  MockHeaders,
  MockNextResponse,
  originalConsole,
};

export type {
  MockRequestInit,
  MockResponseInit,
  MockHeadersData,
};
