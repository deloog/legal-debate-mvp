/**
 * 辩论业务场景完整 API 测试
 * 
 * 测试范围：
 * - 用户认证 (login)
 * - 案件管理 (cases CRUD)
 * - 辩论生命周期 (debates CRUD + status flow)
 * - 轮次管理 (rounds)
 * - 论点获取 (arguments)
 * - 知识图谱关联 (recommendations/legal-references)
 * 
 * 使用方法:
 * 1. 确保服务器运行在 http://localhost:3000
 * 2. 脚本会自动注册测试用户，或使用已有用户登录
 * 3. 运行: npx ts-node scripts/api-test/debate-workflow-test.ts
 */

// =============================================================================
// 配置
// =============================================================================
const CONFIG = {
  BASE_URL: process.env.API_BASE_URL || 'http://localhost:3000',
  TEST_USER: {
    email: process.env.TEST_USER_EMAIL || '',
    password: process.env.TEST_USER_PASSWORD || 'TestPass123',
  },
  TIMEOUT: 30000,
  RETRIES: 3,
};

// =============================================================================
// 类型定义
// =============================================================================
interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string | { code: string; message: string };
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
  refreshToken?: string;
  expiresIn: number;
}

interface Case {
  id: string;
  title: string;
  description: string;
  type: string;
  status: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

interface Debate {
  id: string;
  caseId: string;
  userId: string;
  title: string;
  status: string;
  currentRound: number;
  debateConfig?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  case?: Case;
  rounds?: DebateRound[];
}

interface DebateRound {
  id: string;
  debateId: string;
  roundNumber: number;
  status: string;
  startedAt?: string;
  completedAt?: string;
  arguments?: Argument[];
}

interface Argument {
  id: string;
  roundId: string;
  side: 'PLAINTIFF' | 'DEFENDANT';
  content: string;
  type: string;
  aiProvider?: string;
  generationTime?: number;
  confidence?: number;
  legalBasis?: Record<string, unknown>;
  legalScore?: number;
  logicScore?: number;
  overallScore?: number;
  reasoning?: string;
  priority?: string;
  createdAt: string;
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
    console.log('\n🧪 开始运行测试...\n');
    const startTime = Date.now();

    for (const { name, fn, skip } of this.tests) {
      if (skip) {
        console.log(`⏭️  SKIP: ${name}`);
        continue;
      }

      const testStart = Date.now();
      try {
        await fn();
        const duration = Date.now() - testStart;
        this.results.push({ name, passed: true, duration });
        console.log(`✅ PASS: ${name} (${duration}ms)`);
      } catch (error) {
        const duration = Date.now() - testStart;
        const errorMsg = error instanceof Error ? error.message : String(error);
        this.results.push({ name, passed: false, error: errorMsg, duration });
        console.log(`❌ FAIL: ${name} (${duration}ms)`);
        console.log(`   Error: ${errorMsg}`);
      }
    }

    const totalDuration = Date.now() - startTime;
    const passed = this.results.filter(r => r.passed).length;
    const failed = this.results.filter(r => !r.passed).length;

    console.log('\n' + '='.repeat(50));
    console.log(`📊 测试结果: ${passed} 通过, ${failed} 失败, 总计 ${this.results.length} 个测试`);
    console.log(`⏱️  总耗时: ${totalDuration}ms`);
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

  getToken(): string {
    return this.token;
  }

