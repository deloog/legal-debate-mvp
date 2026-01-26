# 律伴助手数据模型设计文档 v3.0

## 📋 文档信息

- **版本**: v3.0
- **创建日期**: 2024-12-18
- **最后更新**: 2026-01-01
- **基于**: Manus智能体架构增强
- **迁移名称**: `20260101000000_manus_enhancement`

## 🎯 设计目标

### v2.0 核心目标（已完成）

1. **完整的辩论系统支持** - 添加debates、debate_rounds、arguments等核心表 ✅
2. **灵活的扩展性** - 使用JSONB字段存储灵活业务数据 ✅
3. **软删除支持** - 所有核心表支持deletedAt软删除 ✅
4. **性能优化** - 合理的索引设计 ✅
5. **数据完整性** - 完善的外键约束和级联删除 ✅

### v3.0 新增目标（Manus增强）

6. **三层记忆架构** - 支持Working/Hot/Cold Memory管理
7. **统一验证层** - 实现事实准确性、逻辑一致性、任务完成度三重验证
8. **错误学习机制** - 保留错误记录，支持AI从错误中学习
9. **Agent行动空间** - 定义核心原子函数，支持分层行动空间
10. **准确性提升** - 数据模型支持准确率从88分提升到95分+的目标

## 📊 数据模型概览

### 核心实体关系（v3.0更新）

```
User (用户)
  ├── Case (案件) 1:N
  │   ├── Document (文档) 1:N
  │   ├── Debate (辩论) 1:N
  │   │   └── DebateRound (辩论轮次) 1:N
  │   │       └── Argument (论点) 1:N
  │   └── LegalReference (法律依据) 1:N
  ├── Account (第三方账号) 1:N
  ├── Session (会话) 1:N
  └── AgentMemory (Agent记忆) 1:N  ⭐ 新增

AIInteraction (AI交互记录) - 独立表
ErrorLog (错误日志) - 独立表  ⭐ 新增
VerificationResult (验证结果) - 独立表  ⭐ 新增
AgentAction (Agent行动) - 独立表  ⭐ 新增
```

### Manus架构映射

**PEV三层架构在数据模型中的体现**：

1. **Planning Layer（规划层）**
   - 数据支持：AgentAction表记录规划决策
   - 关联表：Case、Debate（存储规划目标）

2. **Execution Layer（执行层）**
   - 数据支持：AIInteraction表记录执行过程
   - 关联表：Document、Argument、LegalReference（存储执行结果）

3. **Verification Layer（验证层）**
   - 数据支持：VerificationResult表记录验证结果 ⭐ 新增
   - 关联表：所有核心业务表（支持质量验证）

**三层记忆架构在数据模型中的体现**：

1. **Working Memory（工作记忆）**
   - 存储：AgentMemory表（memoryType = 'WORKING'）
   - 特点：高频访问，短期保留（TTL: 1小时）

2. **Hot Memory（热记忆）**
   - 存储：AgentMemory表（memoryType = 'HOT'）
   - 特点：中频访问，中期保留（TTL: 7天）

3. **Cold Memory（冷记忆）**
   - 存储：AgentMemory表（memoryType = 'COLD'）
   - 特点：低频访问，长期保留（永久）

## 📁 数据表详细设计

### 1. 用户和认证模块

#### 1.1 User (用户表)

**表名**: `users`

**用途**: 存储用户基本信息和权限

**字段说明**:

| 字段           | 类型          | 说明                                  | 索引   |
| -------------- | ------------- | ------------------------------------- | ------ |
| id             | String (CUID) | 主键                                  | PK     |
| email          | String        | 邮箱（唯一）                          | Unique |
| username       | String?       | 用户名                                | -      |
| name           | String?       | 姓名                                  | -      |
| role           | UserRole      | 角色（USER/LAWYER/ADMIN/SUPER_ADMIN） | -      |
| permissions    | Json?         | 权限配置（JSONB）                     | -      |
| organizationId | String?       | 组织ID                                | Index  |
| createdAt      | DateTime      | 创建时间                              | -      |
| updatedAt      | DateTime      | 更新时间                              | -      |
| deletedAt      | DateTime?     | 软删除时间                            | -      |

**设计亮点**:

- ✅ 使用JSONB存储灵活的权限配置
- ✅ 支持组织架构（organizationId）
- ✅ 软删除支持

#### 1.2 Account (第三方账号表)

**表名**: `accounts`

**用途**: NextAuth.js第三方登录支持

**关键约束**:

- Unique: (provider, providerAccountId)
- Foreign Key: userId → users.id (Cascade Delete)

#### 1.3 Session (会话表)

**表名**: `sessions`

**用途**: 用户会话管理

**关键约束**:

- Unique: sessionToken
- Foreign Key: userId → users.id (Cascade Delete)

---

### 2. 案件管理模块

#### 2.1 Case (案件表)

**表名**: `cases`

**用途**: 存储案件基本信息

**字段说明**:

| 字段        | 类型          | 说明              | 索引  |
| ----------- | ------------- | ----------------- | ----- |
| id          | String (CUID) | 主键              | PK    |
| userId      | String        | 用户ID            | Index |
| title       | String        | 案件标题          | -     |
| description | Text          | 案件描述          | -     |
| type        | CaseType      | 案件类型          | Index |
| status      | CaseStatus    | 案件状态          | Index |
| metadata    | Json?         | 扩展数据（JSONB） | -     |
| createdAt   | DateTime      | 创建时间          | Index |
| updatedAt   | DateTime      | 更新时间          | -     |
| deletedAt   | DateTime?     | 软删除时间        | -     |

**metadata字段示例**:

```json
{
  "parties": {
    "plaintiff": "张三",
    "defendant": "李四"
  },
  "caseNumber": "（2024）京0105民初12345号",
  "amount": 100000,
  "court": "北京市朝阳区人民法院",
  "customFields": {}
}
```

**设计亮点**:

