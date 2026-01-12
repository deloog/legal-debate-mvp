/**
 * API测试环境设置
 * 确保Web API在Node环境中可用
 */

// 首先定义Headers类
global.Headers = class Headers {
  constructor(init = {}) {
    this.headers = new Map();
    if (typeof init === 'object') {
      if (init instanceof Map) {
        this.headers = new Map(init);
      } else if (init instanceof Headers) {
        init.forEach((value, key) => {
          this.headers.set(key, value);
        });
      } else if (Array.isArray(init)) {
        init.forEach(([key, value]) => {
          this.headers.set(key, value);
        });
      } else {
        Object.entries(init).forEach(([key, value]) => {
          this.headers.set(key, value);
        });
      }
    }
  }

  set(name, value) {
    this.headers.set(name, String(value));
  }

  get(name) {
    return this.headers.get(name);
  }

  has(name) {
    return this.headers.has(name);
  }

  delete(name) {
    this.headers.delete(name);
  }

  append(name, value) {
    const existing = this.get(name);
    if (existing) {
      this.set(name, `${existing}, ${value}`);
    } else {
      this.set(name, value);
    }
  }

  entries() {
    return this.headers.entries();
  }

  keys() {
    return this.headers.keys();
  }

  values() {
    return this.headers.values();
  }

  forEach(callback) {
    this.headers.forEach(callback);
  }
};

// 然后定义Request类
global.Request = class Request {
  constructor(input, init = {}) {
    this.url = typeof input === 'string' ? input : input.toString();
    this.method = init.method || 'GET';
    this.headers = new Map();

    if (init.headers) {
      if (init.headers instanceof Map) {
        this.headers = init.headers;
      } else {
        Object.entries(init.headers).forEach(([key, value]) => {
          this.headers.set(key, value);
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

  async json() {
    if (this.body) {
      try {
        return JSON.parse(
          typeof this.body === 'string' ? this.body : this.body.toString()
        );
      } catch {
        throw new Error('Invalid JSON');
      }
    }
    return {};
  }

  async text() {
    return this.body
      ? typeof this.body === 'string'
        ? this.body
        : this.body.toString()
      : '';
  }

  async blob() {
    return new Blob([this.body || '']);
  }

  async arrayBuffer() {
    return new TextEncoder().encode(await this.text()).buffer;
  }

  clone() {
    return new Request(this.url, {
      method: this.method,
      headers: Object.fromEntries(this.headers),
      body: this.body,
      ...this,
    });
  }
};

global.Response = class Response {
  constructor(body, init = {}) {
    init = init || {};

    this.body = body;
    this.status = init.status || 200;
    this.statusText = init.statusText || 'OK';
    this.url = init.url || '';
    this.ok = this.status >= 200 && this.status < 300;
    this.redirected = init.redirected || false;
    this.type = init.type || 'basic';

    // 创建Headers对象而不是Map
    this.headers = new global.Headers();

    // 先设置init中的headers
    if (init.headers) {
      if (init.headers instanceof Map) {
        init.headers.forEach((value, key) => {
          this.headers.set(key, value);
        });
      } else if (init.headers instanceof global.Headers) {
        init.headers.forEach((value, key) => {
          this.headers.set(key, value);
        });
      } else {
        Object.entries(init.headers).forEach(([key, value]) => {
          this.headers.set(key, value);
        });
      }
    }

    // 只有在没有显式设置Content-Type时才自动设置
    // 并且只对非ArrayBuffer、非Blob、非ReadableStream的对象设置
    if (
      typeof body === 'object' &&
      body !== null &&
      !(body instanceof ArrayBuffer) &&
      !(body instanceof Blob) &&
      !(body instanceof ReadableStream) &&
      !this.headers.has('Content-Type')
    ) {
      this.headers.set('Content-Type', 'application/json');
    }
  }

  static json(data, init = {}) {
    return new Response(JSON.stringify(data), {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...init.headers,
      },
    });
  }

  static redirect(url, status = 302) {
    return new Response(null, {
      status,
      headers: { Location: url },
    });
  }

  static error() {
    return new Response(null, {
      status: 500,
      statusText: 'Internal Server Error',
    });
  }

  async json() {
    const text = await this.text();
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }

  async text() {
    return this.body
      ? typeof this.body === 'string'
        ? this.body
        : this.body.toString()
      : '';
  }

  async blob() {
    return new Blob([this.body || '']);
  }

  async arrayBuffer() {
    return new TextEncoder().encode(await this.text()).buffer;
  }

  clone() {
    return new Response(this.body, {
      status: this.status,
      statusText: this.statusText,
      headers: Object.fromEntries(this.headers),
      url: this.url,
    });
  }
};

// 立即模拟Next.js模块
jest.mock('next/server', () => {
  const MockHeaders = global.Headers;
  const MockRequest = global.Request;
  const MockResponse = global.Response;

  // Add static methods to NextResponse
  MockResponse.next = jest.fn(() => new MockResponse(null));

  return {
    NextRequest: MockRequest,
    NextResponse: MockResponse,
  };
});

// 设置基本的Web API polyfills
const util = require('util');

if (!global.TextEncoder) {
  global.TextEncoder = util.TextEncoder;
}
if (!global.TextDecoder) {
  global.TextDecoder = util.TextDecoder;
}

// 模拟fetch
global.fetch = jest.fn(() =>
  Promise.resolve({
    status: 200,
    statusText: 'OK',
    headers: new Headers(),
    json: () => Promise.resolve({}),
    text: () => Promise.resolve('{}'),
  })
);

// 模拟localStorage和sessionStorage
if (!global.localStorage) {
  global.localStorage = {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn(),
    length: 0,
    key: jest.fn(),
  };
}

if (!global.sessionStorage) {
  global.sessionStorage = {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn(),
    length: 0,
    key: jest.fn(),
  };
}

// 设置Web Crypto API
if (!global.crypto) {
  global.crypto = {
    randomUUID: () => '123e4567-e89b-12d3-a456-426614174000',
    getRandomValues: arr => {
      for (let i = 0; i < arr.length; i++) {
        arr[i] = Math.floor(Math.random() * 256);
      }
      return arr;
    },
  };
}

// 添加ReadableStream polyfill
global.ReadableStream = class ReadableStream {
  constructor(underlyingSource) {
    this.underlyingSource = underlyingSource || {};
    this.controller = null;
    this.started = false;
  }

  async getReader() {
    return {
      read: async () => {
        // 简化的实现
        return { done: true, value: undefined };
      },
      releaseLock: () => {},
    };
  }

  async tee() {
    return [this, this.clone()];
  }

  clone() {
    return new ReadableStream(this.underlyingSource);
  }

  cancel(reason) {
    if (this.controller) {
      this.controller.error(reason);
    }
    return Promise.resolve();
  }

  pipeThrough(transformStream) {
    // 简化实现
    return this;
  }

  pipeTo(writableStream) {
    // 简化实现
    return Promise.resolve();
  }
};

// 设置环境变量
if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = 'test';
}
