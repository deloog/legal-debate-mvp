# 律伴助手 — 生产环境部署手册

**版本**：v3.0（2026-02）
**适用对象**：负责首次生产部署的技术人员
**预计耗时**：2–4 小时（首次全量部署）

---

## 目录

1. [服务器配置要求](#1-服务器配置要求)
2. [前置软件安装](#2-前置软件安装)
3. [获取代码](#3-获取代码)
4. [配置环境变量](#4-配置环境变量)
5. [数据库初始化](#5-数据库初始化)
6. [法律法规数据导入](#6-法律法规数据导入)
7. [构建与启动应用](#7-构建与启动应用)
8. [Nginx 反向代理配置](#8-nginx-反向代理配置)
9. [验证部署是否成功](#9-验证部署是否成功)
10. [常用运维命令](#10-常用运维命令)
11. [故障排查](#11-故障排查)

---

## 1. 服务器配置要求

### 最低配置（内测阶段）

| 资源     | 最低要求                                  |
| -------- | ----------------------------------------- |
| CPU      | 2 核                                      |
| 内存     | 4 GB RAM                                  |
| 磁盘     | 50 GB SSD（法律数据约 5–10 GB）           |
| 操作系统 | Ubuntu 22.04 LTS / Debian 12              |
| 网络     | 公网 IP + 域名（可选，但 HTTPS 强烈推荐） |

### 推荐配置（正式上线）

| 资源 | 推荐要求   |
| ---- | ---------- |
| CPU  | 4 核       |
| 内存 | 8 GB RAM   |
| 磁盘 | 100 GB SSD |

### 需要开放的端口

| 端口 | 用途                                   |
| ---- | -------------------------------------- |
| 22   | SSH                                    |
| 80   | HTTP（可选，用于 HTTPS 跳转）          |
| 443  | HTTPS                                  |
| 5432 | PostgreSQL（**仅内网，禁止对外开放**） |

---

## 2. 前置软件安装

在服务器上依次执行：

```bash
# 更新系统
sudo apt update && sudo apt upgrade -y

# 安装 Docker
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
newgrp docker

# 验证 Docker
docker --version   # 应显示 Docker 25+ 版本

# 安装 Node.js 20（用于运行 seed 和数据导入脚本）
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
node --version   # 应显示 v20.x.x

# 安装 PostgreSQL 16
sudo apt install -y postgresql-16
sudo systemctl enable postgresql
sudo systemctl start postgresql

# 安装 Nginx（用于反向代理）
sudo apt install -y nginx
sudo systemctl enable nginx
```

---

## 3. 获取代码

### 方法一：从 Git 仓库克隆（推荐）

```bash
cd /opt
sudo git clone https://github.com/你的仓库地址/legal-debate-mvp.git
sudo chown -R $USER:$USER /opt/legal-debate-mvp
cd /opt/legal-debate-mvp
```

### 方法二：从代码压缩包上传

```bash
# 在本地打包（排除无关文件）
cd D:\legal-debate-mvp
tar --exclude='.next' --exclude='node_modules' --exclude='data/crawled' \
    -czf legal-debate-mvp.tar.gz .

# 上传到服务器
scp legal-debate-mvp.tar.gz user@your-server:/opt/

# 在服务器上解压
cd /opt
mkdir legal-debate-mvp
tar -xzf legal-debate-mvp.tar.gz -C legal-debate-mvp
cd legal-debate-mvp
```

---

## 4. 配置环境变量

这是 **最关键** 的步骤，所有密钥和连接信息都在这里配置。

```bash
cd /opt/legal-debate-mvp

# 复制模板
cp .env.example .env

# 用编辑器打开
nano .env
```

### 必须填写的变量（留空则应用无法启动）

```bash
# ── 数据库 ──────────────────────────────────────────────────
DATABASE_URL="postgresql://legalapp:你的数据库密码@localhost:5432/legal_debate_db"

# ── 认证密钥（生产环境必须设置强密码，不能使用示例值）──────
# 生成随机密钥的命令：node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
JWT_SECRET=在此粘贴生成的64位十六进制字符串
NEXTAUTH_SECRET=在此粘贴另一个生成的64位十六进制字符串
NEXTAUTH_URL=https://你的域名.com

# ── 应用 URL ────────────────────────────────────────────────
NEXT_PUBLIC_APP_URL=https://你的域名.com
NODE_ENV=production
```

### AI 服务（至少配置一个）

```bash
# DeepSeek（推荐，性价比高）
DEEPSEEK_API_KEY=sk-你的DeepSeek密钥
DEEPSEEK_API_BASE_URL=https://api.deepseek.com/v1

# 或 智谱AI
ZHIPU_API_KEY=你的智谱密钥
```

### 其他可选配置（内测阶段可以暂时不填）

```bash
# 微信支付（如需支付功能）
WECHAT_APP_ID=...
WECHAT_APP_SECRET=...

# 短信服务（如需发短信）
ALIYUN_SMS_ACCESS_KEY_ID=...
```

> **安全提示**：`.env` 文件不得上传到 Git 仓库。
> **验证方法**：`cat .gitignore | grep env` 应显示 `.env*`

---

## 5. 数据库初始化

### 5.1 创建数据库和用户

```bash
sudo -u postgres psql << 'EOF'
CREATE USER legalapp WITH PASSWORD '你的数据库密码';
CREATE DATABASE legal_debate_db OWNER legalapp;
GRANT ALL PRIVILEGES ON DATABASE legal_debate_db TO legalapp;
\q
EOF
```

### 5.2 安装依赖

```bash
cd /opt/legal-debate-mvp
npm ci --production=false
```

### 5.3 执行数据库迁移

```bash
# 创建所有数据库表
npx prisma migrate deploy

# 预期输出：
# Applying migration `20240101_init`...
# ...
# Applying migration `20260206_add_export_task_model`...
# All migrations have been successfully applied.
```

### 5.4 执行性能索引（手动步骤，不要跳过）

```bash
# 这个索引文件不在 Prisma 标准迁移中，需要手动执行
psql $DATABASE_URL < prisma/migrations/add_performance_indexes.sql

# 若报错"relation already exists"可忽略
```

### 5.5 初始化基础数据

```bash
# 创建角色和权限（必须）
npx tsx prisma/seed-roles.ts

# 创建会员等级配置（必须）
npx tsx prisma/seed-membership.ts

# 创建案件类型配置（必须）
npx tsx prisma/seed-case-type-config.ts

# 创建合同模板（建议）
npx tsx prisma/seed-contracts.ts

# 创建管理员账号（必须）
npx tsx prisma/seed-admin.ts
# 执行后控制台会显示管理员初始账号和密码，请立即修改密码
```

---

## 6. 法律法规数据导入

> **背景说明**：项目已在本地爬取了来自全国人大法工委的法律法规数据，
> 存储在开发者电脑的 `data/` 目录和 `data/crawled/flk/` 目录中（28000+ 个文档）。
> 这些数据需要导入到生产数据库才能使用。

### 方案一：从本地数据库导出 SQL（推荐）

**在开发者本地电脑执行：**

```bash
# Windows PowerShell 或 Git Bash
cd D:\legal-debate-mvp

# 执行导出脚本（已有现成脚本）
bash scripts/export-npc-data.sh
```

**预期输出**：

- `backups/law_articles_npc_YYYYMMDD_HHMMSS.sql.gz` — 压缩 SQL 文件
- `backups/import_on_server.sh` — 服务器端自动导入脚本

**上传到服务器：**

```bash
scp backups/law_articles_npc_*.sql.gz user@your-server:/tmp/
scp backups/import_on_server.sh user@your-server:/tmp/
```

**在服务器上导入：**

```bash
ssh user@your-server
cd /tmp
chmod +x import_on_server.sh
./import_on_server.sh law_articles_npc_*.sql.gz

# 验证导入结果
cd /opt/legal-debate-mvp
npx tsx scripts/import-data/verify-npc-import.ts
```

---

### 方案二：在服务器上重新爬取（如方案一的 SQL 导出脚本不可用）

```bash
cd /opt/legal-debate-mvp

# 1. 先导入 data/ 目录下的 JSON 格式法条（已整理好的基础数据）
npx tsx scripts/import-data/import-existing-laws.ts

# 2. 再导入已爬取的 docx 文件（需要先把 data/crawled/flk/ 目录上传到服务器）
#    将开发者本地的 data/crawled/flk/ 目录压缩后上传：
#    scp -r data/crawled/flk/ user@your-server:/opt/legal-debate-mvp/data/crawled/
npx tsx scripts/import-data/import-npc-laws-batch.ts
```

---

### 验证法律数据

```bash
# 查看数据库中法条总数
psql $DATABASE_URL -c "SELECT COUNT(*) FROM law_articles;"

# 正常结果应 > 1000 条
```

---

## 7. 构建与启动应用

### 方法一：使用 Docker（推荐生产环境）

```bash
cd /opt/legal-debate-mvp

# 构建 Docker 镜像
docker build -t legal-debate-app:latest .
# 预计耗时 3–5 分钟

# 启动容器
docker run -d \
  --name legal-debate-app \
  --restart unless-stopped \
  --env-file .env \
  -p 3000:3000 \
  legal-debate-app:latest

# 查看启动日志
docker logs -f legal-debate-app
# 看到 "Ready - started server on 0.0.0.0:3000" 即表示启动成功
```

### 方法二：直接运行（内测阶段也可用）

```bash
cd /opt/legal-debate-mvp

# 安装依赖
npm ci --production=false

# 构建（约需 2–3 分钟）
npm run build

# 使用 PM2 守护进程运行（推荐）
npm install -g pm2
pm2 start npm --name "legal-debate" -- start
pm2 save
pm2 startup  # 设置开机自启

# 查看状态
pm2 status
pm2 logs legal-debate
```

---

## 8. Nginx 反向代理配置

```bash
sudo nano /etc/nginx/sites-available/legal-debate
```

粘贴以下内容（替换 `你的域名.com`）：

```nginx
server {
    listen 80;
    server_name 你的域名.com www.你的域名.com;

    # 强制跳转 HTTPS
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name 你的域名.com www.你的域名.com;

    # SSL 证书（使用 certbot 免费申请）
    ssl_certificate /etc/letsencrypt/live/你的域名.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/你的域名.com/privkey.pem;

    # 安全配置
    ssl_protocols TLSv1.2 TLSv1.3;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # 文件上传大小限制（律师资质照片等）
    client_max_body_size 10M;

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
    }
}
```

```bash
# 启用配置
sudo ln -s /etc/nginx/sites-available/legal-debate /etc/nginx/sites-enabled/
sudo nginx -t           # 检查配置语法
sudo systemctl reload nginx

# 申请免费 HTTPS 证书（需要域名已解析到服务器 IP）
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d 你的域名.com -d www.你的域名.com
```

---

## 9. 验证部署是否成功

### 逐步检查清单

```bash
# ✅ 1. 健康检查接口
curl https://你的域名.com/api/health
# 预期返回：{"success": true, "status": "ok", ...}

# ✅ 2. 数据库连接检查
curl https://你的域名.com/api/health/deps
# 预期返回包含 "database": "ok"

# ✅ 3. 检查应用版本
curl https://你的域名.com/api/version

# ✅ 4. 登录页面可访问
# 浏览器打开 https://你的域名.com/login

# ✅ 5. 管理员登录测试
# 使用 seed-admin.ts 输出的账号密码登录
# 访问 https://你的域名.com/admin

# ✅ 6. 查看容器/进程状态
docker ps                    # Docker 方式
# 或
pm2 status                   # PM2 方式
```

---

## 10. 常用运维命令

### 更新应用代码

```bash
cd /opt/legal-debate-mvp

# 拉取最新代码
git pull origin main

# 重新构建并重启（Docker 方式）
docker build -t legal-debate-app:latest .
docker stop legal-debate-app
docker rm legal-debate-app
docker run -d --name legal-debate-app --restart unless-stopped \
  --env-file .env -p 3000:3000 legal-debate-app:latest

# 或（PM2 方式）
npm run build
pm2 restart legal-debate
```

### 数据库备份

```bash
cd /opt/legal-debate-mvp

# 手动备份
npm run db:backup
# 备份文件存储在 backups/ 目录

# 恢复备份
npm run db:restore -- --file backups/backup_YYYYMMDD.sql
```

### 查看应用日志

```bash
# Docker 方式
docker logs legal-debate-app --tail 100 -f

# PM2 方式
pm2 logs legal-debate --lines 100
```

### 修改管理员密码

```bash
# 使用 Prisma Studio 可视化管理数据库
# （在本地开发环境运行，连接生产数据库）
DATABASE_URL="生产数据库连接串" npx prisma studio
```

---

## 11. 故障排查

### 应用启动失败

```bash
# 查看错误日志
docker logs legal-debate-app 2>&1 | tail -50

# 常见原因及解决方法：
# ❌ "JWT_SECRET environment variable not set"
#    → .env 文件中 JWT_SECRET 未填写
# ❌ "Can't reach database server"
#    → DATABASE_URL 配置错误，或 PostgreSQL 未启动（sudo systemctl start postgresql）
# ❌ "Port 3000 already in use"
#    → 已有进程占用端口：lsof -i :3000 查看并终止
```

### 数据库迁移失败

```bash
# 查看迁移状态
npx prisma migrate status

# 如果有迁移未应用
npx prisma migrate deploy

# 如果迁移文件冲突（慎用，会清空数据）
# npx prisma migrate reset  ← 谨慎！只在全新安装时使用
```

### 页面 500 错误

```bash
# 检查服务端日志
docker logs legal-debate-app 2>&1 | grep -i "error"

# 检查 Nginx 日志
sudo tail -f /var/log/nginx/error.log
```

---

## 附录 A：完整 .env 变量说明

请参考项目根目录的 [.env.example](../../../.env.example)，其中每个变量都有详细注释说明。

---

## 附录 B：法律数据来源说明

项目已收录以下来源的法律法规数据：

| 数据来源                         | 数量（约） | 说明                                              |
| -------------------------------- | ---------- | ------------------------------------------------- |
| 全国人大法工委（flk.npc.gov.cn） | 28000+ 条  | 已爬取，存于 `data/crawled/flk/` 目录，.docx 格式 |
| 整理后的 JSON 法条               | 7 个类别   | 存于 `data/` 目录，已结构化                       |

**交付方式**：开发者将通过以下其中一种方式提供数据：

1. `law_articles_npc_YYYYMMDD.sql.gz` — 直接可导入的 SQL 文件（推荐）
2. `data/crawled/flk/` 目录压缩包 — 原始 .docx 文件，需运行导入脚本处理

---

## 附录 C：联系支持

首次部署遇到问题时，请将以下信息提供给开发者协助排查：

1. 服务器操作系统及版本：`cat /etc/os-release`
2. Docker 版本：`docker --version`
3. Node.js 版本：`node --version`
4. 错误日志（最后 50 行）：`docker logs legal-debate-app 2>&1 | tail -50`
5. 环境变量检查（**不要发送实际密钥，只发变量名**）：`cat .env | grep -v "=" | sort`
