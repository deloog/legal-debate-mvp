# 律伴助手系统改进实施清单 V2

> **版本**: v2.0（基于审计结果修正）  
> **审计日期**: 2026-03-31  
> **修正说明**: 根据审计反馈，修正了CRM表状态、VerificationAgent集成程度、API数量等关键信息

---

## 📋 审计修正摘要

### 原路线图 vs 实际情况

| 项目              | 原路线图   | 审计结果                                       | 修正                   |
| ----------------- | ---------- | ---------------------------------------------- | ---------------------- |
| VerificationAgent | 完全未集成 | **部分集成**（UI有，分数是固定值）             | 改为动态接入           |
| CRM数据库表       | 需新建     | **已存在**（CommunicationRecord/FollowUpTask） | 只需前端页面           |
| CRM页面           | 完全缺失   | **部分存在**（列表/详情有，子页面缺）          | 补充子功能             |
| 根级API数量       | 19个       | **48个**                                       | 混乱更严重，需优先处理 |
| E2E通过率         | 44.4%      | **可能已过时**                                 | 需重新测试确认         |
| 会员服务          | 分散       | 部分已统一入口（re-export）                    | 需真正整合             |

### 工时差修正

| 任务                     | 原工时 | 修正工时 | 节省原因               |
| ------------------------ | ------ | -------- | ---------------------- |
| P0-001 VerificationAgent | 5天    | **3天**  | UI已存在，只需接入逻辑 |
| P1-001 CRM功能           | 10天   | **6天**  | 无需数据库迁移         |
| **总节省**               | -      | **6天**  | -                      |

---

## 阶段一：核心能力激活（第1-3周）

> **目标**：将沉睡的Agent能力真正接入业务流程  
> **优先级**：🔴 P0 - 立即实施  
> **总工期**: 8天（原11天）

### P0-001: VerificationAgent 动态接入

**状态**: 🔴 待开始  
**工期**: 3天（原5天）  
**难度**: 中等

#### 当前状态分析

```typescript
// 现有实现（问题所在）
// src/app/debates/components/argument-card.tsx
// 已显示 legalScore/logicScore/overallScore
// 但分数是 generateSideArguments 固定写入，非真实验证
```

#### 需要完成的工作

| #   | 任务                     | 工时 | 技术要点                                                       |
| --- | ------------------------ | ---- | -------------------------------------------------------------- |
| 1   | 修改辩论生成流程         | 8h   | 在 `generateSideArguments` 后调用 `VerificationAgent.verify()` |
| 2   | 更新 Argument 表写入逻辑 | 4h   | 将真实验证结果存入数据库                                       |
| 3   | 验证前端展示正确性       | 4h   | 确认现有 UI 正确显示动态分数                                   |
| 4   | 添加验证详情API          | 4h   | `GET /api/v1/arguments/[id]/verification`                      |
| 5   | 编写测试                 | 4h   | 单元测试 + API测试                                             |

#### 技术实现

```typescript
// src/lib/debate/debate-generator.ts

// 修改后流程
async function generateArgumentWithVerification(caseInfo, legalBasis) {
  // 1. 生成论点（现有逻辑）
  const argument = await generateSideArguments(caseInfo, legalBasis);

  // 2. 【新增】动态验证
  const verificationAgent = new VerificationAgent();
  const verificationResult = await verificationAgent.verify(argument, {
    sourceCase: caseInfo,
  });

  // 3. 【修改】存储真实验证结果
  await prisma.argument.update({
    where: { id: argument.id },
    data: {
      legalScore: verificationResult.factualAccuracy, // 真实分数
      logicScore: verificationResult.logicalConsistency, // 真实分数
      overallScore: verificationResult.overallScore, // 真实分数
      verificationData: JSON.stringify(verificationResult), // 完整数据
    },
  });

  return argument;
}
```

#### 验收标准

- [ ] 辩论论点分数由 VerificationAgent **动态计算**
- [ ] 点击验证徽章显示 **三重验证详情**（事实+逻辑+完整度）
- [ ] 验证结果包含 **问题列表** 和 **改进建议**
- [ ] API 响应时间 < 500ms（验证计算耗时）

#### 依赖项

- VerificationAgent 已实现（`src/lib/agent/verification-agent/`）
- 前端 UI 已存在（`argument-card.tsx`）

---

