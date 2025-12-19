# AI服务基础设施

本目录包含完整的AI服务基础设施实现，提供多提供商AI服务的统一接口、负载均衡、监控和降级策略。

## 📁 文件结构

```
src/lib/ai/
├── README.md              # 本文档
├── config.ts             # AI服务配置管理
├── service.ts            # AI服务主类和工厂
├── clients.ts            # AI客户端实现（已存在）
├── load-balancer.ts      # 负载均衡器
├── monitor.ts            # 监控和日志系统
├── fallback.ts           # 降级策略管理
├── lawstar-client.ts     # 法律之星客户端 ⭐ 新增
├── lawstar-config.ts     # 法律之星配置 ⭐ 新增
├── unified-service.ts    # 统一AI服务管理器 ⭐ 新增
└── ../types/
    ├── ai-service.d.ts   # 完整的AI服务类型定义
    └── lawstar-api.d.ts  # 法律之星API类型定义 ⭐ 新增
```

## 🚀 核心功能

### 1. 多提供商支持
- **智谱AI (Zhipu)**: GLM系列模型
- **DeepSeek**: Chat和Code模型
- **OpenAI**: GPT系列模型
- **Anthropic**: Claude系列模型

### 2. 负载均衡策略
- **轮询 (Round Robin)**: 依次分配请求
- **加权轮询 (Weighted Round Robin)**: 根据权重分配
- **最少连接 (Least Connections)**: 分配给连接数最少的提供商
- **最少响应时间 (Least Response Time)**: 分配给响应最快的提供商
- **随机 (Random)**: 随机选择提供商
- **优先级 (Provider Priority)**: 按优先级顺序选择

### 3. 监控和日志
- **性能指标**: 响应时间、吞吐量、错误率
- **健康检查**: 定期检查提供商状态
- **实时监控**: 请求追踪和状态监控
- **告警系统**: 阈值监控和通知

### 4. 降级策略
- **提供商切换**: 自动切换到备用提供商
- **缓存降级**: 使用缓存响应
- **简化请求**: 降低请求复杂度
- **本地处理**: 使用本地AI处理
- **错误返回**: 优雅错误处理

## 🛠️ 使用方法

### 基础使用

```typescript
import AIServiceFactory, { getAIConfig } from '@/lib/ai/service';

// 获取配置
const config = getAIConfig();

// 创建AI服务实例
const aiService = await AIServiceFactory.getInstance('default', config);

// 执行聊天完成
const response = await aiService.chatCompletion({
  model: 'glm-4-flash',
  messages: [
    { role: 'user', content: '你好，请介绍一下自己' }
  ],
  temperature: 0.7,
  maxTokens: 1000,
});

console.log(response.choices[0].message.content);
```

### 高级配置

```typescript
import { AIServiceFactory, PRODUCTION_AI_CONFIG } from '@/lib/ai/config';

// 自定义配置
const customConfig = {
  ...PRODUCTION_AI_CONFIG,
  defaultProvider: 'deepseek',
  loadBalancer: {
    ...PRODUCTION_AI_CONFIG.loadBalancer,
    strategy: 'least_response_time',
    weights: {
      zhipu: 0.4,
      deepseek: 0.6,
    },
  },
};

// 创建自定义实例
const aiService = await AIServiceFactory.createCustomInstance('production', customConfig);
```

### 监控和统计

```typescript
// 获取服务状态
const status = aiService.getServiceStatus();
console.log('服务健康状态:', status.healthy);
console.log('总请求数:', status.totalRequests);
console.log('平均响应时间:', status.averageResponseTime);

// 获取提供商统计
const providerStats = aiService.getProviderStats();
providerStats.providerStats.forEach(stat => {
  console.log(`提供商 ${stat.provider}:`);
  console.log(`  健康状态: ${stat.healthy}`);
  console.log(`  平均响应时间: ${stat.averageResponseTime}ms`);
  console.log(`  成功请求: ${stat.successfulRequests}`);
  console.log(`  失败请求: ${stat.failedRequests}`);
});

// 获取性能指标
const metrics = aiService.getMetrics(3600000); // 最近1小时
console.log('性能指标:', metrics);

// 获取降级统计
const fallbackStats = aiService.getFallbackStats(3600000);
console.log('降级统计:', fallbackStats);
```

## ⚙️ 配置选项

### 环境变量

```bash
# 智谱AI配置
ZHIPU_API_KEY=your_zhipu_api_key
ZHIPU_BASE_URL=https://open.bigmodel.cn/api/paas/v4/

# DeepSeek配置
DEEPSEEK_API_KEY=your_deepseek_api_key
DEEPSEEK_BASE_URL=https://api.deepseek.com/v1

# OpenAI配置
OPENAI_API_KEY=your_openai_api_key
OPENAI_BASE_URL=https://api.openai.com/v1

# Anthropic配置
ANTHROPIC_API_KEY=your_anthropic_api_key
ANTHROPIC_BASE_URL=https://api.anthropic.com
```

