# 生产环境配置指南

## 概述

本文档提供法律辩论系统生产环境配置的完整指南，包括环境变量说明、配置验证、安全最佳实践等内容。

## 目录

- [快速开始](#快速开始)
- [环境变量说明](#环境变量说明)
- [配置验证](#配置验证)
- [安全最佳实践](#安全最佳实践)
- [故障排查](#故障排查)

---

## 快速开始

### 1. 复制配置文件

```bash
cp .env.production.example .env.production
```

### 2. 编辑配置文件

根据您的生产环境设置，编辑 `.env.production` 文件，填入实际的配置值。

### 3. 验证配置

启动应用前，建议先验证配置：

```bash
npm run validate-config
```

---

## 环境变量说明

### 应用配置

| 环境变量 | 必需 | 默认值 | 说明 |
|----------|------|---------|------|
| `NODE_ENV` | 是 | `production` | 运行环境 |
| `APP_VERSION` | 否 | `1.0.0` | 应用版本号 |
| `TZ` | 否 | `Asia/Shanghai` | 时区设置 |

### 数据库配置

| 环境变量 | 必需 | 默认值 | 说明 |
|----------|------|---------|------|
| `DATABASE_URL` | 是 | - | PostgreSQL数据库连接URL |
| `DATABASE_POOL_MIN` | 否 | `2` | 最小连接池大小 |
| `DATABASE_POOL_MAX` | 否 | `10` | 最大连接池大小 |
| `DATABASE_POOL_IDLE_TIMEOUT` | 否 | `30000` | 空闲连接超时（毫秒） |
| `DATABASE_POOL_CONNECT_TIMEOUT` | 否 | `10000` | 连接超时（毫秒） |

**生产环境建议：**
- `DATABASE_POOL_MIN`: 10-20
- `DATABASE_POOL_MAX`: 50-100
- 根据数据库服务器性能调整

### Redis配置

| 环境变量 | 必需 | 默认值 | 说明 |
|----------|------|---------|------|
| `REDIS_URL` | 是 | - | Redis连接URL |
| `REDIS_MAX_RETRIES` | 否 | `3` | 最大重试次数 |
| `REDIS_CONNECT_TIMEOUT` | 否 | `10000` | 连接超时（毫秒） |
| `REDIS_IDLE_TIMEOUT` | 否 | `30000` | 空闲超时（毫秒） |
| `REDIS_MAX_RETRIES_PER_REQUEST` | 否 | `3` | 每请求最大重试次数 |
| `REDIS_ENABLE_OFFLINE_QUEUE` | 否 | `false` | 是否启用离线队列 |
| `REDIS_PERSISTENCE_MODE` | 否 | `off` | 持久化模式：`aof`, `rdb`, `off` |
| `REDIS_AOF_FSYNC_EVERYSEC` | 否 | `1` | AOF同步间隔（秒） |

**生产环境建议：**
- 使用TLS加密连接：`rediss://`
- 启用AOF持久化：`REDIS_PERSISTENCE_MODE=aof`
- 连接池大小：`REDIS_MAX_RETRIES_PER_REQUEST=10`

### 缓存配置

| 环境变量 | 必需 | 默认值 | 说明 |
|----------|------|---------|------|
| `CACHE_DEFAULT_TTL` | 否 | `3600` | 默认缓存TTL（秒） |
| `CACHE_SESSION_TTL` | 否 | `1800` | 会话缓存TTL（秒） |
| `CACHE_CONFIG_TTL` | 否 | `86400` | 配置缓存TTL（秒） |
| `CACHE_KEY_PREFIX` | 否 | `legal_debate:` | 缓存键前缀 |
| `CACHE_MAX_SIZE` | 否 | `1000` | 最大缓存条目数 |
| `CACHE_UPDATE_AGE_ON_GET` | 否 | `false` | 获取时更新过期时间 |

### 认证配置

| 环境变量 | 必需 | 默认值 | 说明 |
|----------|------|---------|------|
| `JWT_SECRET` | 是 | - | JWT签名密钥 |
| `JWT_EXPIRES_IN` | 否 | `7d` | JWT过期时间 |
| `BCRYPT_SALT_ROUNDS` | 否 | `12` | 密码加密salt轮数 |

**生产环境建议：**
- JWT_SECRET必须使用强密钥（至少32个字符）
- 使用以下命令生成强密钥：

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

- BCRYPT_SALT_ROUNDS建议14

### AI服务配置

| 环境变量 | 必需 | 默认值 | 说明 |
|----------|------|---------|------|
| `USE_REAL_AI` | 否 | `false` | 是否使用真实AI服务 |
| `ZHIPUAI_API_KEY` | 否 | - | 智谱AI API密钥 |
| `ZHIPUAI_BASE_URL` | 否 | `https://open.bigmodel.cn/api/paas/v4` | 智谱AI基础URL |
| `ZHIPUAI_MODEL` | 否 | `glm-4-flash` | 智谱AI模型 |
| `ZHIPUAI_MAX_TOKENS` | 否 | `1000000` | 智谱AI最大令牌数 |
| `ZHIPUAI_RATE_LIMIT` | 否 | `100` | 智谱AI速率限制 |
| `DEEPSEEK_API_KEY` | 否 | - | DeepSeek API密钥 |
| `DEEPSEEK_BASE_URL` | 否 | `https://api.deepseek.com/v1` | DeepSeek基础URL |
| `DEEPSEEK_MODEL` | 否 | `deepseek-chat` | DeepSeek模型 |
| `DEEPSEEK_MAX_TOKENS` | 否 | `1000000` | DeepSeek最大令牌数 |
| `DEEPSEEK_RATE_LIMIT` | 否 | `100` | DeepSeek速率限制 |
| `OPENAI_API_KEY` | 否 | - | OpenAI API密钥 |
| `OPENAI_BASE_URL` | 否 | `https://api.openai.com/v1` | OpenAI基础URL |
| `OPENAI_MODEL` | 否 | `gpt-4` | OpenAI模型 |
| `OPENAI_MAX_TOKENS` | 否 | `1000000` | OpenAI最大令牌数 |
| `OPENAI_RATE_LIMIT` | 否 | `100` | OpenAI速率限制 |
| `ANTHROPIC_API_KEY` | 否 | - | Anthropic API密钥 |
| `ANTHROPIC_BASE_URL` | 否 | `https://api.anthropic.com` | Anthropic基础URL |
| `ANTHROPIC_MODEL` | 否 | `claude-3-opus-20240229` | Anthropic模型 |
| `ANTHROPIC_MAX_TOKENS` | 否 | `1000000` | Anthropic最大令牌数 |
| `ANTHROPIC_RATE_LIMIT` | 否 | `100` | Anthropic速率限制 |
| `AI_SERVICE_TIMEOUT` | 否 | `30000` | AI服务超时（毫秒） |
| `AI_SERVICE_RETRY_COUNT` | 否 | `3` | AI服务重试次数 |
| `AI_SERVICE_RETRY_DELAY` | 否 | `1000` | AI服务重试延迟（毫秒） |

**生产环境建议：**
- 设置 `USE_REAL_AI=true`
- 至少配置一个AI服务API密钥
- 根据需求调整速率限制

### 支付系统配置

#### 微信支付配置

| 环境变量 | 必需 | 默认值 | 说明 |
|----------|------|---------|------|
| `WECHAT_APP_ID` | 否 | - | 微信支付AppID |
| `WECHAT_MCH_ID` | 否 | - | 微信支付商户号 |
| `WECHAT_API_KEY` | 否 | - | 微信支付API密钥 |
| `WECHAT_API_V3_KEY` | 否 | - | 微信支付API V3密钥 |
| `WECHAT_SERIAL_NO` | 否 | - | 微信支付证书序列号 |
| `WECHAT_CERT_PATH` | 否 | - | 微信支付证书路径 |
| `WECHAT_NOTIFY_URL` | 否 | - | 微信支付回调URL |
| `WECHAT_SANDBOX` | 否 | `false` | 是否使用沙箱环境 |

#### 支付宝配置

| 环境变量 | 必需 | 默认值 | 说明 |
|----------|------|---------|------|
| `ALIPAY_APP_ID` | 否 | - | 支付宝AppID |
| `ALIPAY_PRIVATE_KEY` | 否 | - | 支付宝私钥 |
| `ALIPAY_PUBLIC_KEY` | 否 | - | 支付宝公钥 |
| `ALIPAY_NOTIFY_URL` | 否 | - | 支付宝回调URL |
| `ALIPAY_SANDBOX` | 否 | `false` | 是否使用沙箱环境 |

#### 支付安全配置

| 环境变量 | 必需 | 默认值 | 说明 |
|----------|------|---------|------|
| `PAYMENT_TIMEOUT` | 否 | `7200000` | 支付超时（毫秒） |
| `PAYMENT_RETRY_COUNT` | 否 | `3` | 支付重试次数 |
| `PAYMENT_SUCCESS_CALLBACK_ATTEMPTS` | 否 | `5` | 支付成功回调尝试次数 |

**生产环境建议：**
- 配置完整的生产环境支付密钥
- 设置 `WECHAT_SANDBOX=false` 和 `ALIPAY_SANDBOX=false`
- 回调URL必须使用HTTPS
- 支付超时时间建议2小时（7200000ms）

### 会员系统配置

| 环境变量 | 必需 | 默认值 | 说明 |
|----------|------|---------|------|
| `MEMBERSHIP_FREE_PRICE` | 否 | `0` | 免费会员价格（分） |
| `MEMBERSHIP_BASIC_PRICE` | 否 | `9900` | 基础会员价格（分） |
| `MEMBERSHIP_PROFESSIONAL_PRICE` | 否 | `29900` | 专业会员价格（分） |
| `MEMBERSHIP_ENTERPRISE_PRICE` | 否 | `99900` | 企业会员价格（分） |
| `MEMBERSHIP_QUARTERLY_DISCOUNT` | 否 | `1.0` | 季度折扣系数 |
| `MEMBERSHIP_YEARLY_DISCOUNT` | 否 | `0.83` | 年度折扣系数 |
| `ORDER_EXPIRE_HOURS` | 否 | `2` | 订单过期时间（小时） |
| `ORDER_RETRY_PAYMENT_COUNT` | 否 | `3` | 支付重试次数 |

**价格说明：**
- 价格单位为"分"，例如：9900分 = 99.00元
- 折扣系数为小数，例如：0.83表示83折

### Next.js配置

| 环境变量 | 必需 | 默认值 | 说明 |
|----------|------|---------|------|
| `NEXTAUTH_URL` | 是 | - | NextAuth认证URL |
| `NEXTAUTH_SECRET` | 是 | - | NextAuth密钥 |
| `NEXT_PUBLIC_API_URL` | 否 | - | API基础URL |
| `NEXT_PUBLIC_APP_URL` | 否 | - | 应用基础URL |
| `NEXT_PUBLIC_APP_NAME` | 否 | `法律辩论系统` | 应用名称 |
| `NEXT_PUBLIC_APP_DESCRIPTION` | 否 | `专业的法律辩论与分析系统` | 应用描述 |

**生产环境建议：**
- 使用生产环境域名
- 必须使用HTTPS协议
- NEXTAUTH_SECRET应与JWT_SECRET不同且同样安全

### 安全配置

#### CORS配置

| 环境变量 | 必需 | 默认值 | 说明 |
|----------|------|---------|------|
| `CORS_ALLOWED_ORIGINS` | 否 | `http://localhost:3000` | 允许的跨域来源 |
| `CORS_ALLOWED_METHODS` | 否 | `GET,POST,PUT,DELETE,OPTIONS` | 允许的HTTP方法 |
| `CORS_ALLOWED_HEADERS` | 否 | `Content-Type,Authorization,X-Requested-With` | 允许的请求头 |
| `CORS_CREDENTIALS` | 否 | `true` | 是否允许携带凭证 |
| `CORS_MAX_AGE` | 否 | `86400` | 预检请求缓存时间（秒） |

#### Rate Limiting配置

| 环境变量 | 必需 | 默认值 | 说明 |
|----------|------|---------|------|
| `RATE_LIMIT_WINDOW_MS` | 否 | `60000` | 限流时间窗口（毫秒） |
| `RATE_LIMIT_MAX_REQUESTS` | 否 | `100` | 时间窗口内最大请求数 |
| `RATE_LIMIT_SKIP_SUCCESS_REQUESTS` | 否 | `false` | 是否跳过成功请求 |

#### 安全头配置

| 环境变量 | 必需 | 默认值 | 说明 |
|----------|------|---------|------|
| `SECURITY_CONTENT_SECURITY_POLICY` | 否 | CSP策略 | Content-Security-Policy头 |
| `SECURITY_HSTS_MAX_AGE` | 否 | `31536000` | HSTS最大时间（秒） |
| `SECURITY_X_FRAME_OPTIONS` | 否 | `DENY` | X-Frame-Options头 |
| `SECURITY_X_CONTENT_TYPE_OPTIONS` | 否 | `nosniff` | X-Content-Type-Options头 |

**生产环境建议：**
- `CORS_ALLOWED_ORIGINS`仅包含生产域名
- `RATE_LIMIT_MAX_REQUESTS`根据实际需求调整
- 使用严格的CSP策略

### 日志配置

| 环境变量 | 必需 | 默认值 | 说明 |
|----------|------|---------|------|
| `LOG_LEVEL` | 否 | `error` | 日志级别：`error`, `warn`, `info`, `debug` |
| `LOG_FILE_MAX_SIZE` | 否 | `20m` | 日志文件最大大小 |
| `LOG_FILE_MAX_FILES` | 否 | `14d` | 日志文件保留时间 |
| `LOG_DATE_PATTERN` | 否 | `YYYY-MM-DD` | 日志文件日期格式 |
| `LOG_FORMAT` | 否 | `json` | 日志格式：`json`, `text` |
| `LOG_FILE_PATH` | 否 | `./logs` | 日志文件路径 |

**生产环境建议：**
- 使用 `LOG_LEVEL=error` 或 `LOG_LEVEL=warn`
- 日志路径使用绝对路径，如 `/var/log/legal-debate`
- 使用JSON格式方便日志分析

### 监控告警配置

#### Prometheus配置

| 环境变量 | 必需 | 默认值 | 说明 |
|----------|------|---------|------|
| `PROMETHEUS_ENABLED` | 否 | `false` | 是否启用Prometheus |
| `PROMETHEUS_PORT` | 否 | `9090` | Prometheus端口 |
| `PROMETHEUS_METRICS_PATH` | 否 | `/metrics` | 指标路径 |

#### Grafana配置

| 环境变量 | 必需 | 默认值 | 说明 |
|----------|------|---------|------|
| `GRAFANA_ADMIN_PASSWORD` | 否 | - | Grafana管理员密码 |
| `GRAFANA_ADMIN_USER` | 否 | `admin` | Grafana管理员用户名 |
| `GRAFANA_URL` | 否 | - | Grafana访问URL |

#### Alertmanager配置

| 环境变量 | 必需 | 默认值 | 说明 |
|----------|------|---------|------|
| `ALERTMANAGER_ENABLED` | 否 | `false` | 是否启用Alertmanager |
| `ALERTMANAGER_URL` | 否 | - | Alertmanager URL |

#### 告警邮件配置

| 环境变量 | 必需 | 默认值 | 说明 |
|----------|------|---------|------|
| `ALERT_EMAIL_ENABLED` | 否 | `false` | 是否启用邮件告警 |
| `ALERT_EMAIL_TO` | 否 | - | 告警接收邮箱 |
| `ALERT_EMAIL_FROM` | 否 | - | 告警发送邮箱 |
| `ALERT_EMAIL_SMTP_HOST` | 否 | - | SMTP服务器地址 |
| `ALERT_EMAIL_SMTP_PORT` | 否 | `587` | SMTP端口 |
| `ALERT_EMAIL_SMTP_USER` | 否 | - | SMTP用户名 |
| `ALERT_EMAIL_SMTP_PASSWORD` | 否 | - | SMTP密码 |

### 备份配置

| 环境变量 | 必需 | 默认值 | 说明 |
|----------|------|---------|------|
| `BACKUP_ENABLED` | 否 | `false` | 是否启用备份 |
| `BACKUP_SCHEDULE` | 否 | `0 2 * * *` | 备份计划（cron表达式） |
| `BACKUP_RETENTION_DAYS` | 否 | `30` | 备份保留天数 |
| `BACKUP_PATH` | 否 | `./backups` | 备份路径 |
| `BACKUP_S3_ENABLED` | 否 | `false` | 是否使用S3存储 |
| `BACKUP_S3_BUCKET` | 否 | - | S3存储桶名称 |
| `BACKUP_S3_REGION` | 否 | - | S3区域 |
| `BACKUP_S3_ACCESS_KEY` | 否 | - | S3访问密钥 |
| `BACKUP_S3_SECRET_KEY` | 否 | - | S3秘钥 |

**生产环境建议：**
- 设置 `BACKUP_ENABLED=true`
- 每日凌晨2点备份：`BACKUP_SCHEDULE="0 2 * * *"`
- 保留30天备份
- 配置S3实现异地备份

---

## 配置验证

### 使用配置验证器

项目提供了配置验证工具，可以在启动应用前验证配置：

```typescript
import { ConfigValidator } from './src/config/validation';
import { loadConfig } from './src/config/production';

const config = loadConfig();
const validator = new ConfigValidator();
const result = validator.validate(config);

console.log(validator.getSummary(result));

if (!result.isValid) {
  console.error('配置验证失败，请修复错误后重试');
  process.exit(1);
}
```

### 验证结果说明

- **错误（Error）**：必须修复的配置问题，可能导致应用无法运行
- **警告（Warning）**：建议修改的配置问题，可能影响性能或安全性

---

## 安全最佳实践

### 1. 敏感信息管理

- ✅ **不要**将 `.env.production` 提交到版本控制系统
- ✅ 使用环境变量管理工具（如 AWS Secrets Manager、Azure Key Vault）
- ✅ 定期轮换密钥和证书
- ✅ 限制对生产环境的访问权限

### 2. 数据库安全

- ✅ 使用强密码
- ✅ 启用SSL/TLS连接
- ✅ 配置适当的连接池大小
- ✅ 定期备份数据库

### 3. HTTPS配置

- ✅ 生产环境必须使用HTTPS
- ✅ 配置有效的SSL证书
- ✅ 启用HSTS（HTTP Strict Transport Security）
- ✅ 设置合理的HSTS max-age

### 4. CORS配置

- ✅ 仅允许必要的域名
- ✅ 限制允许的HTTP方法
- ✅ 配置合理的预检缓存时间
- ✅ 测试生产环境的CORS配置

### 5. Rate Limiting

- ✅ 根据实际流量设置限流
- ✅ 区分不同接口的限流策略
- ✅ 监控限流触发情况
- ✅ 对关键接口实施更严格的限流

---

## 故障排查

### 应用无法启动

1. 检查必需的环境变量是否设置
2. 验证数据库和Redis连接URL是否正确
3. 检查日志输出中的错误信息
4. 运行配置验证工具

### 数据库连接失败

1. 验证 `DATABASE_URL` 格式是否正确
2. 检查数据库服务器是否可访问
3. 验证用户名和密码是否正确
4. 检查防火墙规则

### Redis连接失败

1. 验证 `REDIS_URL` 格式是否正确
2. 检查Redis服务器是否可访问
3. 验证密码是否正确
4. 检查防火墙规则

### 支付功能异常

1. 验证支付API密钥是否正确
2. 检查支付回调URL是否可访问
3. 确认支付平台账户状态
4. 检查支付配置是否使用沙箱环境

### AI服务无响应

1. 验证API密钥是否正确
2. 检查 `USE_REAL_AI` 设置
3. 验证AI服务基础URL
4. 检查网络连接和防火墙规则

---

## 相关文档

- [Sprint 13-14 任务追踪](../task-tracking/SPRINT13_14_TASK_TRACKING.md)
- [安全配置指南](./SECURITY_CONFIG.md)
- [性能配置指南](./PERFORMANCE_CONFIG.md)