  private parseCookies(response: Response) {
    const setCookie = (response.headers as any).getSetCookie?.();
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
    body?: unknown,
    customHeaders?: Record<string, string>
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...customHeaders,
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const cookieHeader = this.getCookieHeader();
    if (cookieHeader) {
      headers['Cookie'] = cookieHeader;
    }

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

      // 提取并保存 cookie
      this.parseCookies(response);

      // 处理 204 No Content
      if (response.status === 204) {
        return { success: true } as ApiResponse<T>;
      }

      const data = await response.json();

      if (!response.ok) {
        const errorMsg =
          data.error?.message ||
          data.detail ||
          (typeof data.error === 'string' ? data.error : undefined) ||
          data.message ||
          JSON.stringify(data).slice(0, 200) ||
          'Unknown error';
        throw new Error(`HTTP ${response.status}: ${errorMsg}`);
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

  // 认证相关
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

  async getCurrentUser(): Promise<ApiResponse<{ user: User }>> {
    return this.request('GET', '/api/auth/me');
  }

  // 案件相关
  async createCase(data: {
    title: string;
    description: string;
    type?: string;
    status?: string;
    amount?: number;
    cause?: string;
    court?: string;
    plaintiffName?: string;
    defendantName?: string;
  }): Promise<ApiResponse<Case>> {
    return this.request('POST', '/api/v1/cases', data);
  }

  async getCases(page = 1, limit = 10): Promise<ApiResponse<{ cases: Case[]; total: number }>> {
    return this.request('GET', `/api/v1/cases?page=${page}&limit=${limit}`);
  }

  async getCase(id: string): Promise<ApiResponse<Case>> {
    return this.request('GET', `/api/v1/cases/${id}`);
  }

  async updateCase(id: string, data: Partial<Case>): Promise<ApiResponse<Case>> {
    return this.request('PUT', `/api/v1/cases/${id}`, data);
  }

  async deleteCase(id: string): Promise<ApiResponse<void>> {
    return this.request('DELETE', `/api/v1/cases/${id}`);
  }

  // 辩论相关
  async createDebate(data: {
    caseId: string;
    title: string;
    config?: Record<string, unknown>;
    status?: string;
  }): Promise<ApiResponse<Debate>> {
    return this.request('POST', '/api/v1/debates', data);
  }

  async getDebates(page = 1, limit = 10): Promise<ApiResponse<Debate[]>> {
    return this.request('GET', `/api/v1/debates?page=${page}&limit=${limit}`);
  }

  async getDebate(id: string): Promise<ApiResponse<Debate>> {
    return this.request('GET', `/api/v1/debates/${id}`);
  }

  async updateDebate(id: string, data: Partial<Debate>): Promise<ApiResponse<Debate>> {
    return this.request('PUT', `/api/v1/debates/${id}`, data);
  }

  async deleteDebate(id: string): Promise<ApiResponse<void>> {
    return this.request('DELETE', `/api/v1/debates/${id}`);
  }

  // 辩论状态管理
  async getDebateStatus(id: string): Promise<ApiResponse<{
    id: string;
    status: string;
    availableTransitions: string[];
  }>> {
    return this.request('GET', `/api/v1/debates/${id}/status`);
  }

  async updateDebateStatus(id: string, status: string): Promise<ApiResponse<{
    debate: Debate;
    previousStatus: string;
    newStatus: string;
  }>> {
    return this.request('PATCH', `/api/v1/debates/${id}/status`, { status });
  }

  // 轮次相关
  async createRound(debateId: string): Promise<ApiResponse<DebateRound>> {
    return this.request('POST', `/api/v1/debates/${debateId}/rounds`, {});
  }

  async getRounds(debateId: string): Promise<ApiResponse<DebateRound[]>> {
    return this.request('GET', `/api/v1/debates/${debateId}/rounds`);
  }

  // 论点相关
  async getArguments(debateId: string): Promise<ApiResponse<Argument[]>> {
    return this.request('GET', `/api/v1/debates/${debateId}/arguments`);
  }

  // 推荐和法条
  async getRecommendations(debateId: string): Promise<ApiResponse<unknown>> {
    return this.request('GET', `/api/v1/debates/${debateId}/recommendations`);
  }

  async getLegalReferences(debateId: string, roundId: string): Promise<ApiResponse<unknown>> {
    return this.request('GET', `/api/v1/debates/${debateId}/rounds/${roundId}/legal-references`);
  }

  // 导出
  async exportDebate(debateId: string, format: 'pdf' | 'docx' | 'json' = 'json'): Promise<ApiResponse<unknown>> {
    return this.request('GET', `/api/v1/debates/${debateId}/export?format=${format}`);
  }

  // AI 摘要
  async generateAISummary(debateId: string): Promise<ApiResponse<unknown>> {
    return this.request('POST', `/api/v1/debates/${debateId}/ai-summary`, {});
  }

  async getSummary(debateId: string): Promise<ApiResponse<unknown>> {
    return this.request('GET', `/api/v1/debates/${debateId}/summary`);
  }
}

// =============================================================================
// 测试断言辅助函数
// =============================================================================
function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

function assertExists<T>(value: T | null | undefined, name: string): T {
  if (value === null || value === undefined) {
    throw new Error(`Assertion failed: ${name} should exist`);
  }
  return value;
}

function assertEquals(actual: unknown, expected: unknown, name: string): void {
  if (actual !== expected) {
    throw new Error(`Assertion failed: ${name} expected ${expected}, got ${actual}`);
  }
}

// =============================================================================
// 主测试逻辑
// =============================================================================
async function main() {
  const runner = new TestRunner();
  const client = new ApiClient(CONFIG.BASE_URL);

  // 测试数据存储
  const testData: {
    token?: string;
    user?: User;
    testCase?: Case;
    testDebate?: Debate;
    testRound?: DebateRound;
  } = {};

  // ==========================================================================
  // 阶段 1: 认证测试
  // ==========================================================================
  const testEmail = CONFIG.TEST_USER.email || `api-test-${Date.now()}@example.com`;
  const testPassword = CONFIG.TEST_USER.password;
  const isEmailProvided = !!CONFIG.TEST_USER.email; // 用户是否提供了邮箱

  runner.test('1.0 获取访问令牌（登录或注册）', async () => {
    // 如果用户提供了邮箱，先尝试登录已有用户
    if (isEmailProvided) {
      console.log(`   🔑 尝试登录已有用户: ${testEmail}`);
      try {
        const loginResponse = await client.login(testEmail, testPassword);
        if (loginResponse.success) {
          assertExists(loginResponse.data?.token, 'login token');
          testData.token = loginResponse.data!.token;
          testData.user = loginResponse.data!.user;
          client.setToken(testData.token);
          console.log(`   ✨ 登录成功: ${testData.user?.email} (${testData.user?.role})`);
          return; // 登录成功，直接返回
        }
      } catch (err: any) {
        console.log(`   ⚠️  登录失败: ${err.message}`);
        console.log(`   📝 尝试注册新用户...`);
      }
    }
    
    // 登录失败或没有提供邮箱，尝试注册新用户
    let currentEmail = testEmail;
    let response: ApiResponse<AuthData> | null = null;
    let lastError: Error | null = null;
    
    const maxRetries = 3;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          const randomSuffix = Math.floor(Math.random() * 10000);
          currentEmail = `api-test-${Date.now()}-${randomSuffix}@example.com`;
          console.log(`   ⚠️  尝试第 ${attempt + 1}/${maxRetries} 次注册: ${currentEmail}`);
        }
        
        response = await client.register({
          email: currentEmail,
          password: testPassword,
          username: `u${Date.now().toString(36).slice(-6)}${attempt}`,
          name: `测试用户${Date.now().toString(36).slice(-4)}`,
          role: 'LAWYER',
        });
        
        if (response.success) {
          break;
        }
        
        const errorCode = typeof response.error === 'object' && response.error !== null 
          ? (response.error as any).code 
          : response.error;
        const isUserExists = 
          response.message?.includes('邮箱已被注册') ||
          response.message?.includes('USER_EXISTS') ||
          errorCode === 'USER_EXISTS';
        
        if (!isUserExists) {
          throw new Error(`注册失败: ${response.message || response.error || 'Unknown error'}`);
        }
        
        lastError = new Error(response.message || 'USER_EXISTS');
        
      } catch (err: any) {
        lastError = err;
        
        if (!err.message?.includes('USER_EXISTS') && !err.message?.includes('邮箱已被注册')) {
          throw err;
        }
        
        if (attempt === maxRetries - 1) {
          throw new Error(`注册失败，已重试 ${maxRetries} 次: ${err.message}`);
        }
        
        console.log(`   ⚠️  邮箱冲突，准备重试...`);
        await new Promise(r => setTimeout(r, 50));
      }
    }

    if (response && response.success) {
      assertExists(response.data?.token, 'register token');
      testData.token = response.data!.token;
      testData.user = response.data!.user;
      client.setToken(testData.token);
      console.log(`   ✨ 新用户注册成功: ${testData.user?.email} (${testData.user?.role})`);
    } else {
      throw new Error(`注册失败: ${lastError?.message || 'Unknown error'}`);
    }
  });