- ✅ 使用metadata JSONB存储灵活业务数据
- ✅ 多维度索引（userId, status, type, createdAt）
- ✅ 软删除支持

---

### 3. 文档管理模块

#### 3.1 Document (文档表)

**表名**: `documents`

**用途**: 存储案件相关文档

**字段说明**:

| 字段           | 类型           | 说明                      | 索引  |
| -------------- | -------------- | ------------------------- | ----- |
| id             | String (CUID)  | 主键                      | PK    |
| caseId         | String         | 案件ID                    | Index |
| userId         | String         | 用户ID                    | Index |
| filename       | String         | 文件名                    | -     |
| filePath       | String         | 存储路径                  | -     |
| fileType       | String         | 文件类型（PDF/DOCX等）    | -     |
| fileSize       | Int            | 文件大小（字节）          | -     |
| mimeType       | String         | MIME类型                  | -     |
| extractedData  | Json?          | 提取的结构化数据（JSONB） | -     |
| analysisStatus | AnalysisStatus | 解析状态                  | Index |
| analysisResult | Json?          | AI解析结果（JSONB）       | -     |
| analysisError  | String?        | 解析错误信息              | -     |
| createdAt      | DateTime       | 创建时间                  | -     |
| updatedAt      | DateTime       | 更新时间                  | -     |
| deletedAt      | DateTime?      | 软删除时间                | -     |

**extractedData字段示例**:

```json
{
  "parties": ["张三", "李四"],
  "caseType": "合同纠纷",
  "claims": ["支付货款100000元", "支付违约金20000元"],
  "facts": ["2024年1月签订合同", "2024年6月违约"],
  "keyDates": ["2024-01-15", "2024-06-20"]
}
```

**设计亮点**:

- ✅ 完整的文件元数据
- ✅ AI解析结果存储（JSONB）
- ✅ 解析状态追踪

---

### 4. 辩论系统模块 ⭐ 核心特色

#### 4.1 Debate (辩论表)

**表名**: `debates`

**用途**: 存储辩论会话信息

**字段说明**:

| 字段         | 类型          | 说明              | 索引  |
| ------------ | ------------- | ----------------- | ----- |
| id           | String (CUID) | 主键              | PK    |
| caseId       | String        | 案件ID            | Index |
| userId       | String        | 用户ID            | Index |
| title        | String        | 辩论标题          | -     |
| status       | DebateStatus  | 辩论状态          | Index |
| currentRound | Int           | 当前轮次          | -     |
| debateConfig | Json?         | 辩论配置（JSONB） | -     |
| createdAt    | DateTime      | 创建时间          | Index |
| updatedAt    | DateTime      | 更新时间          | -     |
| deletedAt    | DateTime?     | 软删除时间        | -     |

**debateConfig字段示例**:

```json
{
  "mode": "adversarial",
  "maxRounds": 5,
  "aiConfig": {
    "plaintiff": {
      "provider": "deepseek",
      "model": "deepseek-chat",
      "temperature": 0.7
    },
    "defendant": {
      "provider": "zhipu",
      "model": "glm-4-flash",
      "temperature": 0.7
    }
  },
  "autoAdvance": false
}
```

**设计亮点**:

- ✅ 灵活的辩论配置（JSONB）
- ✅ 支持多种辩论模式
- ✅ 轮次追踪

#### 4.2 DebateRound (辩论轮次表)

**表名**: `debate_rounds`

**用途**: 存储每轮辩论信息

**字段说明**:

| 字段        | 类型          | 说明     | 索引  |
| ----------- | ------------- | -------- | ----- |
| id          | String (CUID) | 主键     | PK    |
| debateId    | String        | 辩论ID   | Index |
| roundNumber | Int           | 轮次编号 | -     |
| status      | RoundStatus   | 轮次状态 | Index |
| startedAt   | DateTime?     | 开始时间 | -     |
| completedAt | DateTime?     | 完成时间 | -     |
| createdAt   | DateTime      | 创建时间 | -     |
| updatedAt   | DateTime      | 更新时间 | -     |

**关键约束**:

- Unique: (debateId, roundNumber) - 确保轮次唯一性

**设计亮点**:

- ✅ 时间追踪（开始/完成）
- ✅ 轮次唯一性约束

#### 4.3 Argument (论点表)

**表名**: `arguments`

**用途**: 存储辩论论点

**字段说明**:

| 字段           | 类型          | 说明                                  | 索引  |
| -------------- | ------------- | ------------------------------------- | ----- |
| id             | String (CUID) | 主键                                  | PK    |
| roundId        | String        | 轮次ID                                | Index |
| side           | ArgumentSide  | 论点方（PLAINTIFF/DEFENDANT/NEUTRAL） | Index |
| content        | Text          | 论点内容                              | -     |
| type           | ArgumentType  | 论点类型                              | -     |
| aiProvider     | String?       | AI提供商                              | -     |
| generationTime | Int?          | 生成耗时（ms）                        | -     |
| confidence     | Float?        | AI置信度                              | -     |
| createdAt      | DateTime      | 创建时间                              | -     |
| updatedAt      | DateTime      | 更新时间                              | -     |

**ArgumentType枚举**:

- MAIN_POINT: 主要论点
- SUPPORTING: 支持论据
- REBUTTAL: 反驳论点
- EVIDENCE: 证据引用
- LEGAL_BASIS: 法律依据
- CONCLUSION: 结论

**设计亮点**:

- ✅ 详细的AI生成信息
- ✅ 论点类型分类
- ✅ 性能指标记录

---

### 5. 法律依据模块

#### 5.1 LawArticle (法条表) ⭐ 新增

**表名**: `law_articles`

**用途**: 本地法条存储，支持分类、标签和版本管理

**字段说明**:

