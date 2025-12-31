# E2E测试改进计划

## 项目背景

根据端到端流程测试覆盖率报告，当前测试通过率仅为 **10.3%**（6/58通过），远低于预期目标。

## 深度分析结果

### 根本原因分析

经过深入审查API实现状态，发现测试失败的真实原因：

| API | 实现状态 | 问题 |
|-----|---------|------|
| `/api/v1/cases` (GET/POST) | ✅ 已修复 | 从mock改为真实数据库 |
| `/api/v1/cases/[id]` (GET/PUT/DELETE) | ✅ 已修复 | 从mock改为真实数据库 |
| `/api/v1/documents/upload` | ✅ 已修复 | 集成DocAnalyzer自动分析 |
| `/api/v1/documents/[id]` | ✅ 已实现 | 返回真实数据 |
| `/api/v1/law-articles/search` | ✅ 已实现 | 完整的检索服务 |
| `/api/v1/legal-analysis/applicability` | ✅ 已实现 | AI适用性分析 |
| `/api/v1/debates` | ✅ 已实现 | 创建辩论和轮次 |
| `/api/v1/debate-rounds/[id]/generate` | ✅ 已实现 | 生成辩论论点 |

### 真正的问题

1. **案件详情API使用mock数据** - `src/app/api/v1/cases/[id]/route.ts`中GET/PUT/DELETE都是mock实现
2. **案件列表API使用mock数据** - `src/app/api/v1/cases/route.ts`中GET/POST都是mock实现
3. **测试数据缺失** - E2E测试用户和法条数据未初始化

### API实现状态总结

**所有核心API都已经实现完毕**，只有案件相关API存在mock数据的问题。

## 已完成的改进

### ✅ 阶段一：问题诊断
- [x] 审查现有API实现情况
- [x] 识别mock数据问题
- [x] 确定测试数据缺失问题
- [x] **重要发现**：之前对API实现状态的判断有误，实际大部分API都已实现

### ✅ 阶段二：基础设施修复
- [x] 创建测试数据初始化脚本 (`scripts/init-e2e-test-data.ts`)
  - 创建5个E2E测试用户
  - 创建20条测试法条数据
- [x] 执行测试数据初始化（成功）

### ✅ 阶段三：核心API修复

#### 1. 案件列表API修复 (`src/app/api/v1/cases/route.ts`)
**改进内容：**
- ✅ 从mock数据改为真实数据库操作
- ✅ 实现GET /api/v1/cases - 案件列表查询（支持分页、搜索）
- ✅ 实现POST /api/v1/cases - 案件创建
- ✅ 添加用户验证逻辑
- ✅ 添加软删除支持
- ✅ 修复类型枚举转换

#### 2. 案件详情API修复 (`src/app/api/v1/cases/[id]/route.ts`)
**改进内容：**
- ✅ 从mock数据改为真实数据库操作
- ✅ 实现GET /api/v1/cases/[id] - 获取案件详情（包含文档、辩论）
- ✅ 实现PUT /api/v1/cases/[id] - 更新案件信息
- ✅ 实现DELETE /api/v1/cases/[id] - 软删除案件
- ✅ 修复类型枚举转换

#### 3. 文档上传API修复 (`src/app/api/v1/documents/upload/route.ts`)
**改进内容：**
- ✅ 集成DocAnalyzer Agent自动触发文档分析
- ✅ 修复异步分析触发逻辑
- ✅ 修复TypeScript类型错误

#### 4. Validation Schema更新 (`src/app/api/lib/validation/schemas.ts`)
**改进内容：**
- ✅ 更新`createCaseSchema`添加完整字段
- ✅ 添加`caseQuerySchema`支持查询参数
- ✅ 修复类型枚举值匹配

#### 5. 前端配置修复
- ✅ 更新页面元数据

## 已验证的API实现状态

### ✅ 已完全实现的API

#### 1. 法条检索API (`src/app/api/v1/law-articles/search/route.ts`)
```typescript
POST /api/v1/law-articles/search
- 支持关键词搜索
- 支持分类过滤
- 支持分页
- 返回相关性评分
- 使用LawArticleSearchService
```