### P0-002: MemoryAgent 管理界面（完全新建）

**状态**: 🔴 待开始  
**工期**: 6天  
**难度**: 中等  
**无变化**（审计确认完全不存在）

#### 需要完成的工作

| #   | 任务                 | 工时 | 说明                  |
| --- | -------------------- | ---- | --------------------- |
| 1   | 创建记忆管理后台页面 | 10h  | `/admin/memories`     |
| 2   | 实现记忆列表组件     | 8h   | 支持排序、筛选        |
| 3   | 创建记忆统计面板     | 8h   | 迁移统计、命中率      |
| 4   | 添加批量清理功能     | 6h   | 按条件批量删除        |
| 5   | 创建管理API          | 10h  | search/cleanup/export |
| 6   | 编写测试             | 6h   | 组件测试 + API测试    |

#### 关键API设计

```typescript
// GET /api/admin/memories
interface MemoryListResponse {
  data: {
    id: string;
    type: 'WORKING' | 'HOT' | 'COLD';
    agentName: string;
    key: string;
    size: number;
    compressionRatio?: number;
    importance: number;
    accessCount: number;
    expiresAt?: string;
    createdAt: string;
  }[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
  };
}

// POST /api/admin/memories/cleanup
interface CleanupRequest {
  type?: 'WORKING' | 'HOT' | 'COLD';
  olderThan?: string; // ISO日期
  maxImportance?: number;
  dryRun?: boolean; // 预览模式
}
```

---

### P0-003: Agent 监控仪表盘（完全新建）

**状态**: 🔴 待开始  
**工期**: 4天  
**难度**: 低  
**无变化**（审计确认完全不存在）

#### 核心功能

- 6个 Agent 健康状态实时监控
- AgentAction 日志聚合分析
- 性能指标可视化（响应时间、成功率）

---

## 阶段二：功能补全与优化（第4-7周）

> **目标**：补充缺失的子功能，优化现有功能  
> **优先级**：🟡 P1 - 近期实施  
> **总工期**: 17天（原20天）

### P1-001: CRM 子功能完善（修正版）

**状态**: 🔴 待开始  
**工期**: 6天（原10天，节省4天）  
**难度**: 低  
**重大修正**：无需数据库迁移！

#### 当前状态（审计确认）

| 组件                   | 状态      | 路径                            |
| ---------------------- | --------- | ------------------------------- |
| 客户列表页             | ✅ 已存在 | `src/app/clients/page.tsx`      |
| 客户详情页             | ✅ 已存在 | `src/app/clients/[id]/page.tsx` |
| CommunicationRecord 表 | ✅ 已存在 | `prisma/schema.prisma:1123`     |
| FollowUpTask 表        | ✅ 已存在 | `prisma/schema.prisma:1147`     |
| **沟通记录子页面**     | ❌ 缺失   | `/clients/[id]/communications`  |
| **跟进任务子页面**     | ❌ 缺失   | `/clients/[id]/follow-ups`      |

#### 需要完成的工作（简化版）

| #   | 任务                 | 工时 | 说明                                               |
| --- | -------------------- | ---- | -------------------------------------------------- |
| 1   | 检查现有API完整性    | 2h   | 确认 CommunicationRecord/FollowUpTask API 是否存在 |
| 2   | 补充缺失的API        | 6h   | 如缺失则创建 CRUD API                              |
| 3   | 创建沟通记录子页面   | 10h  | `/clients/[id]/communications/page.tsx`            |
| 4   | 创建跟进任务子页面   | 10h  | `/clients/[id]/follow-ups/page.tsx`                |
| 5   | 在客户详情页添加入口 | 4h   | 导航到子页面                                       |
| 6   | 编写测试             | 8h   | 页面测试 + API测试                                 |

#### 实施前检查清单

- [ ] 确认 `GET /api/clients/[id]/communications` 是否存在
- [ ] 确认 `GET /api/clients/[id]/follow-ups` 是否存在
- [ ] 如API已存在，工时进一步减少至 **4天**

---

### P1-002: API 版本策略统一（优先级提升）

**状态**: 🔴 待开始  
**工期**: 5天（原3天，增加2天）  
**难度**: 中等  
**修正**：问题比预计严重（48个根级目录 vs 原估计19个）

#### 现状分析

