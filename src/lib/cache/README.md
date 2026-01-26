# Redis缓存系统

这是一个完整的Redis缓存系统，提供了高性能、可配置、易用的缓存解决方案。

## 🚀 功能特性

- **高性能缓存**：基于Redis的内存缓存，支持毫秒级响应
- **多种策略**：支持懒加载、写穿透、写回、预刷新等缓存策略
- **命名空间**：支持命名空间隔离，便于管理和清理
- **监控告警**：内置监控系统，支持健康检查、性能监控、告警通知
- **类型安全**：完整的TypeScript类型定义，确保类型安全
- **易于使用**：提供简洁的API和装饰器，简化使用
- **批量操作**：支持批量读写，提高操作效率
- **自动过期**：支持TTL自动过期机制
- **统计报告**：提供详细的缓存统计和性能报告

## 📁 文件结构

```
src/lib/cache/
├── index.ts          # 统一导出接口
├── types.ts          # 类型定义
├── redis.ts          # Redis客户端配置
├── manager.ts        # 缓存管理器
├── strategies.ts     # 缓存策略实现
├── monitor.ts        # 缓存监控系统
└── README.md         # 文档说明
```

## 🔧 安装和配置

### 1. 环境变量配置

在`.env`文件中添加Redis配置：

```env
# Redis配置
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0
REDIS_TLS=false
REDIS_MAX_RETRIES=3
REDIS_CONNECT_TIMEOUT=10000
REDIS_IDLE_TIMEOUT=30000
REDIS_MAX_RETRIES_PER_REQUEST=3

# 缓存配置
CACHE_KEY_PREFIX=legal_debate:
CACHE_DEFAULT_TTL=3600
CACHE_SESSION_TTL=1800
CACHE_CONFIG_TTL=86400
CACHE_ENABLE_METRICS=true
CACHE_ENABLE_COMPRESSION=false
```

### 2. Docker配置

使用Docker Compose启动Redis：

```yaml
# config/docker-compose.yml
version: '3.8'
services:
  redis:
    image: redis:7-alpine
    container_name: legal_debate_redis
    ports:
      - '6379:6379'
    volumes:
      - redis_data:/data
    command: redis-server --appendonly yes
    restart: unless-stopped

volumes:
  redis_data:
```

启动命令：

```bash
docker-compose -f config/docker-compose.yml up -d
```

### 3. 安装依赖

```bash
npm install ioredis
```

## 📖 使用指南

### 基础使用

```typescript
import { cache, initializeCache } from '@/lib/cache';

// 初始化缓存系统
await initializeCache();

// 设置缓存
await cache.set(
  'user:123',
  { name: '张三', age: 25 },
  {
    ttl: 3600, // 1小时
    namespace: 'user_data',
  }
);

// 获取缓存
const userData = await cache.get('user:123', {
  namespace: 'user_data',
});

// 删除缓存
await cache.delete('user:123', {
  namespace: 'user_data',
});
```

### 使用预配置缓存实例

```typescript
import { userCache, aiCache, configCache } from '@/lib/cache';

// 用户会话缓存
await userCache.set('session:abc123', { userId: 123, role: 'admin' });

// AI响应缓存
const aiResponse = await aiCache.getOrSet(
  'query:legal-question-1',
  async () => {
    // 从AI服务获取数据
    return await aiService.getLegalAdvice('question-1');
  },
  3600 // 1小时
);

// 配置缓存
const config = await configCache.get('app-settings');
```

### 缓存装饰器

```typescript
import { Cached } from '@/lib/cache';

class UserService {
  @Cached({
    ttl: 1800, // 30分钟
    namespace: 'user_data',
  })
  async getUserById(id: string) {
    // 这个方法的结果会被自动缓存
    return await database.user.findUnique({ where: { id } });
  }

  @Cached({
    ttl: 300, // 5分钟
    keyGenerator: (query: string) => `search:${query.toLowerCase()}`,
  })
  async searchUsers(query: string) {
    return await database.user.findMany({
      where: { name: { contains: query } },
    });
  }
}
```

### 缓存策略

```typescript
import { cacheStrategyFactory, CacheStrategy } from '@/lib/cache';

// 懒加载策略（默认）
const lazyStrategy = cacheStrategyFactory.createLazyLoadingStrategy();

// 写穿透策略
const writeThroughStrategy = cacheStrategyFactory.createWriteThroughStrategy(
  async (key, value) => {
    // 写入数据库
    await database.save(key, value);
    return true;
  }
);

// 写回策略
const writeBehindStrategy = cacheStrategyFactory.createWriteBehindStrategy(
  async (key, value) => {
    // 批量写入数据库
    await database.batchSave(key, value);
    return true;
  },
  5000 // 5秒批量写入间隔
);

// 预刷新策略
const refreshAheadStrategy = cacheStrategyFactory.createRefreshAheadStrategy(
  async key => {
    // 从数据源重新获取数据
    return await database.get(key);
  },
  300 // 在TTL剩余5分钟时刷新
);
```

### 批量操作

```typescript
import { cacheUtils } from '@/lib/cache';

// 批量获取
const keys = ['user:1', 'user:2', 'user:3'];
const results = await cacheUtils.batchGet<User>(keys, {
  namespace: 'user_data',
});

// 批量设置
const items = [
  { key: 'user:1', value: { name: '用户1' }, ttl: 3600 },
  { key: 'user:2', value: { name: '用户2' }, ttl: 3600 },
  { key: 'user:3', value: { name: '用户3' }, ttl: 3600 },
];
const result = await cacheUtils.batchSet(items, {
  namespace: 'user_data',
});

// 批量删除
const deletedCount = await cacheUtils.batchDelete(keys, {
  namespace: 'user_data',
});
```

