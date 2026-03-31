# 律伴助手 - 生产部署指南

> 版本：2026-03-28
> 适用环境：Linux 服务器 + PostgreSQL 15 + Redis 7 + Node.js 20

---

## 近期重要变更（2026-03-26 ~ 03-28）

| 变更项               | 说明                                                                                      |
| -------------------- | ----------------------------------------------------------------------------------------- |
| pg_trgm 扩展         | 新迁移 `20260327000000` 依赖 pg_trgm，**部署前必须以 superuser 身份预先创建**（见 4.2）   |
| 案例库数据           | 新增 10 万+ 典型案例，需导入 `case_examples.sql`（见 5.1）                                |
| 用户角色注册         | 注册时用户可选 LAWYER/ENTERPRISE，不再统一为 USER                                         |
| 新增页面             | `/terms`（服务条款）和 `/privacy`（隐私政策）为静态页面，无需额外配置                     |
| Prisma binaryTargets | 已覆盖 `debian-openssl-1.0.x` + `rhel-openssl-3.0.x`，Ubuntu/Debian 和 CentOS/RHEL 均支持 |

---

## ⛔ 安全部署前置要求（上线前必须完成，否则禁止部署）

> **以下两项是安全审查（2026-03-26）中发现的必须手动处理的问题，代码层面无法自动修复。**
> **跳过任意一项将导致生产系统存在高危安全漏洞。**

---

### 【必须-1】轮换全部 API 密钥和数据库密码

开发环境文件 `.env.development` 中存有真实密钥（安全审查已确认）。
**这些密钥绝对不能原样用于生产环境**，必须全部到对应平台重新生成：