```
API 目录统计：
- /api/          : 48 个目录（混乱）
- /api/v1/       : 39 个目录（相对规范）
- /api/admin/    : 独立管理后台
- /api/auth/     : 认证相关
```

#### 统一策略

| 层级          | 用途     | 规则                               |
| ------------- | -------- | ---------------------------------- |
| `/api/auth/`  | 认证     | 保留，所有版本共用                 |
| `/api/v1/`    | 业务API  | **唯一正式版本**，新功能必须放这里 |
| `/api/admin/` | 管理后台 | 保留，内部使用                     |
| `/api/*`      | 遗留API  | **冻结**，不再新增，逐步迁移到 v1  |

#### 需要完成的工作

| #   | 任务              | 工时 | 说明                      |
| --- | ----------------- | ---- | ------------------------- |
| 1   | 扫描所有根级API   | 4h   | 列出48个目录的功能        |
| 2   | 识别重复/冲突路由 | 8h   | 对比 /api/ 和 /api/v1/    |
| 3   | 创建 v1 转发路由  | 12h  | 为缺失的 API 创建 v1 版本 |
| 4   | 更新前端调用      | 8h   | 统一使用 v1 路径          |
| 5   | 添加废弃标记      | 4h   | 根级路由加 @deprecated    |
| 6   | 编写迁移文档      | 4h   | 供团队参考                |

#### 风险评估

- **风险**: 修改API路径可能影响现有功能
- **缓解**:
  - 保留根级路由（添加 deprecated 标记）
  - 创建 v1 转发（非删除）
  - 完整回归测试

---

### P1-003: 案件管理增强

**状态**: 🔴 待开始  
**工期**: 6天  
**难度**: 中等

#### 内容

- 时间线提取器集成（TimelineExtractor）
- 法庭日历优化
- 证据链可视化

---

## 阶段三：架构债务清理（第8-10周）

> **目标**：解决Agent职责重叠、服务分散问题  
> **优先级**：🟡 P1 - 技术债务  
> **总工期**: 15天

### P1-004: Agent 职责边界明确化

**状态**: 🔴 待开始  
**工期**: 7天  
**难度**: 高

#### 确认的问题（审计验证）

```typescript
// src/lib/agent/doc-analyzer/extractors/amount-extractor.ts
// 问题：直接 new VerificationAgent()，职责混淆

class AmountExtractor {
  private verifier = new VerificationAgent(); // ❌ 应该在流程外层调用

  async extract() {
    // 提取逻辑...
    const result = await this.verifier.verify(data); // ❌ 内嵌验证
  }
}
```

#### 重构方案

- 提取 DocAnalyzer 中的验证逻辑到流程编排层
- VerificationAgent 只作为**独立验证服务**被调用
- 明确边界：AnalysisAgent 负责生成，VerificationAgent 负责验证

---

### P1-005: 会员服务真正统一

**状态**: 🔴 待开始  
**工期**: 5天  
**难度**: 中  
**修正**：部分已统一入口（re-export），但核心逻辑仍分散

#### 当前状态

```typescript
// src/lib/membership/index.ts
// ✅ 已有统一入口，但只是 re-export

export { recordUsage } from '@/lib/usage/record-usage'; // ❌ 逻辑仍在 usage/
export { updateOrderPaid } from '@/lib/order/update-order-paid'; // ❌ 逻辑仍在 order/
```

#### 真正统一方案

- 将核心逻辑迁移到 `src/lib/membership/` 目录
- 原位置保留 re-export（向后兼容）
- 新增统一的 `MembershipService` 类

---

### P1-006: 其他功能补全

**状态**: 🔴 待开始  
**工期**: 3天

- 团队协作优化
- AI 功能增强（证据链分析前端集成）

---

## 阶段四：质量提升（第11-13周）

> **目标**：全面提升测试覆盖率和系统质量  
> **优先级**: 🟢 P2 - 质量保障  
> **总工期**: 15天

### P2-001: E2E 测试重新评估与修复

**状态**: 🟡 需重新评估  
**工期**: 5天（原10天，可能减少）

#### 首要任务

| #   | 任务                  | 工时 | 说明               |
| --- | --------------------- | ---- | ------------------ |
| 1   | **重新运行 E2E 测试** | 4h   | 获取当前真实通过率 |
| 2   | 分析失败用例          | 4h   | 分类问题           |
| 3   | 修复关键失败          | 16h  | 优先修复核心流程   |
| 4   | 添加缺失的 Mock       | 12h  | AI服务Mock等       |

