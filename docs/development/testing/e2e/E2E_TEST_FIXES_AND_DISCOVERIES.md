# E2E测试修复与问题发现报告

## 任务背景

根据《任务5.1.1端到端流程测试覆盖率报告》，当前测试覆盖率为10.3%（58个测试中仅6个通过），需要修复核心API问题。

## 已完成的修复

### 1. 修复案件列表API (`src/app/api/v1/cases/route.ts`)

- **问题**：缺少`deletedAt`过滤条件
- **修复**：添加`deletedAt: null`查询条件
- **影响**：确保软删除的记录不被查询返回

### 2. 修复案件详情API (`src/app/api/v1/cases/[id]/route.ts`)

- **问题**：缺少`deletedAt`过滤条件
- **修复**：添加`deletedAt: null`查询条件

### 3. 修复测试helper

- **问题**：测试使用硬编码的非UUID格式的userId（`"test-e2e-user-single-round"`）
- **修复**：
  - 修改`createTestCase`函数使userId参数可选
  - 使用默认UUID格式的E2E测试用户ID（`00000000-0000-0000-0000-000000000001`）
  - 添加详细的错误日志输出

### 4. 修复Prettier代码风格问题

- **问题**：文件中的代码风格不符合`.clinerules`规范
- **修复**：统一使用单引号、2空格缩进等格式

### 5. 修复TypeScript类型错误

- **问题**：部分API代码存在类型不匹配问题
- **修复**：修正类型定义

## 发现的根本问题

### 数据库配置不匹配 ⚠️ CRITICAL

**问题描述：**

- `.env.development`配置的是SQLite：`DATABASE_URL="file:./data/dev.db"`
- `prisma/schema.prisma`配置的是PostgreSQL：`provider = "postgresql"`
- 导致Prisma初始化失败：`Error validating datasource db: URL must start with protocol postgresql:// or postgres://`

**根本原因：**
项目从SQLite迁移到PostgreSQL后，环境配置未同步更新。

**解决方案：**

1. 已更新`.env.development`为PostgreSQL连接字符串：

   ```
   DATABASE_URL="postgresql://postgres:password@localhost:5432/legal_debate_dev"
   ```

2. 需要启动Docker PostgreSQL容器：

   ```bash
   cd config && docker-compose up -d postgres
   ```

3. 运行数据库迁移：

   ```bash
   npx prisma migrate dev
   ```

4. 初始化E2E测试数据：
   ```bash
   npm run init-e2e-test-data
   ```

### Docker Desktop未运行

**问题描述：**

- 尝试启动Docker容器时报错：`The system cannot find the file specified`
- 错误信息表明Docker Desktop未正确安装或未运行

**影响：**

- 无法启动PostgreSQL容器
- 无法运行数据库迁移
- E2E测试无法连接数据库

**临时解决方案：**
如果Docker不可用，可以考虑：

1. 使用本地PostgreSQL服务器
2. 切换回SQLite（但需要修改schema以移除JSON/enum支持）

## 待修复的关键问题

### 1. 文档上传API (12个测试失败)

**错误**：500错误
**可能原因**：

- multipart表单数据处理问题
- 文件存储路径配置问题
- 文件解析服务问题

### 2. 法条检索API (15个测试失败)

**错误**：500错误
**可能原因**：

- 数据库连接问题（已识别为DATABASE_URL配置问题）
- 缓存服务问题
- 查询性能问题

### 3. 创建辩论API (11个测试失败)

**错误**：500错误
**可能原因**：

- 案件验证逻辑问题
- userId验证问题（已部分修复）
- 关联数据创建失败

### 4. Playwright配置问题 (3个测试失败)

**错误**：页面导航失败
**解决方案**：

- 确保`config/playwright.config.ts`中`baseURL`配置正确
- 使用完整URL而非相对路径

## 下一步行动计划

### 立即执行（基础设施层面）

1. [ ] 启动Docker Desktop
2. [ ] 启动PostgreSQL容器：`cd config && docker-compose up -d`
3. [ ] 运行数据库迁移：`npx prisma migrate dev`
4. [ ] 初始化测试数据：`npm run init-e2e-test-data`
5. [ ] 重新生成Prisma client：`npx prisma generate`

### 代码层面修复（按优先级）

1. [ ] 修复文档上传API
   - 检查multipart处理逻辑
   - 验证文件存储配置
   - 测试文档解析流程

2. [ ] 修复法条检索API
   - 验证数据库连接
   - 检查缓存服务状态
   - 优化查询性能

3. [ ] 修复创建辩论API
   - 验证案件关联逻辑
   - 确保轮次正确创建

4. [ ] 修复Playwright配置
   - 检查baseURL配置
   - 确保完整URL格式

### 测试验证

1. [ ] 重新运行E2E测试：`cd src/__tests__/e2e && npx playwright test`
2. [ ] 分析测试结果
3. [ ] 修复新发现的问题
4. [ ] 目标：达到80%+测试覆盖率

## 测试数据说明

E2E测试依赖于以下测试数据（由`scripts/init-e2e-test-data.ts`创建）：

- 用户ID：`00000000-0000-0000-0000-000000000001`
- 法条数据：需要在数据库中存在法条记录
- 测试案件：每次测试动态创建
- 测试文档：使用模拟PDF内容

## 技术栈说明

- **数据库**：PostgreSQL 15 (Docker)
- **缓存**：Redis 7 (Docker)
- **框架**：Next.js 16 + Prisma 5
- **测试**：Playwright E2E测试

## 备注

- 所有代码修改遵循`.clinerules`规范
- 使用单引号、2空格缩进
- 避免默认导出，优先使用命名导出
- 使用TypeScript类型而非JSDoc