| 字段             | 类型          | 说明                 | 索引  |
| ---------------- | ------------- | -------------------- | ----- |
| id               | String (CUID) | 主键                 | PK    |
| lawName          | String        | 法律名称             | Index |
| articleNumber    | String        | 条款号               | Index |
| fullText         | Text          | 法条全文             | -     |
| lawType          | LawType       | 法律类型（枚举）     | Index |
| category         | LawCategory   | 法律分类（枚举）     | Index |
| subCategory      | String?       | 子分类               | -     |
| tags             | String[]      | 标签数组             | Index |
| keywords         | String[]      | 关键词数组           | -     |
| version          | String        | 版本号（默认1.0）    | -     |
| effectiveDate    | DateTime      | 生效日期             | Index |
| expiryDate       | DateTime?     | 失效日期             | -     |
| status           | LawStatus     | 法律状态（枚举）     | Index |
| amendmentHistory | Json?         | 修订历史（JSONB）    | -     |
| parentId         | String?       | 父法条ID（层级关系） | -     |
| chapterNumber    | String?       | 章号                 | -     |
| sectionNumber    | String?       | 节号                 | -     |
| level            | Int           | 层级深度（默认0）    | -     |
| issuingAuthority | String        | 制定机关             | -     |
| jurisdiction     | String?       | 管辖范围             | -     |
| relatedArticles  | String[]      | 关联法条ID数组       | -     |
| legalBasis       | String?       | 法律依据             | -     |
| searchableText   | Text          | 搜索文本             | -     |
| viewCount        | Int           | 浏览次数（默认0）    | Index |
| referenceCount   | Int           | 引用次数（默认0）    | Index |
| createdAt        | DateTime      | 创建时间             | -     |
| updatedAt        | DateTime      | 更新时间             | -     |

**枚举类型**:

```prisma
enum LawType {
  CONSTITUTION              // 宪法
  LAW                      // 法律
  ADMINISTRATIVE_REGULATION // 行政法规
  LOCAL_REGULATION         // 地方性法规
  JUDICIAL_INTERPRETATION  // 司法解释
  DEPARTMENTAL_RULE        // 部门规章
  OTHER                   // 其他
}

enum LawCategory {
  CIVIL              // 民法
  CRIMINAL           // 刑法
  ADMINISTRATIVE     // 行政法
  COMMERCIAL         // 商法
  ECONOMIC          // 经济法
  LABOR             // 劳动法
  INTELLECTUAL_PROPERTY // 知识产权法
  PROCEDURE         // 程序法
  OTHER            // 其他
}

enum LawStatus {
  DRAFT    // 草案
  VALID    // 有效
  AMENDED  // 已修订
  REPEALED // 已废止
  EXPIRED  // 已过期
}
```

**amendmentHistory字段示例**:

```json
{
  "version": "2.0",
  "amendedDate": "2023-01-01",
  "changes": [
    {
      "date": "2023-01-01",
      "description": "修改了第一条",
      "oldContent": "...",
      "newContent": "..."
    },
    {
      "date": "2022-06-01",
      "description": "增加了第二条",
      "content": "..."
    }
  ]
}
```

**在辩论流程中的作用**:

1. **法条检索阶段**：
   - 根据案情分析结果，生成检索关键词
   - 使用searchableText字段进行全文检索
   - 使用tags字段进行标签匹配
   - 使用category字段进行分类筛选
   - 支持模糊匹配和精确查询

2. **检索优化**：
   - lawName索引：支持按法律名称快速查询
   - articleNumber索引：支持按条款号精确匹配
   - tags索引：支持标签数组查询
   - category索引：支持按法律分类筛选
   - viewCount/referenceCount索引：支持热门法条排序

3. **适用性分析**：
   - effectiveDate字段：检查法条时效性
   - status字段：过滤无效法条
   - version字段：使用最新版本
   - amendmentHistory字段：追溯历史变更

4. **检索示例**：

```typescript
// 案情：房屋买卖合同纠纷
const articles = await prisma.lawArticle.findMany({
  where: {
    OR: [
      { searchableText: { contains: '合同' } },
      { tags: { has: '违约责任' } },
      { tags: { has: '买卖合同' } },
    ],
    category: LawCategory.CIVIL,
    status: LawStatus.VALID,
    effectiveDate: { lte: new Date() },
  },
  orderBy: [{ referenceCount: 'desc' }, { viewCount: 'desc' }],
  take: 20,
});
```

**设计亮点**:

- ✅ 支持全文存储
- ✅ 灵活的分类和标签系统
- ✅ 完整的版本管理
- ✅ 支持层级关系（章-节-条）
- ✅ 多维度索引优化检索性能
- ✅ 统计追踪（浏览次数、引用次数）
- ✅ 支持完整辩论流程（检索→适用性分析→辩论生成）

**迁移名称**: `20251227032442_add_law_articles_table`

---

#### 5.2 LegalReference (法律依据表)

**表名**: `legal_references`

**用途**: 存储法律条文和案例

**字段说明**:

| 字段           | 类型          | 说明            | 索引  |
| -------------- | ------------- | --------------- | ----- |
| id             | String (CUID) | 主键            | PK    |
| caseId         | String?       | 案件ID（可选）  | Index |
| source         | String        | 法律名称        | -     |
| content        | Text          | 法条内容        | -     |
| lawType        | String?       | 法律类型        | Index |
| articleNumber  | String?       | 条款号          | -     |
| retrievalQuery | String?       | 检索关键词      | -     |
| relevanceScore | Float?        | 相关性评分      | Index |
| metadata       | Json?         | 元数据（JSONB） | -     |
| createdAt      | DateTime      | 创建时间        | -     |
| updatedAt      | DateTime      | 更新时间        | -     |

**metadata字段示例**:

```json
{
  "effectiveDate": "2021-01-01",
  "version": "2020修订",
  "category": "合同法",
  "tags": ["违约责任", "损害赔偿"]
}
```

**设计亮点**:

- ✅ 支持独立法条库（caseId可选）
- ✅ 相关性评分索引
- ✅ 灵活的元数据存储

---

### 6. AI交互记录模块

#### 6.1 AIInteraction (AI交互记录表)

**表名**: `ai_interactions`

**用途**: 记录所有AI服务调用

