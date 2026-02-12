# 律伴助手 测试策略文档

## 📋 测试目标

基于TDD（测试驱动开发）理念，确保律伴助手的代码质量、功能完整性和系统稳定性。通过多层次测试策略，实现高质量交付。

### 核心原则

1. **测试先行**：核心业务逻辑先写测试
2. **全面覆盖**：单元、集成、E2E测试分层覆盖
3. **持续集成**：自动化测试流水线
4. **质量门禁**：明确的质量标准

## 🎯 测试覆盖率目标

### 整体覆盖率要求

- **单元测试覆盖率**：>80%
- **集成测试覆盖率**：关键路径100%
- **E2E测试覆盖率**：核心用户流程100%
- **API测试覆盖率**：>95%

### 分层覆盖率分配

| 测试类型     | 目标覆盖率   | 重点覆盖内容                   |
| ------------ | ------------ | ------------------------------ |
| **单元测试** | >80%         | 业务逻辑、工具函数、数据处理   |
| **集成测试** | 100%关键路径 | API接口、数据库操作、Agent协作 |
| **E2E测试**  | 100%核心流程 | 模拟辩论完整流程、用户交互     |
| **性能测试** | 关键接口100% | API响应时间、并发处理          |
| **安全测试** | 关键模块100% | 数据安全、权限控制             |

## 🧪 单元测试策略

### 测试框架配置

- **Jest**：主要测试框架
- **React Testing Library**：前端组件测试
- **Supertest**：API接口测试
- **Prisma Test Client**：数据库测试

### 测试文件组织

```
src/
├── __tests__/
│   ├── unit/
│   │   ├── ai/
│   │   │   ├── document-analyzer.test.ts
│   │   │   ├── evidence-analyzer.test.ts
│   │   │   ├── strategy-generator.test.ts
│   │   │   ├── quality-reviewer.test.ts
│   │   │   └── coordinator.test.ts
│   │   ├── api/
│   │   │   ├── debates.test.ts
│   │   │   ├── cases.test.ts
│   │   │   └── documents.test.ts
│   │   ├── lib/
│   │   │   ├── utils.test.ts
│   │   │   └── validation.test.ts
│   │   └── components/
│   │       ├── case-management.test.tsx
│   │       └── debate-interface.test.tsx
│   ├── integration/
│   │   ├── api/
│   │   │   ├── debate-flow.test.ts
│   │   │   └── document-upload.test.ts
│   │   └── ai/
│   │       ├── agent-coordination.test.ts
│   │       └── lawstar-integration.test.ts
│   └── e2e/
│       ├── debate-complete-flow.spec.ts
│       ├── document-parsing.spec.ts
│       └── multi-round-debate.spec.ts
```

### 单元测试标准

#### 业务逻辑测试

```typescript
// 示例：DocAnalyzer测试
describe('DocAnalyzer', () => {
  describe('extractKeyInfo', () => {
    it('should extract plaintiff information correctly', async () => {
      const document = createTestDocument({
        content: '原告：张三，被告：李四...',
        type: 'lawsuit',
      });

      const result = await docAnalyzer.extractKeyInfo(document);

      expect(result.plaintiff.name).toBe('张三');
      expect(result.defendant.name).toBe('李四');
      expect(result.confidence).toBeGreaterThan(0.95);
    });

    it('should handle complex case names', async () => {
      const document = createTestDocument({
        content: '原告：北京某某科技有限公司...',
        type: 'lawsuit',
      });

      const result = await docAnalyzer.extractKeyInfo(document);

      expect(result.plaintiff.type).toBe('company');
      expect(result.plaintiff.name).toContain('北京');
    });
  });
});
```

#### API接口测试

```typescript
// 示例：辩论API测试
describe('/api/v1/debates', () => {
  describe('POST /api/v1/debates', () => {
    it('should create a new debate successfully', async () => {
      const debateData = {
        title: '测试辩论',
        description: '这是一个测试案例',
        caseId: 'test-case-id',
      };

      const response = await request(app)
        .post('/api/v1/debates')
        .send(debateData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBeDefined();
      expect(response.body.data.status).toBe('active');
    });

    it('should validate required fields', async () => {
      const invalidData = { title: '' };

      const response = await request(app)
        .post('/api/v1/debates')
        .send(invalidData)
        .expect(400);

      expect(response.body.error).toContain('title is required');
    });
  });
});
```

