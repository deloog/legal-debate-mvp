# 法律知识图谱实施路线图

> **创建时间**: 2026-01-31
> **版本**: v2.0
> **状态**: 规划阶段

---

## 📋 目录

- [一、项目概述](#一项目概述)
- [二、技术架构设计](#二技术架构设计)
- [三、数据库设计方案](#三数据库设计方案)
- [四、关系发现策略](#四关系发现策略)
- [五、核心服务实现](#五核心服务实现)
- [六、可视化组件实现](#六可视化组件实现)
- [七、API接口设计](#七api接口设计)
- [八、管理后台设计](#八管理后台设计)
- [九、测试策略](#九测试策略)
- [十、实施计划](#十实施计划)
- [十一、风险与应对](#十一风险与应对)

---

## 一、项目概述

### 1.1 项目目标

构建法律知识图谱，建立法条之间的语义关系，提升法律辩论和合同审查的智能推荐能力。

### 1.2 核心价值

- **引用关系追踪**: 自动发现法条之间的引用关系
- **冲突检测**: 识别可能存在冲突的法律规定
- **补全推荐**: 推荐相关的补充性法条
- **替代关系**: 识别新旧法条的替代关系
- **实施关系**: 发现实施细则与上位法的对应关系

### 1.3 技术指标

- **关系发现覆盖率**: 95%+ (规则80% + AI15% + 案例5%)
- **关系准确率**: 90%+ (经过人工审核验证)
- **查询响应时间**: < 500ms (3层深度关系查询)
- **可视化节点数**: 支持1000+节点流畅展示

---

## 二、技术架构设计

### 2.1 整体架构

```
┌─────────────────────────────────────────────────────────────┐
│                        前端层                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ 法条详情页   │  │ 关系图谱展示  │  │ 辩论生成器   │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                        API层                                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ 关系查询API   │  │ 关系管理API   │  │ 图谱数据API   │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      服务层                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ 规则引擎      │  │ AI分析器      │  │ 关系管理服务  │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│  ┌──────────────┐  ┌──────────────┐                        │
│  │ 案例分析器    │  │ 图谱构建器    │                        │
│  └──────────────┘  └──────────────┘                        │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      数据层                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ LawArticle   │  │ LawArticle   │  │ 关系缓存     │      │
│  │ (法条表)      │  │ Relation     │  │ (Redis)      │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 技术栈

| 层级 | 技术 | 说明 |
|------|------|------|
| 前端 | Next.js 14 | React框架 |
| 可视化 | D3.js / React Flow | 力导向图 |
| 后端 | Next.js API | 服务端渲染 |
| 数据库 | PostgreSQL | 关系型数据库 |
| 缓存 | Redis | 关系查询缓存 |
| AI | OpenAI GPT-4 | 语义分析 |

---

## 三、数据库设计方案

### 3.1 关系表设计

```prisma
// prisma/schema.prisma

model LawArticleRelation {
  id              String              @id @default(cuid())
  
  // 关系的两端
  sourceId        String
  targetId        String
  source          LawArticle          @relation("SourceRelations", fields: [sourceId], references: [id], onDelete: Cascade)
  target          LawArticle          @relation("TargetRelations", fields: [targetId], references: [id], onDelete: Cascade)
  
  // 关系类型
  relationType    RelationType
  
  // 关系属性
  strength        Float               @default(1.0)  // 关系强度 0-1
  confidence      Float               @default(1.0)  // 置信度 0-1
  description     String?                           // 关系描述
  evidence        Json?                             // 证据（引用的具体文本）
  
  // 发现方式
  discoveryMethod DiscoveryMethod     @default(MANUAL)
  
  // 审核状态
  verificationStatus VerificationStatus @default(PENDING)
  verifiedBy      String?
  verifiedAt      DateTime?
  
  // 元数据
  createdBy       String?
  createdAt       DateTime            @default(now())
  updatedAt       DateTime            @updatedAt
  
  // 复合索引用于快速查找和去重
  @@index([sourceId, targetId, relationType])
  @@index([sourceId])
  @@index([targetId])
  @@index([relationType])
  @@index([strength])
  @@index([verificationStatus])
  @@index([discoveryMethod])
  @@map("law_article_relations")
}

// 关系类型枚举（包含正向和反向关系）
enum RelationType {
  // 引用关系
  CITES              // 引用关系：A明确引用B
  CITED_BY           // 被引用关系：B被A引用（反向）
  
  // 冲突关系
  CONFLICTS          // 冲突关系：A与B存在冲突
  
  // 补全关系
  COMPLETES          // 补全关系：A补充完善B
  COMPLETED_BY       // 被补全关系：B被A补全（反向）
  
  // 替代关系
  SUPERSEDES         // 替代关系：A替代B（新法替旧法）
  SUPERSEDED_BY      // 被替代关系：B被A替代（反向）
  
  // 实施关系
  IMPLEMENTS         // 实施关系：A实施B（细则实施原则）
  IMPLEMENTED_BY     // 被实施关系：B被A实施（反向）
  
  // 一般关联
  RELATED            // 一般关联：相关但不属于上述类型
}

// 发现方式
enum DiscoveryMethod {
  MANUAL             // 人工添加
  RULE_BASED         // 规则匹配
  AI_DETECTED        // AI检测
  CASE_DERIVED       // 案例推导
}

// 审核状态
enum VerificationStatus {
  PENDING            // 待审核
  VERIFIED           // 已验证
  REJECTED           // 已拒绝
}

// 修改LawArticle模型
model LawArticle {
  // ... 现有字段保持不变 ...
  
  // 新增关系字段
  sourceRelations    LawArticleRelation[] @relation("SourceRelations")
  targetRelations    LawArticleRelation[] @relation("TargetRelations")
}
```

### 3.2 数据库迁移

```bash
# 创建迁移文件
npx prisma migrate dev --name add_law_article_relations

# 应用迁移到生产环境
npx prisma migrate deploy
```

### 3.3 关系管理策略

由于移除了唯一约束，同一对法条可能存在多条相同类型的关系。需要在应用层处理：

```typescript
// 建议的关系合并策略
interface RelationMergeStrategy {
  // 策略1：保留置信度最高的
  KEEP_HIGHEST_CONFIDENCE: 'keep_highest_confidence',
  
  // 策略2：保留所有（用于人工审核）
  KEEP_ALL: 'keep_all',
  
  // 策略3：合并证据
  MERGE_EVIDENCE: 'merge_evidence',
}
```

### 3.4 索引优化策略

```sql
-- 复合索引用于常见查询模式
CREATE INDEX idx_relation_type_strength ON law_article_relations(relationType, strength DESC);

-- 索引用于关系路径查询
CREATE INDEX idx_source_target ON law_article_relations(sourceId, targetId);

-- 部分索引用于待审核的关系
CREATE INDEX idx_pending_verification ON law_article_relations(verificationStatus) 
WHERE verificationStatus = 'PENDING';

-- 索引用于发现方式统计
CREATE INDEX idx_discovery_method ON law_article_relations(discoveryMethod);
```

---

## 四、关系发现策略

### 4.1 三层架构概述

| 策略 | 覆盖率 | 准确率 | 成本 | 优先级 |
|------|--------|--------|------|--------|
| 规则匹配 | 80% | 95% | 低 | P0 |
| AI语义分析 | 15% | 85% | 中 | P1 |
| 案例推导 | 5% | 80% | 高 | P2 |

### 4.2 规则匹配引擎（Rule-Based）

#### 4.2.1 目录结构

```
src/lib/law-article/relation-discovery/
├── rule-based-detector.ts      # 规则检测器
├── patterns.ts                 # 正则模式库
└── types.ts                    # 类型定义
```

#### 4.2.2 规则检测器实现

```typescript
// src/lib/law-article/relation-discovery/types.ts

export interface CitesRelation {
  lawName: string;
  articleNumber: string;
  evidence: string;
  confidence: number;
}

export interface SupersedesRelation {
  sourceId: string;
  targetId: string;
  relationType: RelationType;
  confidence: number;
  evidence: string;
}

export interface HierarchicalRelation {
  parentLawName: string;
  relationType: string;
  confidence: number;
}
```

```typescript
// src/lib/law-article/relation-discovery/patterns.ts

export const CITE_PATTERNS = [
  /根据[《]?([^》]+)[》]?第?(\d+)条/g,
  /依照[《]?([^》]+)[》]?第?(\d+)条/g,
  /按照[《]?([^》]+)[》]?第?(\d+)条/g,
  /参照[《]?([^》]+)[》]?第?(\d+)条/g,
  /适用[《]?([^》]+)[》]?第?(\d+)条/g,
  /引用[《]?([^》]+)[》]?第?(\d+)条/g,
] as const;

export const HIERARCHY_PATTERNS = [
  /根据[《]?([^》]+)[》]?制定/g,
  /依据[《]?([^》]+)[》]?制定/g,
  /为实施[《]?([^》]+)[》]?/g,
] as const;

export const CONFLICT_PATTERNS = [
  /与[《]?([^》]+)[》]?规定不一致/g,
  /与[《]?([^》]+)[》]?相抵触/g,
] as const;
```

```typescript
// src/lib/law-article/relation-discovery/rule-based-detector.ts

import { LawArticle, RelationType } from '@prisma/client';
import { CITE_PATTERNS, HIERARCHY_PATTERNS, CONFLICT_PATTERNS } from './patterns';
import { CitesRelation, SupersedesRelation, HierarchicalRelation } from './types';

export class RuleBasedDetector {
  /**
   * 检测引用关系
   */
  static detectCitesRelation(article: LawArticle): CitesRelation[] {
    const relations: CitesRelation[] = [];

    for (const pattern of CITE_PATTERNS) {
      const matches = article.fullText.matchAll(pattern);
      for (const match of matches) {
        relations.push({
          lawName: match[1]?.trim() || '',
          articleNumber: match[2]?.trim() || '',
          evidence: match[0] || '',
          confidence: 0.95,
        });
      }
    }

    return relations;
  }

  /**
   * 检测时序关系（新法替旧法）
   */
  static detectSupersedesRelation(articles: LawArticle[]): SupersedesRelation[] {
    // 按lawName分组
    const grouped = new Map<string, LawArticle[]>();
    for (const article of articles) {
      if (!grouped.has(article.lawName)) {
        grouped.set(article.lawName, []);
      }
      grouped.get(article.lawName)!.push(article);
    }

    const relations: SupersedesRelation[] = [];

    for (const [lawName, versions] of grouped.entries()) {
      // 按effectiveDate排序
      const sorted = versions.sort((a, b) => {
        const dateA = a.effectiveDate ? a.effectiveDate.getTime() : 0;
        const dateB = b.effectiveDate ? b.effectiveDate.getTime() : 0;
        return dateA - dateB;
      });

      // 相邻版本建立替代关系
      for (let i = 1; i < sorted.length; i++) {
        const newLaw = sorted[i];
        const oldLaw = sorted[i - 1];

        relations.push({
          sourceId: newLaw.id,
          targetId: oldLaw.id,
          relationType: RelationType.SUPERSEDES,
          confidence: 0.9,
          evidence: `${newLaw.version || '新版本'} 替代 ${oldLaw.version || '旧版本'}`,
        });
      }
    }

    return relations;
  }

  /**
   * 检测层级关系（上位法/下位法）
   */
  static detectHierarchicalRelation(article: LawArticle): HierarchicalRelation[] {
    const relations: HierarchicalRelation[] = [];

    for (const pattern of HIERARCHY_PATTERNS) {
      const match = article.fullText.match(pattern);
      if (match && match[1]) {
        relations.push({
          parentLawName: match[1].trim(),
          relationType: 'IMPLEMENTS',
          confidence: 0.85,
        });
      }
    }

    return relations;
  }

  /**
   * 检测冲突关系
   */
  static detectConflictsRelation(article: LawArticle): Array<{ targetLawName: string; confidence: number }> {
    const conflicts: Array<{ targetLawName: string; confidence: number }> = [];

    for (const pattern of CONFLICT_PATTERNS) {
      const match = article.fullText.match(pattern);
      if (match && match[1]) {
        conflicts.push({
          targetLawName: match[1].trim(),
          confidence: 0.8,
        });
      }
    }

    return conflicts;
  }

  /**
   * 批量检测所有关系
   */
  static async detectAllRelations(article: LawArticle): Promise<{
    cites: CitesRelation[];
    hierarchical: HierarchicalRelation[];
    conflicts: Array<{ targetLawName: string; confidence: number }>;
  }> {
    return {
      cites: this.detectCitesRelation(article),
      hierarchical: this.detectHierarchicalRelation(article),
      conflicts: this.detectConflictsRelation(article),
    };
  }
}
```

### 4.3 AI语义分析引擎（AI-Based）

#### 4.3.1 AI配置管理

```typescript
// src/lib/law-article/relation-discovery/ai-detector-config.ts

export const AI_DETECTOR_CONFIG = {
  // 批处理配置
  maxBatchSize: 5,
  maxDailyRequests: 1000,
  maxCostPerDay: 100, // 美元
  
  // 降级策略
  fallbackToRuleBasedOnError: true,
  retryAttempts: 2,
  retryDelay: 1000, // 毫秒
  
  // 质量控制
  minConfidenceThreshold: 0.6,
  maxTextLength: 2000, // 单个法条截取长度
} as const;
```

#### 4.3.2 成本监控

```typescript
// src/lib/law-article/relation-discovery/ai-cost-monitor.ts

export class AICostMonitor {
  private static dailyRequestCount = 0;
  private static dailyCost = 0;
  private static lastReset = Date.now();

  static async trackCall(cost: number): Promise<boolean> {
    // 每日重置
    if (Date.now() - this.lastReset > 24 * 60 * 60 * 1000) {
      this.dailyRequestCount = 0;
      this.dailyCost = 0;
      this.lastReset = Date.now();
    }

    // 检查限制
    if (this.dailyRequestCount >= AI_DETECTOR_CONFIG.maxDailyRequests) {
      console.warn('达到每日API调用限制');
      return false;
    }

    if (this.dailyCost >= AI_DETECTOR_CONFIG.maxCostPerDay) {
      console.warn('达到每日成本预算');
      return false;
    }

    this.dailyRequestCount++;
    this.dailyCost += cost;
    return true;
  }

  static getStats() {
    return {
      dailyRequestCount: this.dailyRequestCount,
      dailyCost: this.dailyCost,
      remainingRequests: AI_DETECTOR_CONFIG.maxDailyRequests - this.dailyRequestCount,
      remainingBudget: AI_DETECTOR_CONFIG.maxCostPerDay - this.dailyCost,
    };
  }
}
```

#### 4.3.3 AI检测器实现

```typescript
// src/lib/law-article/relation-discovery/ai-detector.ts

import { LawArticle, RelationType } from '@prisma/client';
import { getOpenAICompletion } from '@/lib/ai/openai-client';
import { AI_DETECTOR_CONFIG } from './ai-detector-config';
import { AICostMonitor } from './ai-cost-monitor';

export interface RelationAnalysis {
  relations: RelationInfo[];
}

export interface RelationInfo {
  type: RelationType | 'NONE';
  confidence: number;
  reason: string;
  evidence: string;
}

export class AIDetector {
  /**
   * 分析两个法条之间的关系
   */
  static async detectRelations(
    article1: LawArticle,
    article2: LawArticle
  ): Promise<RelationAnalysis> {
    const prompt = `分析以下两个法条之间的关系：

【法条A】
法律名称：${article1.lawName}
条号：${article1.articleNumber}
内容：${article1.fullText.slice(0, AI_DETECTOR_CONFIG.maxTextLength)}

【法条B】
法律名称：${article2.lawName}
条号：${article2.articleNumber}
内容：${article2.fullText.slice(0, AI_DETECTOR_CONFIG.maxTextLength)}

请判断它们之间是否存在以下关系（可多选）：
1. CITES（引用）：A明确引用B
2. CITED_BY（被引用）：B被A引用
3. CONFLICTS（冲突）：A与B在适用条件重叠时结论不同
4. COMPLETES（补全）：A补充完善B的规定
5. IMPLEMENTS（实施）：A是B的实施细则
6. RELATED（相关）：存在一般关联
7. NONE（无关系）：不存在明确关系

返回JSON格式：
{
  "relations": [
    {
      "type": "CITES" | "CITED_BY" | "CONFLICTS" | "COMPLETES" | "IMPLEMENTS" | "RELATED" | "NONE",
      "confidence": 0.0-1.0,
      "reason": "关系存在的理由",
      "evidence": "支持该关系的具体文本"
    }
  ]
}`;

    try {
      const response = await getOpenAICompletion(prompt, {
        temperature: 0.3,
        maxTokens: 500,
      });

      const result = JSON.parse(response) as RelationAnalysis;

      // 过滤掉低置信度和无关系的结果
      result.relations = result.relations.filter(
        (r: RelationInfo) => r.confidence >= AI_DETECTOR_CONFIG.minConfidenceThreshold && r.type !== 'NONE'
      );

      return result;
    } catch (error) {
      console.error('AI关系检测失败:', error);
      
      // 降级处理
      if (AI_DETECTOR_CONFIG.fallbackToRuleBasedOnError) {
        console.log('AI服务失败，使用规则匹配降级');
      }
      
      return { relations: [] };
    }
  }

  /**
   * 批量分析关系（优化成本）
   */
  static async batchDetectRelations(
    sourceArticle: LawArticle,
    candidateArticles: LawArticle[]
  ): Promise<Map<string, RelationAnalysis>> {
    // 先用规则过滤，只对可能相关的法条调用AI
    const filtered = candidateArticles.filter((candidate) =>
      this.isPotentiallyRelated(sourceArticle, candidate)
    );

    // 检查成本限制
    const estimatedCost = 0.05 * filtered.length;
    if (!(await AICostMonitor.trackCall(estimatedCost))) {
      console.log('AI成本限制，跳过批量检测');
      return new Map();
    }

    const results = new Map<string, RelationAnalysis>();

    // 批量调用AI
    const batchSize = AI_DETECTOR_CONFIG.maxBatchSize;
    for (let i = 0; i < filtered.length; i += batchSize) {
      const batch = filtered.slice(i, i + batchSize);
      const promises = batch.map((candidate) =>
        this.detectRelations(sourceArticle, candidate)
          .then((result) => ({ id: candidate.id, result }))
          .catch((error) => {
            console.error(`分析法条 ${candidate.id} 失败:`, error);
            return { id: candidate.id, result: { relations: [] } };
          })
      );

      const batchResults = await Promise.all(promises);
      for (const { id, result } of batchResults) {
        results.set(id, result);
      }
    }

    return results;
  }

  /**
   * 快速预筛选（避免无意义的AI调用）
   */
  private static isPotentiallyRelated(a: LawArticle, b: LawArticle): boolean {
    // 同一法律的法条
    if (a.lawName === b.lawName) {
      // 只检测相邻法条
      const numA = parseInt(a.articleNumber) || 0;
      const numB = parseInt(b.articleNumber) || 0;
      return Math.abs(numA - numB) <= 10;
    }

    // 分类相同或相近
    if (a.category === b.category) return true;

    // 标签有交集
    if (a.tags && b.tags) {
      const tagOverlap = a.tags.filter((tag) => b.tags.includes(tag));
      if (tagOverlap.length > 0) return true;
    }

    // 关键词有交集
    if (a.keywords && b.keywords) {
      const keywordOverlap = a.keywords.filter((kw) => b.keywords.includes(kw));
      if (keywordOverlap.length >= 2) return true;
    }

    return false;
  }
}
```

### 4.4 关系冲突处理

```typescript
// src/lib/law-article/relation-discovery/conflict-resolver.ts

import { RelationType, DiscoveryMethod } from '@prisma/client';

export interface RelationCandidate {
  type: RelationType;
  confidence: number;
  method: DiscoveryMethod;
}

export class ConflictResolver {
  /**
   * 解决关系冲突
   * 优先级：RULE_BASED > AI_DETECTED > CASE_DERIVED
   */
  static resolveConflicts(relations: RelationCandidate[]): RelationType | null {
    if (relations.length === 0) return null;
    if (relations.length === 1) return relations[0].type;

    // 按置信度排序
    const sorted = relations.sort((a, b) => b.confidence - a.confidence);
    const highest = sorted[0];

    // 检查是否有高置信度的冲突
    const conflicts = sorted.filter(
      (r) => r.confidence > 0.7 && r.type !== highest.type
    );

    if (conflicts.length === 0) {
      return highest.type;
    }

    // 如果置信度差异 < 0.1，选择优先级高的
    if (highest.confidence - conflicts[0].confidence < 0.1) {
      return this.selectByPriority([highest, conflicts[0]]);
    }

    // 否则选择置信度高的
    return highest.type;
  }

  private static selectByPriority(relations: RelationCandidate[]): RelationType {
    const priority = {
      RULE_BASED: 3,
      AI_DETECTED: 2,
      CASE_DERIVED: 1,
    };

    return relations.sort(
      (a, b) => priority[b.method] - priority[a.method]
    )[0].type;
  }
}
```

### 4.5 关系质量评分

```typescript
// src/lib/law-article/relation-quality-scorer.ts

import { LawArticleRelation, DiscoveryMethod, VerificationStatus } from '@prisma/client';

export class RelationQualityScorer {
  /**
   * 计算关系质量分数（0-1）
   */
  static calculateQualityScore(relation: LawArticleRelation): number {
    let score = 0;

    // 1. 发现方式权重（规则>AI>案例）
    const methodWeights = {
      RULE_BASED: 0.4,
      AI_DETECTED: 0.3,
      CASE_DERIVED: 0.2,
      MANUAL: 0.5,
    };
    score += (methodWeights[relation.discoveryMethod] || 0.3) * 0.3;

    // 2. 置信度
    score += relation.confidence * 0.4;

    // 3. 是否经过人工验证
    if (relation.verificationStatus === VerificationStatus.VERIFIED) {
      score += 0.2;
    }

    // 4. 关系强度
    score += relation.strength * 0.1;

    return Math.min(score, 1.0);
  }

  /**
   * 批量计算质量分数
   */
  static async batchCalculateQualityScore(
    relations: LawArticleRelation[]
  ): Promise<Map<string, number>> {
    const scores = new Map<string, number>();

    for (const relation of relations) {
      scores.set(relation.id, this.calculateQualityScore(relation));
    }

    return scores;
  }
}
```

### 4.6 案例推导引擎（Case-Derived）

```typescript
// src/lib/law-article/relation-discovery/case-derived-detector.ts

import { prisma } from '@/lib/db';
import { RelationType } from '@prisma/client';

export interface CoOccurrenceRelation {
  sourceId: string;
  targetId: string;
  relationType: RelationType;
  strength: number;
  confidence: number;
  discoveryMethod: string;
  evidence: string;
}

export interface UsagePattern {
  articleId: string;
  frequentlyUsedWith: Array<{
    articleId: string;
    frequency: number;
    typicalOrder: 'before' | 'after';
  }>;
}

export class CaseDerivedDetector {
  /**
   * 从裁判文书中发现法条共现关系
   */
  static async discoverFromCases(): Promise<CoOccurrenceRelation[]> {
    const query = `
      SELECT 
        a1.id as source_id,
        a2.id as target_id,
        COUNT(*) as co_occurrence_count,
        AVG(CASE WHEN a1.id < a2.id THEN 1 ELSE 0 END) as order_score
      FROM case_examples ce
      JOIN legal_references lr1 ON lr1.caseId = ce.id
      JOIN legal_references lr2 ON lr2.caseId = ce.id
      JOIN law_articles a1 ON lr1.source = a1.lawName AND lr1.articleNumber = a1.articleNumber
      JOIN law_articles a2 ON lr2.source = a2.lawName AND lr2.articleNumber = a2.articleNumber
      WHERE a1.id != a2.id
      GROUP BY a1.id, a2.id
      HAVING COUNT(*) >= 5
      ORDER BY co_occurrence_count DESC
    `;

    try {
      const results = await prisma.$queryRawUnsafe<any[]>(query);

      return results.map((r) => ({
        sourceId: r.source_id,
        targetId: r.target_id,
        relationType: RelationType.RELATED,
        strength: Math.min(r.co_occurrence_count / 100, 1.0),
        confidence: 0.7,
        discoveryMethod: 'CASE_DERIVED',
        evidence: `在${r.co_occurrence_count}个案例中同时被引用`,
      }));
    } catch (error) {
      console.error('案例推导失败:', error);
      return [];
    }
  }

  /**
   * 分析法条在案例中的使用顺序
   */
  static async analyzeUsagePattern(articleId: string): Promise<UsagePattern> {
    const query = `
      SELECT 
        related_article_id,
        AVG(position_diff) as avg_position,
        COUNT(*) as frequency
      FROM (
        SELECT 
          lr2.articleId as related_article_id,
          lr2.position - lr1.position as position_diff
        FROM legal_references lr1
        JOIN legal_references lr2 ON lr1.caseId = lr2.caseId
        WHERE lr1.articleId = $1
          AND lr2.articleId != $1
      ) subquery
      GROUP BY related_article_id
      HAVING COUNT(*) >= 3
    `;

    try {
      const results = await prisma.$queryRawUnsafe<any[]>(query, articleId);

      return {
        articleId,
        frequentlyUsedWith: results.map((p) => ({
          articleId: p.related_article_id,
          frequency: p.frequency,
          typicalOrder: p.avg_position > 0 ? 'after' : 'before',
        })),
      };
    } catch (error) {
      console.error('使用模式分析失败:', error);
      return {
        articleId,
        frequentlyUsedWith: [],
      };
    }
  }
}
```

### 4.7 关系发现日志

```typescript
// src/lib/law-article/relation-discovery/discovery-logger.ts

import { DiscoveryMethod } from '@prisma/client';

export interface DiscoveryLog {
  articleId: string;
  method: DiscoveryMethod;
  relationsFound: number;
  duration: number;
  cost?: number;
  timestamp: Date;
}

export class DiscoveryLogger {
  /**
   * 记录发现结果
   */
  static logDiscovery(result: DiscoveryLog): void {
    console.log(
      `[关系发现] 法条:${result.articleId} 方法:${result.method} ` +
      `发现:${result.relationsFound} 耗时:${result.duration}ms ` +
      `成本:${result.cost ?? 0}`
    );

    // TODO: 可以记录到数据库或日志系统，用于后续分析
  }

  /**
   * 统计发现效果
   */
  static getStats(logs: DiscoveryLog[]) {
    const byMethod = new Map<DiscoveryMethod, number[]>();
    
    for (const log of logs) {
      if (!byMethod.has(log.method)) {
        byMethod.set(log.method, []);
      }
      byMethod.get(log.method)!.push(log.relationsFound);
    }

    return {
      totalRelations: logs.reduce((sum, l) => sum + l.relationsFound, 0),
      avgDuration: logs.reduce((sum, l) => sum + l.duration, 0) / logs.length,
      totalCost: logs.reduce((sum, l) => sum + (l.cost ?? 0), 0),
      byMethod: Object.fromEntries(
        Array.from(byMethod.entries()).map(([method, counts]) => [
          method,
          {
            total: counts.reduce((sum, c) => sum + c, 0),
            avg: counts.reduce((sum, c) => sum + c, 0) / counts.length,
          },
        ])
      ),
    };
  }
}
```

---

## 五、核心服务实现

### 5.1 关系管理服务

```typescript
// src/lib/law-article/relation-service.ts

import { prisma } from '@/lib/db';
import {
  LawArticleRelation,
  RelationType,
  DiscoveryMethod,
  VerificationStatus,
} from '@prisma/client';

export interface CreateRelationInput {
  sourceId: string;
  targetId: string;
  relationType: RelationType;
  strength?: number;
  confidence?: number;
  description?: string;
  evidence?: any;
  discoveryMethod?: DiscoveryMethod;
  userId?: string;
}

export interface ArticleRelationGraph {
  articleId: string;
  outgoingRelations: Array<LawArticleRelation & { target: any }>;
  incomingRelations: Array<LawArticleRelation & { source: any }>;
  totalRelations: number;
}

export interface RelationPath {
  source: string;
  target: string;
  path: LawArticleRelation[];
  length: number;
}

export interface RelationStats {
  articleId: string;
  byType: Record<RelationType, number>;
  total: number;
}

export interface RecommendedArticle {
  article: any;
  score: number;
  reason: string;
}

export class LawArticleRelationService {
  /**
   * 创建关系
   */
  static async createRelation(
    data: CreateRelationInput
  ): Promise<LawArticleRelation> {
    // 验证关系的合理性
    await this.validateRelation(data);

    // 创建关系
    const relation = await prisma.lawArticleRelation.create({
      data: {
        sourceId: data.sourceId,
        targetId: data.targetId,
        relationType: data.relationType,
        strength: data.strength ?? 1.0,
        confidence: data.confidence ?? 1.0,
        description: data.description,
        evidence: data.evidence,
        discoveryMethod: data.discoveryMethod ?? DiscoveryMethod.MANUAL,
        createdBy: data.userId,
      },
      include: {
        source: true,
        target: true,
      },
    });

    return relation;
  }

  /**
   * 批量创建关系
   */
  static async batchCreateRelations(
    relations: CreateRelationInput[]
  ): Promise<LawArticleRelation[]> {
    const results: LawArticleRelation[] = [];

    for (const relationData of relations) {
      try {
        const relation = await this.createRelation(relationData);
        results.push(relation);
      } catch (error) {
        console.error(`创建关系失败: ${relationData.sourceId} -> ${relationData.targetId}`, error);
      }
    }

    return results;
  }

  /**
   * 获取法条的所有关系
   */
  static async getArticleRelations(
    articleId: string,
    options?: {
      relationType?: RelationType;
      direction?: 'outgoing' | 'incoming' | 'both';
      minStrength?: number;
      verificationStatus?: VerificationStatus;
    }
  ): Promise<ArticleRelationGraph> {
    const where: Record<string, any> = {};

    if (options?.relationType) {
      where.relationType = options.relationType;
    }

    if (options?.minStrength) {
      where.strength = { gte: options.minStrength };
    }

    if (options?.verificationStatus) {
      where.verificationStatus = options.verificationStatus;
    }

    // 查询出边（source relations）
    const outgoing =
      options?.direction !== 'incoming'
        ? await prisma.lawArticleRelation.findMany({
            where: { sourceId: articleId, ...where },
            include: { target: true },
          })
        : [];

    // 查询入边（target relations）
    const incoming =
      options?.direction !== 'outgoing'
        ? await prisma.lawArticleRelation.findMany({
            where: { targetId: articleId, ...where },
            include: { source: true },
          })
        : [];

    return {
      articleId,
      outgoingRelations: outgoing,
      incomingRelations: incoming,
      totalRelations: outgoing.length + incoming.length,
    };
  }

  /**
   * 查找关系路径（A到B的关系链）
   */
  static async findRelationPath(
    sourceId: string,
    targetId: string,
    maxDepth: number = 3
  ): Promise<RelationPath[]> {
    const visited = new Set<string>();
    const queue: Array<{ articleId: string; path: LawArticleRelation[]; depth: number }> = [
      { articleId: sourceId, path: [], depth: 0 },
    ];
    const paths: RelationPath[] = [];

    while (queue.length > 0) {
      const current = queue.shift()!;

      if (current.depth > maxDepth) continue;
      if (visited.has(current.articleId)) continue;

      visited.add(current.articleId);

      // 找到目标
      if (current.articleId === targetId) {
        paths.push({
          source: sourceId,
          target: targetId,
          path: current.path,
          length: current.depth,
        });
        continue;
      }

      // 获取相邻节点
      const relations = await prisma.lawArticleRelation.findMany({
        where: { sourceId: current.articleId },
      });

      for (const rel of relations) {
        if (!visited.has(rel.targetId)) {
          queue.push({
            articleId: rel.targetId,
            path: [...current.path, rel],
            depth: current.depth + 1,
          });
        }
      }
    }

    return paths;
  }

  /**
   * 获取关系统计
   */
  static async getRelationStats(articleId: string): Promise<RelationStats> {
    const stats = await prisma.lawArticleRelation.groupBy({
      by: ['relationType'],
      where: {
        OR: [{ sourceId: articleId }, { targetId: articleId }],
      },
      _count: true,
    });

    const byType = stats.reduce((acc, s) => {
      acc[s.relationType] = s._count;
      return acc;
    }, {} as Record<RelationType, number>);

    return {
      articleId,
      byType,
      total: stats.reduce((sum, s) => sum + s._count, 0),
    };
  }

  /**
   * 验证关系
   */
  static async verifyRelation(
    relationId: string,
    verifiedBy: string,
    isApproved: boolean
  ): Promise<LawArticleRelation> {
    return prisma.lawArticleRelation.update({
      where: { id: relationId },
      data: {
        verificationStatus: isApproved ? VerificationStatus.VERIFIED : VerificationStatus.REJECTED,
        verifiedBy,
        verifiedAt: new Date(),
      },
    });
  }

  /**
   * 删除关系
   */
  static async deleteRelation(relationId: string): Promise<void> {
    await prisma.lawArticleRelation.delete({
      where: { id: relationId },
    });
  }

  /**
   * 验证关系数据
   */
  private static async validateRelation(data: CreateRelationInput): Promise<void> {
    // 检查源法条和目标法条是否存在
    const [source, target] = await Promise.all([
      prisma.lawArticle.findUnique({ where: { id: data.sourceId } }),
      prisma.lawArticle.findUnique({ where: { id: data.targetId } }),
    ]);

    if (!source) {
      throw new Error(`源法条不存在: ${data.sourceId}`);
    }

    if (!target) {
      throw new Error(`目标法条不存在: ${data.targetId}`);
    }

    // 检查是否自引用
    if (data.sourceId === data.targetId) {
      throw new Error('禁止自引用');
    }

    // 注意：由于移除了唯一约束，这里不再检查重复关系
    // 如果需要去重，应该在应用层处理
  }
}
```

### 5.2 图谱构建服务（性能优化版）

```typescript
// src/lib/law-article/graph-builder.ts

import { prisma } from '@/lib/db';
import { LawArticleRelation, VerificationStatus } from '@prisma/client';

export interface GraphNode {
  id: string;
  lawName: string;
  articleNumber: string;
  category: string;
  level: number;
}

export interface GraphLink {
  source: string;
  target: string;
  relationType: string;
  strength: number;
  confidence: number;
}

export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

export class GraphBuilder {
  /**
   * 构建法条关系图谱（优化版）
   */
  static async buildGraph(
    centerArticleId: string,
    depth: number = 2
  ): Promise<GraphData> {
    const nodes = new Map<string, GraphNode>();
    const links: GraphLink[] = [];
    const visited = new Set<string>();

    // BFS遍历
    const queue: Array<{ id: string; currentDepth: number }> = [
      { id: centerArticleId, currentDepth: 0 },
    ];

    while (queue.length > 0) {
      const { id, currentDepth } = queue.shift()!;

      if (visited.has(id) || currentDepth > depth) continue;
      visited.add(id);

      // 获取法条信息
      const article = await prisma.lawArticle.findUnique({
        where: { id },
        select: {
          id: true,
          lawName: true,
          articleNumber: true,
          category: true,
        },
      });

      if (!article) continue;

      // 添加节点
      nodes.set(id, {
        id: article.id,
        lawName: article.lawName,
        articleNumber: article.articleNumber,
        category: article.category,
        level: currentDepth,
      });
    }

    // 批量获取所有关系（性能优化）
    const allRelations = await prisma.lawArticleRelation.findMany({
      where: {
        sourceId: { in: Array.from(visited) },
        verificationStatus: VerificationStatus.VERIFIED,
      },
      include: {
        target: {
          select: {
            id: true,
            lawName: true,
            articleNumber: true,
            category: true,
          },
        },
      },
    });

    // 在内存中构建邻接表
    const adjacencyMap = new Map<string, LawArticleRelation[]>();
    for (const rel of allRelations) {
      if (!adjacencyMap.has(rel.sourceId)) {
        adjacencyMap.set(rel.sourceId, []);
      }
      adjacencyMap.get(rel.sourceId)!.push(rel);
    }

    // 构建图
    for (const [sourceId, relations] of adjacencyMap.entries()) {
      const sourceLevel = nodes.get(sourceId)?.level ?? 0;

      for (const rel of relations) {
        links.push({
          source: rel.sourceId,
          target: rel.targetId,
          relationType: rel.relationType,
          strength: rel.strength,
          confidence: rel.confidence,
        });

        // 添加目标节点
        if (!nodes.has(rel.targetId)) {
          nodes.set(rel.targetId, {
            id: rel.target.id,
            lawName: rel.target.lawName,
            articleNumber: rel.target.articleNumber,
            category: rel.target.category,
            level: sourceLevel + 1,
          });
        }
      }
    }

    return {
      nodes: Array.from(nodes.values()),
      links,
    };
  }

  /**
   * 获取全量图谱（用于分析）
   */
  static async buildFullGraph(): Promise<GraphData> {
    const articles = await prisma.lawArticle.findMany({
      select: {
        id: true,
        lawName: true,
        articleNumber: true,
        category: true,
      },
    });

    const nodes: GraphNode[] = articles.map((a) => ({
      id: a.id,
      lawName: a.lawName,
      articleNumber: a.articleNumber,
      category: a.category,
      level: 0,
    }));

    const relations = await prisma.lawArticleRelation.findMany({
      where: { verificationStatus: VerificationStatus.VERIFIED },
      select: {
        sourceId: true,
        targetId: true,
        relationType: true,
        strength: true,
        confidence: true,
      },
    });

    const links: GraphLink[] = relations.map((r) => ({
      source: r.sourceId,
      target: r.targetId,
      relationType: r.relationType,
      strength: r.strength,
      confidence: r.confidence,
    }));

    return { nodes, links };
  }
}
```

### 5.3 批量关系发现脚本

```typescript
// scripts/discover-relations.ts

import { prisma } from '../src/lib/db';
import { RuleBasedDetector } from '../src/lib/law-article/relation-discovery/rule-based-detector';
import { AIDetector } from '../src/lib/law-article/relation-discovery/ai-detector';
import { CaseDerivedDetector } from '../src/lib/law-article/relation-discovery/case-derived-detector';
import { LawArticleRelationService } from '../src/lib/law-article/relation-service';
import { DiscoveryLogger } from '../src/lib/law-article/relation-discovery/discovery-logger';

async function discoverAllRelations() {
  console.log('开始批量发现关系...');
  
  const startTime = Date.now();
  let totalRelations = 0;

  // 获取所有法条
  const articles = await prisma.lawArticle.findMany({
    select: {
      id: true,
      lawName: true,
      articleNumber: true,
      fullText: true,
    },
  });

  console.log(`找到 ${articles.length} 条法条`);

  for (let i = 0; i < articles.length; i++) {
    const article = articles[i];
    const articleStartTime = Date.now();

    try {
      // 1. 规则检测
      const ruleRelations = await RuleBasedDetector.detectAllRelations(article);
      
      // 2. 转换为关系输入格式
      const relationInputs = [];
      
      // 处理引用关系
      for (const cite of ruleRelations.cites) {
        // 查找目标法条
        const target = await prisma.lawArticle.findFirst({
          where: {
            lawName: cite.lawName,
            articleNumber: cite.articleNumber,
          },
        });

        if (target) {
          relationInputs.push({
            sourceId: article.id,
            targetId: target.id,
            relationType: 'CITES' as const,
            confidence: cite.confidence,
            discoveryMethod: 'RULE_BASED' as const,
            evidence: { text: cite.evidence },
          });
        }
      }

      // 处理层级关系
      for (const hierarchy of ruleRelations.hierarchical) {
        const parent = await prisma.lawArticle.findFirst({
          where: { lawName: hierarchy.parentLawName },
        });

        if (parent) {
          relationInputs.push({
            sourceId: article.id,
            targetId: parent.id,
            relationType: 'IMPLEMENTS' as const,
            confidence: hierarchy.confidence,
            discoveryMethod: 'RULE_BASED' as const,
          });
        }
      }

      // 3. 批量创建关系
      if (relationInputs.length > 0) {
        await LawArticleRelationService.batchCreateRelations(relationInputs);
        totalRelations += relationInputs.length;
      }

      // 4. 记录日志
      const duration = Date.now() - articleStartTime;
      DiscoveryLogger.logDiscovery({
        articleId: article.id,
        method: 'RULE_BASED',
        relationsFound: relationInputs.length,
        duration,
        cost: 0,
      });

      console.log(
        `[${i + 1}/${articles.length}] ${article.lawName} ${article.articleNumber}: ` +
        `发现 ${relationInputs.length} 个关系`
      );

    } catch (error) {
      console.error(
        `处理 ${article.lawName} ${article.articleNumber} 失败:`,
        error
      );
    }
  }

  const totalDuration = Date.now() - startTime;
  
  console.log('\n========== 发现完成 ==========');
  console.log(`总法条数: ${articles.length}`);
  console.log(`总关系数: ${totalRelations}`);
  console.log(`总耗时: ${(totalDuration / 1000).toFixed(2)}秒`);
  console.log(`平均每条: ${(totalDuration / articles.length).toFixed(2)}ms`);
}

// 运行脚本
discoverAllRelations()
  .then(() => {
    console.log('脚本执行完成');
    process.exit(0);
  })
  .catch((error) => {
    console.error('脚本执行失败:', error);
    process.exit(1);
  });
```

---

## 六、可视化组件实现

### 6.1 图谱可视化组件

```typescript
// src/components/law-article/LawArticleGraphVisualization.tsx

'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { GraphNode, GraphLink } from '@/lib/law-article/graph-builder';

interface Props {
  centerArticleId: string;
  depth?: number;
}

export function LawArticleGraphVisualization({ centerArticleId, depth = 2 }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [graphData, setGraphData] = useState<{ nodes: GraphNode[]; links: GraphLink[] }>();
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [loading, setLoading] = useState(true);

  // 加载图谱数据
  useEffect(() => {
    async function loadGraph() {
      setLoading(true);
      try {
        const response = await fetch(`/api/v1/law-articles/${centerArticleId}/graph?depth=${depth}`);
        const data = await response.json();
        setGraphData(data);
      } catch (error) {
        console.error('加载图谱失败:', error);
      } finally {
        setLoading(false);
      }
    }
    loadGraph();
  }, [centerArticleId, depth]);

  // 渲染图谱
  useEffect(() => {
    if (!graphData || !svgRef.current) return;

    const width = 1200;
    const height = 800;

    // 清空SVG
    d3.select(svgRef.current).selectAll('*').remove();

    const svg = d3
      .select(svgRef.current)
      .attr('width', width)
      .attr('height', height)
      .attr('viewBox', [0, 0, width, height]);

    // 创建力导向图
    const simulation = d3
      .forceSimulation(graphData.nodes as any)
      .force(
        'link',
        d3
          .forceLink(graphData.links as any)
          .id((d: any) => d.id)
          .distance((d: any) => 100 / d.strength)
      )
      .force('charge', d3.forceManyBody().strength(-300))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(30));

    // 绘制连线
    const link = svg
      .append('g')
      .selectAll('line')
      .data(graphData.links)
      .enter()
      .append('line')
      .attr('stroke', (d: any) => getRelationColor(d.relationType))
      .attr('stroke-width', (d: any) => d.strength * 3)
      .attr('stroke-opacity', 0.6);

    // 绘制节点
    const node = svg
      .append('g')
      .selectAll('circle')
      .data(graphData.nodes)
      .enter()
      .append('circle')
      .attr('r', (d: GraphNode) => (d.id === centerArticleId ? 15 : 10))
      .attr('fill', (d: GraphNode) => getCategoryColor(d.category))
      .attr('stroke', '#fff')
      .attr('stroke-width', 2)
      .style('cursor', 'pointer')
      .call(
        d3
          .drag()
          .on('start', dragstarted)
          .on('drag', dragged)
          .on('end', dragended) as any
      )
      .on('click', (event: MouseEvent, d: GraphNode) => {
        event.stopPropagation();
        setSelectedNode(d);
      });

    // 添加标签
    const label = svg
      .append('g')
      .selectAll('text')
      .data(graphData.nodes)
      .enter()
      .append('text')
      .text((d: GraphNode) => `${d.lawName}-${d.articleNumber}`)
      .attr('font-size', 10)
      .attr('dx', 12)
      .attr('dy', 4)
      .style('pointer-events', 'none');

    // 更新位置
    simulation.on('tick', () => {
      link
        .attr('x1', (d: any) => d.source.x)
        .attr('y1', (d: any) => d.source.y)
        .attr('x2', (d: any) => d.target.x)
        .attr('y2', (d: any) => d.target.y);

      node.attr('cx', (d: any) => d.x).attr('cy', (d: any) => d.y);

      label.attr('x', (d: any) => d.x).attr('y', (d: any) => d.y);
    });

    // 拖拽函数
    function dragstarted(event: any) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      event.subject.fx = event.subject.x;
      event.subject.fy = event.subject.y;
    }

    function dragged(event: any) {
      event.subject.fx = event.x;
      event.subject.fy = event.y;
    }

    function dragended(event: any) {
      if (!event.active) simulation.alphaTarget(0);
      event.subject.fx = null;
      event.subject.fy = null;
    }

    return () => {
      simulation.stop();
    };
  }, [graphData]);

  // 关系类型颜色映射
  function getRelationColor(type: string): string {
    const colors: Record<string, string> = {
      CITES: '#3b82f6',
      CITED_BY: '#60a5fa',
      CONFLICTS: '#ef4444',
      COMPLETES: '#22c55e',
      COMPLETED_BY: '#4ade80',
      SUPERSEDES: '#a855f7',
      SUPERSEDED_BY: '#c084fc',
      IMPLEMENTS: '#f59e0b',
      IMPLEMENTED_BY: '#fbbf24',
      RELATED: '#6b7280',
    };
    return colors[type] || '#6b7280';
  }

  // 分类颜色映射
  function getCategoryColor(category: string): string {
    const colors: Record<string, string> = {
      CIVIL: '#3b82f6',
      CRIMINAL: '#ef4444',
      ADMINISTRATIVE: '#22c55e',
      COMMERCIAL: '#f59e0b',
      LABOR: '#a855f7',
    };
    return colors[category] || '#6b7280';
  }

  if (loading) {
    return <div className="flex items-center justify-center h-96">加载中...</div>;
  }

  return (
    <div className="relative">
      <svg ref={svgRef} className="border rounded-lg w-full" />

      {/* 图例 */}
      <div className="absolute top-4 right-4 bg-white p-4 rounded shadow-lg">
        <h3 className="font-bold mb-2">关系类型</h3>
        <div className="space-y-1 text-sm">
          <div><span className="inline-block w-4 h-1 bg-blue-500 mr-2"></span>引用</div>
          <div><span className="inline-block w-4 h-1 bg-red-500 mr-2"></span>冲突</div>
          <div><span className="inline-block w-4 h-1 bg-green-500 mr-2"></span>补全</div>
          <div><span className="inline-block w-4 h-1 bg-purple-500 mr-2"></span>替代</div>
          <div><span className="inline-block w-4 h-1 bg-orange-500 mr-2"></span>实施</div>
        </div>
      </div>

      {/* 节点详情 */}
      {selectedNode && (
        <div className="absolute bottom-4 left-4 bg-white p-4 rounded shadow-lg">
          <h3 className="font-bold mb-2">{selectedNode.lawName}</h3>
          <p className="text-sm text-gray-600">第{selectedNode.articleNumber}条</p>
          <p className="text-sm text-gray-500">{selectedNode.category}</p>
          <button
            onClick={() => setSelectedNode(null)}
            className="mt-2 px-3 py-1 bg-gray-200 rounded text-sm"
          >
            关闭
          </button>
        </div>
      )}
    </div>
  );
}
```

---

## 七、API接口设计

### 7.1 图谱查询API

```typescript
// src/app/api/v1/law-articles/[id]/graph/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { GraphBuilder } from '@/lib/law-article/graph-builder';
import { prisma } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    const depth = parseInt(searchParams.get('depth') || '2');

    // 验证法条存在
    const article = await prisma.lawArticle.findUnique({
      where: { id: params.id },
    });

    if (!article) {
      return NextResponse.json({ error: '法条不存在' }, { status: 404 });
    }

    // 构建图谱数据
    const graph = await GraphBuilder.buildGraph(params.id, depth);

    return NextResponse.json(graph);
  } catch (error) {
    console.error('获取图谱数据失败:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
```

### 7.2 关系管理API

```typescript
// src/app/api/v1/law-articles/[id]/relations/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { LawArticleRelationService } from '@/lib/law-article/relation-service';
import { prisma } from '@/lib/db';

// GET 获取法条的所有关系
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    const relationType = searchParams.get('relationType') as any;
    const direction = searchParams.get('direction') as any;
    const minStrength = searchParams.get('minStrength')
      ? parseFloat(searchParams.get('minStrength')!)
      : undefined;

    const relations = await LawArticleRelationService.getArticleRelations(params.id, {
      relationType,
      direction,
      minStrength,
    });

    return NextResponse.json(relations);
  } catch (error) {
    console.error('获取关系失败:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

// POST 创建关系
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();

    const relation = await LawArticleRelationService.createRelation({
      sourceId: params.id,
      ...body,
    });

    return NextResponse.json(relation, { status: 201 });
  } catch (error: any) {
    console.error('创建关系失败:', error);
    return NextResponse.json({ error: error.message || '服务器错误' }, { status: 400 });
  }
}
```

### 7.3 关系验证API

```typescript
// src/app/api/v1/law-article-relations/[id]/verify/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { LawArticleRelationService } from '@/lib/law-article/relation-service';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { verifiedBy, isApproved } = body;

    const relation = await LawArticleRelationService.verifyRelation(
      params.id,
      verifiedBy,
      isApproved
    );

    return NextResponse.json(relation);
  } catch (error) {
    console.error('验证关系失败:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
```

---

## 八、管理后台设计

### 8.1 关系管理页面

```typescript
// src/app/admin/law-article-relations/page.tsx

'use client';

import React from 'react';

export default function LawArticleRelationsAdminPage() {
  return (
    <div className="container mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">法条关系管理</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        {/* 待审核数量 */}
        <div className="bg-yellow-50 p-4 rounded-lg">
          <div className="text-sm text-gray-600">待审核</div>
          <div className="text-2xl font-bold">128</div>
        </div>
        
        {/* 总关系数 */}
        <div className="bg-blue-50 p-4 rounded-lg">
          <div className="text-sm text-gray-600">总关系数</div>
          <div className="text-2xl font-bold">12,345</div>
        </div>
        
        {/* 引用关系 */}
        <div className="bg-green-50 p-4 rounded-lg">
          <div className="text-sm text-gray-600">引用关系</div>
          <div className="text-2xl font-bold">8,234</div>
        </div>
        
        {/* 冲突关系 */}
        <div className="bg-red-50 p-4 rounded-lg">
          <div className="text-sm text-gray-600">冲突关系</div>
          <div className="text-2xl font-bold">156</div>
        </div>
      </div>

      {/* 关系列表表格 */}
      <div className="bg-white rounded-lg shadow">
        {/* 表格内容 */}
      </div>
    </div>
  );
}
```

### 8.2 关系审核页面

```typescript
// src/app/admin/law-article-relations/verify/page.tsx

'use client';

import React from 'react';

export default function VerifyRelationsPage() {
  return (
    <div className="container mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">批量审核关系</h1>
      
      {/* 批量操作按钮 */}
      <div className="flex gap-4 mb-6">
        <button className="px-4 py-2 bg-green-500 text-white rounded">
          批量通过
        </button>
        <button className="px-4 py-2 bg-red-500 text-white rounded">
          批量拒绝
        </button>
        <button className="px-4 py-2 bg-gray-500 text-white rounded">
          导出待审核列表
        </button>
      </div>

      {/* 关系列表（带选择框） */}
      <div className="bg-white rounded-lg shadow">
        {/* 审核列表内容 */}
      </div>
    </div>
  );
}
```

### 8.3 关系统计页面

```typescript
// src/app/admin/law-article-relations/stats/page.tsx

'use client';

import React from 'react';

export default function RelationStatsPage() {
  return (
    <div className="container mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">关系统计分析</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 按类型统计 */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-bold mb-4">按关系类型</h2>
          {/* 图表 */}
        </div>

        {/* 按发现方式统计 */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-bold mb-4">按发现方式</h2>
          {/* 图表 */}
        </div>

        {/* 覆盖率统计 */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-bold mb-4">关系覆盖率</h2>
          {/* 图表 */}
        </div>

        {/* 质量统计 */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-bold mb-4">质量分布</h2>
          {/* 图表 */}
        </div>
      </div>
    </div>
  );
}
```

---

## 九、测试策略

### 9.1 单元测试

```typescript
// src/__tests__/lib/law-article/relation-discovery/rule-based-detector.test.ts

import { RuleBasedDetector } from '@/lib/law-article/relation-discovery/rule-based-detector';
import { LawArticle } from '@prisma/client';

describe('RuleBasedDetector', () => {
  const mockArticle: LawArticle = {
    id: '1',
    lawName: '民法典',
    articleNumber: '1',
    fullText: '根据宪法制定本法。依照合同法第10条的规定。',
    category: 'CIVIL',
    // ... 其他字段
  } as any;

  describe('detectCitesRelation', () => {
    it('应该检测到引用关系', () => {
      const relations = RuleBasedDetector.detectCitesRelation(mockArticle);

      expect(relations).toHaveLength(1);
      expect(relations[0].lawName).toBe('合同法');
      expect(relations[0].articleNumber).toBe('10');
    });

    it('应该返回正确的置信度', () => {
      const relations = RuleBasedDetector.detectCitesRelation(mockArticle);

      expect(relations[0].confidence).toBe(0.95);
    });
  });

  describe('detectHierarchicalRelation', () => {
    it('应该检测到上位法关系', () => {
      const relations = RuleBasedDetector.detectHierarchicalRelation(mockArticle);

      expect(relations).toHaveLength(1);
      expect(relations[0].parentLawName).toBe('宪法');
      expect(relations[0].relationType).toBe('IMPLEMENTS');
    });
  });
});
```

### 9.2 集成测试

```typescript
// src/__tests__/integration/law-article/relation-service.test.ts

import { LawArticleRelationService } from '@/lib/law-article/relation-service';
import { RelationType, DiscoveryMethod } from '@prisma/client';
import { prisma } from '@/lib/db';

describe('LawArticleRelationService Integration', () => {
  let sourceArticleId: string;
  let targetArticleId: string;

  beforeAll(async () => {
    // 创建测试数据
    const source = await prisma.lawArticle.create({
      data: {
        lawName: '测试法A',
        articleNumber: '1',
        fullText: '这是测试法条A',
        category: 'CIVIL',
      },
    });

    const target = await prisma.lawArticle.create({
      data: {
        lawName: '测试法B',
        articleNumber: '2',
        fullText: '这是测试法条B',
        category: 'CIVIL',
      },
    });

    sourceArticleId = source.id;
    targetArticleId = target.id;
  });

  afterAll(async () => {
    // 清理测试数据
    await prisma.lawArticleRelation.deleteMany({});
    await prisma.lawArticle.deleteMany({});
  });

  describe('createRelation', () => {
    it('应该成功创建关系', async () => {
      const relation = await LawArticleRelationService.createRelation({
        sourceId: sourceArticleId,
        targetId: targetArticleId,
        relationType: RelationType.CITES,
        confidence: 0.9,
        discoveryMethod: DiscoveryMethod.RULE_BASED,
      });

      expect(relation).toBeDefined();
      expect(relation.sourceId).toBe(sourceArticleId);
      expect(relation.targetId).toBe(targetArticleId);
      expect(relation.relationType).toBe(RelationType.CITES);
    });

    it('应该拒绝自引用', async () => {
      await expect(
        LawArticleRelationService.createRelation({
          sourceId: sourceArticleId,
          targetId: sourceArticleId,
          relationType: RelationType.CITES,
        })
      ).rejects.toThrow('禁止自引用');
    });
  });

  describe('getArticleRelations', () => {
    it('应该获取法条的所有关系', async () => {
      const relations = await LawArticleRelationService.getArticleRelations(sourceArticleId);

      expect(relations.outgoingRelations).toHaveLength(1);
      expect(relations.incomingRelations).toHaveLength(0);
      expect(relations.totalRelations).toBe(1);
    });
  });
});
```

### 9.3 性能测试

```typescript
// src/__tests__/performance/relation-performance.test.ts

describe('Relation Performance Tests', () => {
  describe('大数据量查询性能', () => {
    it('10万法条 + 100万关系查询应在5秒内完成', async () => {
      const startTime = Date.now();
      
      const relations = await LawArticleRelationService.getArticleRelations(
        'article-id-12345'
      );
      
      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(5000);
      expect(relations.totalRelations).toBeGreaterThan(0);
    });

    it('3层深度关系路径查询应在1秒内完成', async () => {
      const startTime = Date.now();
      
      const paths = await LawArticleRelationService.findRelationPath(
        'source-id',
        'target-id',
        3
      );
      
      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(1000);
      expect(paths.length).toBeGreaterThan(0);
    });
  });

  describe('并发创建关系', () => {
    it('并发创建1000个关系不应出现数据不一致', async () => {
      const promises = Array.from({ length: 1000 }, (_, i) => 
        LawArticleRelationService.createRelation({
          sourceId: `source-${i}`,
          targetId: `target-${i}`,
          relationType: 'CITES',
        })
      );

      const results = await Promise.allSettled(promises);
      const failed = results.filter(r => r.status === 'rejected');
      
      expect(failed.length).toBeLessThan(10); // 允许少量失败
    });
  });
});
```

### 9.4 AI服务降级测试

```typescript
// src/__tests__/integration/ai-detector-fallback.test.ts

describe('AI Detector Fallback Tests', () => {
  it('AI服务不可用时应降级到规则匹配', async () => {
    // 模拟AI服务失败
    jest.spyOn(AIDetector, 'detectRelations').mockRejectedValue(
      new Error('AI service unavailable')
    );

    const result = await AIDetector.detectRelations(
      mockArticle1,
      mockArticle2
    );

    // 应该返回空结果而不是抛出错误
    expect(result.relations).toBeDefined();
  });
});
```

---

## 十、实施计划

### 10.1 实施前准备清单

在开始实施前，必须完成以下准备工作：

- [ ] **数据库容量评估**
  - [ ] 统计现有法条数量
  - [ ] 预估关系数量（按法条数 × 平均关系数）
  - [ ] 评估数据库存储空间需求

- [ ] **AI预算设置**
  - [ ] 确定每月AI调用预算上限
  - [ ] 配置AI成本监控
  - [ ] 设置告警阈值

- [ ] **测试数据准备**
  - [ ] 准备至少100条测试法条
  - [ ] 准备各种关系类型的测试用例
  - [ ] 准备边界情况测试数据

- [ ] **环境准备**
  - [ ] 确保Redis已安装并运行
  - [ ] 确保PostgreSQL版本兼容
  - [ ] 检查网络连接（AI服务）

- [ ] **依赖安装**
  - [ ] 安装D3.js: `npm install d3 @types/d3`
  - [ ] 安装其他必要的依赖

- [ ] **数据备份**
  - [ ] 在迁移前完整备份数据库
  - [ ] 准备回滚方案
  - [ ] 备份Prisma schema

### 10.2 调整后的实施计划

基于MVP优先原则，建议调整实施顺序：

#### 第一批：核心功能MVP（8-10天）

| 阶段 | 名称 | 工作量 | 说明 |
|------|------|--------|------|
| 阶段1 | 数据库迁移 | 1-2天 | Prisma迁移、索引创建 |
| 阶段2 | 规则引擎MVP | 2-3天 | 只实现引用关系检测 |
| 阶段3 | 关系管理服务 | 2-3天 | 核心CRUD、关系验证 |
| 阶段4 | API接口 | 2-3天 | 基础查询、创建接口 |
| 验证 | MVP验证 | 1天 | 验证核心功能可行性 |

#### 第二批：可视化功能（3-5天）

| 阶段 | 名称 | 工作量 | 说明 |
|------|------|--------|------|
| 阶段5 | 可视化组件 | 3-5天 | D3.js图谱、交互功能 |

#### 第三批：AI增强（5-7天）

| 阶段 | 名称 | 工作量 | 说明 |
|------|------|--------|------|
| 阶段6 | AI语义分析 | 5-7天 | AI检测器、成本控制 |
| 阶段7 | 案例推导引擎 | 3-5天 | 共现关系、使用模式 |

#### 第四批：优化与集成（3-5天）

| 阶段 | 名称 | 工作量 | 说明 |
|------|------|--------|------|
| 阶段8 | 测试与优化 | 3-5天 | 性能测试、压力测试 |
| 阶段9 | 应用集成 | 3-5天 | 法条详情、辩论生成集成 |

### 10.3 详细任务清单

#### 阶段1：数据库迁移（1-2天）

**任务清单**:
- [ ] 创建Prisma迁移文件
- [ ] 定义LawArticleRelation模型
- [ ] 定义RelationType枚举（包含反向关系）
- [ ] 定义DiscoveryMethod枚举
- [ ] 定义VerificationStatus枚举
- [ ] 运行开发环境迁移
- [ ] 创建数据库索引（包括复合索引）
- [ ] 编写数据验证脚本
- [ ] 测试回滚方案

**验收标准**:
- [ ] 迁移文件创建成功
- [ ] 数据库表结构正确（包含反向关系类型）
- [ ] 索引创建完成（包括复合索引）
- [ ] 数据验证通过（字段类型、约束）
- [ ] 回滚方案测试通过

#### 阶段2：规则引擎MVP（2-3天）

**任务清单**:
- [ ] 创建relation-discovery目录结构
- [ ] 实现patterns.ts（正则模式库）
- [ ] 实现types.ts（类型定义）
- [ ] 实现detectCitesRelation方法
- [ ] 实现detectHierarchicalRelation方法
- [ ] 实现detectConflictsRelation方法
- [ ] 编写单元测试
- [ ] 编写集成测试
- [ ] 性能基准测试

**验收标准**:
- [ ] 所有检测方法实现完成
- [ ] 单元测试覆盖率 > 80%
- [ ] 集成测试通过
- [ ] 性能测试通过

#### 阶段3：关系管理服务（2-3天）

**任务清单**:
- [ ] 创建relation-service.ts
- [ ] 实现createRelation方法
- [ ] 实现batchCreateRelations方法
- [ ] 实现getArticleRelations方法
- [ ] 实现findRelationPath方法
- [ ] 实现getRelationStats方法
- [ ] 实现verifyRelation方法
- [ ] 实现deleteRelation方法
- [ ] 移除关系唯一性检查（适配新策略）
- [ ] 编写单元测试
- [ ] 编写集成测试

**验收标准**:
- [ ] 所有服务方法实现完成
- [ ] 关系验证逻辑正确
- [ ] 批量操作性能达标
- [ ] 测试覆盖率 > 80%

#### 阶段4：API接口（2-3天）

**任务清单**:
- [ ] 创建图谱查询API
- [ ] 创建关系管理API
- [ ] 创建关系验证API
- [ ] 添加错误处理
- [ ] 添加权限控制
- [ ] 添加请求验证
- [ ] 编写API测试
- [ ] 生成API文档

**验收标准**:
- [ ] 所有API端点正常工作
- [ ] 错误处理完善
- [ ] 权限控制生效
- [ ] API文档完成

#### 阶段5：可视化组件（3-5天）

**任务清单**:
- [ ] 安装D3.js依赖
- [ ] 创建LawArticleGraphVisualization组件
- [ ] 实现力导向图渲染
- [ ] 实现节点拖拽功能
- [ ] 实现缩放和平移
- [ ] 添加图例
- [ ] 添加节点详情展示
- [ ] 优化大数据量性能（虚拟滚动、LOD）
- [ ] 编写组件测试
- [ ] 浏览器兼容性测试

**验收标准**:
- [ ] 组件正常渲染
- [ ] 交互功能正常
- [ ] 性能优化完成（支持1000+节点）
- [ ] 浏览器兼容性测试通过

#### 阶段6：AI语义分析（5-7天）

**任务清单**:
- [ ] 创建ai-detector-config.ts
- [ ] 创建ai-cost-monitor.ts
- [ ] 实现AIDetector类
- [ ] 实现detectRelations方法
- [ ] 实现batchDetectRelations方法
- [ ] 实现isPotentiallyRelated预筛选
- [ ] 实现AI降级机制
- [ ] 优化AI调用成本
- [ ] 编写单元测试
- [ ] 编写集成测试
- [ ] 成本监控测试

**验收标准**:
- [ ] AI检测准确率 > 85%
- [ ] 批量分析性能达标
- [ ] 成本控制在预算范围内
- [ ] 测试覆盖率 > 70%
- [ ] 降级机制测试通过

#### 阶段7：案例推导引擎（3-5天）

**任务清单**:
- [ ] 创建case-derived-detector.ts
- [ ] 实现discoverFromCases方法
- [ ] 实现analyzeUsagePattern方法
- [ ] 优化SQL查询性能
- [ ] 编写单元测试
- [ ] 编写集成测试
- [ ] 性能基准测试

**验收标准**:
- [ ] 共现关系发现准确
- [ ] 使用模式分析正确
- [ ] 性能优化完成
- [ ] 测试通过

#### 阶段8：测试与优化（3-5天）

**任务清单**:
- [ ] 编写E2E测试
- [ ] 性能测试和优化（10万法条+100万关系）
- [ ] 并发测试（1000并发关系创建）
- [ ] 安全测试
- [ ] AI服务降级测试
- [ ] 浏览器兼容性测试
- [ ] 代码审查
- [ ] 文档更新

**验收标准**:
- [ ] E2E测试通过
- [ ] 性能指标达标（5秒内完成查询）
- [ ] 安全测试通过
- [ ] 文档完整

#### 阶段9：应用场景集成（3-5天）

**任务清单**:
- [ ] 在法条详情页集成关系图谱
- [ ] 在辩论生成时推荐关联法条
- [ ] 在合同审查时提示补全法条
- [ ] 添加用户反馈机制
- [ ] 编写使用文档
- [ ] 用户验收测试

**验收标准**:
- [ ] 所有集成功能正常工作
- [ ] 用户体验优化完成
- [ ] 文档完整清晰
- [ ] 用户验收通过

---

## 十一、风险与应对

### 11.1 技术风险

| 风险 | 影响 | 概率 | 应对措施 |
|------|------|------|----------|
| 大数据量性能问题 | 高 | 中 | 1. 实现分页查询<br>2. 使用Redis缓存<br>3. 优化数据库索引<br>4. 限制查询深度<br>5. 使用内存邻接表优化BFS |
| AI调用成本过高 | 中 | 高 | 1. 预筛选机制<br>2. 批量处理<br>3. 限制AI使用场景<br>4. 成本监控和告警<br>5. 考虑本地模型 |
| 关系发现准确率不足 | 高 | 中 | 1. 人工审核机制<br>2. 用户反馈系统<br>3. 持续优化规则<br>4. A/B测试验证<br>5. 关系冲突处理 |
| 可视化性能问题 | 中 | 中 | 1. 虚拟滚动<br>2. LOD优化<br>3. WebGL渲染<br>4. 限制展示节点数<br>5. 惰性加载 |
| 图谱构建性能瓶颈 | 中 | 高 | 1. 批量查询优化<br>2. 内存邻接表<br>3. 关系缓存 |

### 11.2 项目风险

| 风险 | 影响 | 概率 | 应对措施 |
|------|------|------|----------|
| 时间估算偏差 | 中 | 中 | 1. 分阶段交付<br>2. 优先级排序<br>3. 定期回顾调整<br>4. 预留缓冲时间<br>5. MVP优先原则 |
| 需求变更 | 中 | 高 | 1. 敏捷开发<br>2. 快速迭代<br>3. 模块化设计<br>4. 充分沟通<br>5. 需求冻结期 |
| 人员流动 | 高 | 低 | 1. 代码文档化<br>2. 知识共享<br>3. 代码审查<br>4. 备份计划<br>5. 结对开发 |
| AI服务不可用 | 高 | 中 | 1. 降级策略<br>2. 多AI服务提供商<br>3. 本地模型备选 |

### 11.3 数据风险

| 风险 | 影响 | 概率 | 应对措施 |
|------|------|------|----------|
| 数据库迁移失败 | 高 | 低 | 1. 备份数据<br>2. 测试环境验证<br>3. 回滚方案<br>4. 灰度发布<br>5. 迁移脚本测试 |
| 关系数据质量差 | 高 | 中 | 1. 数据验证<br>2. 人工审核<br>3. 质量监控<br>4. 定期清理<br>5. 质量评分系统 |
| 数据不一致 | 中 | 中 | 1. 事务处理<br>2. 并发控制<br>3. 定期校验<br>4. 数据审计日志 |

---

## 十二、后续优化方向

### 12.1 功能扩展

- **关系推理**: 基于已知关系推断潜在关系（传递性推理）
- **时间维度**: 追踪关系的时效性（新法生效后旧法关系标记）
- **权重动态调整**: 基于用户反馈调整关系权重
- **个性化推荐**: 基于用户使用习惯推荐关系
- **关系版本控制**: 追踪关系的历史变更
- **跨领域关联**: 发现不同法律领域之间的隐式关系

### 12.2 性能优化

- **图数据库**: 考虑使用Neo4j等图数据库优化图谱查询
- **向量搜索**: 使用向量相似度补充关系发现（Embedding）
- **增量更新**: 只更新变化的关系，避免全量重建
- **并行处理**: 多线程/分布式处理关系发现
- **图分片**: 对超大规模图谱进行分片处理
- **GPU加速**: 使用WebGL/CUDA加速图谱渲染和计算

### 12.3 用户体验

- **3D可视化**: 更直观的3D图谱展示
- **交互式探索**: 更灵活的图谱导航（缩放、旋转、筛选）
- **关系解释**: 解释为什么存在这个关系（可视化推理链）
- **智能搜索**: 自然语言查询关系（如"找到与民法典第1条冲突的所有法条"）
- **关系路径高亮**: 可视化展示关系路径
- **时间轴视图**: 按时间线展示关系演化

### 12.4 智能化升级

- **自适应规则学习**: 基于AI反馈自动优化规则模式
- **多模态分析**: 结合文本、案例、裁判文书等多源信息
- **知识图谱推理**: 实现图谱查询、推理、推荐算法
- **实时关系更新**: 监控新法条发布，自动发现新关系
- **关系预测**: 预测可能存在但未发现的关系

---

## 十三、附录

### 13.1 术语表

| 术语 | 定义 |
|------|------|
| 法条关系 | 两个法条之间的语义关联 |
| 引用关系 (CITES) | 法条A明确引用法条B |
| 被引用关系 (CITED_BY) | 法条B被法条A引用（反向） |
| 冲突关系 (CONFLICTS) | 两个法条在相同条件下产生不同结论 |
| 补全关系 (COMPLETES) | 法条A补充完善法条B的规定 |
| 被补全关系 (COMPLETED_BY) | 法条B被法条A补全（反向） |
| 替代关系 (SUPERSEDES) | 新法条A替代旧法条B |
| 被替代关系 (SUPERSEDED_BY) | 旧法条B被新法条A替代（反向） |
| 实施关系 (IMPLEMENTS) | 细则A是上位法B的实施规定 |
| 被实施关系 (IMPLEMENTED_BY) | 上位法B被细则A实施（反向） |
| 一般关联 (RELATED) | 相关但不属于上述类型的关系 |
| 关系强度 | 关系的强弱程度（0-1） |
| 置信度 | 关系存在的可信程度（0-1） |
| 发现方式 | 关系是如何被发现的方法（规则/AI/案例/人工） |
| 审核状态 | 关系的验证状态（待审核/已验证/已拒绝） |
| 质量分数 | 综合评估关系质量的指标（0-1） |

### 13.2 参考文档

- [Prisma Schema Reference](https://www.prisma.io/docs/reference/api-reference/prisma-schema-reference)
- [D3.js Documentation](https://d3js.org/)
- [OpenAI API Documentation](https://platform.openai.com/docs/api-reference)
- [Graph Visualization Best Practices](https://graphology.github.io/)
- [Knowledge Graph Best Practices](https://towardsdatascience.com/introduction-to-knowledge-graphs-1d7c7790c9f)
- [Graph Algorithms](https://github.com/twobitc/graphology)

### 13.3 相关技术

| 技术 | 用途 | 学习资源 |
|------|------|----------|
| D3.js | 图谱可视化 | https://observablehq.com/@d3/gallery |
| D3 Force Simulation | 力导向布局 | https://github.com/d3/d3-force |
| PostgreSQL | 关系型数据库 | https://www.postgresql.org/docs/ |
| Redis | 缓存系统 | https://redis.io/documentation |
| Next.js | React框架 | https://nextjs.org/docs |

### 13.4 常见问题FAQ

**Q1: 为什么移除唯一约束改为索引？**
A: 允许同一对法条存在多条相同类型的关系，以便支持不同发现方式产生的多个证据。去重在应用层处理。

**Q2: AI检测的成本如何控制？**
A: 通过预筛选机制、批量处理、每日限额、成本监控等多重手段控制成本。

**Q3: 如何处理不同发现方式产生的冲突？**
A: 使用ConflictResolver根据优先级（规则>AI>案例）和置信度智能解决。

**Q4: 图谱查询性能如何优化？**
A: 使用批量查询、内存邻接表、关系缓存、限制查询深度等策略。

**Q5: 关系质量如何评估？**
A: 综合考虑发现方式权重、置信度、人工验证状态、关系强度等因素计算质量分数。

---

## 十四、更新日志

| 版本 | 日期 | 更新内容 |
|------|------|----------|
| v2.0 | 2026-01-31 | 采纳AI审查意见，全面修订实施路线图 |
| v1.0 | 2026-01-31 | 初始版本 |

---

**文档版本**: v2.0  
**最后更新**: 2026-01-31  
**维护者**: 开发团队
