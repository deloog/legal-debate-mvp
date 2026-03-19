# 律伴助手 - 生产部署指南

> 版本：2026-03
> 适用环境：Linux 服务器 + PostgreSQL 15 + Redis 7 + Node.js 20

---

## 目录

1. [服务器要求](#1-服务器要求)
2. [环境变量配置](#2-环境变量配置)
3. [数据库初始化](#3-数据库初始化)
4. [业务数据导入](#4-业务数据导入)
5. [构建与启动](#5-构建与启动)
6. [Nginx 反向代理](#6-nginx-反向代理)
7. [PM2 进程管理](#7-pm2-进程管理)
8. [验证清单](#8-验证清单)
9. [常见问题](#9-常见问题)

---

## 1. 服务器要求

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

# JWT 密钥（至少 32 位随机字符串）
# 生成命令：node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
JWT_SECRET=替换为随机生成的32位以上字符串
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
```

---

## 3. 数据库初始化

### 3.1 创建生产数据库

```bash
sudo -u postgres psql
```

```sql
CREATE USER legal_user WITH PASSWORD '你的密码';
CREATE DATABASE legal_debate_prod OWNER legal_user;
GRANT ALL PRIVILEGES ON DATABASE legal_debate_prod TO legal_user;
\q
```

### 3.2 运行数据库迁移

```bash
cd /path/to/legal_debate_mvp

# 生成 Prisma Client
npx prisma generate

# 执行所有迁移（生产环境用 migrate deploy，不用 migrate dev）
npx prisma migrate deploy
```

---

## 4. 业务数据导入

部署技术人员会收到以下 3 个 SQL 文件，须按顺序导入：

| 文件                     | 内容                 | 大小（约） |
| ------------------------ | -------------------- | ---------- |
| `membership_tiers.sql`   | 4 条会员套餐配置     | < 1 KB     |
| `contract_templates.sql` | 460 个合同模板       | ~1 MB      |
| `law_articles.sql`       | 113 万条法律法规全文 | ~3-5 GB    |

### 4.1 导入命令

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
```

> **注意：** 法律法规数据量大，导入过程中请勿中断。导入完成后建议执行：
>
> ```bash
> psql -h localhost -U legal_user -d legal_debate_prod -c "ANALYZE law_articles;"
> ```

### 4.2 验证导入结果

```bash
psql -h localhost -U legal_user -d legal_debate_prod -c "
SELECT
  (SELECT COUNT(*) FROM law_articles) AS law_articles,
  (SELECT COUNT(*) FROM contract_templates) AS contract_templates,
  (SELECT COUNT(*) FROM membership_tiers) AS membership_tiers;
"
```

预期输出：

```
 law_articles | contract_templates | membership_tiers
--------------+--------------------+------------------
      1135648 |                460 |                4
```

---

## 5. 构建与启动

### 5.1 安装依赖

```bash
cd /path/to/legal_debate_mvp
npm ci --production=false
```

### 5.2 构建应用

```bash
# 确保 .env（或 .env.production）已配置好
npm run build
```

构建成功后会生成 `.next/standalone/` 目录（Next.js standalone 输出模式）。

### 5.3 复制静态文件

```bash
cp -r .next/static .next/standalone/.next/static
cp -r public .next/standalone/public
```

> **此步骤必须执行**，否则 CSS/JS 资源 404，页面无法正常显示。

### 5.4 手动验证启动（可选）

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

## 6. Nginx 反向代理

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

## 7. PM2 进程管理

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

## 8. 验证清单

部署完成后逐项核验：

- [ ] `https://你的域名.com` 页面正常加载（无白屏）
- [ ] 注册新用户 → 收到验证邮件（或日志中打印验证码）
- [ ] 登录功能正常
- [ ] 搜索法律法规，有结果返回
- [ ] 创建法律辩论，AI 生成论点（检验 AI API Key 是否生效）
- [ ] 创建合同，选择合同模板有内容
- [ ] 支付流程（沙箱/正式根据配置验证）
- [ ] `pm2 status` 显示 `online`，无频繁重启

---

## 9. 常见问题

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