### Mock策略

```typescript
// AI服务Mock
jest.mock('../lib/ai/unified-service', () => ({
  getUnifiedAIService: jest.fn().mockResolvedValue({
    parseDocument: jest.fn().mockResolvedValue(mockDocumentAnalysis),
    generateDebate: jest.fn().mockResolvedValue(mockDebatePoints),
    searchLegalByVector: jest.fn().mockResolvedValue(mockLegalReferences),
  }),
}));

// 数据库Mock
jest.mock('../lib/db/prisma', () => ({
  prisma: {
    case: {
      create: jest.fn().mockResolvedValue(mockCase),
      findMany: jest.fn().mockResolvedValue([mockCase]),
      findUnique: jest.fn().mockResolvedValue(mockCase),
    },
  },
}));
```

## 🔗 集成测试策略

### 测试范围

1. **API集成测试**
   - 辩论完整流程API测试
   - 文档上传和解析集成
   - 多Agent协作测试
   - 数据库事务测试

2. **外部服务集成测试**
   - 法律之星API集成
   - AI服务提供商集成
   - 缓存系统集成

3. **模块间集成测试**
   - Agent工作流编排
   - 数据一致性验证
   - 错误传播机制

### 集成测试示例

```typescript
describe('Debate Flow Integration', () => {
  let testDatabase: TestDatabase;
  let mockAIService: MockUnifiedAIService;

  beforeEach(async () => {
    testDatabase = await createTestDatabase();
    mockAIService = new MockUnifiedAIService();
  });

  afterEach(async () => {
    await testDatabase.cleanup();
  });

  it('should complete full debate flow', async () => {
    // 1. 创建案件
    const caseData = await testDatabase.case.create({
      data: mockCaseData,
    });

    // 2. 上传文档
    const document = await testDatabase.document.create({
      data: {
        caseId: caseData.id,
        content: testDocumentContent,
        type: 'lawsuit',
      },
    });

    // 3. 启动辩论
    const debate = await testDatabase.debate.create({
      data: {
        caseId: caseData.id,
        title: '测试辩论',
        status: 'active',
      },
    });

    // 4. 执行辩论分析
    const analysisResult = await mockAIService.analyzeCaseComplete({
      content: document.content,
      title: caseData.title,
    });

    // 5. 验证结果
    expect(analysisResult.documentAnalysis).toBeDefined();
    expect(analysisResult.legalReferences).toBeDefined();
    expect(analysisResult.debatePoints).toBeDefined();

    // 6. 验证数据库状态
    const updatedDebate = await testDatabase.debate.findUnique({
      where: { id: debate.id },
    });
    expect(updatedDebate.status).toBe('completed');
  });
});
```

## 🌐 E2E测试策略

### 测试工具

- **Playwright**：E2E测试框架
- **测试环境**：独立的测试数据库
- **测试数据**：标准化的测试案例

### 核心用户流程

1. **完整辩论流程**
   - 用户注册/登录
   - 案件创建
   - 文档上传
   - 辩论启动
   - 多轮辩论
   - 结果查看

2. **文档管理流程**
   - 文档上传
   - 解析结果查看
   - 文档关联管理
   - 文档下载

3. **法条检索流程**
   - 关键词搜索
   - 语义搜索
   - 结果筛选
   - 法条收藏

### E2E测试示例

