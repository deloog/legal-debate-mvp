/**
 * 全局测试设置 - 在模块加载前执行
 * 确保Next.js Web API在任何模块导入前就被正确模拟
 */

// 设置Web API polyfills
const util = require('util');

if (!global.TextEncoder) {
  global.TextEncoder = util.TextEncoder;
}
if (!global.TextDecoder) {
  global.TextDecoder = util.TextDecoder;
}

// 模拟基本的Web API
const MockHeaders = class {
  constructor(init = {}) {
    this.headers = {};
    if (typeof init === 'object') {
      Object.assign(this.headers, init);
    }
  }

  set(name, value) {
    this.headers[name.toLowerCase()] = value;
  }

  get(name) {
    return this.headers[name.toLowerCase()];
  }

  has(name) {
    return name.toLowerCase() in this.headers;
  }

  delete(name) {
    delete this.headers[name.toLowerCase()];
  }

  entries() {
    return Object.entries(this.headers);
  }

  keys() {
    return Object.keys(this.headers);
  }

  values() {
    return Object.values(this.headers);
  }

  forEach(callback) {
    Object.entries(this.headers).forEach(([key, value]) => {
      callback(value, key, this);
    });
  }
};

const MockRequest = class {
  constructor(input, init = {}) {
    this.url = typeof input === 'string' ? input : input.toString();
    this.method = init.method || 'GET';
    
    if (init.headers instanceof MockHeaders) {
      this.headers = init.headers;
    } else {
      this.headers = new MockHeaders(init.headers || {});
    }
    
    this.body = init.body;
  }

  async json() {
    if (this.body) {
      try {
        return JSON.parse(typeof this.body === 'string' ? this.body : this.body.toString());
      } catch {
        throw new Error('Invalid JSON');
      }
    }
    return {};
  }

  async text() {
    return this.body ? (typeof this.body === 'string' ? this.body : this.body.toString()) : '';
  }
};

const MockResponse = class {
  constructor(body, init = {}) {
    init = init || {};
    
    if (typeof body === 'object' && body !== null) {
      body = JSON.stringify(body);
      if (!init.headers) {
        init.headers = new MockHeaders();
      } else if (!(init.headers instanceof MockHeaders)) {
        init.headers = new MockHeaders(init.headers);
      }
      if (!init.headers.get('Content-Type')) {
        init.headers.set('Content-Type', 'application/json');
      }
    } else if (!init.headers) {
      init.headers = new MockHeaders();
    } else if (!(init.headers instanceof MockHeaders)) {
      init.headers = new MockHeaders(init.headers);
    }
    
    this.body = body;
    this.status = init.status || 200;
    this.headers = init.headers;
  }

  static json(data, init) {
    return new MockResponse(data, init);
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
    return this.body || '';
  }
};

// 设置全局变量
global.Headers = MockHeaders;
global.Request = MockRequest;
global.Response = MockResponse;
global.NextRequest = MockRequest;
global.NextResponse = MockResponse;

// 设置Web Crypto API
global.crypto = {
  randomUUID: () => '123e4567-e89b-12d3-a456-426614174000',
  getRandomValues: (arr) => {
    for (let i = 0; i < arr.length; i++) {
      arr[i] = Math.floor(Math.random() * 256);
    }
    return arr;
  },
};

// 模拟fetch
global.fetch = jest.fn(() => 
  Promise.resolve(new MockResponse('{}', {
    status: 200,
    statusText: 'OK',
    headers: new MockHeaders(),
  }))
);

// 模拟localStorage和sessionStorage
global.localStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
  length: 0,
  key: jest.fn(),
};

global.sessionStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
  length: 0,
  key: jest.fn(),
};

// 设置环境变量
if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = 'test';
}

// 导出全局设置函数
export default async function globalSetup() {
  console.log('Global setup completed for API tests');
}