**字段说明**:

| 字段       | 类型          | 说明              | 索引  |
| ---------- | ------------- | ----------------- | ----- |
| id         | String (CUID) | 主键              | PK    |
| type       | String        | 交互类型          | Index |
| provider   | String        | AI提供商          | Index |
| model      | String?       | 模型名称          | -     |
| request    | Json          | 请求数据（JSONB） | -     |
| response   | Json?         | 响应数据（JSONB） | -     |
| tokensUsed | Int?          | Token消耗         | -     |
| duration   | Int?          | 响应时间（ms）    | -     |
| cost       | Float?        | 成本（元）        | -     |
| success    | Boolean       | 是否成功          | Index |
| error      | String?       | 错误信息          | -     |
| createdAt  | DateTime      | 创建时间          | Index |

**type类型示例**:

- `document_analysis`: 文档解析
- `debate_generation`: 辩论生成
- `legal_search`: 法律检索
- `argument_generation`: 论点生成

**设计亮点**:

- ✅ 完整的性能指标
- ✅ 成本追踪
- ✅ 多维度索引（type, provider, success, createdAt）

---

## 🔍 索引策略

### 高频查询索引

```sql
-- 用户相关
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_organization ON users(organizationId);

-- 案件相关
CREATE INDEX idx_cases_user ON cases(userId);
CREATE INDEX idx_cases_status ON cases(status);
CREATE INDEX idx_cases_type ON cases(type);
CREATE INDEX idx_cases_created ON cases(createdAt);

-- 文档相关
CREATE INDEX idx_documents_case ON documents(caseId);
CREATE INDEX idx_documents_user ON documents(userId);
CREATE INDEX idx_documents_status ON documents(analysisStatus);

-- 辩论相关
CREATE INDEX idx_debates_case ON debates(caseId);
CREATE INDEX idx_debates_user ON debates(userId);
CREATE INDEX idx_debates_status ON debates(status);
CREATE INDEX idx_debates_created ON debates(createdAt);

CREATE INDEX idx_rounds_debate ON debate_rounds(debateId);
CREATE INDEX idx_rounds_status ON debate_rounds(status);

CREATE INDEX idx_arguments_round ON arguments(roundId);
CREATE INDEX idx_arguments_side ON arguments(side);

-- 法律依据相关
CREATE INDEX idx_legal_case ON legal_references(caseId);
CREATE INDEX idx_legal_type ON legal_references(lawType);
CREATE INDEX idx_legal_score ON legal_references(relevanceScore);

-- 法条相关（新增）
CREATE INDEX idx_law_articles_type ON law_articles(lawType);
CREATE INDEX idx_law_articles_category ON law_articles(category);
CREATE INDEX idx_law_articles_status ON law_articles(status);
CREATE INDEX idx_law_articles_effective ON law_articles(effectiveDate);
CREATE INDEX idx_law_articles_name ON law_articles(lawName);
CREATE INDEX idx_law_articles_number ON law_articles(articleNumber);
CREATE INDEX idx_law_articles_tags ON law_articles(tags);
CREATE INDEX idx_law_articles_view ON law_articles(viewCount);
CREATE INDEX idx_law_articles_ref ON law_articles(referenceCount);

-- AI交互相关
CREATE INDEX idx_ai_type ON ai_interactions(type);
CREATE INDEX idx_ai_provider ON ai_interactions(provider);
CREATE INDEX idx_ai_success ON ai_interactions(success);
CREATE INDEX idx_ai_created ON ai_interactions(createdAt);
```

---

## 🔐 数据完整性

### 外键约束

所有关系都使用外键约束，确保数据完整性：

```prisma
// 级联删除示例
user User @relation(fields: [userId], references: [id], onDelete: Cascade)
case Case @relation(fields: [caseId], references: [id], onDelete: Cascade)
```

### 唯一性约束

```prisma
// 用户邮箱唯一
email String @unique

// 第三方账号唯一
@@unique([provider, providerAccountId])

// 会话令牌唯一
sessionToken String @unique

// 辩论轮次唯一
@@unique([debateId, roundNumber])
```

---

## 📈 性能优化建议

### 1. JSONB字段优化

```sql
-- 为常用的JSONB查询创建GIN索引
CREATE INDEX idx_case_metadata_gin ON cases USING GIN (metadata);
CREATE INDEX idx_document_extracted_gin ON documents USING GIN (extractedData);
```

### 2. 分区策略（未来）

对于大数据量表，考虑按时间分区：

```sql
-- AI交互记录按月分区
CREATE TABLE ai_interactions_2024_12 PARTITION OF ai_interactions
FOR VALUES FROM ('2024-12-01') TO ('2025-01-01');
```

### 3. 查询优化

```sql
-- 使用EXPLAIN ANALYZE分析慢查询
EXPLAIN ANALYZE SELECT * FROM debates WHERE userId = 'xxx' AND status = 'IN_PROGRESS';
```

---

---

## 🆕 Manus增强模块（v3.0新增）

### 7. Agent记忆管理模块 ⭐ 核心增强

#### 7.1 AgentMemory (Agent记忆表)

**表名**: `agent_memories`

**用途**: 实现Manus的三层记忆架构（Working/Hot/Cold Memory）

**字段说明**:

| 字段             | 类型          | 说明                         | 索引  |
| ---------------- | ------------- | ---------------------------- | ----- |
| id               | String (CUID) | 主键                         | PK    |
| userId           | String        | 用户ID                       | Index |
| caseId           | String?       | 案件ID（可选）               | Index |
| debateId         | String?       | 辩论ID（可选）               | Index |
| memoryType       | MemoryType    | 记忆类型（WORKING/HOT/COLD） | Index |
| agentName        | String        | Agent名称                    | Index |
| memoryKey        | String        | 记忆键（唯一标识）           | Index |
| memoryValue      | Json          | 记忆内容（JSONB）            | -     |
| importance       | Float         | 重要性评分（0-1）            | Index |
| accessCount      | Int           | 访问次数（默认0）            | Index |
| lastAccessedAt   | DateTime?     | 最后访问时间                 | Index |
| expiresAt        | DateTime?     | 过期时间                     | Index |
| compressed       | Boolean       | 是否已压缩（默认false）      | -     |
| compressionRatio | Float?        | 压缩比例                     | -     |
| metadata         | Json?         | 元数据（JSONB）              | -     |
| createdAt        | DateTime      | 创建时间                     | -     |
| updatedAt        | DateTime      | 更新时间                     | -     |