```typescript
import { test, expect } from '@playwright/test';

test.describe('Debate E2E Flow', () => {
  test('should complete full debate process', async ({ page }) => {
    // 1. 访问应用
    await page.goto('/');

    // 2. 创建新案件
    await page.click('[data-testid="create-case-btn"]');
    await page.fill('[data-testid="case-title"]', '测试案例');
    await page.fill('[data-testid="case-description"]', '这是一个测试描述');
    await page.click('[data-testid="save-case-btn"]');

    // 3. 上传文档
    await page.setInputFiles(
      '[data-testid="document-upload"]',
      'test-document.pdf'
    );
    await page.waitForSelector('[data-testid="document-uploaded"]');

    // 4. 启动辩论
    await page.click('[data-testid="start-debate-btn"]');
    await page.waitForSelector('[data-testid="debate-in-progress"]');

    // 5. 验证辩论结果
    await expect(page.locator('[data-testid="debate-result"]')).toBeVisible();
    await expect(
      page.locator('[data-testid="plaintiff-arguments"]')
    ).toContainText('原告方论点');
    await expect(
      page.locator('[data-testid="defendant-arguments"]')
    ).toContainText('被告方论点');

    // 6. 多轮辩论
    await page.click('[data-testid="add-round-btn"]');
    await page.fill('[data-testid="additional-info"]', '补充信息');
    await page.click('[data-testid="submit-round-btn"]');

    // 7. 验证第二轮结果
    await expect(page.locator('[data-testid="round-2-result"]')).toBeVisible();
  });
});
```

## ⚡ 性能测试策略

### 测试目标

- **API响应时间**：<2秒（95%请求）
- **页面加载时间**：<3秒
- **并发处理能力**：支持100并发用户
- **数据库查询优化**：查询时间<500ms

### 性能测试工具

- **Artillery**：API压力测试
- **Lighthouse**：前端性能测试
- **数据库分析**：查询性能分析

### 性能测试场景

```typescript
// Artillery配置示例
{
  "config": {
    "target": "http://localhost:3000",
    "phases": [
      { "duration": 60, "arrivalRate": 10 },
      { "duration": 120, "arrivalRate": 50 },
      { "duration": 60, "arrivalRate": 100 }
    ]
  },
  "scenarios": [
    {
      "name": "Debate API Load Test",
      "requests": [
        {
          "method": "POST",
          "url": "/api/v1/debates",
          "body": {
            "title": "Load Test Debate",
            "description": "Performance testing case"
          }
        },
        {
          "method": "GET",
          "url": "/api/v1/debates/{{ debateId }}"
        }
      ]
    }
  ]
}
```

## 🔒 安全测试策略

### 测试范围

1. **数据安全**
   - 敏感数据脱敏
   - 数据传输加密
   - 数据访问权限

2. **API安全**
   - 认证授权机制
   - SQL注入防护
   - XSS防护
   - CSRF防护

3. **输入验证**
   - 文件类型验证
   - 文件大小限制
   - 恶意输入检测

### 安全测试示例

```typescript
describe('Security Tests', () => {
  describe('Input Validation', () => {
    it('should reject malicious file uploads', async () => {
      const maliciousFile = Buffer.from('malicious content');

      const response = await request(app)
        .post('/api/v1/documents/upload')
        .attach('document', maliciousFile, 'malicious.exe')
        .expect(400);

      expect(response.body.error).toContain('Invalid file type');
    });

    it('should prevent SQL injection', async () => {
      const maliciousInput = "'; DROP TABLE cases; --";

      const response = await request(app)
        .get(`/api/v1/cases?search=${encodeURIComponent(maliciousInput)}`)
        .expect(400);

      expect(response.body.error).toContain('Invalid input');
    });
  });

  describe('Authentication', () => {
    it('should require authentication for protected routes', async () => {
      const response = await request(app).get('/api/v1/cases').expect(401);

      expect(response.body.error).toContain('Authentication required');
    });
  });
});
```

## 🚀 CI/CD测试流水线

### GitHub Actions配置

```yaml
name: Test Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run unit tests
        run: npm run test:unit -- --coverage

      - name: Upload coverage
        uses: codecov/codecov-action@v3

  integration-tests:
    runs-on: ubuntu-latest
    needs: unit-tests
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: test_db
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432

      redis:
        image: redis:7
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 6379:6379

    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3

      - name: Install dependencies
        run: npm ci

      - name: Run integration tests
        run: npm run test:integration
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test_db
          REDIS_URL: redis://localhost:6379

  e2e-tests:
    runs-on: ubuntu-latest
    needs: integration-tests
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3

      - name: Install dependencies
        run: npm ci

      - name: Install Playwright
        run: npx playwright install --with-deps

      - name: Run E2E tests
        run: npm run test:e2e

      - name: Upload test results
        uses: actions/upload-artifact@v3
        if: failure()
        with:
          name: playwright-report
          path: playwright-report/

  performance-tests:
    runs-on: ubuntu-latest
    needs: e2e-tests
    if: github.ref == 'refs/heads/main'

    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3

      - name: Install dependencies
        run: npm ci

      - name: Run performance tests
        run: npm run test:performance
```