#### 决策点

- 如果最新通过率 > 70%：减少工时至 **3天**
- 如果最新通过率 < 50%：保持 **5天** 甚至增加

---

### P2-002: 单元测试覆盖率提升

**状态**: 🔴 待开始  
**工期**: 5天  
**目标**: 63% → 80%

---

### P2-003: 性能优化

**状态**: 🔴 待开始  
**工期**: 3天

- 辩论生成响应优化（21.2s → <10s）
- 页面首屏加载优化

---

### P2-004: 文档完善

**状态**: 🔴 待开始  
**工期**: 2天（原4天，减少）  
**修正**：优先级降低，工时减少

---

## 📊 修正后总体对比

| 维度           | 原路线图 | 修正版   | 变化  |
| -------------- | -------- | -------- | ----- |
| **总工期**     | 14周     | **12周** | -2周  |
| **阶段一**     | 3周      | **2周**  | -1周  |
| **阶段二**     | 4周      | **4周**  | 0     |
| **阶段三**     | 3周      | **3周**  | 0     |
| **阶段四**     | 4周      | **3周**  | -1周  |
| **总任务数**   | 14个     | **14个** | 0     |
| **预估总工时** | 70天     | **55天** | -15天 |

### 关键变化说明

1. **VerificationAgent 节省2天**：UI已存在，只需接入逻辑
2. **CRM 节省4天**：无需数据库迁移
3. **API 统一增加2天**：问题比预计严重
4. **E2E 可能节省**：取决于最新测试结果
5. **文档减少2天**：优先级降低

---

## 🎯 修正后优先级

### 🔴 P0 - 必须立即执行（投入产出比最高）

| 任务                              | 工期 | 价值                     |
| --------------------------------- | ---- | ------------------------ |
| P0-001 VerificationAgent 动态接入 | 3天  | 用户立即看到真实验证质量 |
| P0-002 MemoryAgent 管理界面       | 6天  | 核心功能不再沉睡         |

**小计**: 9天，释放核心Agent价值

### 🟡 P1 - 近期执行（用户体验 + 技术债务）

| 任务                  | 工期 | 价值           |
| --------------------- | ---- | -------------- |
| P1-001 CRM 子功能     | 6天  | 完善客户管理   |
| P1-002 API 版本统一   | 5天  | 解决架构混乱   |
| P1-003 案件管理增强   | 6天  | 提升产品竞争力 |
| P1-004 Agent 职责明确 | 7天  | 技术债务清理   |
| P1-005 会员服务统一   | 5天  | 架构优化       |

**小计**: 29天

### 🟢 P2 - 质量保障

| 任务                | 工期 | 价值     |
| ------------------- | ---- | -------- |
| P2-001 E2E 测试修复 | 5天  | 质量保障 |
| P2-002 覆盖率提升   | 5天  | 长期维护 |
| P2-003 性能优化     | 3天  | 用户体验 |
| P2-004 文档完善     | 2天  | 团队效率 |

**小计**: 15天

---

## ⚠️ 关键风险（审计新增）

| 风险                               | 等级 | 应对                       |
| ---------------------------------- | ---- | -------------------------- |
| API 版本混乱比预计严重             | 高   | 增加2天工时，分阶段迁移    |
| E2E 通过率可能已大幅改善           | 中   | **首要任务：重新测试确认** |
| VerificationAgent 接入可能影响性能 | 中   | 异步验证 + 缓存            |

---

## ✅ 实施前必须确认的事项

- [ ] **重新运行 E2E 测试**，获取最新通过率
- [ ] **检查 CRM 相关 API** 是否已存在（可能进一步节省工时）
- [ ] **确认 VerificationAgent 性能**，辩论生成是否会变慢
- [ ] **扫描所有 48 个根级 API**，制定详细的迁移计划

---

## 📚 关联文档

- [审计报告原始版](IMPROVEMENT_ROADMAP.md)
- [技术实施指南](IMPROVEMENT_IMPLEMENTATION_GUIDE.md)
- [任务追踪清单](IMPROVEMENT_TASK_TRACKING.md)

---

**文档版本**: v2.0  
**修正日期**: 2026-03-31  
**下次审计**: 建议2周后