### 监控和统计

```typescript
import { cacheMonitor, cacheUtils } from '@/lib/cache';

// 获取健康状态
const health = await cacheMonitor.getHealthStatus();
console.log('缓存健康状态:', health);

// 获取统计信息
const stats = cacheUtils.getStats();
console.log('缓存统计:', {
  hitRate: `${stats.hitRate.toFixed(2)}%`,
  totalRequests: stats.totalRequests,
  hits: stats.hits,
  misses: stats.misses,
});

// 生成性能报告
const report = await cacheUtils.generateReport();
console.log(report);
```

### 命名空间管理

```typescript
import { cache, CacheNamespace } from '@/lib/cache';

// 清空特定命名空间
const deletedCount = await cache.clearNamespace(CacheNamespace.USER_SESSION);

// 使用命名空间隔离不同类型的数据
await cache.set('user:123', userData, {
  namespace: CacheNamespace.USER_DATA,
  ttl: 3600,
});

await cache.set('config:app', appConfig, {
  namespace: CacheNamespace.CONFIGURATION,
  ttl: 86400,
});
```

## 🔍 监控和告警

### 健康检查

缓存系统会自动进行健康检查，监控以下指标：

- **连接状态**：Redis连接是否正常
- **响应时间**：缓存操作响应时间
- **内存使用**：Redis内存占用情况
- **命中率**：缓存命中率统计

### 告警阈值

当以下情况发生时会触发告警：

- 连接断开
- 响应时间超过1秒
- 内存使用超过1GB

### 性能监控

```typescript
// 启动自定义监控
cacheMonitor.addEventListener(event => {
  console.log('缓存事件:', event);

  // 可以集成到外部监控系统
  if (event.type === 'miss') {
    // 记录缓存未命中
    monitoring.increment('cache_miss');
  }
});

// 获取性能报告
const performanceReport = cacheMonitor.getPerformanceReport();
console.log('性能报告:', performanceReport);
```

## 🛠️ 高级配置

### 自定义序列化器

```typescript
import { cacheManager } from '@/lib/cache';

// 使用自定义序列化器
cacheManager.setSerializer({
  serialize<T>(value: T): string {
    return JSON.stringify(value);
  },
  deserialize<T>(value: string): T {
    return JSON.parse(value);
  },
});
```

### 缓存工厂

```typescript
import { createCache, CacheNamespace } from '@/lib/cache';

// 创建专门的缓存实例
const productCache = createCache(CacheNamespace.USER_DATA, 7200); // 2小时

productCache.get('product:123');
productCache.set('product:123', productData);
productCache.delete('product:123');
productCache.clear(); // 清空整个命名空间
```

## 📊 性能优化建议

### 1. 合理设置TTL

- 用户会话：30分钟
- 用户数据：1小时
- AI响应：1小时
- 配置数据：24小时
- 临时数据：5分钟

### 2. 使用命名空间

- 避免键冲突
- 便于批量清理
- 提高管理效率

### 3. 选择合适的缓存策略

- **懒加载**：适用于读多写少的场景
- **写穿透**：要求数据一致性高
- **写回**：写操作频繁，可容忍短暂不一致
- **预刷新**：热点数据，要求高可用性

### 4. 监控和调优

- 定期检查命中率
- 监控内存使用
- 分析热点键
- 调整TTL设置

## 🚨 故障处理

### 连接失败

```typescript
import { checkRedisConnection } from '@/lib/cache';

const isConnected = await checkRedisConnection();
if (!isConnected) {
  console.error('Redis连接失败，请检查配置');
  // 可以降级到内存缓存或直接查询数据库
}
```

### 缓存降级

```typescript
async function getUserData(id: string) {
  try {
    // 尝试从缓存获取
    return await userCache.get(`user:${id}`);
  } catch (error) {
    console.error('缓存不可用，直接查询数据库');
    return await database.user.findUnique({ where: { id } });
  }
}
```

## 🧪 测试

```typescript
import { cache, initializeCache, cleanupCache } from '@/lib/cache';

beforeAll(async () => {
  await initializeCache();
});

afterAll(async () => {
  await cleanupCache();
});

test('缓存基础操作', async () => {
  const key = 'test:key';
  const value = { test: 'data' };

  // 设置
  await expect(cache.set(key, value)).resolves.toBe(true);

  // 获取
  const result = await cache.get(key);
  expect(result).toEqual(value);

  // 删除
  await expect(cache.delete(key)).resolves.toBe(true);

  // 验证删除
  const deleted = await cache.get(key);
  expect(deleted).toBeNull();
});
```

## 📝 更新日志

### v1.0.0 (2025-12-18)

- ✅ 初始版本发布
- ✅ 支持基础缓存操作
- ✅ 实现多种缓存策略
- ✅ 添加监控和告警功能
- ✅ 提供完整的TypeScript类型定义
- ✅ 支持装饰器和工厂函数

## 🤝 贡献指南

1. Fork项目
2. 创建功能分支
3. 提交代码变更
4. 编写测试用例
5. 提交Pull Request

## 📄 许可证

MIT License

---

## 📞 支持

如有问题或建议，请：

1. 查看此文档
2. 检查GitHub Issues
3. 创建新的Issue

**Happy Caching! 🚀**