## 📊 测试报告和质量指标

### 测试报告

1. **Jest覆盖率报告**
   - 行覆盖率
   - 分支覆盖率
   - 函数覆盖率
   - 语句覆盖率

2. **Playwright测试报告**
   - 测试执行结果
   - 失败截图
   - 性能指标
   - 网络请求日志

3. **Artillery性能报告**
   - 响应时间分布
   - 错误率统计
   - 并发能力分析

### 质量门禁标准

```typescript
// quality-gates.config.js
module.exports = {
  coverage: {
    statements: 80,
    branches: 75,
    functions: 80,
    lines: 80,
  },
  performance: {
    maxResponseTime: 2000, // ms
    maxErrorRate: 0.01, // 1%
    minThroughput: 100, // requests per second
  },
  security: {
    maxVulnerabilities: 0,
    maxHighRiskIssues: 0,
    maxMediumRiskIssues: 5,
  },
};
```

## 🔄 测试驱动开发(TDD)流程

### TDD实施步骤

1. **红阶段**：编写失败的测试
2. **绿阶段**：编写最少代码使测试通过
3. **重构阶段**：优化代码结构
4. **循环**：重复以上步骤

### TDD示例流程

```typescript
// 1. 红阶段：编写失败的测试
test('should calculate legal risk score correctly', () => {
  const caseData = { complexity: 'high', precedentCount: 5 };
  const riskScore = calculateRiskScore(caseData);
  expect(riskScore).toBe(85); // 测试失败，函数不存在
});

// 2. 绿阶段：实现最小功能
function calculateRiskScore(caseData: any): number {
  return 85; // 最小实现使测试通过
}

// 3. 重构阶段：完善实现
function calculateRiskScore(caseData: CaseData): number {
  const complexityScore = caseData.complexity === 'high' ? 50 : 30;
  const precedentScore = Math.min(caseData.precedentCount * 5, 35);
  return complexityScore + precedentScore;
}

// 4. 添加更多测试用例
test('should handle low complexity cases', () => {
  const caseData = { complexity: 'low', precedentCount: 2 };
  const riskScore = calculateRiskScore(caseData);
  expect(riskScore).toBe(40);
});
```

## 📝 测试数据管理

### 测试数据策略

1. **Fixtures**：标准测试数据
2. **Factories**：动态数据生成
3. **Seeds**：基础数据填充
4. **Cleanup**：测试后清理

### 测试数据示例

```typescript
// 测试工厂
export const createTestCase = (overrides?: Partial<Case>): Case => ({
  id: generateId(),
  title: '测试案例',
  description: '这是一个测试案例描述',
  type: 'civil',
  status: 'active',
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

// 测试Fixtures
export const mockCases = {
  simpleCase: createTestCase({ title: '简单案例' }),
  complexCase: createTestCase({
    title: '复杂案例',
    complexity: 'high',
    precedentCount: 10,
  }),
};

// 测试工具函数
export const setupTestDatabase = async () => {
  await prisma.case.deleteMany();
  await prisma.debate.deleteMany();
  await prisma.document.deleteMany();
};
```

## 🎯 测试优先级

### 优先级划分

| 优先级 | 测试范围                        | 完成时间   |
| ------ | ------------------------------- | ---------- |
| **P0** | 核心业务逻辑、API接口、辩论流程 | Sprint 1-2 |
| **P1** | 集成测试、用户界面、性能优化    | Sprint 3-4 |
| **P2** | E2E测试、安全测试、边界情况     | Sprint 5   |

### 核心测试场景（P0）

1. **文档解析准确性测试**
2. **辩论生成逻辑测试**
3. **API接口功能测试**
4. **数据库一致性测试**
5. **Agent协作测试**

---

_文档版本：v1.0_
_创建时间：2025-12-19_
_下次更新：根据测试进展持续优化_
