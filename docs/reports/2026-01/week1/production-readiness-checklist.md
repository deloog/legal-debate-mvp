# 生产就绪检查清单

> **创建日期**: 2026-02-12
> **状态**: 待完成
> **目标**: 部署前确保所有关键问题已解决

---

## 📋 使用说明

- ✅ = 已完成
- 🔄 = 进行中
- ❌ = 未开始
- ⚠️ = 需要决策

---

## 🔴 第一优先级：部署前必须完成

### 1. 环境配置和密钥管理

- [ ] **1.1** 替换所有占位符环境变量
  ```bash
  # 需要替换的变量：
  - DEEPSEEK_API_KEY="sk-placeholder-deepseek-key"
  - ZHIPU_API_KEY="placeholder-zhipu-key"
  - DATABASE_URL 中的弱密码 "password"
  - NEXTAUTH_SECRET（使用真实的强密钥）
  - JWT_SECRET（每个环境独立生成）
  ```

- [ ] **1.2** 生成强密钥
  ```bash
  # 推荐命令：
  openssl rand -base64 32  # 用于 JWT_SECRET
  openssl rand -base64 32  # 用于 NEXTAUTH_SECRET
  openssl rand -hex 32     # 用于其他密钥
  ```

- [ ] **1.3** 验证所有必需环境变量
  ```bash
  npm run validate:env
  ```

- [ ] **1.4** 配置真实的 AI 服务密钥
  - [ ] DeepSeek API Key
  - [ ] 智谱 API Key
  - [ ] 验证 API 配额和限制

- [ ] **1.5** 数据库密码使用强密码
  - 长度 ≥ 12 字符
  - 包含大小写字母、数字、特殊字符
  - 不包含字典词汇

- [ ] **1.6** 考虑使用密钥管理服务
  - [ ] AWS Secrets Manager
  - [ ] Azure Key Vault
  - [ ] HashiCorp Vault
  - [ ] 其他：____________

### 2. 认证和授权系统

- [ ] **2.1** 完成 NextAuth 配置
  ```typescript
  // auth-options.ts 当前状态：
  providers: []  // ⚠️ 空配置

  // 需要实现：
  - [ ] OAuth 2.0 提供程序（Google/GitHub/微信等）
  - [ ] JWT 回调逻辑
  - [ ] 会话管理
  ```

- [ ] **2.2** 实现 Token 刷新机制
  - [ ] 创建 `/api/auth/refresh` 端点
  - [ ] 客户端拦截器自动续期
  - [ ] 刷新 Token 过期时间配置

- [ ] **2.3** 增强 JWT 验证
  - [ ] 在 middleware 中验证签名（考虑使用 edge-compatible 库）
  - [ ] 验证 Token 过期时间
  - [ ] 验证 Token 签发者（iss claim）
  - [ ] 实现 Token 黑名单（用于注销）

- [ ] **2.4** 实现 CSRF 保护
  - [ ] 添加 CSRF Token 生成
  - [ ] 验证 POST/PUT/DELETE 请求
  - [ ] 客户端集成 CSRF Token

- [ ] **2.5** 会话安全配置
  - [ ] 设置安全的 Cookie 属性（httpOnly, secure, sameSite）
  - [ ] 配置会话超时时间
  - [ ] 实现滑动会话机制

### 3. 日志和安全

- [ ] **3.1** 移除生产环境调试日志
  ```typescript
  // 检查以下文件并移除或条件化日志：
  - middleware.ts: Token 前缀打印
  - jwt.ts: JWT_SECRET 打印
  - oauth-*.ts: 敏感错误信息打印
  ```

- [ ] **3.2** 启用安全日志工具
  ```typescript
  // 将所有 console.log/error 替换为：
  import { logSanitized, logError } from '@/lib/utils/safe-logger';
  ```

- [ ] **3.3** 配置日志级别
  ```bash
  # .env.production
  LOG_LEVEL=error  # 或 warn
  NODE_ENV=production
  ```

- [ ] **3.4** 审计敏感操作日志
  - [ ] 用户登录/注销
  - [ ] 密码重置
  - [ ] 权限变更
  - [ ] 关键数据修改

### 4. 数据库配置

- [ ] **4.1** 增加数据库连接池
  ```bash
  # .env.production
  DATABASE_POOL_MIN=5
  DATABASE_POOL_MAX=50  # 根据并发需求调整
  ```

- [ ] **4.2** 配置生产数据库
  - [ ] 使用云数据库服务（RDS/Cloud SQL）
  - [ ] 启用自动备份
  - [ ] 配置故障转移
  - [ ] 启用 SSL 连接

- [ ] **4.3** 执行数据库迁移测试
  ```bash
  # 在预生产环境测试：
  npm run prisma migrate deploy
  npm run prisma migrate status
  ```

- [ ] **4.4** 优化数据库性能
  - [ ] 审查慢查询日志
  - [ ] 添加必要的索引
  - [ ] 配置查询超时
  - [ ] 实现连接池监控