**MemoryType枚举**:

```prisma
enum MemoryType {
  WORKING  // 工作记忆：当前任务上下文，TTL 1小时
  HOT      // 热记忆：近期任务经验，TTL 7天
  COLD     // 冷记忆：长期知识库，永久保留
}
```

**memoryValue字段示例**:

```json
{
  "type": "case_analysis",
  "content": {
    "parties": ["张三", "李四"],
    "claims": ["支付货款100000元"],
    "keyFacts": ["2024年1月签订合同"],
    "legalIssues": ["违约责任"]
  },
  "context": {
    "taskId": "task_123",
    "stepNumber": 3,
    "dependencies": ["task_121", "task_122"]
  },
  "compressed": false
}
```

**metadata字段示例**:

```json
{
  "source": "DocAnalyzer",
  "confidence": 0.92,
  "relatedMemories": ["mem_456", "mem_789"],
  "compressionHistory": [
    {
      "timestamp": "2026-01-01T10:00:00Z",
      "originalSize": 5000,
      "compressedSize": 1000,
      "method": "summarization"
    }
  ]
}
```

**设计亮点**:

- ✅ 支持三层记忆架构（Working/Hot/Cold）
- ✅ 自动过期机制（expiresAt字段）
- ✅ 访问频率追踪（accessCount、lastAccessedAt）
- ✅ 重要性评分（importance字段）
- ✅ 压缩支持（compressed、compressionRatio）
- ✅ 灵活的关联（caseId、debateId可选）

**索引策略**:

```sql
CREATE INDEX idx_memories_user ON agent_memories(userId);
CREATE INDEX idx_memories_case ON agent_memories(caseId);
CREATE INDEX idx_memories_debate ON agent_memories(debateId);
CREATE INDEX idx_memories_type ON agent_memories(memoryType);
CREATE INDEX idx_memories_agent ON agent_memories(agentName);
CREATE INDEX idx_memories_key ON agent_memories(memoryKey);
CREATE INDEX idx_memories_importance ON agent_memories(importance);
CREATE INDEX idx_memories_access_count ON agent_memories(accessCount);
CREATE INDEX idx_memories_last_accessed ON agent_memories(lastAccessedAt);
CREATE INDEX idx_memories_expires ON agent_memories(expiresAt);
```

---

### 8. 验证层模块 ⭐ 核心增强

#### 8.1 VerificationResult (验证结果表)

**表名**: `verification_results`

**用途**: 实现Manus的三重验证机制（事实准确性+逻辑一致性+任务完成度）

**字段说明**:

| 字段               | 类型             | 说明                                   | 索引  |
| ------------------ | ---------------- | -------------------------------------- | ----- |
| id                 | String (CUID)    | 主键                                   | PK    |
| entityType         | String           | 实体类型（Document/Argument/Debate等） | Index |
| entityId           | String           | 实体ID                                 | Index |
| verificationType   | VerificationType | 验证类型                               | Index |
| overallScore       | Float            | 综合评分（0-1）                        | Index |
| factualAccuracy    | Float?           | 事实准确性评分（0-1）                  | -     |
| logicalConsistency | Float?           | 逻辑一致性评分（0-1）                  | -     |
| taskCompleteness   | Float?           | 任务完成度评分（0-1）                  | -     |
| passed             | Boolean          | 是否通过验证                           | Index |
| issues             | Json?            | 发现的问题（JSONB数组）                | -     |
| suggestions        | Json?            | 改进建议（JSONB数组）                  | -     |
| verifiedBy         | String           | 验证者（AI/RULE/HUMAN）                | -     |
| verificationTime   | Int              | 验证耗时（ms）                         | -     |
| metadata           | Json?            | 元数据（JSONB）                        | -     |
| createdAt          | DateTime         | 创建时间                               | Index |
| updatedAt          | DateTime         | 更新时间                               | -     |

**VerificationType枚举**:

```prisma
enum VerificationType {
  FACTUAL      // 事实准确性验证
  LOGICAL      // 逻辑一致性验证
  COMPLETENESS // 任务完成度验证
  COMPREHENSIVE // 综合验证（三重验证）
}
```

**issues字段示例**:

```json
[
  {
    "type": "factual_error",
    "severity": "high",
    "description": "当事人姓名与文档不一致",
    "location": "parties.plaintiff",
    "expected": "张三",
    "actual": "张四"
  },
  {
    "type": "logical_inconsistency",
    "severity": "medium",
    "description": "诉讼请求与事实理由不匹配",
    "details": "请求支付违约金，但未提及违约事实"
  }
]
```

**suggestions字段示例**:

```json
[
  {
    "priority": "high",
    "action": "correct_party_name",
    "description": "修正原告姓名为'张三'",
    "estimatedImpact": 0.15
  },
  {
    "priority": "medium",
    "action": "add_breach_facts",
    "description": "补充违约事实描述",
    "estimatedImpact": 0.1
  }
]
```

**设计亮点**:

- ✅ 支持三重验证机制（Manus核心特性）
- ✅ 详细的问题追踪（issues数组）
- ✅ 可执行的改进建议（suggestions数组）
- ✅ 多维度评分（事实、逻辑、完成度）
- ✅ 验证者追踪（AI/规则/人工）
- ✅ 性能指标（verificationTime）

---

### 9. 错误学习模块 ⭐ 核心增强

#### 9.1 ErrorLog (错误日志表)

**表名**: `error_logs`

