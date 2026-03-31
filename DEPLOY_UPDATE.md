# 律伴助手 — 更新部署指南（腾讯云 Linux）

> 适用场景：服务器已有初次部署基础，本次为功能更新部署
> 更新时间：2026-03-31

---

## 本次更新内容摘要

| 类别        | 变更                                                                            |
| ----------- | ------------------------------------------------------------------------------- |
| 数据库      | `arguments` 表新增 `metadata` 字段（JSONB，可为空）                             |
| Prisma 引擎 | 同时支持 `debian-openssl-1.0.x`（Ubuntu）和 `rhel-openssl-3.0.x`（CentOS/RHEL） |
| 新页面/路由 | `/terms`、`/privacy`、`/documents`，及多个 API 路由                             |
| BUG 修复    | 辩论系统、合同审批流、知识图谱、证据管理等多处修复                              |
| 打包修复    | 补充 Windows 打包遗漏的 `node-polyfill-crypto.js`                               |

---

## ⚠️ Windows → Linux 跨平台打包注意事项

每次在 **Windows 开发机** 打包给 Linux 服务器，必须遵守：

### 完整打包命令（已验证可用）

```bash
# 1. 构建
npm run build

# 2. 复制静态文件
cp -r .next/static .next/standalone/.next/static
cp -r public .next/standalone/public

# 3. 补充 Windows 打包时文件追踪器遗漏的文件（必须，否则服务器启动报错）
cp node_modules/next/dist/server/node-polyfill-crypto.js \
   .next/standalone/node_modules/next/dist/server/node-polyfill-crypto.js

# 4. 打包（--dereference 把软链接内容打进去，而不是链接本身）
tar \
  --dereference \
  --exclude='.next/standalone/node_modules/.prisma/client/query_engine-windows*' \
  --exclude='.next/standalone/node_modules/@img/sharp-win32*' \
  -czf /d/legal_debate_mvp_built.tar.gz \
  -C /d/legal_debate_mvp \
  .next/standalone/server.js \
  .next/standalone/.next \
  .next/standalone/node_modules \
  .next/standalone/public \
  prisma/schema.prisma \
  prisma/migrations \
  package.json \
  DEPLOY_UPDATE.md
```

> **不能省略第 3 步**：`next.js` 第 26 行无条件 `require("./node-polyfill-crypto")`，Windows 构建时 `@vercel/nft` 文件追踪器不会将其纳入 standalone，导致服务器报 `Cannot find module './node-polyfill-crypto'`。

---

## 你会收到的文件

| 文件                            | 说明                                                                 |
| ------------------------------- | -------------------------------------------------------------------- |
| `legal_debate_mvp_built.tar.gz` | **预编译包**（已在开发机编译好，服务器直接解压运行，无需 npm build） |
| `DEPLOY_UPDATE.md`              | 本文档                                                               |

> `law_articles.sql`、`case_examples.sql`、合同模板、会员配置已在之前导入，**本次不需要重新导入**。

---

## 第一步：上传文件到服务器

```bash
# 本地执行（替换 IP）
scp legal_debate_mvp_built.tar.gz root@你的服务器IP:/www/wwwroot/

# 登录服务器
ssh root@你的服务器IP
```

---

## 第二步：解压并替换应用

```bash
cd /www/wwwroot

# 备份旧版本
cp -r legal /www/wwwroot/legal_backup_$(date +%Y%m%d) 2>/dev/null || true

# 解压到当前目录（包内路径以 .next/ 开头，解压到项目根目录）
tar -xzf legal_debate_mvp_built.tar.gz -C /www/wwwroot/legal/
```

解压后关键文件：

```
/www/wwwroot/legal/
├── server.js                    ← PM2 入口
├── .next/                       ← 编译产物
├── node_modules/                ← 运行时依赖（含 Linux Prisma 引擎）
├── public/                      ← 静态资源
├── prisma/schema.prisma
├── prisma/migrations/           ← 迁移文件
└── package.json
```

---

## 第三步：配置环境变量

```bash
# 确认 .env 存在（之前部署已配置，正常情况下不需要重新设置）
ls -la /www/wwwroot/legal/.env

# 如果 .env 因解压被覆盖，从备份恢复
cp /www/wwwroot/legal_backup_*/.env /www/wwwroot/legal/.env
```

