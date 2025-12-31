# 项目迁移指南 - 新电脑配置

本文档说明如何将 legal_debate_mvp 项目迁移到新电脑。

## 迁移方式推荐

### 方式一：使用 Git 克隆（推荐）

如果你的项目已经在 Git 仓库中：

```bash
# 1. 在新电脑上克隆仓库
git clone <your-repository-url> legal_debate_mvp
cd legal_debate_mvp

# 2. 安装依赖
npm install

# 3. 配置环境变量
cp .env.example .env
# 编辑 .env 文件，填入实际的配置值

# 4. 生成 Prisma Client
npm run db:generate

# 5. 运行数据库迁移
npm run db:migrate

# 6. 启动开发服务器
npm run dev
```

### 方式二：直接复制文件夹

如果项目不在 Git 仓库中：

```bash
# 1. 将整个项目文件夹复制到新电脑

# 2. 复制完成后，进入项目目录
cd legal_debate_mvp

# 3. 重新安装依赖（node_modules 不需要复制）
npm install

# 4. 生成 Prisma Client
npm run db:generate

# 5. 运行数据库迁移
npm run db:migrate

# 6. 启动开发服务器
npm run dev
```

## 详细步骤

### 步骤 1：复制项目文件

**需要复制的文件夹和文件：**

```
legal_debate_mvp/
├── src/              ✅ 必需
├── public/           ✅ 必需
├── prisma/           ✅ 必需
├── config/           ✅ 必需
├── scripts/          ✅ 必需
├── data/             ✅ 必需
├── docs/             ✅ 必需
├── tests/            ✅ 必需
├── package.json      ✅ 必需
├── package-lock.json ✅ 必需（保留依赖版本锁定）
├── tsconfig.json     ✅ 必需
├── next.config.*     ✅ 必需
├── .prettierrc       ✅ 必需
├── eslint.config.*   ✅ 必需
└── README.md         ✅ 必需
```

**不需要复制的文件夹/文件：**

```
node_modules/          ❌ 不要复制（太大且在新机器上重新安装）
.next/                 ❌ Next.js 构建产物
out/                   ❌ 构建输出
dist/                  ❌ 构建输出
build/                 ❌ 构建输出
coverage/              ❌ 测试覆盖率
.env                   ❌ 包含敏感信息，不要直接复制（手动配置）
.env.local             ❌ 包含敏感信息
*.log                  ❌ 日志文件
data/dev.db*           ❌ 本地数据库文件
backups/               ❌ 备份文件
test-data/             ❌ 测试数据
```

### 步骤 2：在新电脑上安装必要软件

确保新电脑已安装以下软件：

1. **Node.js**（推荐 v18 或 v20）
   - 下载：https://nodejs.org/
   - 验证：`node --version` 和 `npm --version`

2. **PostgreSQL**（如果使用外部数据库）
   - 下载：https://www.postgresql.org/download/
   - 或者使用 Docker 运行 PostgreSQL

3. **Git**（如果使用 Git 方式）
   - 下载：https://git-scm.com/

4. **VSCode**（推荐）
   - 下载：https://code.visualstudio.com/

### 步骤 3：安装项目依赖

在新电脑的项目根目录执行：

```bash
npm install
```

这会根据 package-lock.json 安装完全一致的依赖版本。

### 步骤 4：配置环境变量

**重要：** 不要复制原有的 .env 文件，因为它包含敏感信息。

在新电脑上创建环境配置：

```bash
# 如果有 .env.example 模板
cp .env.example .env

# 如果没有模板，创建新的 .env 文件
touch .env
```

编辑 `.env` 文件，填入以下必要配置：

```env
# 数据库配置
DATABASE_URL="postgresql://用户名:密码@localhost:5432/数据库名?schema=public"

# AI 服务配置（根据需要配置）
ANTHROPIC_API_KEY="your-key-here"
OPENAI_API_KEY="your-key-here"

# 其他配置...
```

### 步骤 5：数据库迁移

```bash
# 生成 Prisma Client
npm run db:generate

# 应用数据库迁移（创建表结构）
npm run db:migrate

# 如果需要填充种子数据
npm run db:seed
```

### 步骤 6：验证配置

```bash
# 检查 TypeScript 类型
npm run type-check

# 运行测试
npm test

# 启动开发服务器
npm run dev
```

## 数据库数据迁移（可选）

如果需要迁移数据库中的实际数据，有以下几种方案：

### 方案 A：使用 PostgreSQL 导出/导入

```bash
# 在原电脑上导出数据
pg_dump -U username -d dbname > backup.sql

# 复制 backup.sql 到新电脑

# 在新电脑上导入数据
psql -U username -d dbname < backup.sql
```

### 方案 B：使用 Prisma 备份/恢复（项目已有脚本）

```bash
# 在原电脑上备份
npm run db:backup

# 复制 backups/ 目录中的备份文件到新电脑

# 在新电脑上恢复
npm run db:restore
```

### 方案 C：重新初始化（推荐用于开发环境）

如果只是开发环境，可以只迁移表结构，数据通过种子数据重新生成：

```bash
npm run db:reset
```

## 常见问题

### 1. 依赖安装失败

```bash
# 清理缓存
npm cache clean --force

# 删除 node_modules 和 package-lock.json
rm -rf node_modules package-lock.json

# 重新安装
npm install
```

### 2. 数据库连接失败

检查 .env 中的 DATABASE_URL 配置是否正确：

```bash
# 测试数据库连接
psql $DATABASE_URL
```

### 3. Prisma 相关问题

```bash
# 重新生成 Prisma Client
npm run db:generate

# 重置数据库（慎用！会删除所有数据）
npm run db:reset
```

### 4. TypeScript 错误

```bash
# 清理 TypeScript 缓存
rm -rf .next
rm -f *.tsbuildinfo
next-env.d.ts

# 重新生成
npm run dev
```

## 迁移检查清单

迁移完成后，使用以下清单验证：

- [ ] 项目文件完整复制
- [ ] Node.js 版本正确
- [ ] `npm install` 成功执行
- [ ] `.env` 文件配置正确（不要使用原电脑的）
- [ ] 数据库连接正常
- [ ] `npm run db:generate` 成功
- [ ] `npm run db:migrate` 成功
- [ ] `npm run type-check` 无错误
- [ ] `npm test` 测试通过
- [ ] `npm run dev` 可以正常启动
- [ ] 访问 http://localhost:3000 能看到页面

## 性能优化建议

由于原电脑内存不足，在新电脑上可以：

1. **增加 Node.js 内存限制**

   在 `package.json` 中修改 dev 脚本：

   ```json
   "dev": "node --max-old-space-size=4096 node_modules/.bin/next dev"
   ```

2. **使用数据库连接池**

   确保数据库 URL 中包含连接池参数：

   ```
   ?connection_limit=10&pool_timeout=20
   ```

3. **关闭不必要的服务**

   只运行需要的开发工具，避免后台进程占用内存。

## 迁移完成后

1. 提交初始状态到 Git（如果使用 Git）
2. 创建新的 `.env.example`（如果配置有变化）
3. 更新 README.md 中的开发环境配置说明
4. 运行一次完整的测试套件

## 需要帮助？

如果遇到问题，请查看：

- [DATABASE_SETUP.md](DATABASE_SETUP.md) - 数据库设置
- [README.md](../README.md) - 项目概述
- [MIGRATION_GUIDE.md](MIGRATION_GUIDE.md) - 数据迁移指南
