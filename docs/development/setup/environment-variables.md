# 环境变量配置指南

> **重要提示**: 本项目使用环境变量验证系统，在生产环境启动时会自动检查所有必需的环境变量。配置错误将导致应用拒绝启动。

---

## 📋 目录

- [快速开始](#快速开始)
- [必需变量](#必需变量)
- [可选变量](#可选变量)
- [安全最佳实践](#安全最佳实践)
- [常见问题](#常见问题)

---

## 🚀 快速开始

### 1. 复制环境变量模板

```bash
# 开发环境
cp .env.example .env

# 生产环境
cp .env.production.example .env.production
```

### 2. 配置必需变量

**最小配置（开发环境）**:
```env
# 数据库
DATABASE_URL="postgresql://postgres:password@localhost:5432/legal_debate_dev"

# JWT 密钥
JWT_SECRET="your-jwt-secret-key-min-32-chars"

# NextAuth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-nextauth-secret-key-min-32-chars"
```

### 3. 生成安全密钥

```bash
# 生成 JWT_SECRET 和 NEXTAUTH_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 4. 验证配置

```bash
# 启动应用时会自动验证
npm run dev

# 或手动验证
node -e "require('./src/config/validate-env').validateRequiredEnv()"
```

---

## 🔐 必需变量

### 数据库配置

#### `DATABASE_URL` **(必需)**

PostgreSQL 数据库连接字符串。

**格式**:
```env
DATABASE_URL="postgresql://用户名:密码@主机:端口/数据库名?schema=public"
```

**示例**:
```env
# 开发环境
DATABASE_URL="postgresql://postgres:dev_password_2024@localhost:5432/legal_debate_dev"

# 生产环境（使用环境变量或密钥管理服务）
DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@db.example.com:5432/legal_debate_prod"
```

**安全要求**:
- ✅ 使用强密码（至少12个字符，包含字母、数字和特殊字符）
- ✅ 生产环境禁止使用 "password", "123456" 等弱密码
- ❌ 禁止将生产数据库 URL 提交到版本控制

---

### 认证配置

#### `JWT_SECRET` **(必需)**

JWT token 签名密钥，用于用户认证 token 的生成和验证。

**要求**:
- 最小长度：32 字符（推荐 64 字符）
- 必须是随机生成的强密钥
- 生产环境和开发环境应使用不同的密钥

**生成方法**:
```bash
# 方法 1: Node.js crypto
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# 方法 2: OpenSSL
openssl rand -hex 32

# 方法 3: Python
python -c "import secrets; print(secrets.token_hex(32))"
```

**示例**:
```env
JWT_SECRET="b0e101769ac57cdf6a5cb9af05c5a11f66718b16a3e5b4def9610f4991e21535"
```

#### `NEXTAUTH_SECRET` **(必需)**

NextAuth.js 会话加密密钥。

**要求**: 与 `JWT_SECRET` 相同

**示例**:
```env
NEXTAUTH_SECRET="fe6b20f0820f47b7aa38680226758ee23d8694fe78ef27da5e435b6047441241"
```

#### `NEXTAUTH_URL` **(必需)**

应用的完整 URL，用于 NextAuth 回调和重定向。

**示例**:
```env
# 开发环境
NEXTAUTH_URL="http://localhost:3000"

# 生产环境
NEXTAUTH_URL="https://legal-debate.example.com"
```

---

### AI 服务配置（生产环境必需）

#### `DEEPSEEK_API_KEY` **(生产环境必需)**

DeepSeek AI 服务的 API 密钥（主要 AI 服务提供商）。

**获取方式**:
1. 访问 [DeepSeek 官网](https://platform.deepseek.com/)
2. 注册并创建 API 密钥
3. 将密钥添加到环境变量

**示例**:
```env
DEEPSEEK_API_KEY="sk-1234567890abcdef1234567890abcdef"
DEEPSEEK_BASE_URL="https://api.deepseek.com"
```

#### `ZHIPU_API_KEY` **(生产环境必需)**

智谱清言 AI 服务的 API 密钥（备用 AI 服务提供商）。

**获取方式**:
1. 访问 [智谱 AI 开放平台](https://open.bigmodel.cn/)
2. 注册并创建 API 密钥
3. 将密钥添加到环境变量

**示例**:
```env
ZHIPU_API_KEY="1234567890abcdef.1234567890abcdef"
ZHIPU_BASE_URL="https://open.bigmodel.cn/api/paas/v4"
```

---

## 🔧 可选变量

### Redis 缓存（可选）

用于提高性能的缓存层。

```env
REDIS_HOST="localhost"
REDIS_PORT="6379"
REDIS_PASSWORD=""  # 如果 Redis 需要认证
```

**配置说明**:
- 如果不配置，应用将使用内存缓存
- 生产环境强烈推荐使用 Redis

---

### 邮件服务（可选）

用于发送通知邮件（密码重置、订单确认等）。

```env
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_USER="your-email@gmail.com"
SMTP_PASSWORD="your-app-password"
```

**Gmail 配置示例**:
1. 启用两步验证
2. 生成应用专用密码
3. 使用应用密码替代 Gmail 密码

**其他邮件服务**:
```env
# Outlook
SMTP_HOST="smtp-mail.outlook.com"
SMTP_PORT="587"

# 阿里云邮件推送
SMTP_HOST="smtpdm.aliyun.com"
SMTP_PORT="465"
```

---

### 文件存储（可选）

配置文件上传存储方式。

```env
# 本地存储（默认）
STORAGE_TYPE="local"

# 阿里云 OSS
STORAGE_TYPE="aliyun"
OSS_ACCESS_KEY_ID="your-access-key-id"
OSS_ACCESS_KEY_SECRET="your-access-key-secret"
OSS_BUCKET="your-bucket-name"
OSS_REGION="oss-cn-beijing"
```

---

### 应用配置

```env
# 环境标识
NODE_ENV="development"  # development | production | test

# JWT 过期时间
JWT_EXPIRES_IN="7d"  # 7天

# 日志级别
LOG_LEVEL="info"  # debug | info | warn | error

# API 限流
RATE_LIMIT_MAX="100"  # 每分钟最大请求数
```

---

## 🔒 安全最佳实践

### 1. 密钥管理

#### ✅ 推荐做法

- **使用密钥管理服务**:
  - AWS Secrets Manager
  - Azure Key Vault
  - Google Cloud Secret Manager
  - HashiCorp Vault

- **环境变量注入**:
  ```bash
  # Docker
  docker run -e JWT_SECRET="$(cat /run/secrets/jwt_secret)" ...

  # Kubernetes
  kubectl create secret generic app-secrets \
    --from-literal=jwt-secret="your-secret"
  ```

- **本地开发**:
  - 使用 `.env.local` (已在 `.gitignore` 中)
  - 团队成员各自配置

#### ❌ 禁止做法

- ❌ 将密钥硬编码在代码中
- ❌ 将 `.env` 文件提交到 Git
- ❌ 在日志中打印密钥
- ❌ 使用弱密码或占位符值

---

### 2. 数据库安全

#### 连接字符串安全

```env
# ❌ 不安全 - 使用默认密码
DATABASE_URL="postgresql://postgres:password@localhost:5432/db"

# ✅ 安全 - 使用强密码
DATABASE_URL="postgresql://postgres:Xk9#mP2$qL7@wR5&localhost:5432/db"

# ✅ 更安全 - 使用环境变量
DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:5432/${DB_NAME}"
```

#### SSL/TLS 连接

```env
# 生产环境强制 SSL
DATABASE_URL="postgresql://user:pass@host:5432/db?sslmode=require"
```

---

### 3. 环境隔离

#### 开发、测试、生产环境隔离

```bash
legal-debate-mvp/
├── .env                    # 本地开发（不提交）
├── .env.local              # 本地覆盖（不提交）
├── .env.example            # 开发环境模板（提交）
├── .env.production         # 生产环境模板（提交，只有占位符）
└── .env.test               # 测试环境（提交）
```

#### 配置优先级

1. `.env.local` (最高优先级，本地覆盖)
2. `.env.production` / `.env.development` / `.env.test`
3. `.env`
4. 系统环境变量（最低优先级）

---

### 4. API 密钥保护

#### 密钥轮换策略

```bash
# 定期轮换密钥（推荐：每90天）
1. 生成新密钥
2. 在应用中配置新旧密钥共存
3. 验证新密钥可用
4. 移除旧密钥
```

#### 密钥权限最小化

- API 密钥只授予必要权限
- 使用不同密钥for 不同环境
- 监控密钥使用情况

---

## ❓ 常见问题

### Q1: 启动时报错 "环境变量配置错误"

**错误示例**:
```
═══════════════════════════════════════════════════════════════════
  环境变量配置错误
═══════════════════════════════════════════════════════════════════

❌ 缺少必需的环境变量:
   - JWT_SECRET
   - NEXTAUTH_SECRET
```

**解决方法**:
1. 检查 `.env` 文件是否存在
2. 确认所有必需变量已配置
3. 生成强密钥替换占位符

---

### Q2: 如何在 Docker 中使用环境变量？

**方法 1: docker-compose.yml**
```yaml
services:
  app:
    environment:
      - DATABASE_URL=${DATABASE_URL}
      - JWT_SECRET=${JWT_SECRET}
    env_file:
      - .env.production
```

**方法 2: Dockerfile + docker run**
```bash
docker run -e DATABASE_URL="..." -e JWT_SECRET="..." app:latest
```

**方法 3: Docker Secrets**
```bash
echo "your-jwt-secret" | docker secret create jwt_secret -
docker service create --secret jwt_secret app:latest
```

---

### Q3: Vercel/Netlify 部署如何配置？

#### Vercel

1. 项目设置 → Environment Variables
2. 添加所有必需变量
3. 分别配置 Production / Preview / Development

#### Netlify

```bash
netlify env:set JWT_SECRET "your-secret"
netlify env:set DATABASE_URL "your-database-url"
```

或在 `netlify.toml`:
```toml
[build.environment]
  NODE_ENV = "production"
```

---

### Q4: 如何验证环境变量配置？

**方法 1: 启动验证**
```bash
npm run dev
# 应用启动时自动验证
```

**方法 2: 手动验证**
```bash
node -e "require('./src/config/validate-env').validateRequiredEnv()"
```

**方法 3: 查看验证结果**
```bash
✅ 环境变量验证通过
```

---

### Q5: 生产环境使用了占位符值怎么办？

**错误示例**:
```
⚠️  发现占位符配置（生产环境禁止使用）:
   - DEEPSEEK_API_KEY: sk-placeholder-deepseek-key
   - ZHIPU_API_KEY: placeholder-zhipu-key
```

**解决方法**:
1. 获取真实的 API 密钥
2. 替换所有 "placeholder" 值
3. 重启应用

---

## 📚 相关文档

- [代码质量修复报告](../CODE_QUALITY_FIX_FINAL_REPORT.md)
- [环境变量验证系统](../src/config/validate-env.ts)
- [Next.js 环境变量文档](https://nextjs.org/docs/app/building-your-application/configuring/environment-variables)
- [安全日志工具](../src/lib/utils/safe-logger.ts)

---

## 🔄 版本历史

- **v1.0.0** (2026-02-12): 初始版本，包含环境变量验证系统
- **v1.1.0** (计划): 添加环境变量加密存储

---

**最后更新**: 2026-02-12
**维护者**: 开发团队
**反馈**: 如有问题，请提交 Issue 或 Pull Request
