# 测试覆盖率指南

## 📋 概述

本文档定义了项目的测试覆盖率标准、流程和最佳实践，确保代码质量和可维护性。

## 🎯 覆盖率目标

### 整体覆盖率阈值

| 指标              | 目标  | 阈值 | 说明         |
| ----------------- | ----- | ---- | ------------ |
| Statements (语句) | > 80% | 70%  | 全局最低要求 |
| Branches (分支)   | > 75% | 70%  | 全局最低要求 |
| Functions (函数)  | > 80% | 70%  | 全局最低要求 |
| Lines (代码行)    | > 80% | 70%  | 全局最低要求 |

### 分模块覆盖率阈值

```javascript
// jest.config.js
coverageThreshold: {
  global: {
    statements: 70,
    branches: 70,
    functions: 70,
    lines: 70,
  },
  // API层 - 关键业务逻辑，要求较高
  './src/app/api/': {
    statements: 90,
    branches: 85,
    functions: 90,
    lines: 90,
  },
  // 缓存层 - 基础设施，要求中等
  './src/lib/cache/': {
    statements: 85,
    branches: 80,
    functions: 85,
    lines: 85,
  },
  // 数据库层 - 基础设施，要求中等
  './src/lib/db/': {
    statements: 80,
    branches: 75,
    functions: 80,
    lines: 80,
  },
  // AI服务层 - 外部依赖，允许较低
  './src/lib/ai/': {
    statements: 60,
    branches: 50,
    functions: 60,
    lines: 60,
  },
  // 辩论功能层 - 核心业务，要求较高
  './src/lib/debate/': {
    statements: 85,
    branches: 80,
    functions: 85,
    lines: 85,
  },
  // 法条检索层 - 核心业务，要求较高
  './src/lib/law-article/': {
    statements: 90,
    branches: 85,
    functions: 90,
    lines: 90,
  },
  // 监控层 - 基础设施，要求中等
  './src/lib/monitoring/': {
    statements: 75,
    branches: 70,
    functions: 75,
    lines: 75,
  },
}
```

## 🔧 基础设施

### 1. CI/CD集成

**文件位置**：`.github/workflows/ci.yml`

**功能**：

- 自动运行测试并生成覆盖率报告
- 上传覆盖率到Codecov
- 阻止覆盖率低于阈值的PR合并
- 对比PR覆盖率差异

### 2. Pre-commit检查

**文件位置**：`.husky/pre-commit`

**功能**：

- 提交前自动运行测试
- 验证覆盖率不低于当前基线
- 防止低质量代码进入仓库

### 3. Lint-staged配置

**文件位置**：`package.json` -> `lint-staged`

**功能**：

- 仅测试变更的文件
- 自动修复代码风格问题
- 快速反馈

### 4. 覆盖率监控脚本

**文件位置**：`scripts/monitor-test-coverage.ts`

**功能**：

- 实时监控覆盖率变化
- 生成覆盖率趋势报告
- 检测覆盖率下降
- 发送告警通知

### 5. 覆盖率门禁脚本

**文件位置**：`scripts/check-coverage-gate.ts`

**功能**：

- 验证覆盖率达标
- 阻止不达标代码合并
- 生成覆盖率报告

## 📊 工作流程

### 开发阶段

1. **编写代码**
   - 遵循TDD（测试驱动开发）原则
   - 先写测试，再写实现

2. **运行测试**

   ```bash
   # 运行所有测试
   npm test

   # 运行特定测试
   npm test -- path/to/test.test.ts

   # 监听模式
   npm run test:watch
   ```

3. **检查覆盖率**

   ```bash
   # 生成覆盖率报告
   npm run test:coverage

   # 查看HTML报告
   open coverage/index.html
   ```

### 提交阶段

1. **Pre-commit检查**
   - 自动运行：`npm run precommit`
   - 检查：代码风格、类型检查、测试

2. **Commit message**
   - 遵循Conventional Commits规范
   - 示例：`feat(cache): 添加Redis缓存层`

### PR阶段

1. **CI/CD自动检查**
   - 运行完整测试套件
   - 生成覆盖率报告
   - 对比覆盖率差异
   - 上传到Codecov

2. **Code Review**
   - 检查覆盖率是否达标
   - 确认测试质量
   - 验证新增功能的测试

### 发布阶段

1. **覆盖率验证**
   - 确保整体覆盖率不低于阈值
   - 检查关键模块覆盖率
   - 生成覆盖率报告

2. **发布**
   - 合并到main分支
   - 部署到生产环境
   - 监控运行时指标

## 📈 覆盖率提升计划

### 当前状态

- **整体覆盖率**：23.3%
- **API层**：80-100%（良好）
- **核心库**：0-73%（需提升）

### 优先级

#### 高优先级（核心业务）

1. **法条检索** (`src/lib/law-article/`)
   - 目标：90%
   - 当前：未测量
   - 行动：补充测试用例

2. **缓存层** (`src/lib/cache/`)
   - 目标：85%
   - 当前：0%
   - 行动：补充Redis和缓存管理器测试

3. **辩论功能** (`src/lib/debate/`)
   - 目标：85%
   - 当前：0%
   - 行动：补充核心辩论逻辑测试

#### 中优先级（基础设施）

4. **数据库层** (`src/lib/db/`)
   - 目标：80%
   - 当前：73.45%
   - 行动：补充边缘情况测试

5. **监控层** (`src/lib/monitoring/`)
   - 目标：75%
   - 当前：0%
   - 行动：补充监控指标测试

#### 低优先级（辅助功能）

6. **AI服务层** (`src/lib/ai/`)
   - 目标：60%
   - 当前：0%
   - 行动：补充错误处理测试

7. **验证器** (`src/lib/validators/`)
   - 目标：80%
   - 当前：0%
   - 行动：补充验证逻辑测试

## 🚫 反模式

### 不要做的

1. ❌ **为覆盖率写测试**
   - 测试应该验证业务逻辑
   - 而不是仅仅为了提高覆盖率

2. ❌ **测试私有方法**
   - 应该测试公共接口
   - 私有方法通过公共方法间接测试

3. ❌ **忽略测试失败**
   - 失败的测试必须修复
   - 或标记为跳过并创建issue

4. ❌ **过度Mock**
   - 只Mock外部依赖
   - 不要Mock被测试的代码

5. ❌ **测试实现细节**
   - 测试行为，不是实现
   - 关注输入输出，不是内部状态

### 应该做的

1. ✅ **遵循AAA模式**
   - Arrange（准备）：设置测试数据
   - Act（执行）：调用被测试代码
   - Assert（断言）：验证结果

2. ✅ **测试边界条件**
   - 最小值、最大值
   - 空值、null、undefined
   - 异常输入

3. ✅ **使用描述性测试名称**
   - 应该描述测试的目的
   - 示例：`应该为不存在的查询返回null`

4. ✅ **保持测试独立**
   - 不依赖测试执行顺序
   - 不共享状态
   - 每个测试独立运行

5. ✅ **快速失败**
   - 先写简单测试
   - 逐步增加复杂度
   - 早期发现错误

## 📚 参考资料

- [Jest文档](https://jestjs.io/)
- [Testing Library](https://testing-library.com/)
- [Codecov文档](https://docs.codecov.com/)
- [测试最佳实践](https://github.com/goldbergyoni/javascript-testing-best-practices)

## 🔄 更新历史

| 日期       | 版本 | 说明                           |
| ---------- | ---- | ------------------------------ |
| 2025-12-27 | 1.0  | 初始版本，定义覆盖率标准和流程 |

---

**维护者**：开发团队  
**最后更新**：2025-12-27