---

## 🟠 第二优先级：部署后 7 天内完成

### 5. 安全加固

- [ ] **5.1** 实现 API 速率限制
  ```typescript
  // 推荐使用：
  - @upstash/ratelimit (基于 Redis)
  - express-rate-limit
  - 配置： 每IP 100请求/分钟
  ```

- [ ] **5.2** 实现输入验证白名单
  ```typescript
  // 对所有 API 参数进行验证：
  const ALLOWED_SORT_FIELDS = ['createdAt', 'updatedAt', 'name'];
  if (!ALLOWED_SORT_FIELDS.includes(sortBy)) {
    throw new Error('Invalid sort field');
  }
  ```

- [ ] **5.3** 实现请求体大小限制
  ```javascript
  // next.config.js
  api: {
    bodyParser: {
      sizeLimit: '1mb',  // 根据需求调整
    },
  },
  ```

- [ ] **5.4** 配置 CORS 白名单
  ```bash
  # .env.production
  CORS_ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
  CORS_CREDENTIALS=true
  ```

- [ ] **5.5** 启用安全头
  ```javascript
  // next.config.js - 已配置，验证是否启用：
  - Strict-Transport-Security
  - X-Frame-Options
  - X-Content-Type-Options
  - Content-Security-Policy
  ```

### 6. 监控和告警

- [ ] **6.1** 配置应用性能监控（APM）
  - [ ] 选择工具：
    - [ ] New Relic
    - [ ] Datadog
    - [ ] Sentry（已集成？）
    - [ ] 其他：____________

- [ ] **6.2** 设置关键指标告警
  - [ ] 错误率 > 1%
  - [ ] 响应时间 > 2 秒
  - [ ] 数据库连接池使用率 > 80%
  - [ ] 内存使用率 > 85%
  - [ ] CPU 使用率 > 90%

- [ ] **6.3** 配置日志聚合
  - [ ] 选择服务：
    - [ ] ELK Stack（Elasticsearch, Logstash, Kibana）
    - [ ] Splunk
    - [ ] Datadog Logs
    - [ ] CloudWatch Logs
    - [ ] 其他：____________

- [ ] **6.4** 实现健康检查增强
  ```typescript
  // /api/health 已存在，添加：
  - [ ] Redis 连接检查
  - [ ] 磁盘空间检查
  - [ ] 外部依赖检查（AI服务）
  - [ ] 分级健康状态（healthy/degraded/unhealthy）
  ```

- [ ] **6.5** 设置正常运行时间监控
  - [ ] 使用 Pingdom/UptimeRobot
  - [ ] 配置告警通知（邮件/短信/Slack）
  - [ ] 监控频率：1-5 分钟

### 7. 备份和恢复

- [ ] **7.1** 配置自动数据库备份
  ```bash
  # 使用 cron 或云服务：
  0 2 * * *  # 每天凌晨 2 点
  ```

- [ ] **7.2** 实现备份到云存储
  - [ ] 配置 S3/OSS
  - [ ] 上传备份文件
  - [ ] 设置备份保留策略（30天）

- [ ] **7.3** 加密备份文件
  ```bash
  # 使用 GPG 或云服务加密：
  gpg --encrypt --recipient admin@example.com backup.sql
  ```

- [ ] **7.4** 测试备份恢复流程
  - [ ] 在测试环境恢复最新备份
  - [ ] 验证数据完整性
  - [ ] 记录恢复时间（RTO）
  - [ ] 文档化恢复步骤

- [ ] **7.5** 实现数据库复制（可选）
  - [ ] 主从复制
  - [ ] 读写分离
  - [ ] 故障自动转移

### 8. 部署和运维

- [ ] **8.1** 完善 Docker 配置
  ```dockerfile
  # 添加到 Dockerfile：
  HEALTHCHECK --interval=30s --timeout=3s --start-period=40s \
    CMD node -e "require('http').get('http://localhost:3000/api/health', ...)"
  ```

- [ ] **8.2** 配置优雅关闭
  ```javascript
  // 在入口文件添加：
  process.on('SIGTERM', gracefulShutdown);
  process.on('SIGINT', gracefulShutdown);
  ```

- [ ] **8.3** 创建启动脚本
  ```bash
  #!/bin/bash
  # scripts/start-production.sh
  set -e

  echo "验证环境变量..."
  npm run validate:env

  echo "运行数据库迁移..."
  npx prisma migrate deploy

  echo "健康检查..."
  npm run test:health

  echo "启动应用..."
  npm start
  ```

- [ ] **8.4** 设置 CI/CD 流程
  - [ ] 自动化测试
  - [ ] 自动化部署
  - [ ] 蓝绿部署或金丝雀发布
  - [ ] 回滚策略