#### 2. 法条适用性分析API (`src/app/api/v1/legal-analysis/applicability/route.ts`)
```typescript
POST /api/v1/legal-analysis/applicability
- 接收caseId和articleIds
- 调用ApplicabilityAnalyzer分析适用性
- 存储分析结果到legal_references表
- 返回分析结果和评分
```

#### 3. 辩论创建API (`src/app/api/v1/debates/route.ts`)
```typescript
GET  /api/v1/debates  - 获取辩论列表
POST /api/v1/debates  - 创建辩论
- 验证案件存在
- 创建debate记录
- 创建初始round
- 返回完整辩论信息
```

#### 4. 辩论轮次API (`src/app/api/v1/debate-rounds/[roundId]/generate/route.ts`)
```typescript
POST /api/v1/debate-rounds/[roundId]/generate
- 获取案件分析数据
- 调用AI服务生成论点
- 创建argument记录
- 更新round状态
- 返回生成的论点
```

#### 5. 文档详情API (`src/app/api/v1/documents/[id]/route.ts`)
```typescript
GET    /api/v1/documents/[id] - 获取文档详情
DELETE /api/v1/documents/[id] - 删除文档
- 返回文档信息
- 包含分析状态和结果
- 支持物理文件删除
```

## 下一步建议

现在所有核心API都已修复，建议进行以下步骤：

1. **立即运行E2E测试**验证修复效果
2. **分析测试失败原因**（如果仍有失败）
3. **针对性修复测试问题**

## 测试验证计划

### 测试环境准备
```bash
# 1. 确保数据库运行
# 2. 初始化测试数据
npx tsx scripts/init-e2e-test-data.ts

# 3. 启动开发服务器
npm run dev
```

### 测试执行
```bash
# 运行所有E2E测试
cd src/__tests__/e2e
npx playwright test --reporter=list

# 运行特定测试文件
npx playwright test debate-flow/single-round.spec.ts

# 查看测试报告
npx playwright show-report
```

## 风险与缓解

| 风险 | 影响 | 概率 | 缓解措施 |
|-----|------|------|---------|
| 测试helper与API响应格式不匹配 | 高 | 中 | 检查并修复helper函数 |
| AI服务调用超时 | 中 | 中 | 测试时使用简化逻辑 |
| 测试数据污染 | 低 | 低 | 每次测试前清理数据 |

## 成功标准

### 短期目标（1-2天）
- [ ] 所有案件相关API测试通过
- [ ] E2E测试覆盖率达到60%
- [ ] 关键流程测试全部通过

### 中期目标（3-5天）
- [ ] 所有E2E测试通过
- [ ] E2E测试覆盖率达到90%
- [ ] 测试文档完善

## 附录

### A. 测试环境要求
- PostgreSQL数据库运行中
- 测试数据已初始化
- Next.js开发服务器运行在localhost:3000
- 环境变量正确配置

### B. API状态总结

| API路径 | HTTP方法 | 实现状态 | 数据源 |
|---------|---------|---------|--------|
| `/api/v1/cases` | GET | ✅ 已修复 | Prisma |
| `/api/v1/cases` | POST | ✅ 已修复 | Prisma |
| `/api/v1/cases/[id]` | GET | ✅ 已修复 | Prisma |
| `/api/v1/cases/[id]` | PUT | ✅ 已修复 | Prisma |
| `/api/v1/cases/[id]` | DELETE | ✅ 已修复 | Prisma |
| `/api/v1/documents/upload` | POST | ✅ 已实现 | Prisma + DocAnalyzer |
| `/api/v1/documents/[id]` | GET | ✅ 已实现 | Prisma |
| `/api/v1/law-articles/search` | POST | ✅ 已实现 | Prisma + SearchService |
| `/api/v1/legal-analysis/applicability` | POST | ✅ 已实现 | Prisma + AI |
| `/api/v1/debates` | GET | ✅ 已实现 | Prisma |
| `/api/v1/debates` | POST | ✅ 已实现 | Prisma |
| `/api/v1/debate-rounds/[id]/generate` | POST | ✅ 已实现 | Prisma + AI |

---

**文档版本：** 2.0（修正版）  
**最后更新：** 2024-12-30  
**负责人：** 开发团队

**重要说明：** 本文档在v1.0基础上进行了重大修正。之前的分析对API实现状态的判断有误，实际情况是大部分API都已正确实现，只有案件相关API存在mock数据问题。现已全部修复。
