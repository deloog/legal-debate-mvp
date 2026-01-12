/**
 * Next.js server模块的模拟
 * 提供NextRequest和NextResponse的模拟实现
 */

// 立即模拟next/server模块
jest.mock('next/server', () => {
  const MockHeaders = class {
    constructor(init = {}) {
      this.headers = {};
      if (typeof init === 'object') {
        this.headers = { ...init };
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

  return {
    NextRequest: MockRequest,
    NextResponse: MockResponse,
  };
});