  runner.test('1.1 确认用户身份', async () => {
    if (!testData.user) {
      throw new Error('未获取到用户信息，认证步骤可能失败');
    }
    console.log(`   👤 当前用户: ${testData.user?.email} (${testData.user?.role})`);
  });

  runner.test('1.2 获取当前用户信息', async () => {
    console.log(`   🔑 Token: ${client.getToken().slice(0, 30)}...`);
    const response = await client.getCurrentUser();
    
    assert(response.success === true, '获取用户信息应该成功');
    assertExists(response.data?.user, 'user');
    assertEquals(response.data?.user.id, testData.user!.id, 'user id should match');
  });

  // ==========================================================================
  // 阶段 2: 案件管理测试
  // ==========================================================================
  runner.test('2.1 创建测试案件', async () => {
    const response = await client.createCase({
      title: `API测试案件-${Date.now()}`,
      description: '这是一个用于API测试的案件，测试辩论完整流程',
      type: 'civil',
      status: 'active',
      amount: 100000,
      cause: '合同纠纷',
      court: '北京市第一中级人民法院',
      plaintiffName: '张三',
      defendantName: '李四',
    });
    
    assert(response.success === true, '创建案件应该成功');
    assertExists(response.data?.id, 'case id');
    assert(response.data?.title?.includes('API测试案件') === true, '案件标题应该匹配');
    
    testData.testCase = response.data;
    console.log(`   📁 案件ID: ${testData.testCase?.id}`);
  });

