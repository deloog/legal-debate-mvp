# E2E测试AI配置修复报告

## 问题描述

在E2E测试中，尽管`.env`文件中配置了真实的AI API密钥（智谱AI和DeepSeek），但测试时AI不会主动引用使用，始终使用Mock服务。

## 问题根源

### 1. 配置选择逻辑

AI服务配置在`src/lib/ai/config.ts`中通过`getAIConfig()`函数选择：

```typescript
export function getAIConfig(useRealAPI: boolean = false): AIServiceConfig {
  const nodeEnv = process.env.NODE_ENV || "development";
  
  switch (nodeEnv) {
    case "production":
      return PRODUCTION_AI_CONFIG;
    case "test":
      return TEST_AI_CONFIG;  // ← 默认使用Mock配置
    case "development":
    default:
      return DEVELOPMENT_AI_CONFIG;
  }
}
```

### 2. 测试环境配置

`TEST_AI_CONFIG`配置了Mock客户端：

```typescript
export const TEST_AI_CONFIG: AIServiceConfig = {
  clients: [
    {
      provider: "zhipu",
      apiKey: "test-key",
      baseURL: "http://localhost:3000/mock/zhipu",  // Mock地址
      // ...
    },
  ],
  // ...
};
```

### 3. 环境变量文件

`.env.test`文件也配置了mock API密钥：

```env
ZHIPUAI_API_KEY="mock-key-for-testing"
ZHIPUAI_BASE_URL="http://localhost:3001/mock/zhipu"
```

### 4. 问题总结

| 层面 | 状态 |
|------|------|
| `.env`文件 | 有真实API密钥 |
| `.env.test`文件 | 只有mock配置 |
| `TEST_AI_CONFIG` | 硬编码为mock配置 |
| `getAIConfig()` | 测试环境强制返回`TEST_AI_CONFIG` |
| 无环境变量控制 | 无法切换到真实AI |

## 解决方案

### 1. 修改AI服务配置

**文件：** `src/lib/ai/config.ts`

**修改内容：** 添加`USE_REAL_AI`环境变量支持

```typescript
export function getAIConfig(useRealAPI: boolean = false): AIServiceConfig {
  const nodeEnv = process.env.NODE_ENV || "development";
  
  // 检查环境变量 USE_REAL_AI 是否设置为 true
  const useRealAIEnv = process.env.USE_REAL_AI === "true";
  
  // 如果明确指定使用真实API（准确性测试）或通过环境变量设置
  if (useRealAPI || useRealAIEnv) {
    return ACCURACY_TEST_AI_CONFIG;  // 使用真实API配置
  }
  
  switch (nodeEnv) {
    case "production":
      return PRODUCTION_AI_CONFIG;
    case "test":
      return TEST_AI_CONFIG;  // Mock配置（默认）
    case "development":
    default:
      return DEVELOPMENT_AI_CONFIG;
  }
}
```

### 2. 更新环境变量文件

**文件：** `.env`

**添加内容：**
```env
# AI服务配置
# 注意：E2E测试默认使用Mock AI服务，通过设置 USE_REAL_AI=true 启用真实AI服务
USE_REAL_AI=false
```

**文件：** `.env.example`

**添加内容：**
```env
# AI服务配置
# 注意：E2E测试默认使用Mock AI服务，通过设置 USE_REAL_AI=true 启用真实AI服务
# 开发/测试环境：建议设为 false，使用Mock服务快速测试
# 准确性测试：建议设为 true，使用真实API验证功能
USE_REAL_AI=false
```

### 3. 更新开发规范

**文件：** `.clinerules`

**添加规则：**
```json
"e2e_ai_config": "E2E测试默认使用Mock AI服务（USE_REAL_AI=false）。启用真实AI服务需设置 USE_REAL_AI=true 环境变量。真实AI测试会产生API调用费用和延迟，仅在准确性测试或需要验证真实API行为时使用。开发/测试阶段建议使用Mock模式以提升速度并节省成本。"
```

### 4. 创建配置指南

**文件：** `docs/testing/E2E_AI_CONFIG_GUIDE.md`

**内容：**
- Mock模式和真实AI模式的对比
- 配置方式（三种方法）
- 运行示例
- 配置原理说明
- 常见问题解答
- 相关文档链接

## 修改文件汇总

| 文件 | 修改内容 | 行数变化 |
|------|----------|----------|
| `src/lib/ai/config.ts` | 添加USE_REAL_AI环境变量支持 | +3 |
| `.env` | 添加USE_REAL_AI变量和说明 | +3 |
| `.env.example` | 添加USE_REAL_AI变量和说明 | +4 |
| `.clinerules` | 添加E2E测试AI配置规则 | +1 |
| `docs/testing/E2E_AI_CONFIG_GUIDE.md` | 创建配置指南文档 | +180 |

## 配置模式对比

| 模式 | 环境变量 | 配置文件 | 超时 | 重试 | 适用场景 |
|------|-----------|----------|------|------|----------|
| Mock模式 | `USE_REAL_AI=false` | `TEST_AI_CONFIG` | 10秒 | 1次 | 开发、日常测试、CI/CD |
| 真实AI模式 | `USE_REAL_AI=true` | `ACCURACY_TEST_AI_CONFIG` | 60秒 | 3次 | 准确性测试、发布验证 |

## 使用方法

### 方法1：修改.env文件

```env
USE_REAL_AI=true
```

### 方法2：命令行设置

```bash
# 使用Mock AI（默认）
npx playwright test

# 使用真实AI
USE_REAL_AI=true npx playwright test
```

### 方法3：测试代码设置

```typescript
import { AIServiceFactory } from '@/lib/ai/service-refactored';
const aiService = await AIServiceFactory.getInstance('test', undefined, true);
```

## 测试验证

### Mock模式验证

```bash
# 预期：测试快速完成（<10秒/测试）
npx playwright test src/__tests__/e2e/
```

### 真实AI模式验证

```bash
# 预期：测试较慢（5-30秒/测试），产生API调用
USE_REAL_AI=true npx playwright test src/__tests__/e2e/debate-flow/data-consistency.spec.ts
```

## 注意事项

### 使用真实AI时的注意事项

1. **API密钥验证**
   - 确保`.env`中的API密钥有效
   - 确保API账户有足够余额

2. **测试速度**
   - 真实AI响应时间：5-30秒
   - 建议设置单线程运行：`workers=1`
   - 延长测试超时时间

3. **成本控制**
   - 优先使用Mock模式进行功能测试
   - 真实AI测试仅针对关键路径
   - 监控API调用次数和费用

4. **错误处理**
   - 可能遇到超时、限流、配额不足等错误
   - 真实AI测试可以验证系统的容错能力

### Mock模式的限制

1. Mock数据可能与真实AI输出有差异
2. 无法验证AI准确性
3. 无法测试API错误处理逻辑

## 相关文档

- [E2E测试AI配置指南](../docs/testing/E2E_AI_CONFIG_GUIDE.md)
- [AI服务配置](../src/lib/ai/config.ts)
- [AI服务实现](../src/lib/ai/service-refactored.ts)
- [E2E测试Phase 4最终报告](e2e-fix-phase4-final-report.md)

## 修复日期

2026-01-11

## 修复版本

v1.0
