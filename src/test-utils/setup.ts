import '@testing-library/jest-dom';
import React, { ReactElement } from 'react';

// Mock Next.js router
jest.mock('next/navigation', () => ({
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
    return '/';
  },
}));

// Mock Next.js dynamic import
jest.mock('next/dynamic', () => () => {
  return function DynamicComponent(
    props: Record<string, unknown>
  ): ReactElement {
    return React.createElement('div', {
      'data-testid': 'dynamic-component',
      ...props,
    });
  };
});

// Set up global Web API polyfills before any imports
// eslint-disable-next-line @typescript-eslint/no-explicit-any
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

    this.body = init.body ?? undefined;
    this.signal = init.signal ?? undefined;
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

  async json(): Promise<unknown> {
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

  async text(): Promise<string> {
    return this.body
      ? typeof this.body === 'string'
        ? this.body
        : this.body.toString()
      : '';
  }

  async blob(): Promise<Blob> {
    return new Blob([
      typeof this.body === 'string' ? this.body : String(this.body || ''),
    ]);
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
      signal: this.signal,
      credentials: this.credentials,
      cache: this.cache,
      redirect: this.redirect,
      referrer: this.referrer,
      referrerPolicy: this.referrerPolicy,
      integrity: this.integrity,
      keepalive: this.keepalive,
      mode: this.mode,
    });
  }
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(global as any).Response = class Response {
  constructor(body?: BodyInit, init: ResponseInit = {}) {
    this.body = body;
    this.status = init.status || 200;
    this.statusText = init.statusText || 'OK';
    this.headers = new Map();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.url = (init as any).url || '';
    this.ok = this.status >= 200 && this.status < 300;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.redirected = (init as any).redirected || false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.type = (init as any).type || 'basic';

    if (init.headers) {
      if (init.headers instanceof Map) {
        this.headers = init.headers;
      } else if (Array.isArray(init.headers)) {
        init.headers.forEach(([key, value]) => {
          this.headers.set(key, value);
        });
      } else if (typeof init.headers === 'object') {
        Object.entries(init.headers).forEach(([key, value]) => {
          this.headers.set(key, String(value));
        });
      }
    }

    if (
      typeof body === 'object' &&
      body !== null &&
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      !(init.headers as any)?.get?.('Content-Type')
    ) {
      this.headers.set('Content-Type', 'application/json');
    }

    // Add header property for compatibility with existing tests
    this.header = {
      get: (name: string) => this.headers.get(name.toLowerCase()),
      set: (name: string, value: string) =>
        this.headers.set(name.toLowerCase(), value),
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

  static json(data: unknown, init: Record<string, unknown> = {}): Response {
    const initRecord = init as Record<string, unknown>;
    return new Response(JSON.stringify(data), {
      ...initRecord,
      headers: {
        'Content-Type': 'application/json',
        ...(initRecord.headers as Record<string, unknown>),
      },
    });
  }

  static redirect(url: string, status: number = 302): Response {
    return new Response(undefined, {
      status,
      headers: { Location: url },
    });
  }

  static error(): Response {
    return new Response(undefined, {
      status: 500,
      statusText: 'Internal Server Error',
    });
  }

  async json(): Promise<unknown> {
    const text = await this.text();
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }

  async text(): Promise<string> {
    return this.body
      ? typeof this.body === 'string'
        ? this.body
        : this.body.toString()
      : '';
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
      url: this.url,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
  }
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
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

  forEach(
    callback: (value: string, key: string, map: Map<string, string>) => void
  ): void {
    this.headers.forEach(callback);
  }
};

// Mock Next.js server module
jest.mock('next/server', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const MockRequest = (global as any).Request;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

// Mock Prisma client - 共享的 mock
export const mockPrisma = {
  user: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    upsert: jest.fn(),
  },
  case: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    upsert: jest.fn(),
  },
  debate: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    upsert: jest.fn(),
  },
  debateRound: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    upsert: jest.fn(),
  },
  debateArgument: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    upsert: jest.fn(),
  },
  lawArticle: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    upsert: jest.fn(),
  },
  lawArticleRelation: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    upsert: jest.fn(),
    createMany: jest.fn(),
  },
  evidence: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    upsert: jest.fn(),
  },
  document: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    upsert: jest.fn(),
  },
  inAppMessage: {
    create: jest.fn(),
    createMany: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    upsert: jest.fn(),
  },
  reminder: {
    create: jest.fn(),
    createMany: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    upsert: jest.fn(),
  },
  team: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    upsert: jest.fn(),
  },
  teamMember: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    upsert: jest.fn(),
  },
  membership: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    upsert: jest.fn(),
  },
  membershipPlan: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    upsert: jest.fn(),
  },
  membershipFeature: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    upsert: jest.fn(),
  },
  knowledgeGraph: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    upsert: jest.fn(),
  },
  order: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    upsert: jest.fn(),
  },
  payment: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    upsert: jest.fn(),
  },
  aiQuota: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    upsert: jest.fn(),
  },
  storage: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    upsert: jest.fn(),
  },
  auditLog: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    upsert: jest.fn(),
  },
  agent: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    upsert: jest.fn(),
  },
  agentMemory: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    upsert: jest.fn(),
  },
  template: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    upsert: jest.fn(),
  },
  courtSchedule: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    upsert: jest.fn(),
  },
  task: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    upsert: jest.fn(),
  },
  $transaction: jest.fn(),
  $connect: jest.fn(),
  $disconnect: jest.fn(),
  $queryRaw: jest.fn(),
};