**用途**: 实现Manus的错误学习机制，保留错误内容供AI学习

**字段说明**:

| 字段             | 类型          | 说明                    | 索引  |
| ---------------- | ------------- | ----------------------- | ----- |
| id               | String (CUID) | 主键                    | PK    |
| userId           | String?       | 用户ID（可选）          | Index |
| caseId           | String?       | 案件ID（可选）          | Index |
| errorType        | ErrorType     | 错误类型                | Index |
| errorCode        | String        | 错误代码                | Index |
| errorMessage     | Text          | 错误信息                | -     |
| stackTrace       | Text?         | 堆栈跟踪                | -     |
| context          | Json          | 错误上下文（JSONB）     | -     |
| attemptedAction  | Json?         | 尝试的操作（JSONB）     | -     |
| recoveryAttempts | Int           | 恢复尝试次数（默认0）   | -     |
| recovered        | Boolean       | 是否已恢复（默认false） | Index |
| recoveryMethod   | String?       | 恢复方法                | -     |
| recoveryTime     | Int?          | 恢复耗时（ms）          | -     |
| learned          | Boolean       | 是否已学习（默认false） | Index |
| learningNotes    | Text?         | 学习笔记                | -     |
| severity         | ErrorSeverity | 严重程度                | Index |
| metadata         | Json?         | 元数据（JSONB）         | -     |
| createdAt        | DateTime      | 创建时间                | Index |
| updatedAt        | DateTime      | 更新时间                | -     |

**ErrorType枚举**:

```prisma
enum ErrorType {
  AI_SERVICE_ERROR      // AI服务错误
  PARSING_ERROR         // 解析错误
  VALIDATION_ERROR      // 验证错误
  LOGIC_ERROR          // 逻辑错误
  DATA_INCONSISTENCY   // 数据不一致
  TIMEOUT_ERROR        // 超时错误
  NETWORK_ERROR        // 网络错误
  UNKNOWN_ERROR        // 未知错误
}

enum ErrorSeverity {
  LOW      // 低：不影响核心功能
  MEDIUM   // 中：影响部分功能
  HIGH     // 高：影响核心功能
  CRITICAL // 严重：系统无法运行
}
```

**context字段示例**:

```json
{
  "agentName": "DocAnalyzer",
  "taskId": "task_123",
  "inputData": {
    "documentId": "doc_456",
    "filename": "contract.pdf"
  },
  "expectedOutput": "structured_case_data",
  "actualOutput": null,
  "timestamp": "2026-01-01T10:30:00Z"
}
```

**attemptedAction字段示例**:

```json
{
  "action": "parse_document",
  "parameters": {
    "documentId": "doc_456",
    "extractionMode": "full"
  },
  "aiProvider": "zhipu",
  "model": "glm-4-flash",
  "retryCount": 2
}
```

**设计亮点**:

- ✅ 保留完整错误信息（Manus核心理念）
- ✅ 恢复尝试追踪（recoveryAttempts、recovered）
- ✅ 学习状态标记（learned、learningNotes）
- ✅ 严重程度分级（severity）
- ✅ 详细的上下文记录（context、attemptedAction）
- ✅ 支持错误模式分析（通过errorType、errorCode聚合）

---

### 10. Agent行动空间模块 ⭐ 核心增强

#### 10.1 AgentAction (Agent行动表)

**表名**: `agent_actions`

**用途**: 实现Manus的分层行动空间设计，记录Agent执行的所有操作

**字段说明**:

| 字段           | 类型          | 说明                   | 索引  |
| -------------- | ------------- | ---------------------- | ----- |
| id             | String (CUID) | 主键                   | PK    |
| userId         | String?       | 用户ID（可选）         | Index |
| caseId         | String?       | 案件ID（可选）         | Index |
| debateId       | String?       | 辩论ID（可选）         | Index |
| agentName      | String        | Agent名称              | Index |
| actionType     | ActionType    | 行动类型               | Index |
| actionName     | String        | 行动名称               | Index |
| actionLayer    | ActionLayer   | 行动层级               | Index |
| parameters     | Json          | 行动参数（JSONB）      | -     |
| result         | Json?         | 执行结果（JSONB）      | -     |
| status         | ActionStatus  | 执行状态               | Index |
| executionTime  | Int?          | 执行耗时（ms）         | -     |
| retryCount     | Int           | 重试次数（默认0）      | -     |
| parentActionId | String?       | 父行动ID（支持行动链） | Index |
| childActions   | String[]      | 子行动ID数组           | -     |
| metadata       | Json?         | 元数据（JSONB）        | -     |
| createdAt      | DateTime      | 创建时间               | Index |
| updatedAt      | DateTime      | 更新时间               | -     |

**ActionType枚举**:

```prisma
enum ActionType {
  ANALYZE      // 分析类操作
  RETRIEVE     // 检索类操作
  GENERATE     // 生成类操作
  VERIFY       // 验证类操作
  TRANSFORM    // 转换类操作
  COMMUNICATE  // 通信类操作
}

enum ActionLayer {
  CORE         // 核心原子函数层（<20个基础操作）
  UTILITY      // 沙盒实用程序层（组合操作）
  SCRIPT       // 脚本与API层（复杂计算）
}

enum ActionStatus {
  PENDING      // 待执行
  RUNNING      // 执行中
  COMPLETED    // 已完成
  FAILED       // 失败
  RETRYING     // 重试中
  CANCELLED    // 已取消
}
```

**parameters字段示例**:

```json
{
  "documentId": "doc_456",
  "extractionMode": "full",
  "aiConfig": {
    "provider": "zhipu",
    "model": "glm-4-flash",
    "temperature": 0.1
  }
}
```

**result字段示例**:

```json
{
  "success": true,
  "data": {
    "parties": ["张三", "李四"],
    "claims": ["支付货款100000元"],
    "confidence": 0.92
  },
  "metrics": {
    "tokensUsed": 1500,
    "cost": 0.003,
    "accuracy": 0.92
  }
}
```

