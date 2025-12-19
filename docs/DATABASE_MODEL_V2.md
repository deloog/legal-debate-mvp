# 律伴助手数据模型设计文档 v2.0

## 📋 文档信息

- **版本**: v2.0
- **创建日期**: 2024-12-18
- **基于**: AI评审意见重构
- **迁移名称**: `20251218093212_debate_system_complete_model`

## 🎯 设计目标

基于AI架构师的评审意见，本次数据模型重构的核心目标：

1. **完整的辩论系统支持** - 添加debates、debate_rounds、arguments等核心表
2. **灵活的扩展性** - 使用JSONB字段存储灵活业务数据
3. **软删除支持** - 所有核心表支持deletedAt软删除
4. **性能优化** - 合理的索引设计
5. **数据完整性** - 完善的外键约束和级联删除

## 📊 数据模型概览

### 核心实体关系

```
User (用户)
  ├── Case (案件) 1:N
  │   ├── Document (文档) 1:N
  │   ├── Debate (辩论) 1:N
  │   │   └── DebateRound (辩论轮次) 1:N
  │   │       └── Argument (论点) 1:N
  │   └── LegalReference (法律依据) 1:N
  ├── Account (第三方账号) 1:N
  └── Session (会话) 1:N

AIInteraction (AI交互记录) - 独立表
```

## 📁 数据表详细设计

### 1. 用户和认证模块

#### 1.1 User (用户表)

**表名**: `users`

**用途**: 存储用户基本信息和权限

**字段说明**:

| 字段 | 类型 | 说明 | 索引 |
|------|------|------|------|
| id | String (CUID) | 主键 | PK |
| email | String | 邮箱（唯一） | Unique |
| username | String? | 用户名 | - |
| name | String? | 姓名 | - |
| role | UserRole | 角色（USER/LAWYER/ADMIN/SUPER_ADMIN） | - |
| permissions | Json? | 权限配置（JSONB） | - |
| organizationId | String? | 组织ID | Index |
| createdAt | DateTime | 创建时间 | - |
| updatedAt | DateTime | 更新时间 | - |
| deletedAt | DateTime? | 软删除时间 | - |

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

| 字段 | 类型 | 说明 | 索引 |
|------|------|------|------|
| id | String (CUID) | 主键 | PK |
| userId | String | 用户ID | Index |
| title | String | 案件标题 | - |
| description | Text | 案件描述 | - |
| type | CaseType | 案件类型 | Index |
| status | CaseStatus | 案件状态 | Index |
| metadata | Json? | 扩展数据（JSONB） | - |
| createdAt | DateTime | 创建时间 | Index |
| updatedAt | DateTime | 更新时间 | - |
| deletedAt | DateTime? | 软删除时间 | - |

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

| 字段 | 类型 | 说明 | 索引 |
|------|------|------|------|
| id | String (CUID) | 主键 | PK |
| caseId | String | 案件ID | Index |
| userId | String | 用户ID | Index |
| filename | String | 文件名 | - |
| filePath | String | 存储路径 | - |
| fileType | String | 文件类型（PDF/DOCX等） | - |
| fileSize | Int | 文件大小（字节） | - |
| mimeType | String | MIME类型 | - |
| extractedData | Json? | 提取的结构化数据（JSONB） | - |
| analysisStatus | AnalysisStatus | 解析状态 | Index |
| analysisResult | Json? | AI解析结果（JSONB） | - |
| analysisError | String? | 解析错误信息 | - |
| createdAt | DateTime | 创建时间 | - |
| updatedAt | DateTime | 更新时间 | - |
| deletedAt | DateTime? | 软删除时间 | - |

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

| 字段 | 类型 | 说明 | 索引 |
|------|------|------|------|
| id | String (CUID) | 主键 | PK |
| caseId | String | 案件ID | Index |
| userId | String | 用户ID | Index |
| title | String | 辩论标题 | - |
| status | DebateStatus | 辩论状态 | Index |
| currentRound | Int | 当前轮次 | - |
| debateConfig | Json? | 辩论配置（JSONB） | - |
| createdAt | DateTime | 创建时间 | Index |
| updatedAt | DateTime | 更新时间 | - |
| deletedAt | DateTime? | 软删除时间 | - |

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

| 字段 | 类型 | 说明 | 索引 |
|------|------|------|------|
| id | String (CUID) | 主键 | PK |
| debateId | String | 辩论ID | Index |
| roundNumber | Int | 轮次编号 | - |
| status | RoundStatus | 轮次状态 | Index |
| startedAt | DateTime? | 开始时间 | - |
| completedAt | DateTime? | 完成时间 | - |
| createdAt | DateTime | 创建时间 | - |
| updatedAt | DateTime | 更新时间 | - |

**关键约束**:
- Unique: (debateId, roundNumber) - 确保轮次唯一性

**设计亮点**:
- ✅ 时间追踪（开始/完成）
- ✅ 轮次唯一性约束

#### 4.3 Argument (论点表)

**表名**: `arguments`

**用途**: 存储辩论论点

**字段说明**:

| 字段 | 类型 | 说明 | 索引 |
|------|------|------|------|
| id | String (CUID) | 主键 | PK |
| roundId | String | 轮次ID | Index |
| side | ArgumentSide | 论点方（PLAINTIFF/DEFENDANT/NEUTRAL） | Index |
| content | Text | 论点内容 | - |
| type | ArgumentType | 论点类型 | - |
| aiProvider | String? | AI提供商 | - |
| generationTime | Int? | 生成耗时（ms） | - |
| confidence | Float? | AI置信度 | - |
| createdAt | DateTime | 创建时间 | - |
| updatedAt | DateTime | 更新时间 | - |

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

#### 5.1 LegalReference (法律依据表)

**表名**: `legal_references`

**用途**: 存储法律条文和案例

**字段说明**:

| 字段 | 类型 | 说明 | 索引 |
|------|------|------|------|
| id | String (CUID) | 主键 | PK |
| caseId | String? | 案件ID（可选） | Index |
| source | String | 法律名称 | - |
| content | Text | 法条内容 | - |
| lawType | String? | 法律类型 | Index |
| articleNumber | String? | 条款号 | - |
| retrievalQuery | String? | 检索关键词 | - |
| relevanceScore | Float? | 相关性评分 | Index |
| metadata | Json? | 元数据（JSONB） | - |
| createdAt | DateTime | 创建时间 | - |
| updatedAt | DateTime | 更新时间 | - |

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

| 字段 | 类型 | 说明 | 索引 |
|------|------|------|------|
| id | String (CUID) | 主键 | PK |
| type | String | 交互类型 | Index |
| provider | String | AI提供商 | Index |
| model | String? | 模型名称 | - |
| request | Json | 请求数据（JSONB） | - |
| response | Json? | 响应数据（JSONB） | - |
| tokensUsed | Int? | Token消耗 | - |
| duration | Int? | 响应时间（ms） | - |
| cost | Float? | 成本（元） | - |
| success | Boolean | 是否成功 | Index |
| error | String? | 错误信息 | - |
| createdAt | DateTime | 创建时间 | Index |

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

## 🔄 迁移历史

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

---

## 🎯 下一步计划

1. **性能测试** - 使用大数据量测试查询性能
2. **备份策略** - 实施定期备份和恢复测试
3. **监控告警** - 设置数据库性能监控
4. **数据归档** - 实施历史数据归档策略

---

*文档版本: v2.0*
*最后更新: 2024-12-18*
*维护者: 开发团队*