jest.mock('@/lib/db/prisma', () => {
  const mock: Record<string, unknown> = {
    user: {},
    case: {},
    debate: {},
    debateRound: {},
    debateArgument: {},
    lawArticle: {},
    lawArticleRelation: {},
    evidence: {},
    document: {},
    inAppMessage: {},
    reminder: {},
    team: {},
    teamMember: {},
    membership: {},
    membershipPlan: {},
    membershipFeature: {},
    knowledgeGraph: {},
    order: {},
    payment: {},
    aiQuota: {},
    storage: {},
    auditLog: {},
    agent: {},
    agentMemory: {},
    template: {},
    courtSchedule: {},
    task: {},
    // 额外的模型
    caseExample: {},
    aiInteraction: {},
    discussion: {},
    discussionComment: {},
    notification: {},
    followUpTask: {},
    followUpTaskProcessor: {},
    role: {},
    permission: {},
    userRole: {},
    qualification: {},
    contract: {},
    filingMaterials: {},
    similarCase: {},
    timeline: {},
    approvalTemplate: {},
    contractApproval: {},
    approvalStep: {},
    $transaction: jest.fn(),
    $connect: jest.fn(),
    $disconnect: jest.fn(),
    $queryRaw: jest.fn(),
  };

  // 为每个模型添加所有常见方法
  const models = [
    'user',
    'case',
    'debate',
    'debateRound',
    'debateArgument',
    'lawArticle',
    'lawArticleRelation',
    'evidence',
    'document',
    'inAppMessage',
    'reminder',
    'team',
    'teamMember',
    'membership',
    'membershipPlan',
    'membershipFeature',
    'knowledgeGraph',
    'order',
    'payment',
    'aiQuota',
    'storage',
    'auditLog',
    'agent',
    'agentMemory',
    'template',
    'courtSchedule',
    'task',
    'caseExample',
    'aiInteraction',
    'discussion',
    'discussionComment',
    'notification',
    'followUpTask',
    'followUpTaskProcessor',
    'role',
    'permission',
    'userRole',
    'qualification',
    'contract',
    'filingMaterials',
    'similarCase',
    'timeline',
    'approvalTemplate',
    'contractApproval',
    'approvalStep',
  ];

  models.forEach(model => {
    const modelMock = mock[model] as Record<string, unknown>;
    [
      'create',
      'findUnique',
      'findFirst',
      'update',
      'delete',
      'deleteMany',
      'findMany',
      'count',
      'upsert',
      'createMany',
    ].forEach(method => {
      modelMock[method] = jest.fn();
    });
  });

  return {
    default: mock,
    prisma: mock,
  };
});

// Suppress console warnings in tests
const originalWarn = console.warn;
beforeAll(() => {
  console.warn = (...args: unknown[]) => {
    if (
      typeof args[0] === 'string' &&
      args[0].includes('act() is deprecated')
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