| 变量名                  | 操作                                                                                  |
| ----------------------- | ------------------------------------------------------------------------------------- |
| `DEEPSEEK_API_KEY`      | 登录 [DeepSeek 控制台](https://platform.deepseek.com/) → API Keys → 删除旧 Key → 新建 |
| `ZHIPUAI_API_KEY`       | 登录 [智谱 AI 控制台](https://open.bigmodel.cn/) → API Key 管理 → 删除旧 Key → 新建   |
| `LAWSTAR_APP_SECRET`    | 联系 Lawstar 商务重置 App Secret                                                      |
| `DATABASE_URL` 中的密码 | 在 PostgreSQL 中执行：`ALTER USER legal_user WITH PASSWORD '新的强密码';`             |
| `JWT_SECRET`            | 执行下方命令生成（**至少 64 字符**，开发环境的值是弱密钥禁止使用）：                  |

```bash
# 生成 JWT_SECRET（64字节随机十六进制）
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

| `NEXTAUTH_SECRET` | 同上，重新生成独立的随机字符串 |
| `ENCRYPTION_KEY` | 执行：`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |

> ✅ 确认标准：生产 `.env` 中所有密钥的值与 `.env.development` 中**完全不同**。

---

### 【必须-2】数据库连接必须启用 SSL 加密

不加 SSL 的数据库连接在网络层以明文传输，任何中间节点均可截获包含用户数据的 SQL 查询结果。

**在生产 `.env` 的 `DATABASE_URL` 末尾追加 SSL 参数：**

```bash
# ❌ 错误（明文传输）
DATABASE_URL="postgresql://legal_user:密码@localhost:5432/legal_debate_prod"

# ✅ 正确（SSL 加密传输）
DATABASE_URL="postgresql://legal_user:密码@localhost:5432/legal_debate_prod?sslmode=require&connection_limit=20"
```

若数据库与应用在同一台服务器（本机连接），可改用：

```bash
DATABASE_URL="postgresql://legal_user:密码@localhost:5432/legal_debate_prod?sslmode=prefer&connection_limit=20"
```

> ✅ 确认标准：执行 `psql "$DATABASE_URL" -c "SHOW ssl;"` 输出为 `on`。

---

### 部署前自查确认

在执行任何部署步骤之前，确认以下两项均已完成：

```
[ ] 所有密钥已轮换，生产 .env 中无任何来自 .env.development 的原始值
[ ] DATABASE_URL 包含 ?sslmode=require 或 ?sslmode=prefer 参数
```

**以上两项未全部勾选，禁止继续执行部署流程。**

---

## 目录

1. [服务器要求](#1-服务器要求)
2. [环境变量配置](#2-环境变量配置)
3. [阿里云OSS文件存储](#3-阿里云oss文件存储)
4. [数据库初始化](#4-数据库初始化)
5. [业务数据导入](#5-业务数据导入)
6. [构建与启动](#6-构建与启动)
7. [Nginx 反向代理](#7-nginx-反向代理)
8. [PM2 进程管理](#8-pm2-进程管理)
9. [验证清单](#9-验证清单)
10. [常见问题](#10-常见问题)

---

## 1. 服务器要求

> **关于文件存储：** 本系统支持本地存储（开发/测试）和阿里云OSS（生产推荐）两种模式。
> 生产环境**强烈建议**启用OSS，避免用户上传的证据文件、合同、律师证件照等因服务器迁移/重启而丢失。
> 配置方式见 [第3节](#3-阿里云oss文件存储)。

| 项目 | 最低配置                 | 推荐配置         |
| ---- | ------------------------ | ---------------- |
| CPU  | 2 核                     | 4 核             |
| 内存 | 4 GB                     | 8 GB             |
| 硬盘 | 50 GB（法律数据约 8 GB） | 100 GB SSD       |
| 系统 | Ubuntu 22.04 LTS         | Ubuntu 22.04 LTS |

**必须预装：**

- Node.js 20.x（`nvm` 安装推荐）
- PostgreSQL 15
- Redis 7
- Nginx
- PM2（`npm install -g pm2`）

---

## 2. 环境变量配置

在项目根目录创建 `.env.production`（或 `.env`），按以下模板填写所有必填项：

```bash
# ============================================================
# 必填项（缺少任一项服务将无法启动）
# ============================================================

NODE_ENV=production

# 数据库
DATABASE_URL="postgresql://用户名:密码@localhost:5432/legal_debate_prod"

# JWT 密钥（至少 64 字符随机字符串，32位不够安全）
# 生成命令：node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
JWT_SECRET=替换为随机生成的64字符以上字符串
JWT_EXPIRES_IN=7d

# NextAuth
NEXTAUTH_URL=https://你的域名.com
NEXTAUTH_SECRET=替换为另一个随机字符串

# 加密密钥（必须恰好 32 字节）
# 生成命令：node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
ENCRYPTION_KEY=替换为32字节随机字符串

# 应用地址
NEXT_PUBLIC_APP_URL=https://你的域名.com
BASE_URL=https://你的域名.com

# Redis
REDIS_URL=redis://localhost:6379
REDIS_MODE=standalone

# ============================================================
# AI 服务（至少配置一个）
# ============================================================

# DeepSeek（推荐）
DEEPSEEK_API_KEY=sk-你的密钥
DEEPSEEK_BASE_URL=https://api.deepseek.com/v1
AI_SERVICE_PROVIDER=deepseek

# 智谱 AI（备选）
# ZHIPUAI_API_KEY=你的密钥
# ZHIPUAI_API_BASE_URL=https://open.bigmodel.cn/api/paas/v4
# AI_SERVICE_PROVIDER=zhipu

# ============================================================
# 法律数据源（使用本地数据库，无需修改）
# ============================================================
LAW_ARTICLE_PROVIDER=local

# ============================================================
# 邮件服务（用于密码重置等）
# ============================================================
SMTP_HOST=smtp.你的邮件服务商.com
SMTP_PORT=587
SMTP_USER=发件人邮箱
SMTP_PASS=邮箱密码或授权码
EMAIL_FROM=律伴助手 <noreply@你的域名.com>

# ============================================================
# 支付（按需配置）
# ============================================================

# 支付宝（沙箱测试时 ALIPAY_SANDBOX=true，正式上线改为 false）
ALIPAY_APP_ID=你的AppID
ALIPAY_PRIVATE_KEY=你的私钥
ALIPAY_PUBLIC_KEY=支付宝公钥
ALIPAY_NOTIFY_URL=https://你的域名.com/api/payments/alipay/callback
ALIPAY_RETURN_URL=https://你的域名.com/payment/result
ALIPAY_SANDBOX=false

# 微信支付（可选）
# WECHAT_APP_ID=...
# WECHAT_MCH_ID=...
# WECHAT_API_KEY_V3=...

# ============================================================
# 其他可选项
# ============================================================
BCRYPT_SALT_ROUNDS=10
REQUIRE_JWT_SECRET=true
ENABLE_AI_FEATURES=true
ENABLE_LAWYER_QUALIFICATION=true

# ============================================================
# 阿里云 OSS 文件存储（生产环境推荐，见第3节）
# ============================================================
OSS_ENABLED=true
OSS_ACCESS_KEY=你的AccessKey_ID
OSS_SECRET_KEY=你的AccessKey_Secret
OSS_BUCKET=你的Bucket名称
OSS_REGION=oss-cn-hangzhou
# OSS_ENDPOINT=https://cdn.你的域名.com   # 若配置了CDN加速域名，取消注释
```

---

## 3. 阿里云OSS文件存储

系统上传的所有文件（证据材料、律师证件照、合同文件、案件文档）均通过统一存储服务管理。
生产环境使用OSS可避免文件因服务器迁移或磁盘故障而丢失。

### 3.1 创建Bucket

1. 登录 [阿里云OSS控制台](https://oss.console.aliyun.com/)
2. 创建 Bucket，选择与服务器相同的地域（降低延迟）
3. **读写权限设置为「私有」**（系统会对公开文件单独设置 `public-read`，私有文件通过签名URL访问）
4. 记录 Bucket 名称和所在地域（如 `oss-cn-hangzhou`）

### 3.2 创建AccessKey

1. 进入 [RAM访问控制台](https://ram.console.aliyun.com/) → 用户 → 新建用户
2. 勾选「OpenAPI调用访问」，生成 AccessKey ID 和 AccessKey Secret（**Secret只显示一次，立即保存**）
3. 为该用户授权策略：`AliyunOSSFullAccess`（或按最小权限原则自定义只授权该Bucket的读写权限）

### 3.3 配置环境变量

在生产 `.env` 中添加（参考上方环境变量模板）：

```bash
OSS_ENABLED=true
OSS_ACCESS_KEY=LTAI5t...          # RAM用户的AccessKey ID
OSS_SECRET_KEY=xxxxxxxx...        # RAM用户的AccessKey Secret
OSS_BUCKET=legal-debate-files     # Bucket名称
OSS_REGION=oss-cn-hangzhou        # 地域标识
# OSS_ENDPOINT=https://cdn.你的域名.com  # 可选：CDN加速域名
```

### 3.4 存储目录结构

OSS中的文件按以下路径组织：

| 路径前缀          | 内容                        | 访问权限          |
| ----------------- | --------------------------- | ----------------- |
| `evidence/`       | 证据材料（图片/PDF/音视频） | 私有，API代理访问 |
| `qualifications/` | 律师执业证件照              | 私有，API代理访问 |
| `contracts/`      | 合同文件                    | 私有，API代理访问 |
| `documents/`      | 案件文档                    | 私有，API代理访问 |
| `uploads/`        | 案件附件（可公开浏览）      | 公开读取          |

私有文件通过系统API代理访问（需登录验证），签名URL有效期1小时。

### 3.5 验证OSS配置

部署后执行以下接口测试，确认上传功能正常：

```bash
# 获取登录token（替换为实际账号）
TOKEN=$(curl -s -X POST https://你的域名.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"密码"}' \
  | jq -r '.token')

# 上传一张测试图片
curl -X POST https://你的域名.com/api/qualifications/photo \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@/tmp/test.jpg"

# 预期返回：{ "success": true, "data": { "fileId": "qual-...", "url": "/api/qualifications/photo/qual-..." } }
```

### 3.6 本地开发（不需要OSS）

本地开发无需配置OSS，保持 `OSS_ENABLED=false`（或不设置该变量），文件将存储在：

- `private_uploads/evidence/` — 证据文件
- `private_uploads/qualifications/` — 证件照
- `private_uploads/contracts/` — 合同
- `private_uploads/documents/` — 案件文档
- `public/uploads/` — 案件附件（可直接访问）

---

## 4. 数据库初始化

### 4.1 创建生产数据库

```bash
sudo -u postgres psql
```

```sql
CREATE USER legal_user WITH PASSWORD '你的密码';
CREATE DATABASE legal_debate_prod OWNER legal_user;
GRANT ALL PRIVILEGES ON DATABASE legal_debate_prod TO legal_user;
\q
```

### 4.2 启用 pg_trgm 扩展（必须步骤）

> **重要**：迁移文件中包含 `CREATE EXTENSION pg_trgm`，普通数据库用户没有创建扩展的权限。
> 必须以 **superuser（postgres）** 身份预先启用该扩展，否则 `prisma migrate deploy` 会报错中断。

```bash
sudo -u postgres psql -d legal_debate_prod
```

```sql
-- 以超级用户身份启用三元组搜索扩展（法条全文检索必须）
CREATE EXTENSION IF NOT EXISTS pg_trgm;
\q
```

### 4.3 运行数据库迁移

```bash
cd /path/to/legal_debate_mvp

# 生成 Prisma Client
npx prisma generate

# 执行所有迁移（生产环境用 migrate deploy，不用 migrate dev）
npx prisma migrate deploy
```

---

## 5. 业务数据导入

部署技术人员会收到以下 4 个 SQL 文件，须按顺序导入：

| 文件                     | 内容                        | 大小（约） |
| ------------------------ | --------------------------- | ---------- |
| `membership_tiers.sql`   | 4 条会员套餐配置            | < 1 KB     |
| `contract_templates.sql` | 460 个合同模板              | ~1 MB      |
| `law_articles.sql`       | 113 万条法律法规全文        | ~3-5 GB    |
| `case_examples.sql`      | 10 万+ 典型案例库（AI辅助） | ~200 MB    |

### 5.1 导入命令

```bash
# 设置数据库连接变量
export PGPASSWORD=你的密码

# 1. 导入会员套餐（小，先导）
psql -h localhost -U legal_user -d legal_debate_prod -f membership_tiers.sql

# 2. 导入合同模板
psql -h localhost -U legal_user -d legal_debate_prod -f contract_templates.sql

# 3. 导入法律法规（耗时较长，建议在 screen/tmux 中运行）
screen -S import
psql -h localhost -U legal_user -d legal_debate_prod -f law_articles.sql
# Ctrl+A D 可离开 screen，用 screen -r import 重新进入查看进度

# 4. 导入案例库（等法律法规导入完成后执行）
screen -S cases
psql -h localhost -U legal_user -d legal_debate_prod -f case_examples.sql
```

> **注意：** 法律法规数据量大，导入过程中请勿中断。导入完成后建议执行：
>
> ```bash
> psql -h localhost -U legal_user -d legal_debate_prod -c "ANALYZE law_articles; ANALYZE case_examples;"
> ```

### 5.2 验证导入结果

```bash
psql -h localhost -U legal_user -d legal_debate_prod -c "
SELECT
  (SELECT COUNT(*) FROM law_articles) AS law_articles,
  (SELECT COUNT(*) FROM contract_templates) AS contract_templates,
  (SELECT COUNT(*) FROM membership_tiers) AS membership_tiers,
  (SELECT COUNT(*) FROM case_examples) AS case_examples;
"
```

预期输出：

```
 law_articles | contract_templates | membership_tiers | case_examples
--------------+--------------------+------------------+---------------
      1135608 |                460 |                4 |      100000+
```

---

## 6. 构建与启动

### 6.1 安装依赖

```bash
cd /path/to/legal_debate_mvp
npm ci --production=false
```

### 6.2 构建应用

```bash
# 确保 .env（或 .env.production）已配置好
npm run build
```

构建成功后会生成 `.next/standalone/` 目录（Next.js standalone 输出模式）。

### 6.3 复制静态文件及修复 standalone 缺失文件

```bash
cp -r .next/static .next/standalone/.next/static
cp -r public .next/standalone/public

# 修复 Windows 跨平台打包时 @vercel/nft 文件追踪器遗漏的文件
# next.js:26 无条件 require 此文件，缺失会导致服务器启动失败
cp node_modules/next/dist/server/node-polyfill-crypto.js \
   .next/standalone/node_modules/next/dist/server/node-polyfill-crypto.js
```

> **此步骤必须执行**，否则 CSS/JS 资源 404，页面无法正常显示。
> 第三条 `cp` 是 Windows 打包特有问题的补丁（[issue 原因见此](#常见问题)），在 Linux 上直接构建则不需要。

### 6.4 手动验证启动（可选）

```bash
cd .next/standalone
NODE_ENV=production \
  DATABASE_URL="..." \
  JWT_SECRET="..." \
  NEXTAUTH_SECRET="..." \
  ENCRYPTION_KEY="..." \
  PORT=3000 \
  node server.js
```

访问 `http://localhost:3000` 确认页面正常，再配置 PM2。

---

## 7. Nginx 反向代理

```nginx
# /etc/nginx/sites-available/legal-debate

server {
    listen 80;
    server_name 你的域名.com www.你的域名.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name 你的域名.com www.你的域名.com;

    ssl_certificate     /etc/letsencrypt/live/你的域名.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/你的域名.com/privkey.pem;

    # 静态文件缓存
    location /_next/static/ {
        alias /path/to/legal_debate_mvp/.next/standalone/.next/static/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    location /public/ {
        alias /path/to/legal_debate_mvp/.next/standalone/public/;
        expires 7d;
    }

    # 主应用
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 60s;
        client_max_body_size 50m;
    }
}
```

```bash
ln -s /etc/nginx/sites-available/legal-debate /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
```

HTTPS 证书（使用 Let's Encrypt）：

```bash
apt install certbot python3-certbot-nginx
certbot --nginx -d 你的域名.com -d www.你的域名.com
```

---

## 8. PM2 进程管理

在项目根目录创建 `ecosystem.config.js`：

```javascript
module.exports = {
  apps: [
    {
      name: 'legal-debate',
      script: '.next/standalone/server.js',
      cwd: '/path/to/legal_debate_mvp',
      instances: 2, // 建议设为 CPU 核数
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      env_file: '.env', // 从 .env 文件读取其他变量
      max_memory_restart: '1G',
      error_file: 'logs/pm2-error.log',
      out_file: 'logs/pm2-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
  ],
};
```

```bash
mkdir -p logs

# 启动
pm2 start ecosystem.config.js

# 设置开机自启
pm2 save
pm2 startup

# 常用命令
pm2 status           # 查看状态
pm2 logs legal-debate  # 查看日志
pm2 reload legal-debate  # 零停机重启（更新代码后使用）
pm2 stop legal-debate    # 停止
```

---

## 9. 验证清单

### 安全项（部署前，必须全部通过）

- [ ] **【密钥轮换】** 生产 `.env` 中所有密钥均已重新生成，与 `.env.development` 无任何相同值
- [ ] **【JWT 强度】** `JWT_SECRET` 长度 ≥ 64 字符（验证：`echo -n "$JWT_SECRET" | wc -c`）
- [ ] **【数据库 SSL】** `DATABASE_URL` 包含 `sslmode=require` 或 `sslmode=prefer`
- [ ] **【SSL 生效】** `psql "$DATABASE_URL" -c "SHOW ssl;"` 输出为 `on`
- [ ] **【.env 未入库】** `git ls-files .env .env.production .env.development` 无任何输出
- [ ] **【OSS 配置】** `OSS_ENABLED=true` 且 AccessKey/Bucket/Region 已填写（若启用）

### 功能项（部署后验证）

- [ ] `https://你的域名.com` 页面正常加载（无白屏）
- [ ] 注册新用户 → 身份选择（认证律师 / 企业法务）正常显示，选择后勾选协议才可提交
- [ ] 注册为「认证律师」→ 登录后角色显示 LAWYER；注册为「企业法务」→ 角色显示 ENTERPRISE
- [ ] 登录功能正常，工作台显示个人案件数量、待办任务等个人统计
- [ ] 搜索法律法规，有结果返回
- [ ] 知识图谱（知识库 → 知识图谱）显示节点和关系连线（不再为 0 个关系）
- [ ] 创建案件 → 查看「立案材料」Tab，民事/刑事/行政/商事/劳动/知识产权各类均有对应清单
- [ ] 创建法律辩论，AI 生成论点（检验 AI API Key 是否生效）
- [ ] 创建合同，选择合同模板有内容
- [ ] 上传证据文件 → 能正常预览（验证 OSS 上传和签名URL访问）
- [ ] 律师资质认证 → 上传证件照成功（验证私有文件写入OSS）
- [ ] 支付流程（沙箱/正式根据配置验证）
- [ ] 访问 `/terms` 和 `/privacy` 页面正常显示服务条款和隐私政策
- [ ] `pm2 status` 显示 `online`，无频繁重启

---

## 10. 常见问题

### Q: 启动报 `[JWT配置错误] JWT_SECRET环境变量未设置`

确认 `.env` 中 `JWT_SECRET` 已设置，且 PM2 能读取到（`pm2 show legal-debate` 查看 env）。

### Q: 页面空白 / JS 资源 404

检查是否执行了第 5.3 步的静态文件复制：

```bash
ls .next/standalone/.next/static/   # 应该有文件
ls .next/standalone/public/          # 应该有 reports/ 等目录
```

### Q: 数据库连接失败

```bash
psql -h localhost -U legal_user -d legal_debate_prod -c "SELECT 1"
```

若连接失败，检查 PostgreSQL `pg_hba.conf` 是否允许本地用户连接。

### Q: AI 功能不响应

检查 `DEEPSEEK_API_KEY` 是否有效：

```bash
curl https://api.deepseek.com/v1/models \
  -H "Authorization: Bearer $DEEPSEEK_API_KEY"
```

### Q: 法律法规搜索无结果

确认 `law_articles` 表有数据，且 `LAW_ARTICLE_PROVIDER=local`：

```bash
psql ... -c "SELECT COUNT(*) FROM law_articles;"
```

### Q: 更新代码后如何热重启

```bash
git pull
npm ci
npm run build
cp -r .next/static .next/standalone/.next/static
cp -r public .next/standalone/public
pm2 reload legal-debate
```

### Q: 文件上传失败，日志显示 OSS 相关错误

常见原因及排查：

```bash
# 1. 检查环境变量是否被 PM2 读取到
pm2 show legal-debate | grep OSS

# 2. 检查 AccessKey 权限（确认有 PutObject 权限）
# 登录 RAM 控制台 → 用户 → 查看该用户的授权策略

# 3. 检查 Bucket 名称和地域是否匹配
# 错误示例：OSS_BUCKET=legal-files 但 OSS_REGION=oss-cn-beijing，而实际Bucket在上海
```

常见错误码：

| 错误                    | 原因                  | 解决方案                                 |
| ----------------------- | --------------------- | ---------------------------------------- |
| `AccessDenied`          | AccessKey无权限       | RAM控制台授权 `AliyunOSSFullAccess`      |
| `NoSuchBucket`          | Bucket名/地域错误     | 核对 `OSS_BUCKET` 和 `OSS_REGION`        |
| `InvalidAccessKeyId`    | AccessKey ID 错误     | 检查 `OSS_ACCESS_KEY` 值                 |
| `SignatureDoesNotMatch` | AccessKey Secret 错误 | 检查 `OSS_SECRET_KEY` 值，注意不要有空格 |

### Q: 已有本地上传的文件，切换到OSS后如何迁移

本系统对新老文件同时兼容：

- **新上传的文件**：自动存入OSS
- **切换前已上传的本地文件**：代理路由会先尝试OSS，找不到时回退到本地路径，仍可正常访问

若需要将旧文件全量迁移到OSS，可使用 [ossutil](https://help.aliyun.com/document_detail/50452.html) 工具：

```bash
# 安装 ossutil
wget https://gosspublic.alicdn.com/ossutil/1.7.14/ossutil64 -O /usr/local/bin/ossutil
chmod +x /usr/local/bin/ossutil

# 配置
ossutil config -e oss-cn-hangzhou.aliyuncs.com -i YOUR_ACCESS_KEY -k YOUR_SECRET_KEY

# 上传证据文件
ossutil cp -r private_uploads/evidence/ oss://你的Bucket/evidence/

# 上传证件照
ossutil cp -r private_uploads/qualifications/ oss://你的Bucket/qualifications/

# 上传合同文件
ossutil cp -r private_uploads/contracts/ oss://你的Bucket/contracts/
```

---

## 附：关键路径速查

| 用途          | 路径                                      |
| ------------- | ----------------------------------------- |
| 应用入口      | `.next/standalone/server.js`              |
| 环境变量      | `.env`（项目根目录）                      |
| 数据库 Schema | `prisma/schema.prisma`                    |
| 迁移文件      | `prisma/migrations/`                      |
| PM2 配置      | `ecosystem.config.js`                     |
| PM2 日志      | `logs/pm2-*.log`                          |
| Nginx 配置    | `/etc/nginx/sites-available/legal-debate` |
