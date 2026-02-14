# 🧪 测试组织规范

> 法律辩论 MVP 项目测试文件组织最佳实践

**制定日期**: 2026-02-12
**基于**: Jest + React Testing Library + Playwright
**遵循**: 测试金字塔原则

---

## 📋 目录结构标准

### 推荐结构

```
src/__tests__/
├── unit/                          # 单元测试 (目标: 70%)
│   ├── lib/                       # 库函数测试
│   │   ├── agent/                 # Agent系统
│   │   │   ├── doc-analyzer/      # 文档分析器
│   │   │   ├── memory-agent/      # 记忆Agent
│   │   │   ├── legal-agent/       # 法律Agent
│   │   │   └── generation-agent/  # 生成Agent
│   │   ├── ai/                    # AI服务
│   │   ├── auth/                  # 认证
│   │   ├── calculation/           # 计算逻辑
│   │   ├── case/                  # 案件处理
│   │   ├── debate/                # 辩论逻辑
│   │   └── ...                    # 其他模块
│   ├── utils/                     # 工具函数
│   └── helpers/                   # 辅助函数
│
├── integration/                   # 集成测试 (目标: 20%)
│   ├── agent/                     # Agent集成测试
│   ├── api/                       # API集成测试
│   ├── database/                  # 数据库集成
│   └── ...
│
├── e2e/                          # E2E测试 (目标: 10%)
│   ├── auth/                      # 认证流程
│   ├── debate-flow/               # 辩论流程
│   ├── payment/                   # 支付流程
│   └── performance/               # 性能测试
│
├── components/                   # 组件测试
│   ├── admin/                     # 管理组件
│   ├── analytics/                 # 分析组件
│   ├── case/                      # 案件组件
│   ├── debate/                    # 辩论组件
│   └── ...                        # 其他组件
│
├── api/                          # API路由测试
│   ├── admin/                     # 管理API
│   ├── cases/                     # 案件API
│   ├── debates/                   # 辩论API
│   └── ...                        # 其他API
│
├── fixtures/                     # 测试数据
│   ├── cases.json
│   ├── users.json
│   └── ...
│
├── mocks/                        # Mock对象
│   ├── api/
│   ├── database/
│   └── services/
│
├── factories/                    # 测试数据工厂
│   └── test-utils.ts
│
└── setup/                        # 测试配置
    ├── setup-tests.ts
    └── global-setup.ts
```

---

## 📝 命名规范

### 文件命名

```bash
# 单元测试和组件测试
[module-name].test.ts
[module-name].test.tsx

# E2E测试
[scenario].spec.ts

# 示例
claim-extractor.test.ts          ✅ 正确
memory-agent.test.tsx             ✅ 正确
user-login-flow.spec.ts           ✅ 正确
claim-extraction-bad-case.test.ts ❌ 错误 (bad-case应在describe块中)
memory-agent-debug.test.ts        ❌ 错误 (不应有debug)
```

### 测试分组

```typescript
describe('ModuleName', () => {
  // 1. 基本功能测试
  describe('基本功能', () => {
    test('should perform basic operation', () => {});
  });

  // 2. 边界情况
  describe('边界情况', () => {
    test('should handle empty input', () => {});
    test('should handle max length input', () => {});
  });

  // 3. Bad Cases (如果有特定的失败案例优化)
  describe('Bad Cases - Issue #123', () => {
    test('should extract compound claims', () => {});
    test('should handle implicit requests', () => {});
  });

  // 4. 错误处理
  describe('错误处理', () => {
    test('should throw when invalid input', () => {});
  });
});
```

---

## 🗂️ 文件放置规则

### 规则 1: 测试跟随源码位置

```bash
源码位置                                   测试位置
─────────────────────────────────────────────────────────────
src/lib/agent/doc-analyzer/             → src/__tests__/unit/lib/agent/doc-analyzer/
src/lib/auth/jwt.ts                     → src/__tests__/unit/lib/auth/jwt.test.ts
src/components/case/CaseList.tsx        → src/__tests__/components/case/CaseList.test.tsx
src/app/api/cases/route.ts              → src/__tests__/api/cases/route.test.ts
```

### 规则 2: 按测试类型分层

```bash
单元测试 → src/__tests__/unit/
  - 测试单个函数/类
  - 无外部依赖
  - 运行快速

集成测试 → src/__tests__/integration/
  - 测试多个模块协作
  - 可能涉及数据库/API
  - 运行较慢

E2E测试 → src/__tests__/e2e/
  - 测试完整业务流程
  - 涉及UI交互
  - 运行最慢
```

### 规则 3: 特殊文件位置

```bash
Test Utilities    → src/__tests__/factories/test-utils.ts
Test Fixtures     → src/__tests__/fixtures/[data-name].json
Mock Services     → src/__tests__/mocks/[service-name].ts
Setup Files       → src/__tests__/setup/setup-tests.ts
```

---

## ❌ 禁止事项

### 1. 禁止Debug文件

```bash
❌ module.debug.test.ts
❌ module.accuracy.debug.test.ts
❌ test-debug.spec.ts
```

**原因**: 污染测试集合，不应提交到生产代码

**替代方案**: 使用 `.only` 临时调试

```typescript
test.only('debug this test', () => {
  // 调试完后删除 .only
});
```

### 2. 禁止重复文件

```bash
❌ src/__tests__/agent/claim-extractor.test.ts
❌ src/__tests__/lib/agent/claim-extractor.test.ts (重复)
```

**原因**: 导致维护混乱，修改不同步

**解决**: 只保留一个，按规则放在正确位置

### 3. 禁止独立的 "bad-cases" 目录