**设计亮点**:

- ✅ 支持分层行动空间（Core/Utility/Script）
- ✅ 行动链追踪（parentActionId、childActions）
- ✅ 重试机制支持（retryCount、status）
- ✅ 性能指标记录（executionTime）
- ✅ 详细的参数和结果记录
- ✅ 支持行动模式分析（通过actionType、actionName聚合）

---

## 🔄 迁移历史

### v3.0 (2026-01-01) ⭐ Manus增强

**迁移名称**: `20260101000000_manus_enhancement`

**主要变更**:

1. ✅ 新增agent_memories表（三层记忆架构）
2. ✅ 新增verification_results表（统一验证层）
3. ✅ 新增error_logs表（错误学习机制）
4. ✅ 新增agent_actions表（行动空间管理）
5. ✅ 新增枚举类型：MemoryType、VerificationType、ErrorType、ErrorSeverity、ActionType、ActionLayer、ActionStatus
6. ✅ 优化索引策略（新增40+个索引）
7. ✅ 支持准确性提升目标（88分→95分+）

**设计理念**:

- 借鉴Manus的PEV三层架构
- 实现三层记忆管理（Working/Hot/Cold）
- 建立统一验证层（事实+逻辑+完成度）
- 支持错误学习和自动恢复
- 定义分层行动空间

**预期效果**:

- 准确性提升：88分 → 95分+
- 错误恢复率：0% → 90%+
- AI成本降低：40-60%
- 系统稳定性提升：30%+

---

### v2.1 (2024-12-27)

**迁移名称**: `20251227032442_add_law_articles_table`

**主要变更**:

1. ✅ 添加法条表（law_articles）
2. ✅ 新增枚举类型：LawType、LawCategory、LawStatus
3. ✅ 支持法条全文存储
4. ✅ 支持分类和标签
5. ✅ 支持版本管理
6. ✅ 支持层级关系
7. ✅ 优化检索性能索引
8. ✅ 测试覆盖：表结构验证（28个测试用例）、索引性能测试（17个测试用例）

---

### v2.0 (2024-12-18)

**迁移名称**: `20251218093212_debate_system_complete_model`

**主要变更**:

1. ✅ 添加完整的辩论系统表（debates, debate_rounds, arguments）
2. ✅ 重构案件管理表（cases）
3. ✅ 优化文档管理表（documents）
4. ✅ 添加法律依据表（legal_references）
5. ✅ 优化AI交互记录表（ai_interactions）
6. ✅ 所有核心表支持软删除
7. ✅ 添加JSONB字段支持灵活扩展
8. ✅ 优化索引策略

**删除的表**:

- analyses（功能合并到documents）
- chat_messages（功能合并到debates）

---

## 📚 使用示例

### 创建案件和辩论

```typescript
import { prisma } from '@/lib/db/prisma';

// 创建案件
const case = await prisma.case.create({
  data: {
    userId: 'user_123',
    title: '房屋买卖合同纠纷',
    description: '买方违约拒绝支付尾款',
    type: 'CIVIL',
    status: 'ACTIVE',
    metadata: {
      parties: {
        plaintiff: '张三',
        defendant: '李四'
      },
      amount: 500000
    }
  }
});

// 创建辩论
const debate = await prisma.debate.create({
  data: {
    caseId: case.id,
    userId: 'user_123',
    title: '违约责任辩论',
    status: 'IN_PROGRESS',
    debateConfig: {
      mode: 'adversarial',
      maxRounds: 3
    }
  }
});

// 创建辩论轮次
const round = await prisma.debateRound.create({
  data: {
    debateId: debate.id,
    roundNumber: 1,
    status: 'IN_PROGRESS',
    startedAt: new Date()
  }
});

// 添加论点
await prisma.argument.create({
  data: {
    roundId: round.id,
    side: 'PLAINTIFF',
    content: '根据合同约定，被告应在2024年6月30日前支付尾款...',
    type: 'MAIN_POINT',
    aiProvider: 'deepseek',
    generationTime: 1500,
    confidence: 0.85
  }
});
```

### 创建法条

```typescript
import { prisma } from '@/lib/db/prisma';
import { LawType, LawCategory, LawStatus } from '@prisma/client';

// 创建法条
const article = await prisma.lawArticle.create({
  data: {
    lawName: '中华人民共和国民法典',
    articleNumber: '第一百八十八条',
    fullText: '民事主体从事民事活动，应当遵循诚信原则，秉持诚实，恪守承诺。',
    lawType: LawType.LAW,
    category: LawCategory.CIVIL,
    subCategory: '总则编',
    tags: ['诚信原则', '民事活动'],
    keywords: ['诚信', '承诺', '诚实'],
    version: '1.0',
    effectiveDate: new Date('2021-01-01'),
    status: LawStatus.VALID,
    issuingAuthority: '全国人民代表大会',
    jurisdiction: '全国',
    chapterNumber: '第一章',
    sectionNumber: '第一节',
    level: 0,
    searchableText: '民事主体从事民事活动应当遵循诚信原则秉持诚实恪守承诺',
  },
});

// 创建子法条
const childArticle = await prisma.lawArticle.create({
  data: {
    lawName: '中华人民共和国民法典',
    articleNumber: '第一百八十九条',
    fullText: '本条第一款所称重大过失，是指行为人因疏忽大意...',
    lawType: LawType.LAW,
    category: LawCategory.CIVIL,
    tags: ['重大过失'],
    keywords: ['重大过失', '疏忽大意'],
    version: '1.0',
    effectiveDate: new Date('2021-01-01'),
    status: LawStatus.VALID,
    issuingAuthority: '全国人民代表大会',
    parentId: article.id,
    level: 1,
    searchableText: '本条第一款所称重大过失是指行为人因疏忽大意',
  },
});

// 查询法条
const articles = await prisma.lawArticle.findMany({
  where: {
    lawType: LawType.LAW,
    category: LawCategory.CIVIL,
    status: LawStatus.VALID,
    tags: { has: '诚信原则' },
  },
  orderBy: { effectiveDate: 'desc' },
  take: 50,
});
```

