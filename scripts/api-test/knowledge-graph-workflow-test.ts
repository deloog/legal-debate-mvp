/**
 * 知识图谱业务场景完整 API 测试
 *
 * 测试范围：
 * - 法条查询与检索
 * - 知识图谱关系查询
 * - 图谱路径分析
 * - 法条冲突检测
 * - 法条推荐
 * - 专家系统
 *
 * 使用方法:
 * 1. 确保服务器运行在 http://localhost:3000
 * 2. 运行: npx ts-node scripts/api-test/knowledge-graph-workflow-test.ts
 */

// =============================================================================
// 配置
// =============================================================================
const CONFIG = {
  BASE_URL: process.env.API_BASE_URL || 'http://localhost:3000',
  TEST_USER: {
    email: process.env.TEST_USER_EMAIL || 'test@example.com',
    password: process.env.TEST_USER_PASSWORD || 'test123456',
  },
  TIMEOUT: 30000,
};

// =============================================================================
// 类型定义
// =============================================================================
interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: { code: string; message: string };
  message?: string;
}

interface User {
  id: string;
  email: string;
  username: string;
  name: string;
  role: string;
}

interface AuthData {
  user: User;
  token: string;
}

interface LawArticle {
  id: string;
  lawName: string;
  articleNumber: string;
  fullText: string;
  lawType: string;
  category: string;
  tags: string[];
  keywords: string[];
  effectiveDate: string;
  status: 'VALID' | 'AMENDED' | 'REPEALED';
  viewCount: number;
  referenceCount: number;
}

interface LawArticleRelation {
  id: string;
  sourceId: string;
  targetId: string;
  relationType:
    | 'CONFLICTS'
    | 'COMPLEMENTS'
    | 'REQUIRES'
    | 'DERIVES'
    | 'REPEALS';
  confidence: number;
  strength: number;
  createdAt: string;
}

interface KnowledgeGraphPath {
  nodes: LawArticle[];
  edges: LawArticleRelation[];
  pathLength: number;
  totalWeight: number;
}

interface GraphQueryResult {
  nodes: LawArticle[];
  edges: LawArticleRelation[];
  totalCount: number;
}

interface GraphExpert {
  id: string;
  userId: string;
  specialty: string[];
  certificationLevel: 'JUNIOR' | 'SENIOR' | 'EXPERT';
  reputationScore: number;
  verified: boolean;
}

type HeadersWithSetCookie = Headers & {
  getSetCookie?: () => string[];
};

interface BrowseGraphPayload {
  nodes: Array<{
    id: string;
    lawName: string;
    articleNumber: string;
    category: string;
    level?: number;
  }>;
  links: Array<{
    source: string;
    target: string;
    relationType: string;
    strength: number;
  }>;
}

type BrowseGraphResponse = ApiResponse<BrowseGraphPayload> &
  Partial<BrowseGraphPayload> & {
    pagination?: {
      page: number;
      pageSize: number;
      total: number;
      totalPages: number;
    };
  };

