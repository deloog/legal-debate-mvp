# E2E测试AI配置指南

## 概述

本文档说明E2E（端到端）测试中AI服务的配置选项，包括Mock模式和真实AI模式的区别及使用场景。

## 配置模式

### 1. Mock AI模式（默认）

**环境变量设置：**
```bash
USE_REAL_AI=false
```

**特点：**
- 使用Mock AI服务，不调用真实API
- 测试速度快（响应时间<1秒）
- 无API调用费用
- 测试结果可预测

**适用场景：**
- 开发和日常测试
- CI/CD流水线快速反馈
- 功能验证和集成测试
- 不依赖外部服务稳定性

**注意事项：**
- Mock数据可能与真实AI输出有差异
- 无法验证AI准确性
- 无法测试API错误处理逻辑

### 2. 真实AI模式

**环境变量设置：**
```bash
USE_REAL_AI=true
```

**特点：**
- 使用真实AI API（DeepSeek、智谱等）
- 响应时间较长（5-30秒）
- 产生API调用费用
- 测试结果更接近生产环境

**适用场景：**
- 准确性测试
- API行为验证
- 性能基准测试
- 发布前验证

**注意事项：**
- 需要确保API密钥有效且有足够余额
- 测试速度较慢
- 可能触发API限流
- 建议限制测试频率和并发数

## 配置方式

### 方法1：修改.env文件

编辑项目根目录的`.env`文件：

```env
# AI服务配置
USE_REAL_AI=false  # 或 true
```

### 方法2：命令行设置

在运行测试时设置环境变量：

```bash
# 使用Mock AI（默认）
npx playwright test

# 使用真实AI
USE_REAL_AI=true npx playwright test

# 指定特定测试文件
USE_REAL_AI=true npx playwright test src/__tests__/e2e/debate-flow/data-consistency.spec.ts
```

### 方法3：在测试代码中设置

在测试辅助函数或测试文件中设置：

```typescript
import { AIServiceFactory } from '@/lib/ai/service-refactored';

// 在测试初始化时创建使用真实AI的服务
const aiService = await AIServiceFactory.getInstance('test', undefined, true);
```

## 运行示例

### Mock模式运行

```bash
# 运行所有E2E测试
npx playwright test src/__tests__/e2e/

# 运行特定测试套件
npx playwright test src/__tests__/e2e/debate-flow/

# 查看详细输出
npx playwright test src/__tests__/e2e/ --reporter=list
```

### 真实AI模式运行

```bash
# 运行所有E2E测试（使用真实AI）
USE_REAL_AI=true npx playwright test src/__tests__/e2e/

# 运行特定测试（使用真实AI）
USE_REAL_AI=true npx playwright test src/__tests__/e2e/debate-flow/data-consistency.spec.ts

# 运行并生成报告
USE_REAL_AI=true npx playwright test --reporter=html
```

## 配置原理

### AI服务配置选择

AI服务配置在`src/lib/ai/config.ts`中定义：

```typescript
export function getAIConfig(useRealAPI: boolean = false): AIServiceConfig {
  const nodeEnv = process.env.NODE_ENV || "development";
  
  // 检查环境变量 USE_REAL_AI 是否设置为 true
  const useRealAIEnv = process.env.USE_REAL_AI === "true";
  
  // 如果明确指定使用真实API（准确性测试）或通过环境变量设置
  if (useRealAPI || useRealAIEnv) {
    return ACCURACY_TEST_AI_CONFIG;
  }
  
  switch (nodeEnv) {
    case "production":
      return PRODUCTION_AI_CONFIG;
    case "test":
      return TEST_AI_CONFIG;  // Mock配置
    case "development":
    default:
      return DEVELOPMENT_AI_CONFIG;
  }
}
```

### 配置对比

| 配置 | USE_REAL_AI | 描述 | 超时 | 重试次数 |
|------|-------------|------|--------|----------|
| TEST_AI_CONFIG | false | Mock模式，使用本地Mock服务 | 10秒 | 1次 |
| ACCURACY_TEST_AI_CONFIG | true | 真实AI模式，使用DeepSeek/智谱 | 60秒 | 3次 |

## 常见问题

### Q1: 为什么E2E测试默认不使用真实AI？

A: 原因如下：
1. 测试速度：真实AI响应时间5-30秒，Mock模式<1秒
2. 成本：频繁测试会产生大量API调用费用
3. 稳定性：Mock模式不依赖外部服务，测试更稳定
4. 可预测性：Mock数据固定，便于断言和验证

### Q2: 什么时候需要使用真实AI？

A: 建议在以下场景使用真实AI：
1. 验证AI准确性和响应质量
2. 测试API错误处理和重试逻辑
3. 性能基准测试
4. 发布前关键验证

### Q3: 如何测试真实AI的错误处理？

A: 真实AI模式下可能遇到：
- 超时错误（网络慢）
- API限流（请求过多）
- 配额不足（余额不足）
- 服务不可用（API宕机）

这些错误在Mock模式下难以模拟，真实AI测试可以验证系统的容错能力。

### Q4: 使用真实AI时需要注意什么？

A: 注意事项：
1. 确保API密钥有效且有足够余额
2. 限制测试频率，避免触发限流
3. 考虑使用单线程运行（workers=1）
4. 延长测试超时时间
5. 监控API调用次数和费用

### Q5: 如何控制测试成本？

A: 成本控制建议：
1. 优先使用Mock模式进行功能测试
2. 真实AI测试仅针对关键路径
3. 使用测试环境的API密钥（如有折扣）
4. 限制并发测试数和重试次数
5. 定期检查API使用量

## 相关文档

- [AI服务配置](../../src/lib/ai/config.ts)
- [AI服务实现](../../src/lib/ai/service-refactored.ts)
- [测试规范](../guides/CODE_STYLE.md#testing)
- [.clinerules](../../.clinerules)

## 更新历史

| 日期 | 版本 | 说明 |
|------|------|------|
| 2026-01-11 | 1.0 | 初始版本，添加USE_REAL_AI环境变量说明 |