---

## 🔍 v3.0 新增索引策略

### Manus增强模块索引

```sql
-- Agent记忆相关
CREATE INDEX idx_memories_user ON agent_memories(userId);
CREATE INDEX idx_memories_case ON agent_memories(caseId);
CREATE INDEX idx_memories_debate ON agent_memories(debateId);
CREATE INDEX idx_memories_type ON agent_memories(memoryType);
CREATE INDEX idx_memories_agent ON agent_memories(agentName);
CREATE INDEX idx_memories_key ON agent_memories(memoryKey);
CREATE INDEX idx_memories_importance ON agent_memories(importance);
CREATE INDEX idx_memories_access_count ON agent_memories(accessCount);
CREATE INDEX idx_memories_last_accessed ON agent_memories(lastAccessedAt);
CREATE INDEX idx_memories_expires ON agent_memories(expiresAt);

-- 验证结果相关
CREATE INDEX idx_verification_entity_type ON verification_results(entityType);
CREATE INDEX idx_verification_entity_id ON verification_results(entityId);
CREATE INDEX idx_verification_type ON verification_results(verificationType);
CREATE INDEX idx_verification_score ON verification_results(overallScore);
CREATE INDEX idx_verification_passed ON verification_results(passed);
CREATE INDEX idx_verification_created ON verification_results(createdAt);

-- 错误日志相关
CREATE INDEX idx_errors_user ON error_logs(userId);
CREATE INDEX idx_errors_case ON error_logs(caseId);
CREATE INDEX idx_errors_type ON error_logs(errorType);
CREATE INDEX idx_errors_code ON error_logs(errorCode);
CREATE INDEX idx_errors_recovered ON error_logs(recovered);
CREATE INDEX idx_errors_learned ON error_logs(learned);
CREATE INDEX idx_errors_severity ON error_logs(severity);
CREATE INDEX idx_errors_created ON error_logs(createdAt);

-- Agent行动相关
CREATE INDEX idx_actions_user ON agent_actions(userId);
CREATE INDEX idx_actions_case ON agent_actions(caseId);
CREATE INDEX idx_actions_debate ON agent_actions(debateId);
CREATE INDEX idx_actions_agent ON agent_actions(agentName);
CREATE INDEX idx_actions_type ON agent_actions(actionType);
CREATE INDEX idx_actions_name ON agent_actions(actionName);
CREATE INDEX idx_actions_layer ON agent_actions(actionLayer);
CREATE INDEX idx_actions_status ON agent_actions(status);
CREATE INDEX idx_actions_parent ON agent_actions(parentActionId);
CREATE INDEX idx_actions_created ON agent_actions(createdAt);
```

---

## 📚 v3.0 使用示例

### 记忆管理示例

```typescript
import { prisma } from '@/lib/db/prisma';
import { MemoryType } from '@prisma/client';

// 创建工作记忆
const workingMemory = await prisma.agentMemory.create({
  data: {
    userId: 'user_123',
    caseId: 'case_456',
    memoryType: MemoryType.WORKING,
    agentName: 'AnalysisAgent',
    memoryKey: 'current_case_analysis',
    memoryValue: {
      parties: ['张三', '李四'],
      claims: ['支付货款100000元'],
      status: 'in_progress',
    },
    importance: 0.9,
    expiresAt: new Date(Date.now() + 3600000), // 1小时后过期
  },
});

// 压缩并转移到热记忆
const hotMemory = await prisma.agentMemory.create({
  data: {
    userId: 'user_123',
    caseId: 'case_456',
    memoryType: MemoryType.HOT,
    agentName: 'AnalysisAgent',
    memoryKey: 'case_analysis_summary',
    memoryValue: {
      summary: '合同纠纷案件，涉及违约责任',
      keyPoints: ['违约', '赔偿'],
      originalMemoryId: workingMemory.id,
    },
    importance: 0.7,
    compressed: true,
    compressionRatio: 0.2,
    expiresAt: new Date(Date.now() + 7 * 24 * 3600000), // 7天后过期
  },
});
```

### 验证结果示例

```typescript
import { VerificationType } from '@prisma/client';

// 创建综合验证结果
const verification = await prisma.verificationResult.create({
  data: {
    entityType: 'Document',
    entityId: 'doc_456',
    verificationType: VerificationType.COMPREHENSIVE,
    overallScore: 0.88,
    factualAccuracy: 0.92,
    logicalConsistency: 0.85,
    taskCompleteness: 0.87,
    passed: false, // 低于0.9阈值
    issues: [
      {
        type: 'logical_inconsistency',
        severity: 'medium',
        description: '诉讼请求与事实理由不完全匹配',
      },
    ],
    suggestions: [
      {
        priority: 'high',
        action: 'enhance_fact_description',
        description: '补充违约事实的详细描述',
        estimatedImpact: 0.1,
      },
    ],
    verifiedBy: 'AI',
    verificationTime: 1200,
  },
});
```

### 错误学习示例

```typescript
import { ErrorType, ErrorSeverity } from '@prisma/client';

// 记录错误并尝试恢复
const errorLog = await prisma.errorLog.create({
  data: {
    userId: 'user_123',
    caseId: 'case_456',
    errorType: ErrorType.AI_SERVICE_ERROR,
    errorCode: 'AI_TIMEOUT',
    errorMessage: 'AI服务响应超时',
    context: {
      agentName: 'DocAnalyzer',
      taskId: 'task_123',
      inputData: { documentId: 'doc_456' }
    },
    attemptedAction: {
      action: 'parse_document',
      parameters: { documentId: 'doc_456' }
    },
    recoveryAttempts: 0,
    severity: ErrorSeverity.MEDIUM
  }
});

// 更新恢复状态
await prisma.errorLog.update({
  where: { id: errorLog.id },
  data: {
    recovered: true,
    recov
```