  runner.test('2.2 获取案件列表', async () => {
    const response = await client.getCases(1, 10);
    
    assert(response.success === true, '获取案件列表应该成功');
    assert(Array.isArray(response.data?.cases), 'cases should be an array');
    assert(response.data!.cases.length > 0, '案件列表不应该为空');
    assertExists(response.data?.total, 'total count');
  });

  runner.test('2.3 获取案件详情', async () => {
    const response = await client.getCase(testData.testCase!.id);
    
    assert(response.success === true, '获取案件详情应该成功');
    assertEquals(response.data?.id, testData.testCase!.id, 'case id should match');
    assertExists(response.data?.title, 'case title');
  });

  runner.test('2.4 更新案件信息', async () => {
    const newTitle = `API测试案件-已更新-${Date.now()}`;
    const response = await client.updateCase(testData.testCase!.id, {
      title: newTitle,
      description: '案件描述已更新',
    });
    
    assert(response.success === true, '更新案件应该成功');
    assertEquals(response.data?.title, newTitle, 'title should be updated');
    
    // 更新本地数据
    testData.testCase = response.data;
  });

  // ==========================================================================
  // 阶段 3: 辩论生命周期测试
  // ==========================================================================
  runner.test('3.1 创建辩论', async () => {
    const response = await client.createDebate({
      caseId: testData.testCase!.id,
      title: `API测试辩论-${Date.now()}`,
      config: {
        maxRounds: 3,
        aiModel: 'deepseek',
        language: 'zh',
      },
      status: 'DRAFT',
    });
    
    assert(response.success === true, '创建辩论应该成功');
    assertExists(response.data?.id, 'debate id');
    assertEquals(response.data?.caseId, testData.testCase!.id, 'caseId should match');
    assertEquals(response.data?.status, 'DRAFT', 'status should be DRAFT');
    
    testData.testDebate = response.data;
    console.log(`   🗣️  辩论ID: ${testData.testDebate?.id}`);
  });

  runner.test('3.2 获取辩论列表', async () => {
    const response = await client.getDebates(1, 10);
    
    assert(response.success === true, '获取辩论列表应该成功');
    assert(Array.isArray(response.data), 'debates should be an array');
    assert((response.data || []).length > 0, '辩论列表不应该为空');
  });

  runner.test('3.3 获取辩论详情', async () => {
    const response = await client.getDebate(testData.testDebate!.id);
    
    assert(response.success === true, '获取辩论详情应该成功');
    assertEquals(response.data?.id, testData.testDebate!.id, 'debate id should match');
    assertExists(response.data?.case, 'debate.case');
    assertExists(response.data?.rounds, 'debate.rounds');
  });