### 配置文件

项目提供三种环境配置：

- **开发环境** (`DEVELOPMENT_AI_CONFIG`): 适合本地开发
- **测试环境** (`TEST_AI_CONFIG`): 适合自动化测试
- **生产环境** (`PRODUCTION_AI_CONFIG`): 适合生产部署

## 🔧 组件详解

### AIService (主服务类)

AI服务的核心类，提供统一的API接口：

**主要方法:**
- `chatCompletion(request)`: 执行聊天完成
- `embedding(request)`: 执行文本嵌入
- `getServiceStatus()`: 获取服务状态
- `healthCheck()`: 健康检查
- `getAvailableProviders()`: 获取可用提供商
- `updateConfig(config)`: 更新配置

### LoadBalancer (负载均衡器)

实现多种负载均衡策略：

**特性:**
- 动态提供商选择
- 健康状态监控
- 连接数管理
- 响应时间统计

### Monitor (监控系统)

提供全面的监控和日志功能：

**功能:**
- 实时指标收集
- 性能统计分析
- 告警阈值监控
- 日志记录和持久化

### FallbackManager (降级管理)

实现智能降级策略：

**策略:**
- 多级降级处理
- 条件触发机制
- 自动恢复能力
- 降级效果统计

## 📊 性能特性

### 高可用性
- **多提供商**: 支持多个AI服务提供商
- **自动切换**: 故障时自动切换提供商
- **降级处理**: 多级降级保证服务可用
- **健康检查**: 持续监控提供商状态

### 高性能
- **连接池**: 复用HTTP连接
- **智能缓存**: 多层缓存策略
- **负载均衡**: 智能分配请求
- **异步处理**: 全异步架构

### 可扩展性
- **插件架构**: 易于添加新提供商
- **配置驱动**: 灵活的配置管理
- **模块化**: 组件可独立扩展
- **工厂模式**: 支持多实例管理

## 🧪 测试

### 单元测试

```typescript
import AIServiceFactory from '@/lib/ai/service';

describe('AIService', () => {
  let aiService: AIService;

  beforeAll(async () => {
    aiService = await AIServiceFactory.getInstance('test', TEST_AI_CONFIG);
  });

  it('should handle chat completion', async () => {
    const response = await aiService.chatCompletion({
      model: 'glm-4-flash',
      messages: [{ role: 'user', content: 'Hello' }],
    });

    expect(response.choices).toHaveLength(1);
    expect(response.choices[0].message.content).toBeDefined();
  });
});
```

### 集成测试

```typescript
import { validateAIConfig } from '@/lib/ai/config';

describe('AI Configuration', () => {
  it('should validate configuration', () => {
    const validation = validateAIConfig();
    expect(validation.valid).toBe(true);
    expect(validation.errors).toHaveLength(0);
  });
});
```

## 🔍 监控和调试

### 日志级别

- **debug**: 详细调试信息
- **info**: 一般信息记录
- **warn**: 警告信息
- **error**: 错误信息

### 指标类型

- **请求指标**: 数量、成功率、响应时间
- **提供商指标**: 健康状态、连接数、错误率
- **缓存指标**: 命中率、存储使用、过期统计
- **降级指标**: 触发频率、成功率、恢复时间

### 调试工具

```typescript
// 启用详细日志
const debugConfig = {
  ...getAIConfig(),
  monitor: {
    ...getAIConfig().monitor,
    logLevel: 'debug',
    metricsInterval: 10000, // 10秒间隔
  },
};

// 查看内部状态
console.log('负载均衡状态:', aiService.getProviderStats());
console.log('监控指标:', aiService.getMetrics());
console.log('降级历史:', aiService.getFallbackStats());
```

## 🚨 故障处理

### 常见问题

1. **API密钥未配置**
   ```typescript
   // 检查配置
   const validation = validateAIConfig();
   if (!validation.valid) {
     console.error('配置错误:', validation.errors);
   }
   ```

2. **提供商不可用**
   ```typescript
   // 检查健康状态
   const isHealthy = await aiService.healthCheck();
   if (!isHealthy) {
     console.warn('部分提供商不可用，已启用降级策略');
   }
   ```

3. **请求超时**
   ```typescript
   // 调整超时配置
   const configWithTimeout = {
     ...config,
     globalTimeout: 120000, // 2分钟
     clients: config.clients.map(client => ({
       ...client,
       timeout: 60000, // 1分钟
     })),
   };
   ```

### 故障恢复

- **自动重试**: 内置指数退避重试机制
- **提供商切换**: 自动切换到健康提供商
- **降级激活**: 启用本地处理或缓存响应
- **监控告警**: 及时通知运维人员

## 📈 性能优化建议

### 配置优化