```bash
❌ src/__tests__/bad-cases/claim-extraction-bad-case.test.ts
```

**原因**: 增加目录复杂度，应作为测试用例的一部分

**替代**: 在原测试文件中使用 `describe('Bad Cases - Issue #123')`

### 4. 禁止顶级散落文件

```bash
❌ src/__tests__/some-random-test.test.ts
```

**原因**: 无组织，难以查找

**解决**: 按模块放入相应的 unit/integration/e2e 目录

---

## 📊 测试覆盖率目标

### 金字塔原则

```
         /\
        /  \      E2E Tests
       /____\     10%
      /      \
     /________\   Integration Tests
    /          \  20%
   /____________\ Unit Tests
  /              \ 70%
```

### 覆盖率要求

| 层级            | 最低要求 | 目标 | 说明                   |
| --------------- | -------- | ---- | ---------------------- |
| **Unit**        | 60%      | 80%+ | 核心业务逻辑必须高覆盖 |
| **Integration** | 40%      | 60%  | 关键流程必须覆盖       |
| **E2E**         | 20%      | 40%  | 主要用户路径必须覆盖   |

### 关键模块要求

| 模块      | 最低覆盖率 | 说明     |
| --------- | ---------- | -------- |
| Agent系统 | 80%        | 核心功能 |
| 认证授权  | 90%        | 安全关键 |
| 支付处理  | 90%        | 金融关键 |
| AI服务    | 70%        | 重要功能 |
| UI组件    | 60%        | 用户体验 |

---

## 🔧 Jest 配置建议

### jest.config.js

```javascript
module.exports = {
  // 测试匹配模式
  testMatch: [
    '<rootDir>/src/__tests__/unit/**/*.test.{ts,tsx}',
    '<rootDir>/src/__tests__/integration/**/*.test.{ts,tsx}',
    '<rootDir>/src/__tests__/components/**/*.test.{tsx,ts}',
    '<rootDir>/src/__tests__/api/**/*.test.ts',
  ],

  // 忽略模式
  testPathIgnorePatterns: [
    '/node_modules/',
    '/__tests__/fixtures/',
    '/__tests__/mocks/',
    '/__tests__/factories/',
    '\\.debug\\.test\\.', // 忽略debug文件
  ],

  // 覆盖率收集
  collectCoverageFrom: [
    'src/lib/**/*.{ts,tsx}',
    'src/components/**/*.{ts,tsx}',
    'src/app/api/**/*.ts',
    '!**/*.d.ts',
    '!**/node_modules/**',
  ],

  // 覆盖率阈值
  coverageThreshold: {
    global: {
      branches: 60,
      functions: 60,
      lines: 60,
      statements: 60,
    },
  },
};
```

---

## 📚 最佳实践

### 1. AAA 模式 (Arrange-Act-Assert)

```typescript
test('should extract claim from document', () => {
  // Arrange - 准备
  const document = createMockDocument();
  const extractor = new ClaimExtractor();

  // Act - 执行
  const result = extractor.extract(document);

  // Assert - 断言
  expect(result).toHaveLength(3);
  expect(result[0].type).toBe('financial');
});
```

### 2. 描述性测试名称

```typescript
// ✅ 好的
test('should extract multiple claims from contract document', () => {});
test('should throw error when document is empty', () => {});
test('should handle Chinese characters in claim text', () => {});

// ❌ 不好的
test('test1', () => {});
test('works', () => {});
test('extraction', () => {});
```

### 3. 独立性

```typescript
// ✅ 每个测试独立
describe('ClaimExtractor', () => {
  test('test 1', () => {
    const extractor = new ClaimExtractor(); // 独立实例
    // ...
  });

  test('test 2', () => {
    const extractor = new ClaimExtractor(); // 独立实例
    // ...
  });
});

// ❌ 测试共享状态
describe('ClaimExtractor', () => {
  const extractor = new ClaimExtractor(); // 共享!

  test('test 1', () => {
    extractor.config.threshold = 0.5; // 修改共享状态
  });

  test('test 2', () => {
    // 受 test 1 影响!
  });
});
```

### 4. Mock 外部依赖

```typescript
// ✅ Mock AI服务
jest.mock('@/lib/ai/unified-service', () => ({
  analyzeDocument: jest.fn(),
}));

test('should use AI service', async () => {
  const mockAnalyze = require('@/lib/ai/unified-service').analyzeDocument;
  mockAnalyze.mockResolvedValue({ claims: [] });

  // 测试代码...
});
```

---

## 🚀 实施检查清单

### 新测试文件

- [ ] 文件名符合规范 (_.test.ts 或 _.spec.ts)
- [ ] 放在正确的目录 (unit/integration/e2e/components/api)
- [ ] 测试跟随源码位置
- [ ] 无debug或accuracy等修饰符
- [ ] 使用describe/test组织
- [ ] AAA模式编写测试
- [ ] 描述性测试名称
- [ ] Mock外部依赖

### 代码审查检查

- [ ] 无重复的测试文件
- [ ] 无debug文件
- [ ] 测试位置正确
- [ ] 覆盖率达标
- [ ] 测试可独立运行
- [ ] 测试运行稳定（无flaky）

---

## 📞 参考资源

- [Jest 官方文档](https://jestjs.io/)
- [React Testing Library](https://testing-library.com/react)
- [Playwright 文档](https://playwright.dev/)
- [测试金字塔原则](https://martinfowler.com/articles/practical-test-pyramid.html)

---

**维护**: 开发团队
**更新频率**: 每季度审查
**问题反馈**: 在项目Issue中标记 `testing`