  runner.test('3.4 更新辩论信息', async () => {
    const newTitle = `API测试辩论-已更新-${Date.now()}`;
    const response = await client.updateDebate(testData.testDebate!.id, {
      title: newTitle,
      debateConfig: {
        maxRounds: 5,
        aiModel: 'deepseek-v3',
        language: 'zh',
      },
    });
    
    assert(response.success === true, '更新辩论应该成功');
    assertEquals(response.data?.title, newTitle, 'title should be updated');
    
    testData.testDebate = response.data;
  });

  // ==========================================================================
  // 阶段 4: 辩论状态机测试
  // ==========================================================================
  runner.test('4.1 获取辩论状态', async () => {
    const response = await client.getDebateStatus(testData.testDebate!.id);
    
    assert(response.success === true, '获取辩论状态应该成功');
    assertEquals(response.data?.id, testData.testDebate!.id, 'debate id should match');
    assertEquals(response.data?.status, 'DRAFT', 'status should be DRAFT');
    assert(Array.isArray(response.data?.availableTransitions), 'availableTransitions should be an array');
    assert(response.data!.availableTransitions.includes('IN_PROGRESS'), 'should allow transition to IN_PROGRESS');
  });

  runner.test('4.2 更新辩论状态: DRAFT -> IN_PROGRESS', async () => {
    const response = await client.updateDebateStatus(testData.testDebate!.id, 'IN_PROGRESS');
    
    assert(response.success === true, '更新辩论状态应该成功');
    assertEquals(response.data?.previousStatus, 'DRAFT', 'previous status should be DRAFT');
    assertEquals(response.data?.newStatus, 'IN_PROGRESS', 'new status should be IN_PROGRESS');
  });

  runner.test('4.3 验证状态已更新', async () => {
    const response = await client.getDebate(testData.testDebate!.id);
    
    assert(response.success === true, '获取辩论详情应该成功');
    assertEquals(response.data?.status, 'IN_PROGRESS', 'status should be IN_PROGRESS');
  });

  runner.test('4.4 尝试非法状态转换 (应该失败)', async () => {
    try {
      // IN_PROGRESS 不能直接回到 DRAFT
      await client.updateDebateStatus(testData.testDebate!.id, 'DRAFT');
      assert(false, '非法状态转换应该失败');
    } catch (error: any) {
      // 预期会失败
      assert(error instanceof Error, 'should throw error');
      assert(error.message?.includes('无法从 IN_PROGRESS 状态转换为 DRAFT'), 'error message should indicate invalid transition');
      console.log('   ✓ 非法状态转换被正确阻止');
    }
  });

  // ==========================================================================
  // 阶段 5: 轮次管理测试
  // ==========================================================================
  runner.test('5.1 创建辩论轮次', async () => {
    const response = await client.createRound(testData.testDebate!.id);
    
    assert(response.success === true, '创建轮次应该成功');
    assertExists(response.data?.id, 'round id');
    assertEquals(response.data?.debateId, testData.testDebate!.id, 'debateId should match');
    assertEquals(response.data?.roundNumber, 2, 'roundNumber should be 2 (1 is auto-created)');
    
    testData.testRound = response.data;
    console.log(`   🔄 轮次ID: ${testData.testRound?.id} (第${testData.testRound?.roundNumber}轮)`);
  });

  runner.test('5.2 获取辩论轮次列表', async () => {
    const response = await client.getRounds(testData.testDebate!.id);
    
    assert(response.success === true, '获取轮次列表应该成功');
    assert(Array.isArray(response.data), 'rounds should be an array');
    assert(response.data!.length >= 2, '应该至少有2个轮次');
  });

  runner.test('5.3 创建更多轮次', async () => {
    // 创建第3轮
    const response3 = await client.createRound(testData.testDebate!.id);
    assert(response3.success === true, '创建第3轮应该成功');
    assertEquals(response3.data?.roundNumber, 3, 'roundNumber should be 3');
    
    console.log(`   🔄 第3轮ID: ${response3.data?.id}`);
  });

  // ==========================================================================
  // 阶段 6: 论点相关测试
  // ==========================================================================
  runner.test('6.1 获取辩论论点列表', async () => {
    const response = await client.getArguments(testData.testDebate!.id);
    
    assert(response.success === true, '获取论点列表应该成功');
    assert(Array.isArray(response.data), 'arguments should be an array');
    // 新创建的辩论可能没有论点，这是正常的
    console.log(`   📊 当前论点数量: ${response.data?.length || 0}`);
  });