function getSetCookieHeaders(headers: Headers): string[] {
  const cookieHeaders = headers as HeadersWithSetCookie;
  return typeof cookieHeaders.getSetCookie === 'function'
    ? cookieHeaders.getSetCookie()
    : [];
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

// =============================================================================
// 测试框架
// =============================================================================
class TestRunner {
  private tests: Array<{
    name: string;
    fn: () => Promise<void>;
    skip?: boolean;
  }> = [];
  private results: Array<{
    name: string;
    passed: boolean;
    error?: string;
    duration: number;
  }> = [];

  test(name: string, fn: () => Promise<void>, skip = false) {
    this.tests.push({ name, fn, skip });
  }

  async run() {
    console.log('\n🧠 开始运行知识图谱测试...\n');
    const startTime = Date.now();

    for (const { name, fn, skip } of this.tests) {
      if (skip) {
        console.log(`⏭️  SKIP: ${name}`);
        continue;
      }
      const testStart = Date.now();
      try {
        await fn();
        this.results.push({
          name,
          passed: true,
          duration: Date.now() - testStart,
        });
        console.log(`✅ PASS: ${name} (${Date.now() - testStart}ms)`);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        this.results.push({
          name,
          passed: false,
          error: errorMsg,
          duration: Date.now() - testStart,
        });
        console.log(`❌ FAIL: ${name} (${Date.now() - testStart}ms)`);
        console.log(`   Error: ${errorMsg}`);
      }
    }

    const passed = this.results.filter(r => r.passed).length;
    const failed = this.results.filter(r => !r.passed).length;
    console.log('\n' + '='.repeat(50));
    console.log(
      `📊 测试结果: ${passed} 通过, ${failed} 失败, 总计 ${this.results.length} 个测试`
    );
    console.log(`⏱️  总耗时: ${Date.now() - startTime}ms`);
    console.log('='.repeat(50) + '\n');
    return { passed, failed, total: this.results.length };
  }
}

// =============================================================================
// API 客户端
// =============================================================================
class ApiClient {
  private token: string = '';
  private baseUrl: string;
  private cookies: Record<string, string> = {};

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  setToken(token: string) {
    this.token = token;
  }

  private parseCookies(response: Response) {
    const setCookie = getSetCookieHeaders(response.headers);
    if (Array.isArray(setCookie)) {
      for (const cookie of setCookie) {
        const [nameValue] = cookie.split(';');
        const [name, value] = nameValue.trim().split('=');
        if (name && value !== undefined) {
          this.cookies[name] = value;
        }
      }
    }
  }

  private getCookieHeader(): string {
    return Object.entries(this.cookies)
      .map(([name, value]) => `${name}=${value}`)
      .join('; ');
  }

  private async request<T>(
    method: string,
    endpoint: string,
    body?: unknown
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
    if (this.token) headers['Authorization'] = `Bearer ${this.token}`;

    const cookieHeader = this.getCookieHeader();
    if (cookieHeader) headers['Cookie'] = cookieHeader;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CONFIG.TIMEOUT);

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      // Extract and save cookies
      this.parseCookies(response);

      if (response.status === 204) return { success: true } as ApiResponse<T>;
      const data = await response.json();
      if (!response.ok) {
        throw new Error(
          `HTTP ${response.status}: ${data.error?.message || data.message || 'Unknown error'}`
        );
      }
      return data;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Request timeout after ${CONFIG.TIMEOUT}ms`);
      }
      throw error;
    }
  }

  // Auth
  async register(data: {
    email: string;
    password: string;
    username: string;
    name: string;
    role?: string;
  }): Promise<ApiResponse<AuthData>> {
    return this.request('POST', '/api/auth/register', data);
  }

  async login(email: string, password: string): Promise<ApiResponse<AuthData>> {
    return this.request('POST', '/api/auth/login', { email, password });
  }

  // Law articles
  async searchLawArticles(
    query: string,
    limit = 10
  ): Promise<ApiResponse<{ articles: LawArticle[]; total: number }>> {
    return this.request(
      'GET',
      `/api/v1/law-articles?search=${encodeURIComponent(query)}&limit=${limit}`
    );
  }

  async getLawArticle(id: string): Promise<ApiResponse<LawArticle>> {
    return this.request('GET', `/api/v1/law-articles/${id}`);
  }

  // Knowledge graph
  async queryKnowledgeGraph(queryInput: {
    startNode?: string;
    direction?: 'in' | 'out' | 'both';
    depth?: number;
    filter?: {
      relationType?: string;
      minStrength?: number;
    };
  }): Promise<ApiResponse<GraphQueryResult>> {
    return this.request('POST', '/api/v1/knowledge-graph/query', {
      query: queryInput,
    });
  }

  // Relations
  async getRelations(
    articleId?: string
  ): Promise<ApiResponse<LawArticleRelation[]>> {
    const query = articleId ? `?articleId=${articleId}` : '';
    return this.request('GET', `/api/v1/knowledge-graph/relations${query}`);
  }

  async createRelation(data: {
    sourceId: string;
    targetId: string;
    relationType: string;
    confidence?: number;
  }): Promise<ApiResponse<LawArticleRelation>> {
    return this.request('POST', '/api/v1/knowledge-graph/relations', data);
  }

  // Path analysis
  async findPath(
    sourceId: string,
    targetId: string,
    algorithm = 'shortest'
  ): Promise<ApiResponse<KnowledgeGraphPath[]>> {
    return this.request(
      'GET',
      `/api/v1/knowledge-graph/paths?source=${sourceId}&target=${targetId}&algorithm=${algorithm}`
    );
  }

  // Conflict detection
  async detectConflicts(articleIds: string[]): Promise<
    ApiResponse<{
      conflicts: Array<{
        articleId: string;
        articleTitle: string;
        conflictsWith: Array<{
          articleId: string;
          articleTitle: string;
          relationType: string;
          strength: number;
        }>;
      }>;
      total: number;
    }>
  > {
    const ids = articleIds.join(',');
    return this.request(
      'GET',
      `/api/v1/knowledge-graph/conflicts?lawArticleIds=${ids}`
    );
  }

  // Recommendations
  async getRecommendations(
    articleId?: string,
    mode?: string,
    limit = 10
  ): Promise<
    ApiResponse<{
      sourceArticle: {
        id: string;
        lawName: string;
        articleNumber: string;
      } | null;
      recommendations: Array<{
        articleId: string;
        lawName: string;
        articleNumber: string;
        relevanceScore: number;
        reason: string;
      }>;
      mode: string;
    }>
  > {
    const params = new URLSearchParams();
    if (articleId) params.append('articleId', articleId);
    if (mode) params.append('mode', mode);
    params.append('limit', limit.toString());
    return this.request(
      'GET',
      `/api/v1/knowledge-graph/recommendations?${params.toString()}`
    );
  }

  // Neighbors
  async getNeighbors(
    articleId: string,
    depth = 1
  ): Promise<
    ApiResponse<{
      nodeId: string;
      neighbors: Array<{
        id: string;
        title: string;
        relationType: string;
        strength: number;
        distance: number;
      }>;
    }>
  > {
    return this.request(
      'GET',
      `/api/v1/knowledge-graph/neighbors?nodeId=${articleId}&depth=${depth}`
    );
  }

  // Browse graph
  async browseGraph(cursor?: string, limit = 20): Promise<BrowseGraphResponse> {
    const query = cursor
      ? `?page=${cursor}&pageSize=${limit}`
      : `?pageSize=${limit}`;
    return this.request('GET', `/api/v1/knowledge-graph/browse${query}`);
  }

  // Experts
  async getExperts(): Promise<ApiResponse<GraphExpert[]>> {
    return this.request('GET', '/api/knowledge-graph/experts');
  }

  async getExpertStats(expertId: string): Promise<
    ApiResponse<{
      contributions: number;
      verifiedRelations: number;
      accuracy: number;
    }>
  > {
    return this.request(
      'GET',
      `/api/knowledge-graph/experts/${expertId}/stats`
    );
  }

  // Quality score
  async getQualityScore(articleId: string): Promise<
    ApiResponse<{
      score: number;
      completeness: number;
      accuracy: number;
      freshness: number;
    }>
  > {
    return this.request(
      'GET',
      `/api/v1/knowledge-graph/quality-score/${articleId}`
    );
  }

  // Snapshots
  async getSnapshots(): Promise<
    ApiResponse<
      Array<{
        id: string;
        createdAt: string;
        nodeCount: number;
        edgeCount: number;
      }>
    >
  > {
    return this.request('GET', '/api/v1/knowledge-graph/snapshots');
  }

  async getLatestSnapshot(): Promise<
    ApiResponse<{
      id: string;
      createdAt: string;
      nodeCount: number;
      edgeCount: number;
    }>
  > {
    return this.request('GET', '/api/v1/knowledge-graph/snapshots/latest');
  }

  // Reasoning
  async reasonFromArticles(
    articleIds: string[],
    question?: string
  ): Promise<
    ApiResponse<{
      conclusion: string;
      reasoning: string[];
      confidence: number;
    }>
  > {
    return this.request('POST', '/api/knowledge-graph/reasoning', {
      articleIds,
      question,
    });
  }

  // Impact analysis
  async impactAnalysis(articleId: string): Promise<
    ApiResponse<{
      directlyAffected: LawArticle[];
      indirectlyAffected: LawArticle[];
      totalImpact: number;
    }>
  > {
    return this.request(
      'GET',
      `/api/knowledge-graph/impact-analysis?id=${articleId}`
    );
  }

  // Cache stats
  async getCacheStats(): Promise<
    ApiResponse<{
      hitRate: number;
      totalRequests: number;
      cacheSize: number;
    }>
  > {
    return this.request('GET', '/api/knowledge-graph/cache/stats');
  }
}

// =============================================================================
// 辅助函数
// =============================================================================
function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

function assertExists<T>(
  value: T,
  name: string
): asserts value is NonNullable<T> {
  if (value === undefined || value === null) {
    throw new Error(`${name} should not be undefined/null`);
  }
}

// =============================================================================
// 主测试函数
// =============================================================================
async function runTests() {
  const client = new ApiClient(CONFIG.BASE_URL);
  const runner = new TestRunner();

  const testData: {
    token?: string;
    user?: User;
    articles?: LawArticle[];
    article?: LawArticle;
    relations?: LawArticleRelation[];
    experts?: GraphExpert[];
  } = {};

  // ==========================================================================
  // Stage 1: Auth
  // ==========================================================================
  const testEmail =
    CONFIG.TEST_USER.email || `graph-test-${Date.now()}@example.com`;
  const testPassword = CONFIG.TEST_USER.password;
  const isEmailProvided = !!CONFIG.TEST_USER.email;

  runner.test('1.0 Get access token (login or register)', async () => {
    // Try to login if email is provided
    if (isEmailProvided) {
      console.log(`   🔑 Trying to login: ${testEmail}`);
      try {
        const loginResponse = await client.login(testEmail, testPassword);
        if (loginResponse.success) {
          assertExists(loginResponse.data?.token, 'login token');
          testData.token = loginResponse.data!.token;
          testData.user = loginResponse.data!.user;
          client.setToken(testData.token);
          console.log(
            `   ✨ Login success: ${testData.user?.email} (${testData.user?.role})`
          );
          return;
        }
      } catch (err: unknown) {
        console.log(`   ⚠️  Login failed: ${toError(err).message}`);
        console.log(`   📝 Trying to register...`);
      }
    }

    // Login failed or no email provided, try to register
    let currentEmail = testEmail;
    let response: ApiResponse<AuthData> | null = null;
    let lastError: Error | null = null;

    const maxRetries = 3;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          const randomSuffix = Math.floor(Math.random() * 10000);
          currentEmail = `graph-test-${Date.now()}-${randomSuffix}@example.com`;
        }

        response = await client.register({
          email: currentEmail,
          password: testPassword,
          username: `u${Date.now().toString(36).slice(-6)}${attempt}`,
          name: `Test User ${Date.now().toString(36).slice(-4)}`,
          role: 'LAWYER',
        });

        if (response.success) {
          break;
        }

        const isUserExists =
          response.message?.includes('邮箱已被注册') ||
          response.message?.includes('USER_EXISTS') ||
          response.error?.code === 'USER_EXISTS';

        if (!isUserExists) {
          throw new Error(
            `Registration failed: ${response.message || response.error || 'Unknown error'}`
          );
        }

        lastError = new Error(response.message || 'USER_EXISTS');
      } catch (err: unknown) {
        lastError = toError(err);

        if (
          !lastError.message?.includes('USER_EXISTS') &&
          !lastError.message?.includes('邮箱已被注册')
        ) {
          throw lastError;
        }

        if (attempt === maxRetries - 1) {
          throw new Error(
            `Registration failed after ${maxRetries} retries: ${err.message}`
          );
        }

        console.log(`   ⚠️  Email conflict, retrying...`);
        await new Promise(r => setTimeout(r, 50));
      }
    }

    if (response && response.success) {
      assertExists(response.data?.token, 'register token');
      testData.token = response.data!.token;
      testData.user = response.data!.user;
      client.setToken(testData.token);
      console.log(
        `   ✨ New user registered: ${testData.user?.email} (${testData.user?.role})`
      );
    } else {
      throw new Error(
        `Registration failed: ${lastError?.message || 'Unknown error'}`
      );
    }
  });

  runner.test('1.1 Confirm user identity', async () => {
    if (!testData.user) {
      throw new Error('No user info, auth step might have failed');
    }
    console.log(
      `   👤 Current user: ${testData.user?.email} (${testData.user?.role})`
    );
  });

  // ==========================================================================
  // Stage 2: Law Article Search
  // ==========================================================================
  runner.test('2.1 Search law articles', async () => {
    const response = await client.searchLawArticles('合同', 5);
    assert(response.success === true, 'Search should succeed');
    assert(Array.isArray(response.data?.articles), 'articles should be array');
    testData.articles = response.data?.articles;
    console.log(`   📚 Found ${response.data?.total || 0} articles`);
  });

  runner.test('2.2 Get article details', async () => {
    if (!testData.articles || testData.articles.length === 0) {
      console.log('   ⏭️  Skip: No articles found');
      return;
    }
    const articleId = testData.articles[0].id;
    const response = await client.getLawArticle(articleId);
    assert(response.success === true, 'Get article should succeed');
    assertExists(response.data?.id, 'article id');
    testData.article = response.data;
    console.log(
      `   📖 Article: ${response.data?.lawName} ${response.data?.articleNumber}`
    );
  });

  // ==========================================================================
  // Stage 3: Knowledge Graph Query
  // ==========================================================================
  runner.test('3.1 Query knowledge graph', async () => {
    if (!testData.articles || testData.articles.length === 0) {
      console.log('   ⏭️  Skip: No articles found');
      return;
    }
    const response = await client.queryKnowledgeGraph({
      startNode: testData.articles[0].id,
      direction: 'both',
      depth: 2,
    });
    if (response.success) {
      console.log(
        `   🕸️  Graph nodes: ${response.data?.nodes?.length || 0}, edges: ${response.data?.edges?.length || 0}`
      );
    } else {
      console.log(
        `   ℹ️  Graph query: ${response.error?.message || 'No data'}`
      );
    }
  });

  runner.test('3.2 Browse graph', async () => {
    const response = await client.browseGraph(undefined, 10);
    // browse API 返回格式: { nodes, links, pagination }，没有 success 包装
    // 或者标准格式: { success, data: { nodes, links }, pagination }
    const nodes = response.data?.nodes || response.nodes || [];
    const success =
      response.success !== undefined ? response.success : nodes.length > 0;
    assert(success, 'Browse should succeed');
    assert(Array.isArray(nodes), 'nodes should be array');
    console.log(`   📄 Browsed ${nodes.length || 0} nodes`);
  });

  runner.test('3.3 Get article neighbors', async () => {
    if (!testData.article) {
      console.log('   ⏭️  Skip: No article selected');
      return;
    }
    const response = await client.getNeighbors(testData.article.id, 1);
    if (response.success) {
      const neighbors = response.data?.neighbors || [];
      console.log(`   🔗 Neighbors: ${neighbors.length || 0} neighbors found`);
    } else {
      console.log(`   ℹ️  Neighbors: ${response.error?.message || 'No data'}`);
    }
  });

  runner.test('3.4 Get relations', async () => {
    if (!testData.article) {
      console.log('   ⏭️  Skip: No article selected');
      return;
    }
    const response = await client.getRelations(testData.article.id);
    if (response.success) {
      testData.relations = response.data;
      console.log(`   🔗 Relations: ${response.data?.length || 0}`);
    } else {
      console.log(`   ℹ️  Relations: ${response.error?.message || 'No data'}`);
    }
  });

  // ==========================================================================
  // Stage 4: Advanced Analysis
  // ==========================================================================
  runner.test('4.1 Path analysis', async () => {
    if (!testData.articles || testData.articles.length < 2) {
      console.log('   ⏭️  Skip: Need at least 2 articles');
      return;
    }
    const sourceId = testData.articles[0].id;
    const targetId = testData.articles[1].id;
    const response = await client.findPath(sourceId, targetId, 'shortest');
    // Path may not exist, but API should return normally
    if (response.success) {
      console.log(`   🛤️  Path analysis complete`);
    } else {
      console.log(
        `   ℹ️  Path analysis: ${response.error?.message || 'No path'}`
      );
    }
  });

  runner.test('4.2 Get recommendations', async () => {
    // 使用已获取的法条 ID 进行推荐测试
    const articleId = testData.article?.id;
    const response = await client.getRecommendations(
      articleId,
      'relations',
      10
    );
    // API 应该成功返回，即使没有找到推荐
    if (response.success) {
      assert(
        Array.isArray(response.data?.recommendations),
        'recommendations should be array'
      );
      console.log(
        `   💡 Recommendations: ${response.data?.recommendations?.length || 0}`
      );
    } else {
      console.log(
        `   ℹ️  Recommendations: ${response.error?.message || 'No recommendations'}`
      );
    }
  });

  runner.test('4.3 Quality score', async () => {
    if (!testData.articles || testData.articles.length === 0) {
      console.log('   ⏭️  Skip');
      return;
    }
    const response = await client.getQualityScore(testData.articles[0].id);
    if (response.success) {
      console.log(`   ⭐ Quality: ${response.data?.score}`);
    } else {
      console.log(`   ℹ️  Quality: ${response.error?.message || 'N/A'}`);
    }
  });

  // ==========================================================================
  // Stage 5: Expert System
  // ==========================================================================
  runner.test('5.1 Get experts', async () => {
    const response = await client.getExperts();
    if (response.success) {
      testData.experts = response.data;
      console.log(`   👥 Experts: ${response.data?.length || 0}`);
    } else {
      console.log(`   ℹ️  Experts: ${response.error?.message || 'N/A'}`);
    }
  });

  runner.test('5.2 Get snapshots', async () => {
    const response = await client.getSnapshots();
    if (response.success) {
      console.log(`   📸 Snapshots: ${response.data?.length || 0}`);
    } else {
      console.log(`   ℹ️  Snapshots: ${response.error?.message || 'N/A'}`);
    }
  });

  // ==========================================================================
  // Stage 6: Conflict Detection
  // ==========================================================================
  runner.test('6.1 Detect conflicts', async () => {
    if (!testData.articles || testData.articles.length < 2) {
      console.log('   ⏭️  Skip: Need at least 2 articles');
      return;
    }
    const ids = testData.articles.slice(0, 2).map(a => a.id);
    const response = await client.detectConflicts(ids);
    if (response.success) {
      console.log(`   ⚠️  Conflicts: ${response.data?.conflicts?.length || 0}`);
    } else {
      console.log(`   ℹ️  Conflicts: ${response.error?.message || 'N/A'}`);
    }
  });

  // ==========================================================================
  // Stage 7: Reasoning
  // ==========================================================================
  runner.test('7.1 Reason from articles', async () => {
    if (!testData.articles || testData.articles.length < 2) {
      console.log('   ⏭️  Skip: Need at least 2 articles');
      return;
    }
    const ids = testData.articles.slice(0, 2).map(a => a.id);
    const response = await client.reasonFromArticles(ids, '此案应如何判决？');
    if (response.success) {
      console.log(
        `   🧠 Reasoning: ${response.data?.conclusion?.substring(0, 50)}...`
      );
    } else {
      console.log(`   ℹ️  Reasoning: ${response.error?.message || 'N/A'}`);
    }
  });

  // ==========================================================================
  // Stage 8: Cache Stats
  // ==========================================================================
  runner.test('8.1 Get cache stats', async () => {
    const response = await client.getCacheStats();
    if (response.success) {
      console.log(`   📊 Cache hit rate: ${response.data?.hitRate}%`);
    } else {
      console.log(`   ℹ️  Cache: ${response.error?.message || 'N/A'}`);
    }
  });

  return runner.run();
}

// Run tests
runTests()
  .then(({ failed }) => {
    process.exit(failed > 0 ? 1 : 0);
  })
  .catch(error => {
    console.error('Test runner error:', error);
    process.exit(1);
  });