1. **合理设置权重**: 根据提供商性能设置负载均衡权重
2. **调整超时时间**: 根据网络环境调整请求超时
3. **配置缓存策略**: 根据业务特点设置缓存TTL
4. **启用监控**: 生产环境务必启用全面监控

### 使用优化

1. **批量请求**: 合并多个小请求
2. **流式处理**: 对于长文本使用流式API
3. **缓存预热**: 预加载常用响应
4. **连接复用**: 使用连接池减少开销

## 🔮 未来规划

### 短期目标 (1-2个月)
- [ ] 添加更多AI提供商 (如文心一言、通义千问)
- [ ] 实现流式API支持
- [ ] 添加更多降级策略
- [ ] 优化缓存性能

### 中期目标 (3-6个月)
- [ ] 实现AI模型自动选择
- [ ] 添加成本优化功能
- [ ] 实现智能预测缓存
- [ ] 添加A/B测试支持

### 长期目标 (6-12个月)
- [ ] 实现分布式AI服务
- [ ] 添加边缘计算支持
- [ ] 实现自适应负载均衡
- [ ] 添加AI性能调优

## 📚 相关文档

- [AI服务类型定义](../types/ai-service.d.ts)
- [缓存系统](../cache/README.md)
- [数据库连接池](../db/connection-pool.md)
- [测试工具](../../test-utils/README.md)
- [实施路线图](../../../docs/IMPLEMENTATION_TODO.md)

## ⭐ 法律之星集成 (新增)

### 概述

法律之星是专门的法律AI服务，提供法规查询和向量检索功能，已集成到统一AI服务管理器中。

### 核心功能

1. **法规查询**: 基于关键词的法条检索
2. **向量查询**: 基于语义的智能检索
3. **智能缓存**: 减少API调用成本
4. **自动重试**: 提高服务可靠性

### 使用方法

```typescript
import { getUnifiedAIService } from '@/lib/ai/unified-service';

// 获取统一AI服务
const aiService = await getUnifiedAIService();

// 法规查询
const regulations = await aiService.searchLegalRegulations({
  keyword: '合同纠纷',
  lawType: '民法',
  pageSize: 10,
});

// 向量查询（语义检索）
const vectorResults = await aiService.searchLegalByVector({
  query: '房屋买卖合同违约如何处理',
  topK: 5,
  threshold: 0.7,
});

// 智能法律检索（结合关键词和语义）
const smartResults = await aiService.smartLegalSearch({
  keyword: '合同',
  semanticQuery: '买方违约后卖方可以采取什么措施',
  lawType: '民法',
  topK: 10,
});

// 完整案件分析流程
const analysis = await aiService.analyzeCaseComplete({
  title: '房屋买卖合同纠纷',
  content: '案件详细描述...',
});
```

### 环境变量配置

```bash
# 法规查询接口
LAWSTAR_REGULATION_BASE_URL=https://api.law-star.com
LAWSTAR_REGULATION_APP_ID=jHW-4773-B2c6C44150ff8047
LAWSTAR_REGULATION_APP_SECRET=a3B4fE7d3B40Abf9d96ae5601B2B3996

# 向量查询接口
LAWSTAR_VECTOR_BASE_URL=https://api.law-star.com
LAWSTAR_VECTOR_APP_ID=iTW-7650-C06fd2e8675F17dc
LAWSTAR_VECTOR_APP_SECRET=6bB16131b7296bf31E1eC2bd9954e28a
```

### 统一AI服务管理器

`UnifiedAIService` 整合了通用AI服务和法律专用服务：

**通用AI方法:**
- `chatCompletion()`: 聊天完成
- `parseDocument()`: 文档解析
- `generateDebate()`: 辩论生成

**法律AI方法:**
- `searchLegalRegulations()`: 法规查询
- `searchLegalByVector()`: 向量查询
- `smartLegalSearch()`: 智能检索

**组合方法:**
- `analyzeCaseComplete()`: 完整案件分析流程

### 性能特性

- **缓存策略**: 默认1小时缓存，减少API调用
- **重试机制**: 最多3次重试，指数退避
- **并行查询**: 关键词和语义查询可并行执行
- **结果去重**: 自动合并和去重检索结果

### 监控和统计

```typescript
// 获取法律之星统计
const lawStarClient = aiService.legalAIService;
const stats = lawStarClient.getStats();

console.log('法规查询统计:', stats.regulation);
console.log('向量查询统计:', stats.vector);

// 健康检查
const isHealthy = await lawStarClient.healthCheck();
console.log('法律之星服务健康:', isHealthy);
```

## 🤝 贡献指南

1. 遵循现有代码风格和架构模式
2. 添加适当的类型定义和文档注释
3. 编写单元测试覆盖新功能
4. 更新相关文档和配置
5. 进行代码审查确保质量

---

*最后更新: 2024-12-18*
*版本: v2.0 (新增法律之星集成)*
*维护者: AI服务团队*