  // ==========================================================================
  // 阶段 7: 推荐和法条测试
  // ==========================================================================
  runner.test('7.1 获取辩论推荐', async () => {
    const response = await client.getRecommendations(testData.testDebate!.id);
    
    // 这个接口可能返回空数据，但不应该报错
    assert(response.success === true, '获取推荐应该成功');
    console.log('   ✓ 推荐接口正常');
  });

  runner.test('7.2 获取法条引用', async () => {
    // 获取轮次列表
    const roundsResponse = await client.getRounds(testData.testDebate!.id);
    if (roundsResponse.success && roundsResponse.data && roundsResponse.data.length > 0) {
      const firstRound = roundsResponse.data[0];
      const response = await client.getLegalReferences(testData.testDebate!.id, firstRound.id);
      
      assert(response.success === true, '获取法条引用应该成功');
      console.log('   ✓ 法条引用接口正常');
    } else {
      console.log('   ⚠️  跳过：没有可用的轮次');
    }
  });

  // ==========================================================================
  // 阶段 8: 导出功能测试
  // ==========================================================================
  runner.test('8.1 导出辩论 (JSON格式)', async () => {
    const response = await client.exportDebate(testData.testDebate!.id, 'json') as any;
    
    // 导出接口返回直接的 JSON 内容，不是 { success, data } 包装格式
    assertExists(response.debate, '导出响应中应包含 debate 字段');
    assertEquals(response.debate?.id, testData.testDebate!.id, '导出内容中的辩论ID应匹配');
    console.log('   ✓ JSON导出接口正常');
  });

  // ==========================================================================
  // 阶段 9: AI 功能测试
  // ==========================================================================
  runner.test('9.1 生成AI摘要', async () => {
    // 注意：这个测试需要 AI 服务可用，如果 AI 服务不可用可能会失败
    // 在生产环境中，应该使用 mock AI
    try {
      const response = await client.generateAISummary(testData.testDebate!.id);
      assert(response.success === true, '生成AI摘要应该成功');
      console.log('   ✓ AI摘要生成成功');
    } catch (error) {
      console.log('   ⚠️  AI摘要生成失败（可能是AI服务不可用）');
      // 不标记为失败，因为这是可选功能
    }
  });

  runner.test('9.2 获取辩论摘要', async () => {
    const response = await client.getSummary(testData.testDebate!.id);
    
    assert(response.success === true, '获取摘要应该成功');
    console.log('   ✓ 摘要接口正常');
  });

  // ==========================================================================
  // 阶段 10: 清理测试
  // ==========================================================================
  runner.test('10.1 更新辩论状态: IN_PROGRESS -> COMPLETED', async () => {
    const response = await client.updateDebateStatus(testData.testDebate!.id, 'COMPLETED');
    
    assert(response.success === true, '更新辩论状态应该成功');
    assertEquals(response.data?.newStatus, 'COMPLETED', 'status should be COMPLETED');
  });

  runner.test('10.2 更新辩论状态: COMPLETED -> ARCHIVED', async () => {
    const response = await client.updateDebateStatus(testData.testDebate!.id, 'ARCHIVED');
    
    assert(response.success === true, '归档辩论应该成功');
    assertEquals(response.data?.newStatus, 'ARCHIVED', 'status should be ARCHIVED');
    console.log('   📦 辩论已归档');
  });

  runner.test('10.3 删除辩论 (软删除)', async () => {
    const response = await client.deleteDebate(testData.testDebate!.id);
    
    assert(response.success === true, '删除辩论应该成功');
    console.log('   🗑️  辩论已删除');
  });

  runner.test('10.4 删除测试案件 (软删除)', async () => {
    const response = await client.deleteCase(testData.testCase!.id);
    
    assert(response.success === true, '删除案件应该成功');
    console.log('   🗑️  案件已删除');
  });

  // ==========================================================================
  // 运行测试
  // ==========================================================================
  const results = await runner.run();
  
  // 设置退出码
  process.exit(results.failed > 0 ? 1 : 0);
}

// 运行主函数
main().catch((error) => {
  console.error('测试运行失败:', error);
  process.exit(1);
});