> **⚠️ 重要**：`.env` 必须放在 `server.js` 同级目录（`/www/wwwroot/legal/.env`）。

---

## 第四步：执行数据库迁移（本次有新变更）

### 4.1 执行标准迁移

```bash
cd /www/wwwroot/legal
npx prisma migrate deploy
```

预期输出（若上次已执行 trgm 迁移则 Database schema is up to date）：

```
Database schema is up to date!
```

或者：

```
All migrations have been successfully applied.
```

### 4.2 手动执行新增字段迁移（必须）

⚠️ `arguments` 表新增了 `metadata` 字段，此迁移格式不符合 Prisma 标准，`migrate deploy` **不会自动执行**，需手动运行：

```bash
# 替换为实际的数据库密码
export PGPASSWORD=你的数据库密码
psql -h localhost -U legal_user -d legal_debate_prod -c \
  "ALTER TABLE \"arguments\" ADD COLUMN IF NOT EXISTS \"metadata\" JSONB;"
```

预期输出：`ALTER TABLE`（或 `ALTER TABLE 0` 表示字段已存在，均正常）。

**验证字段是否生效**：

```bash
psql -h localhost -U legal_user -d legal_debate_prod -c \
  "\d arguments" | grep metadata
```

应能看到 `metadata | jsonb | ` 这一行。

---

## 第五步：重启应用

```bash
# 重启（保留现有 PM2 配置）
pm2 restart server

# 确认运行正常
pm2 status
pm2 logs server --lines 30 --nostream
```

> 如果 `pm2 restart server` 报 "process not found"，改用完整启动命令：
>
> ```bash
> pm2 start /www/wwwroot/legal/server.js --name server
> pm2 save
> ```

---

## 第六步：验证部署

```bash
# 健康检查
curl -s http://localhost:3000/api/health | python3 -m json.tool
```

### 浏览器验证清单

- [ ] 首页正常加载
- [ ] 注册页面底部有「服务条款」和「隐私政策」勾选项
- [ ] 访问 `/terms`、`/privacy` 页面正常显示
- [ ] 访问 `/documents` 页面正常显示
- [ ] 律师工作台：案件、任务统计正常
- [ ] 辩论页面：能正常生成辩论内容
- [ ] 搜索法律法规有结果返回

---

## 常见问题

### Q: 启动报 `Cannot find module './node-polyfill-crypto'`

打包时漏做了第 3 步（补充遗漏文件）。**无需重新打包**，直接在服务器创建该文件：

```bash
cat > /www/wwwroot/legal/node_modules/next/dist/server/node-polyfill-crypto.js << 'EOF'
// Polyfill crypto() in the Node.js environment
"use strict";
if (!global.crypto) {
    let webcrypto;
    Object.defineProperty(global, 'crypto', {
        enumerable: false,
        configurable: true,
        get () {
            if (!webcrypto) {
                webcrypto = require('node:crypto').webcrypto;
            }
            return webcrypto;
        },
        set (value) {
            webcrypto = value;
        }
    });
}
EOF
pm2 restart server
```

### Q: `prisma migrate deploy` 报错 `extension "pg_trgm" does not exist`

```bash
sudo -u postgres psql -d legal_debate_prod -c "CREATE EXTENSION IF NOT EXISTS pg_trgm;"
npx prisma migrate deploy
```

### Q: 页面报 CSS/JS 404

```bash
# 检查静态文件是否存在
ls /www/wwwroot/legal/.next/static/
```

若为空，说明打包前漏做了静态文件复制：

```bash
# 从备份恢复静态文件（若有备份）
cp -r /www/wwwroot/legal_backup_*/.next/static /www/wwwroot/legal/.next/static
```

### Q: 如何回滚到上个版本

```bash
pm2 stop server
rm -rf /www/wwwroot/legal
mv /www/wwwroot/legal_backup_$(date +%Y%m%d) /www/wwwroot/legal
pm2 start /www/wwwroot/legal/server.js --name server
pm2 save
```

---

## 部署完成后通知开发方

部署完成后，请截图发送以下内容：

1. `pm2 status` 命令输出
2. 浏览器访问首页的截图
3. 如有报错，发送 `pm2 logs server --lines 100 --nostream` 的输出