- [ ] **8.5** 配置资源限制
  ```yaml
  # docker-compose.yml 或 Kubernetes
  resources:
    limits:
      cpus: '2'
      memory: 2G
    reservations:
      cpus: '0.5'
      memory: 512M
  ```

---

## 🟡 第三优先级：1 个月内优化

### 9. 性能优化

- [ ] **9.1** 实现 Redis 缓存
  ```typescript
  // 缓存策略：
  - 用户会话：TTL 30分钟
  - API 响应：TTL 5分钟
  - 静态数据：TTL 1小时
  ```

- [ ] **9.2** 优化数据库查询
  - [ ] 添加复合索引
  - [ ] 使用 `select` 指定字段
  - [ ] 实现分页优化
  - [ ] 使用 `include` 代替多次查询

- [ ] **9.3** 实现 CDN
  - [ ] 静态资源上传到 CDN
  - [ ] 配置缓存策略
  - [ ] 图片优化和 WebP 支持

- [ ] **9.4** 前端性能优化
  - [ ] 代码分割和懒加载
  - [ ] 组件级别缓存
  - [ ] Service Worker 配置
  - [ ] 资源预加载

- [ ] **9.5** 压缩和优化
  - [ ] 启用 Gzip/Brotli 压缩
  - [ ] 图片懒加载
  - [ ] 字体优化
  - [ ] 去除未使用的 CSS/JS

### 10. 可观测性

- [ ] **10.1** 实现分布式追踪
  - [ ] Jaeger 或 Zipkin
  - [ ] 追踪跨服务请求
  - [ ] 性能瓶颈分析

- [ ] **10.2** 实现业务指标监控
  - [ ] 用户注册数
  - [ ] 活跃用户数（DAU/MAU）
  - [ ] 关键业务流程转化率
  - [ ] 收入指标

- [ ] **10.3** 设置错误追踪
  - [ ] 集成 Sentry
  - [ ] 配置错误分组
  - [ ] 设置告警规则
  - [ ] Source Map 上传

### 11. 扩展性和可靠性

- [ ] **11.1** 负载均衡配置
  - [ ] 多实例部署
  - [ ] 负载均衡器配置
  - [ ] 健康检查配置

- [ ] **11.2** 自动扩缩容
  - [ ] 基于 CPU/内存的自动扩容
  - [ ] 基于请求数的扩容
  - [ ] 最小/最大实例数配置

- [ ] **11.3** 数据库读写分离
  - [ ] 配置只读副本
  - [ ] 路由读请求到副本
  - [ ] 监控复制延迟

- [ ] **11.4** 实现降级和熔断
  - [ ] Circuit Breaker 模式
  - [ ] 服务降级策略
  - [ ] 优雅降级 UI

### 12. 文档和培训

- [ ] **12.1** 运维手册
  - [ ] 部署流程
  - [ ] 故障排查指南
  - [ ] 回滚流程
  - [ ] 常见问题 FAQ

- [ ] **12.2** API 文档
  - [ ] Swagger/OpenAPI 规范
  - [ ] 示例请求和响应
  - [ ] 错误码说明
  - [ ] 认证指南

- [ ] **12.3** 监控大盘
  - [ ] 创建 Grafana 仪表板
  - [ ] 关键指标可视化
  - [ ] 告警配置文档

- [ ] **12.4** 应急响应计划
  - [ ] 故障分级标准
  - [ ] 应急联系人
  - [ ] 升级流程
  - [ ] 沟通模板

---

## 📊 进度追踪

| 优先级 | 总任务数 | 已完成 | 进行中 | 未开始 | 完成率 |
|--------|---------|--------|--------|--------|--------|
| 🔴 P0  | 23      | 0      | 0      | 23     | 0%     |
| 🟠 P1  | 27      | 0      | 0      | 27     | 0%     |
| 🟡 P2  | 20      | 0      | 0      | 20     | 0%     |
| **总计** | **70** | **0**  | **0**  | **70** | **0%** |

---

## 🚨 关键阻塞问题

**部署前必须解决**（否则应用无法运行）：

1. ❌ 环境变量占位符（AI服务无法调用）
2. ❌ NextAuth 配置为空（用户无法登录）
3. ❌ 数据库弱密码（安全风险）
4. ❌ 缺少 Token 刷新（会话管理问题）

**建议**: 先完成上述 4 项，再进行部署。

---

## 📝 修改日志

| 日期 | 修改内容 | 修改人 |
|------|----------|--------|
| 2026-02-12 | 初始创建 | 系统审查 |

---

## 🔗 相关文档

- [环境变量配置指南](./ENVIRONMENT_VARIABLES.md)
- [API 路径迁移指南](./API_PATHS_MIGRATION.md)
- [测试数据工厂指南](./TEST_DATA_FACTORY_GUIDE.md)
- [代码质量修复报告](../CODE_QUALITY_FIX_FINAL_REPORT.md)

---

**最后更新**: 2026-02-12
**维护者**: 开发团队
**审查周期**: 每次部署前
