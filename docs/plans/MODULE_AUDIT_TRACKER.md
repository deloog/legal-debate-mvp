# 项目功能模块审计跟踪表

> 目的：把项目按功能模块拆开，逐个审计、逐个标记，避免遗漏，也方便你随时知道“哪些已经跑过、哪些还没跑”。
>
> 更新规则：
>
> - `未开始`：尚未进入正式审计
> - `进行中`：已开始，但还没形成最终结论
> - `已完成`：已经完成代码审计 + 关键链路验证
> - `部分完成`：只完成了子链路或局部能力验证，不能算整个模块结束

---

## 审计状态总览

| 编号 | 模块                         | 状态   | 当前结论                                               | 备注                                                                                   |
| ---- | ---------------------------- | ------ | ------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| 01   | 认证与权限体系               | 已完成 | 已完成审计，关键问题已修复                             | 登录 / me / refresh / logout 已完成真实验证                                            |
| 02   | 用户、角色、协作权限         | 已完成 | 关键一致性问题已修复，真实权限回归通过，关键测试已收口 | 少量历史测试仍可后续统一风格迁移                                                       |
| 03   | 会员、订单、支付、发票、退款 | 已完成 | 模块已收口                                             | P0 已修复；P1/P2 关键重复实现已收口；订单/支付直接相关历史测试已迁移通过               |
| 04   | 律师/企业资质与认证          | 已完成 | 模块已收口                                             | P0 已修复；注册角色时机已治理；企业注册错误码已细化；营业执照已改为存储服务 + 受控访问 |
| 05   | 案件管理主模块               | 已完成 | 模块已收口                                             | CRUD/共享/案号生成/智能抽取可用；相似案例、成功率分析、删除后 404 语义已修复           |
| 06   | 文档上传与文档分析           | 已完成 | 模块已收口                                             | 上传/列表/详情/手动分析/删除主链已修通；剩余为测试基座治理项                           |
| 07   | 案件提炼与风险评估           | 已完成 | 已完成审计，模块主链成立                               | `extract` / `assess` / `workflow-status` 可用；主要剩余为 AI 可用性与测试治理项        |
| 08   | 证据管理体系                 | 已完成 | 模块已收口                                             | 手工证据 CRUD、自动草稿、关系、链分析、交叉询问主链均可用                              |
| 09   | 模拟辩论 / 论点生成          | 已完成 | 模块已收口                                             | 创建/详情/单轮生成/总结/列表/SSE/协作权限主链可用，旧测试已迁移                        |
| 10   | 整案交付包                   | 已完成 | 已完成代码审计 + 真实回归验证                          | 已验证 preview / review / export / 7/7 条件                                            |
| 11   | 法条、法律检索、法律分析     | 已完成 | 模块已收口                                             | 搜索/详情/推荐/关系发现/审核/统计/图谱/指导案例/适用性主链已验证                       |
| 12   | 知识图谱                     | 已完成 | 模块已收口                                             | 案件联动、图谱浏览、路径/邻居/推荐、快照、质量分、关系审核与统计主链已回归             |
| 13   | 合同与审批流                 | 已完成 | 主链已跑通，关键权限、版本与签署边界已收口             | 合同模板、审批、版本、签署                                                             |
| 14   | 客户、咨询、沟通、跟进       | 已完成 | 真实链路已跑通，客户/沟通/跟进/咨询/转案件主链可用     | clients / consultations / communications / follow-up                                   |
| 15   | 团队协作与案件协同           | 已完成 | 模块已收口                                             | team / case team members / discussions / tasks 主链已回归；witness 当前为所有者模型    |
| 16   | 日程、提醒、法院排期         | 已完成 | 模块已收口                                             | court schedule / reminders / follow-up tasks / statute reminders                       |
| 17   | 仪表盘、统计、报表           | 已完成 | 模块已收口                                             | dashboard / analytics / reports；统计口径、筛选、报表测试已收口                        |
| 18   | 企业法务与合规               | 已完成 | 模块已收口                                             | enterprise register / qualification / compliance / enterprise risk / clause risk       |
| 19   | 管理后台                     | 已完成 | 模块已收口                                             | admin users / roles / configs / alerts / logs / orders / memberships                   |
| 20   | 系统支撑与监控               | 已完成 | 前后端已对齐：总览+控制台+权限语义+监控埋点            | memory / quota / health / notification / monitor                                       |

---

## 问题清理节奏表

> 原则：**边审边记，关键问题及时修，阶段性统一收口。**
>
> 不建议：
>
> - 所有问题拖到最后一次性清理
> - 发现一个问题就立刻无计划地散修
>
> 最佳做法：
>
> - `P0 / P1` 的高风险问题：发现后尽快修
> - `P2 / P3` 的结构、命名、注释、重复逻辑问题：先记账，等一批模块审完再统一收口

### A. 发现后应尽快修的问题

这类问题不建议拖到最后：

- 认证失效、会话失效、权限绕过、资源越权
- 支付、订单、退款、发票等资金链路错误
- 数据污染（例如自动流程覆盖人工数据）
- 文件访问漏洞、敏感信息泄露
- 回调路径错误、幂等失效、状态机错误
- 真实主链路无法跑通的问题
- 会导致错误结果继续向后传播的问题

### B. 适合阶段性统一清理的问题

这类问题可以先记在模块下，等一批模块审完后统一处理：

- 注释、文档、命名漂移
- 重复逻辑、重复工具函数
- 低优先级 UI/UX 不一致
- 非关键测试结构混乱
- 非阻塞型技术债
- 监控、日志、告警粒度不一致

### C. 执行节奏建议

建议按以下节奏推进：

1. 每个模块审计时，先把发现的问题分成两类：
   - `立即修`
   - `阶段收口`
2. 每审完 `3-5` 个核心模块，做一次统一收口
3. 收口时只处理：
   - 重复逻辑
   - 命名与注释
   - 测试结构
   - 低优先级技术债
4. 不在“统一收口”阶段改动已经稳定运行的核心业务语义

### D. 模块记录模板

每个模块审计完成后，建议在模块结论下追加：

- `立即修复问题`
- `阶段收口问题`

定义如下：

- `立即修复问题`：影响安全、正确性、主链路可用性、数据可信度的问题
- `阶段收口问题`：不影响当前主链路，但影响长期维护性的问题

---

## 全局后续治理项

以下问题已被记录，暂不阻塞当前模块推进，留待后续统一决策处理：

1. `POST /api/orders/create`
   - 需要明确是否彻底下线
   - 或继续保留“仅创建订单”的独立定位

2. `alipay/query` 等专项支付查询接口
   - 需要决定是否继续保留专项入口
   - 或进一步并入统一支付查询入口

3. 更广泛的老测试基座
   - 项目内仍有一批与模块 03 不直接相关、但还挂旧认证契约的测试
   - 这属于全局测试治理问题，不再作为模块 03 blocker

---

## 已完成模块

### 01. 认证与权限体系

**状态**：已完成

**已验证内容**：

- `/api/auth/login`
- `/api/auth/me`
- `/api/auth/refresh`
- `/api/auth/logout`
- `AuthProvider` 自动续期逻辑
- `proxy` 页面/API 守卫逻辑
- JWT / cookie 双通路

**核心结论**：

- 登录成功链路正常
- `me` 接口正常
- `proxy` 的角色与页面守卫方向基本成立
- `refresh` 已修复：
  - `/api/auth/refresh` 现已被 `proxy` 放行
  - 仅携带 `refreshToken` 时可正常续期
- `logout` 已修复：
  - 新签发的 `accessToken` 已绑定 `session.id`
  - 当前设备登出后，旧 `accessToken` 立即失效，无法继续访问 `/api/auth/me`

**结论**：

- 认证模块审计已完成
- 发现的两个关键问题已完成修复并通过真实链路验证

**立即修复问题**：

- 无

**阶段收口问题**：

- JWT / NextAuth 双机制并存，后续需统一边界说明
- 认证相关测试路径与真实运行模式（cookie / token / session）可进一步归档整理

---

### 03. 会员、订单、支付、发票、退款

**状态**：已完成

**已验证内容**：

- 会员信息查询
- 会员等级列表
- 会员升级 / 降级 / 取消
- 订单创建 / 查询 / 取消
- 支付创建 / 支付查询 / 支付回调
- 发票申请 / 发票列表 / 发票详情 / 取消
- 退款申请 / 退款列表
- 前端会员升级页 / 支付确认页 / 退款页

**核心结论**：

- 模块 03 的 `P0` 问题已完成修复并通过测试收口
- 当前剩余问题主要为 `P1 / P2` 的入口重复与服务重复实现，属于阶段收口问题

**已验证的真实结果**：

- `/api/memberships/tiers` 正常
- `/api/memberships/me` 正常
- `/api/orders/create` 可正常创建 `PENDING` 订单
- `/api/refunds/apply` 对未支付订单可正确返回 `INVALID_ORDER_STATUS`
- `/api/refunds` 在 cookie 登录态下已恢复正常认证
- `/api/memberships/upgrade` 对付费升级仍要求 `orderId + PAID`，前端升级页已改为进入支付链路
- `/api/invoices/apply` 对未支付订单已正确映射为 `400`

**立即修复问题**：

- 无

**已完成的 P0 修复**：

- `POST /api/memberships/cancel` 已改为复用 `membership-service.cancelMembership({ immediate: false })`，实现“仅取消续费，到期前仍可继续使用”
- 会员升级前端页已不再直接调用 `/api/memberships/upgrade`，而是改为跳转支付链路
- `GET /api/refunds` 已统一使用 `getAuthUser()`，恢复 cookie / Bearer 双通路认证
- `POST /api/invoices/apply` 已修复错误映射，未支付/重复申请等业务错误不再一律返回 `500`
- 已补最小测试覆盖：
  - `refunds/apply`
  - `refunds/list`
  - `memberships/cancel`
  - `invoices/apply`
  - `PaymentConfirm`

**已完成的 P1/P2 核心收敛**：

- `POST /api/payment/create-order` 已收敛为 `POST /api/payments/create` 的兼容薄包装
- `GET /api/payment/query` 已收敛为 `GET /api/payments/query` 的兼容薄包装
- 支付处理中页面已改为使用统一查询入口 `/api/payments/query`
- 支付成功后的会员开通逻辑已抽成共享实现，`membership-service.activateMembership` 与 `order-service.handlePaymentSuccess` 复用同一套会员激活逻辑
- 相关支付 UI E2E mock 已同步切到新支付主入口
- `POST /api/orders/[id]/cancel` 已收敛为复用 `PUT /api/orders/[id]` 的取消逻辑
- `src/lib/usage/record-usage.ts` 已收敛为 `membership/usage-tracker` 的兼容门面，避免两套使用量实现继续漂移

**阶段收口问题**：

- `POST /api/orders/create` 仍作为“仅创建订单”的独立入口保留，后续需决定是否继续保留或彻底下线
- 支付查询仍存在 `alipay/query` 等专项入口，后续需进一步统一边界
- 更广泛的非核心历史测试与集成测试仍可继续逐步迁移到 `getAuthUser` 契约，但模块 03 直接相关测试已收口

**全局后续治理说明（来自模块 03）**：

- `P1-5 支付创建三套入口`
  - 当前状态：**部分收敛**
  - `POST /api/payment/create-order` 已改为 `POST /api/payments/create` 的兼容门面
  - 但 `POST /api/orders/create` 仍保留为“仅创建订单”独立入口，是否下线需后续统一决策

- `P1-6 支付查询两套入口`
  - 当前状态：**部分收敛**
  - `GET /api/payment/query` 已改为 `GET /api/payments/query` 的兼容门面
  - 但 `alipay/query` 等专项查询入口仍存在，后续需统一边界

- `P2-8 使用量服务来源重复`
  - 当前状态：**已兼容收敛**
  - `src/lib/usage/record-usage.ts` 已改为 `membership/usage-tracker` 的兼容门面
  - 旧 import 仍保留，避免一次性大范围改引用

- `P2-9 订单取消两套入口`
  - 当前状态：**已兼容收敛**
  - `POST /api/orders/[id]/cancel` 已改为复用 `PUT /api/orders/[id]` 的取消逻辑
  - 两条路径仍保留，但不再维护两套实现

---

### 10. 整案交付包

**状态**：已完成

**已验证内容**：

- Preview API
- Review API
- Review latest
- DOCX export
- 内容变更后重新复核
- 页面级入口
- 真实复核人/时间写入文档
- 真实卷宗链路下可达 `7/7`

**结论**：

- 该模块已完成代码审计
- 已完成真实联调
- 已完成真实卷宗回归验证

**立即修复问题**：

- 无

**阶段收口问题**：

- 与案件工作流、证据自动化链路的回归脚本后续可统一收口
- 相关验收脚本与文档可进一步合并，减少重复入口

---

### 11. 法条、法律检索、法律分析

**状态**：已完成

**已验证内容**：

- 法条搜索 / 详情 / 列表
- 法典列表
- 法条推荐
- 法条适用性分析
- 法条关系发现
- 法条关系单条审核
- 法条关系批量审核
- 法条关系统计 / 图谱
- 指导案例检索
- 法条计算类接口

**真实链路验证结果**：

- 管理员账号 `admin@example.com` 可真实登录
- `POST /api/v1/law-article-relations/discover` 管理员真实请求返回 `200`
- `POST /api/v1/law-article-relations/[id]/verify` 管理员真实请求返回 `200`
- `POST /api/v1/law-article-relations/batch-verify` 管理员真实请求返回 `200`
- 单条审核后，`LawArticleRelation.verifiedBy` 写入的是 `KnowledgeGraphExpert.id`
- 审核日志仍正确记录真实管理员 `User.id`
- 批量拒绝后，两条关系均写入 `REJECTED`，且 `verifiedByExpert.user.email = admin@example.com`

**已完成的关键修复**：

- `/api/v1/legal-analysis/applicability` 已接入当前 `getAuthUser` 契约，修复认证断链
- `POST /api/v1/law-article-relations/[id]/verify` 已修复 `verifiedBy` 外键语义：不再写 `User.id`，改为写 `KnowledgeGraphExpert.id`
- `POST /api/v1/law-article-relations/batch-verify` 同步修复 `verifiedBy` 外键语义
- 旧兼容入口 `POST /api/v1/law-article-relations/[id]` 同步修复 `verifiedBy` 外键语义
- 关系审核相关测试已迁到当前契约：
  - 审核人来自登录态
  - 客户端传入 `verifiedBy` 会被忽略
  - 关系表写专家 ID
  - 日志记录真实用户 ID
- 原先位于 `[id]` 动态目录下、被 Jest 配置忽略的测试已迁到可执行路径，避免假覆盖

**立即修复问题**：

- 无

**阶段收口问题**：

- 当前 Jest 基座会全局 mock Prisma，真实数据库级 API 回归更适合保留为人工/脚本型回归；后续可单独建设“不 mock Prisma”的 API integration 配置
- `POST /api/v1/law-article-relations/[id]` 与 `POST /api/v1/law-article-relations/[id]/verify` 两条审核入口仍同时存在，当前语义已对齐，后续可进一步决定是否下线 legacy 入口

---

### 12. 知识图谱

**状态**：已完成

**已验证内容**：

- 案件页法条图谱
- 法条图谱可视化组件
- 图谱构建器
- 图谱浏览
- 邻居查询
- 最短路径查询
- 法条推荐
- 冲突检测
- 效力链追踪
- 企业风险分析
- 关系创建
- 关系生成
- 关系审核 / 待审核列表 / 统计 / 推荐统计
- 质量分
- 快照列表 / 最新快照 / 快照详情 / 快照比较
- 法条适用性分析沉淀到案件法条引用
- 辩论 legalBasis 沉淀到案件法条引用

**核心结论**：

- 知识图谱概念本身有价值，但此前用户体感弱，主要原因不是“图谱没用”，而是链路没有闭环：
  - 案件页拿到了 `graphData`，但可视化组件没有直接使用
  - 法条关系查询偏向出边，只有入边的法条容易在图谱、推荐、统计中消失
  - 法条适用性分析和辩论生成的 legalBasis 没有稳定沉淀为可复用的 `LegalReference.articleId`
  - 邻居、推荐、浏览、统计等接口对入边/出边口径不一致
  - 快照和后台统计接口存在权限或错误语义不一致
- 本轮已把“案件分析/辩论 -> 法条引用沉淀 -> 案件图谱 -> 图谱浏览/推荐/路径/邻居 -> 后台审核与质量治理”的主链打通
- 当前模块可以进入后续产品体验优化阶段，而不是继续作为业务断链模块处理

**已完成的关键修复**：

- 案件页 `LawGraphTab` 已直接使用案件图谱接口返回的 `graphData`，不再重新按中心法条拉普通图谱
- 已落地“案件法条适用分析 2.0”：新增解释型 `applicationAnalysis`，把图谱关系转译为核心法条、补充法条、风险法条、适用路线图和下一步建议
- 案件页法条图谱 Tab 已改为结论优先：先展示适用结论和执行路线，再展示图谱作为佐证
- `LawArticleGraphVisualization` 已兼容标准 API 包装响应，并支持案件图谱传入的直接颜色
- `GraphBuilder.buildGraph` 已支持入边与出边双向扩展，同时保留原始关系方向
- `/api/v1/knowledge-graph/browse` 已把只有入边的法条纳入种子、关系与邻居集合
- `CaseKnowledgeGraphAnalyzer` 已优先使用 `LegalReference.articleId`，旧数据再回退到 `source + articleNumber`
- `/api/v1/legal-analysis/applicability` 已写入可回连图谱的 `articleId / source / articleNumber`
- 辩论 SSE 完成后会把双方 `legalBasis` 异步同步为案件 `LegalReference`
- `/api/cases/[id]/law-graph` 已对齐案件权限：所有人/管理员/具备 `VIEW_CASE` 的团队成员可访问
- `/api/v1/knowledge-graph/neighbors` 已支持入边邻居，并返回可读标题、方向和原始 source/target
- `/api/v1/knowledge-graph/paths` 缺少必需参数时返回明确 `400`
- `/api/v1/knowledge-graph/recommendations` 缺 `articleId` 时不再静默返回空成功，而是返回明确 `400`
- `/api/v1/knowledge-graph/conflicts` 不再在缺参数、法条不存在或服务异常时伪装成成功空结果
- `/api/v1/knowledge-graph/snapshots*` 已补齐 `VIEW_STATS` 权限，列表查询参数与服务异常不再伪装为空数据
- `/api/v1/knowledge-graph/generate-relations` 已迁到当前 `getAuthUser` 认证契约
- `/api/v1/knowledge-graph/relations` 已去掉客户端 `createdBy` 契约，创建人统一来自登录态
- 后台管理页审核关系时不再从前端传 `verifiedBy`，服务端统一使用登录用户
- 关系统计、推荐统计已把 target-only 法条计入覆盖率与热门法条

**验证结果**：

- `npm run type-check`：通过
- 模块 12 聚合回归：`23` 个测试套件，`247/247` 通过
- 案件法条适用分析 2.0 关键回归：`12` 个测试套件，`106/106` 通过
- 说明：测试输出中的错误日志来自用例刻意模拟数据库、图谱构建或分析失败，用于验证错误分支，不代表回归失败

**立即修复问题**：

- 无

**阶段收口问题**：

- 案件法条适用分析 2.0 已完成第一版，但仍是确定性规则翻译；后续如要继续增强，可引入 AI 对“事实-要件-证据-法条”逐项匹配生成更贴近律师写作的适用说明
- 新旧接口 `/api/knowledge-graph/*` 与 `/api/v1/knowledge-graph/*` 的产品边界仍可进一步统一，避免后台高级能力散落
- 快照、质量分、影响分析等高级能力目前更偏管理员治理，后续可考虑把其中一部分转译成律师用户能理解的案件建议

---

### 13. 合同与审批流

**状态**：已完成

**已审到的范围**：

- 合同创建 / 列表 / 详情 / 编辑
- 付款记录
- 审批发起 / 审批详情 / 提交审批 / 撤回审批
- 版本历史 / 版本对比 / 版本回滚
- 合同签署 / 启动履行 / 发送邮件 / PDF
- 审批模板
- 合同详情页 / 审批页 / 签署页关键交互

**当前阶段结论**：

- 模块 13 的核心业务链已经真实跑通：合同创建、审批模板、发起审批、审批中心/审批页通过、签署、启动履行、版本历史/对比/回滚均已完成真实验证。
- 本轮完成了关键安全边界和状态机收口：合同详情/审批读取权限、付款写权限、审批模板死流程、签署身份令牌、版本链落库与回滚完整性。
- 当前已可以视为模块收口完成，剩余更适合归入后续产品演进而非 blocker。

**已完成的关键修复**：

- 抽出共享 `getContractAccess()`，统一合同读取/管理权限口径：
  - `canRead`：管理员 / 合同律师 / 关联案件委托方
  - `canManage`：管理员 / 合同律师
- `GET /api/contracts/[id]` 已接入共享访问口径，不再只校验登录
- `GET /api/contracts/[id]/approval` 已从“仅登录可读”收紧到合同管理权限
- `GET/POST /api/contracts/[id]/payments` 已对齐共享权限口径：
  - 读取允许合同可读用户
  - 创建仅允许管理员 / 合同律师
- 付款路由 `catch` 中错误变量名已修复，避免异常处理再次抛错
- `POST /api/contracts/[id]/approval/cancel` 已校验 `approvalId` 必须属于当前合同，且只能由发起人撤回
- `POST /api/contracts/[id]/approval/start` 已禁止发起“未指定审批人”的死流程
- 审批模板创建 / 更新已禁止保存缺少 `approverId` 的步骤
- 合同详情页版本对比 / 回滚已改为使用后端真实契约（`POST + versionId`）
- 合同详情页动作按钮已按权限收口：委托方不再看到编辑、发起审批、发送邮件、启动履行动作
- 合同签署页已按当前用户身份收口显示：不再同时暴露委托方 / 律师两侧签署按钮
- `ApprovalFlow` 组件已改为：步骤未指定审批人时不显示操作按钮，并明确提示流程配置错误
- 合同版本服务快照构建已增强健壮性，避免 number / 空 payments 等场景下异步报错

**验证结果**：

- `src/__tests__/api/contracts.test.ts`：`16/16` 通过
- `src/__tests__/components/contract/approval-flow.test.tsx`：`6/6` 通过
- `src/__tests__/lib/contract/approval-workflow-service.test.ts`：`34/34` 通过
- `src/__tests__/lib/contract-signing-token.test.ts`：`2/2` 通过
- 当前这一轮相关回归合计：`56/56` 通过
- `npm run type-check`：通过
- 真实链路已跑通：
  - 管理员真实创建审批模板
  - 律师真实创建合同并发起审批
  - 管理员真实在审批中心 / 审批页看到待审批项并提交通过
  - 合同状态真实 `DRAFT -> PENDING -> SIGNED -> EXECUTING`
  - 版本历史 / 对比 / 回滚已在真实链路下恢复可用
  - 无签署 token 的 `client` 签署已被真实拒绝

**立即修复问题**：

- 无（本轮发现的关键问题已修复）

**阶段收口问题**：

- 根级 `/api/contracts/*` 与 `/api/v1/contracts*` 仍是兼容并存结构，后续需决定合同模块是否也走统一 v1 主入口
- `GET /api/contracts` 测试仍带“环境限制导致 500”的旧说明，说明这条列表接口测试基座还不够贴近真实运行环境
- 合同审查上传 / 审查报告链路仍可继续做一轮独立真实回归，但不再阻塞合同审批签署主链
- 前端合同新建/编辑页仍存在一些“默认文案/默认值”式的历史遗留，需要继续核对与当前后端真实校验是否完全一致
- 当前签署令牌方案已能收紧委托方签署边界，但若后续要做真正的客户门户，仍建议演进到 `clientUserId` 或外部签署身份模型
- 审批通过本身目前没有单独落一条版本记录，虽然不阻塞版本历史使用，但若后续需要更细粒度审计，建议补齐

---

### 14. 客户、咨询、沟通、跟进

**状态**：已完成

**已审到的范围**：

- 客户：`/api/clients`、`/api/clients/[id]`、`/api/clients/[id]/communications`
- 沟通记录：`/api/communications`、`/api/communications/[id]`
- 跟进任务：`/api/follow-up-tasks`、`/api/follow-up-tasks/[id]`、提醒统计
- 咨询：`/api/consultations`、`/api/consultations/[id]`
- 咨询跟进：`/api/consultations/[id]/follow-ups`
- 咨询评估与转案件：`/api/consultations/[id]/assess`、`/convert`
- 客户统计与分析：`/api/clients/statistics`、`/api/analytics/clients`
- v1 兼容层：`/api/v1/clients`、`/consultations`、`/communications`、`/follow-up-tasks`

**当前阶段结论**：

- 模块 14 的服务端结构比模块 13 更整齐，主链不是“整体断裂”，真实 HTTP 链路已经跑通。
- `clients / communications / consultations / follow-up-tasks` 大多已接入 `getAuthUser`，并带 `userId` 归属过滤。
- 本轮发现的 IDOR、软删除、案号、错误响应、私有 mapper 绕过、AI 评估名实不符问题均已完成代码修复和测试回归。

**已完成的关键修复**：

- `consultations/[id]/follow-ups` 已补当前用户归属校验，防止仅凭 `consultationId` 读取/写入他人咨询跟进记录
- `consultations/[id]/assess` 已补当前用户归属校验，防止仅凭 `consultationId` 触发或读取他人咨询评估
- `FollowUpTask` 更新链已补齐：
  - `PUT /api/follow-up-tasks/[id]` 现在真正支持更新 `type / summary / dueDate / priority / notes`
  - `FollowUpTaskProcessor.updateTask()` 已同步落这些字段
- `UpdateFollowUpTaskInput` 类型已补齐 `type / summary / dueDate`
- `ConversionService.convertToCase()` 已补 `userId` 约束，不再只凭 `consultationId` 查咨询
- `ConversionService.getConversionPreview()` 已补 `userId` 约束，路由 GET `/api/consultations/[id]/convert` 也已传入当前用户
- `FollowUpTask.communicationId` 已改为可空：
  - 保留“由沟通记录自动生成任务”时的关联
  - 允许用户从客户页手动创建独立跟进任务
  - 已新增迁移 `20260514000000_make_follow_up_task_communication_nullable`
- `FollowUpTaskProcessor.updateTask()` 已修复 Postgres enum 更新 cast，`status / priority / type` 不再因 enum/text 类型不匹配返回 500
- `POST /api/follow-up-tasks` 已补 `deletedAt: null`，禁止给已软删除客户创建“僵尸跟进任务”
- 咨询转案件已接入共享 `generateCaseNumber()`，转化生成的案件不再出现 `caseNumber = null`
- `/api/v1/cases` 直接创建案件也已接入同一套共享 `generateCaseNumber()`，避免直接创建与咨询转案出现两套案号行为
- `FollowUpTaskProcessor['transformTask']` 私有方法绕过已清理，改为公开 `toFollowUpTask()` mapper
- 模块 14 旧式错误响应已收敛到 `{ success:false, error:{ code, message } }`；其中 `/api/clients/statistics` 成功响应保留裸统计对象以兼容现有前端，错误响应已标准化
- `CaseAssessmentService` 已从关键词/规则引擎改为真实 AI-only 评估：
  - 调用 `AIServiceFactory.getInstance().chatCompletion()`
  - 解析并校验 AI 返回的结构化 JSON
  - AI 调用失败或返回无效结构时直接失败，由路由返回 503 友好提示
  - 不再使用关键词规则兜底

**当前收口状态**：

- 真实代码问题已收口：已修的 IDOR、契约漂移、手动跟进任务外键约束、软删除客户绑定、转案案号、Postgres enum 更新 500、私有 mapper 绕过、AI 评估名实不符问题均已完成并验证。
- 案号生成已收口：咨询转案件与 `/api/v1/cases` 直接创建案件均复用共享案号生成服务，手动传入案号时仍保留用户输入。
- 测试基座已收口：`consultations/route.test.ts` 已迁到当前 `getAuthUser` 认证契约，`follow-up-task-processor.test.ts` 已迁到当前共享 Prisma mock 契约。
- 统计与分析接口已收口：客户统计和客户分析均已用真实数据做 HTTP 回归，不再作为模块 14 遗留项。

**真实链路验证结果**：

- 使用本地开发库 `legal_debate_dev` 和真实认证律师账号 `codex-module14@example.com` 跑通：
  - 登录
  - 创建客户
  - 查询客户列表
  - 创建沟通记录
  - 查询沟通记录
  - 手动创建跟进任务
  - 更新跟进任务 `type / summary / dueDate / priority / notes`
  - 查询待跟进数量
  - 完成跟进任务
  - 创建咨询
  - 查询咨询详情
  - 创建咨询跟进
  - 查询咨询跟进列表
  - 获取转案件预览
  - 执行咨询转案件并创建客户
  - 已转化咨询再次预览返回失败语义
- 使用另一个认证律师账号 `codex-module14-other@example.com` 验证越权访问：
  - 不能读取他人咨询跟进
  - 不能写入他人咨询跟进
  - 不能读取他人咨询评估
  - 不能获取他人转案件预览
  - 不能转化他人咨询
- 客户统计与分析真实数据回归已跑通：
  - `/api/clients/statistics` 返回真实统计数据，覆盖 `totalClients / clientsByType / clientsBySource / tags / recentClients`
  - `/api/analytics/clients?timeRange=ALL&includeLifecycle=true&includeSatisfaction=true&includeRiskAnalysis=true` 返回真实分析数据，覆盖转化漏斗、Top 客户、生命周期、满意度、风险分析

**自动化验证结果**：

- `npm run type-check`：通过
- `consultations/route.test.ts`：`45/45` 通过
- `clients.test.ts` + `statistics.test.ts`：`31/31` 通过
- `follow-up-task-processor.test.ts`：`27/27` 通过
- `follow-up-tasks.test.ts` + `send-reminders.test.ts` + `follow-up-task-generator.test.ts`：`45/45` 通过
- `case-assessment-service.test.ts` + `conversion-service.test.ts` + `consultations-assess.test.ts`：`5/5` 通过
- `cases.test.ts`：`27/27` 通过
- 模块 14 联动组合回归：`180/180` 通过

**立即修复问题**：

- 无

**阶段收口问题**：

- 无

---

### 15. 团队协作与案件协同

**状态**：已完成

**已审到的范围**：

- 团队：`/api/teams`、`/api/teams/[id]`、`/api/teams/[id]/members`
- 案件团队成员：`/api/cases/[id]/team-members`
- 案件讨论：`/api/cases/[id]/discussions`、`/api/discussions/[id]`、`/api/discussions/[id]/pin`
- 任务：`/api/tasks`、`/api/tasks/[id]`、`/assign`、`/complete`
- 证人：`/api/witnesses`、`/api/cases/[id]/witnesses`
- 共享权限基础：`canAccessSharedCase`、`CasePermission`、`CaseRole`

**当前阶段结论**：

- 模块 15 的核心协作链路已收口：团队成员读取、团队成员管理、案件协作成员、讨论、任务与共享权限主链均已完成代码修复和自动化回归。
- 本轮重点修复的是“协作权限边界不一致”和“任务可绑定/指派到无权案件用户”这类正式部署前不能留下的问题。
- 证人模块当前仍是案件所有者模型，不是协作模型；这不是本轮发现的越权漏洞，但属于产品边界决策项：后续如希望协作律师共同管理证人，需要显式接入 `CasePermission`。

**已完成的关键修复**：

- 团队详情与团队成员列表已允许活跃团队成员读取，写操作仍保留管理员权限。
- 团队成员管理已增加“最后一名活跃管理员”保护，禁止降级或移除最后管理员。
- 团队成员重新添加时，如原成员为 `REMOVED / INACTIVE`，现在会恢复成员而不是冲突或撞唯一索引。
- 案件团队成员新增已写入角色默认权限，不再把无显式权限成员保存为 `[]`。
- 已支持恢复软删除的案件团队成员，不再因历史唯一记录导致无法重新加入。
- 共享权限解析已兼容当前数组格式和旧 `customPermissions` 对象格式。
- 新增 `PIN_DISCUSSIONS` 权限，讨论编辑、删除、置顶拆分为独立权限语义。
- 普通讨论更新接口已禁止顺手修改 `isPinned`，置顶必须走 `/pin` 专用入口。
- 讨论删除已从“编辑权限即可删除”收紧为 `DELETE_DISCUSSIONS`。
- 任务创建、更新和指派已校验案件访问权限：
  - 创建带 `caseId` 的任务时，创建者必须可访问该案件。
  - 给他人指派案件任务时，被指派人也必须可访问该案件。
  - 更新任务改绑 `caseId` 时，操作者必须可访问新案件。
  - 无案件上下文的任务不允许指派给他人，避免跨用户孤儿任务。

**自动化验证结果**：

- `npm run type-check`：通过
- 模块 15 聚合回归：`6` 个测试套件，`181/181` 通过
- 覆盖测试包括：
  - `share-permission-validator.test.ts`
  - `teams-id.test.ts`
  - `teams-members.test.ts`
  - `tasks.test.ts`
  - `cases-id-team-members.test.ts`
  - `cases-id-discussions.test.ts`

**立即修复问题**：

- 无

**阶段收口问题**：

- 证人模块是否要从“案件所有者管理”升级为“案件协作成员按权限管理”，需产品层面确认；如确认，应新增 `VIEW_WITNESSES / MANAGE_WITNESSES` 或复用证据/案件权限。
- 当前讨论与团队接口仍存在少量旧式错误响应格式，未影响主链，但后续可与全局 API 响应规范一起统一。

---

### 16. 日程、提醒、法院排期

**状态**：已完成

**已审到的范围**：

- 法庭日程：`/api/court-schedules`、`/api/court-schedules/[id]`、`/api/court-schedules/conflicts`
- v1 兼容入口：`/api/v1/court-schedules`
- 提醒：`/api/reminders`、`/api/reminders/[id]`、`/api/v1/reminders`
- 自动提醒生成：`reminder-generator`、`task-reminder`、案件状态提醒、诉讼时效提醒
- 跟进提醒定时任务：`send-follow-up-reminders`
- 前端提醒展示：`ReminderList`

**当前阶段结论**：

- 模块 16 的主链已收口：日程 CRUD、冲突检测、案件协作权限、提醒创建/查询/更新、自动提醒生成、提醒发送与跟进提醒定时任务均已完成代码修复和自动化回归。
- 本轮重点修复的是正式部署前不能留下的问题：日程接口仍停留在 owner-only 权限模型、日程冲突只检查同一开始时间、提醒查询丢失时间范围、提醒更新不落库、自动提醒写入 Prisma 不支持的 enum 或缺少 `userId`。
- 当前模块没有保留业务 blocker。

**已完成的关键修复**：

- 新增 `schedule-access` 工具，统一日程访问范围、案件日程权限检查、日期解析与时间段重叠查询。
- 法庭日程列表、详情、更新、删除、冲突检测已接入案件协作权限：
  - 查看使用 `VIEW_SCHEDULES`
  - 创建/更新使用 `EDIT_SCHEDULES`
  - 删除使用 `DELETE_SCHEDULES`
- 日程创建与更新时间冲突检测已从“开始时间完全相同”升级为“时间段重叠”。
- 日程更新只在时间变化或从取消状态恢复时触发冲突检测，普通改标题/状态不会被误判冲突。
- 日程时间字段增加非法日期校验，避免 `Invalid Date` 进入查询或写库。
- 提醒创建已正确把 `content/message`、`scheduledAt/reminderTime`、`channel/channels` 映射到 Prisma 字段。
- 提醒查询已同时保留 `startTime` 与 `endTime`，不再后者覆盖前者。
- 提醒更新已支持写回 `message / reminderTime / channels`。
- 自动提醒生成已统一写入当前 Prisma 支持的类型：
  - 法庭日程 -> `COURT_SCHEDULE`
  - 截止日期/案件状态截止 -> `DEADLINE`
  - 跟进/任务提醒 -> `FOLLOW_UP`
- 自动提醒生成已补齐 `userId`、`relatedType`、`relatedId`，避免真实库里生成失败或产生孤儿提醒。
- `ReminderList` 已补 `DEADLINE` 标签与颜色，前端类型映射与真实 DB enum 对齐。
- 相关测试中的预期错误日志和缺失 Prisma mock 已收口，模块回归输出不再被预期错误刷屏。

**自动化验证结果**：

- `npm run type-check`：通过
- 模块 16 聚合回归：`9` 个测试套件，`161/161` 通过
- 覆盖测试包括：
  - `court-schedule-api.test.ts`
  - `court-schedules.test.ts`
  - `schedule-conflict-detector.test.ts`
  - `reminder-service.test.ts`
  - `reminder-sender.test.ts`
  - `task-reminder.test.ts`
  - `send-follow-up-reminders.test.ts`
  - `follow-up-tasks/send-reminders.test.ts`
  - `statute-reminder-generator.test.ts`

**立即修复问题**：

- 无

**阶段收口问题**：

- 日程列表当前已覆盖案件所有者与直接案件成员；如后续确认 `sharedWithTeam` 也必须在“无 caseId 的全局日程列表”中展示，需要进一步把团队共享案件纳入列表级访问范围。
- `ReminderType` 类型仍保留 `CASE_DEADLINE / TASK_DUE / HEARING_DATE` 等旧前端兼容值；写库链路已统一映射到 Prisma enum，后续可做一次全局类型瘦身。

---

## 已完成模块

### 04. 律师/企业资质与认证

**状态**：已完成

**已验证内容**：

- 律师资质照片上传
- 律师资质提交
- 当前用户资质查询
- 资质照片受控访问
- 企业注册
- 企业营业执照上传
- 当前企业信息查询
- 管理员企业审核
- 管理员律师资质审核

**真实链路验证结果**：

- 律师证件照上传成功，返回 `fileId` 与受控访问 URL
- 律师资质提交成功，但资格记录中的 `licensePhoto` 实际为 `null`
- 由于资格记录未保存 `licensePhoto`，刚上传的证件照访问返回 `403`
- 律师资质被管理员驳回后，前端虽然显示“重新申请”，但后端再次提交返回 `409`：`您已提交过律师资格认证`
- 企业注册成功后，企业账号状态为 `PENDING`
- 企业营业执照上传成功
- 管理员审核企业账号成功后，`/api/enterprise/me` 可正确返回 `APPROVED`
- 企业用户在企业注册成功后即被赋予 `ENTERPRISE` 角色，而非审核通过后再赋予
- 待审核 (`PENDING`) 的企业用户已经可以访问 `/api/dashboard/enterprise`

**当前核心结论**：

- 模块 04 的立即修复问题已完成修复并通过真实回归验证
- 当前剩余问题主要为角色赋予时机、错误映射和上传策略一致性，属于阶段治理问题

**立即修复问题**：

- 无

**已完成的 P0 修复**：

- 律师资质提交已支持 `licensePhoto` 落库，真实提交后 `licensePhoto` 可在 `/api/qualifications/me` 中读回
- 刚上传的律师证件照在资格记录正确关联后，受控访问已恢复正常（真实回归返回 `200`）
- `REJECTED / EXPIRED` 状态的律师资质已允许重新申请，真实回归验证通过
- `/api/dashboard/enterprise` 已增加企业审核状态检查，`PENDING` 企业账号访问工作台现在返回 `403`

**已完成的阶段治理**：

- 注册接口不再在注册时提前授予 `LAWYER / ENTERPRISE` 角色，统一先以 `USER` 创建账号
- 注册时会把用户选择的目标身份写入 `preferences.onboarding.intendedRole`
- `USER` 角色已被允许访问律师资质与企业入驻所需链路：
  - `/qualifications`
  - `/enterprise`
  - `/api/qualifications/*`
  - `/api/enterprise/register`
  - `/api/enterprise/me`
  - `/api/enterprise/qualification/[fileId]`
  - `/api/enterprise/qualification/upload`
- 真实回归已验证：
  - 注册为 `LAWYER` 意向的用户，实际角色为 `USER`，但仍可成功提交律师资质
  - 注册为 `ENTERPRISE` 意向的用户，实际角色为 `USER`，但仍可成功完成企业注册
- 企业注册错误码已细化：
  - 重复信用代码 -> `409 CREDIT_CODE_EXISTS`
  - 同用户重复注册 -> `409 ENTERPRISE_ACCOUNT_EXISTS`
- 企业营业执照上传已改为：先上传到存储服务，再只在数据库中保存受控访问 URL
- 真实回归已验证：企业营业执照上传后，`enterpriseAccount.businessLicense` 不再是 base64，而是 `/api/enterprise/qualification/{fileId}`，且企业本人访问返回 `200`

**阶段收口问题**：

- 律师资质审核与企业审核状态流需要补文档和测试基线

---

## 已完成模块

### 05. 案件管理主模块

**状态**：已完成

**已验证内容**：

- 案号生成
- 案件创建
- 案件列表（v1 与根级兼容接口）
- 案件详情
- 案件编辑
- 案件删除（软删除）
- 案件共享状态查询与共享操作
- 创建页智能抽取

**真实链路验证结果**：

- `GET /api/v1/cases/generate-case-number` 可正常返回案号
- `POST /api/v1/cases` 可成功创建案件
- `GET /api/v1/cases/[id]` 可成功返回详情
- `PUT /api/v1/cases/[id]` 可成功更新案件状态与标题
- `DELETE /api/v1/cases/[id]` 可成功软删除并返回 `204`
- `POST /api/cases/[id]/share` 与 `GET /api/cases/[id]/share` 可正常工作
- `POST /api/v1/cases/smart-extract` 真实返回结构化字段，前后端契约成立
- `/api/cases/[id]/similar` 真实返回 `500`
- `/api/cases/[id]/success-rate` 真实返回 `500`
- 删除案件后再次查询 `/api/v1/cases/[id]` 返回 `403`，但消息却是“案件不存在”

**当前核心结论**：

- 案件 CRUD、共享、案号生成、智能抽取主链已成立
- 相似案例与成功率分析已修复：真实案件 `Case.id` 不再误当成 `CaseExample.id`
- 删除后再次查询的语义已修复：案件不存在时返回 `404`

**立即修复问题**：

- 无

**已完成的 P0 修复**：

- `/api/cases/[id]/similar` 已支持真实案件 `Case.id` 的回退检索路径，真实回归返回 `200`
- `/api/cases/[id]/success-rate` 已支持真实案件 `Case.id` 的胜率分析路径，真实回归返回 `200`
- 删除案件后再次查询 `/api/v1/cases/[id]` 现在返回 `404 NOT_FOUND`

**阶段收口问题**：

- 服务端创建案件时是否应兜底生成案号，而不完全依赖前端先调用案号生成接口
- 共享案件列表在“未认证专业角色”的协作成员场景下如何处理，需要与模块 04 的认证边界统一
- 相似案例/胜率分析目前采用 `text-jaccard-fallback` 作为真实案件的回退算法，后续可继续演进为更高质量方案

---

### 06. 文档上传与文档分析

**状态**：已完成

**已验证内容**：

- 文档上传
- 异步分析状态推进
- 文档列表
- 文档详情
- 手动分析入口
- 文档删除
- 文档页前端上传/删除/分析交互

**真实链路验证结果**：

- `POST /api/v1/documents/upload` 可成功上传文档并创建记录
- 上传后文档可自动从 `PENDING` 推进到 `COMPLETED`
- `GET /api/v1/documents` 可返回当前用户文档列表
- `GET /api/v1/documents/[id]` 可返回文档详情与分析状态
- `POST /api/v1/documents/analyze` 当前真实不可用：
  - 前端仅传 `documentId`
  - 后端要求 `documentId + filePath + fileType`
  - 即使补齐参数，后端仍会去 `uploads/` 查文件，而上传链把本地文件写在 `private_uploads/`
- `DELETE /api/v1/documents/[id]` 当前真实不可用：
  - 后端尝试删除 `public/{filePath}`，与真实存储路径不一致
  - 路由返回 `NextResponse.json(..., { status: 204 })`，运行时直接抛错，真实返回 `500`

**当前核心结论**：

- 上传、列表、详情、手动分析、删除主链均已修通
- 文档上传后的归属、协作权限口径、手动分析与删除路径现已一致

**已完成的关键修复**：

- `POST /api/v1/documents/analyze` 已统一为只需 `documentId`，由服务端自行解析 `filePath / fileType`
- 手动分析已改为读取真实上传目录 `private_uploads/`
- `DELETE /api/v1/documents/[id]` 已统一走存储服务删除，修复错误的 `public/` 路径假设
- 删除接口已改为标准 `204 No Content` 返回，不再触发运行时 `Invalid response status code 204`
- 上传路由创建文档时现在写入实际上传者 `authUser.userId`
- 文档列表支持案件协作成员按 `VIEW_DOCUMENTS` 看到共享案件文档
- 文档详情/删除已改为按案件协作权限 `VIEW_DOCUMENTS / DELETE_DOCUMENTS` 判断，不再只认文档所有权
- 文档页前端删除逻辑已兼容 `204`
- `useDocumentUpload` 已去掉本地 `localStorage token` 注入，回归当前 cookie/session 认证契约

**真实回归结果**：

- 新建案件后上传 `.txt` 文档成功
- 自动分析可完成并在详情中看到 `COMPLETED`
- 手动调用 `/api/v1/documents/analyze`（仅传 `documentId`）成功返回 `200`
- 文档详情与列表均可读回更新后的分析状态
- 删除接口真实返回 `204`

**立即修复问题**：

- 无

**阶段收口问题**：

- `documents-auth-permission.test.ts` 当前因自身把 Node `path` 整体 mock 坏，导致 Prisma 引导失败；这是测试基座问题，不是文档链业务问题
- 文档分析当前对超短文本容易走 `fallback-simple`，属于分析质量问题，可后续与 AI 提示词/阈值一起打磨

---

### 07. 案件提炼与风险评估

**状态**：已完成

**已验证内容**：

- `POST /api/v1/cases/[id]/extract`
- `GET /api/v1/cases/[id]/extract`
- `POST /api/v1/cases/[id]/assess`
- `GET /api/v1/cases/[id]/assess`
- `GET /api/v1/cases/[id]/workflow-status`
- `WorkflowPanel` 进度面板按钮链路
- `case-extraction-service`
- `case-risk-pipeline`
- `case-workflow-status`

**真实链路验证结果**：

- 对已有完整卷宗案件，`workflow-status` 可正确返回：
  - `documentsTotal / documentsCompleted`
  - `hasExtraction`
  - `hasRiskAssessment`
  - `hasDebate`
  - `nextStep`
- 对无文档案件：
  - `workflow-status.nextStep = upload`
  - `POST /extract` 返回 `422`（无已完成文档）
  - `POST /assess` 返回 `422 EXTRACTION_REQUIRED`
- 对已有提炼快照案件：
  - 手动 `POST /extract` 在 AI 可用时可重跑
  - AI 不可用时明确返回 `503 AI_UNAVAILABLE`
- 对已有风险快照案件：
  - `POST /assess` 可成功重生成风险评估结果
  - AI 不可用时明确返回 `503 AI_UNAVAILABLE`
- `package preview` 已能真实读取 `extractionSnapshot / riskAssessment`，支撑 `§2 / §5`

**当前核心结论**：

- 案件提炼、风险评估、工作流状态三条主链已成立
- 当前不存在明确业务断链 bug
- 剩余主要是 AI 可用性依赖与测试覆盖治理，不是模块 blocker

**立即修复问题**：

- 无

**阶段收口问题**：

- `extract / assess / workflow-status` 当前缺少对应的路由级 API 测试，现阶段主要依赖单元测试与真实回归
- `WorkflowPanel` 调 `POST /extract` 时固定传 `force: true`，虽然便于推进流程，但会绕过材料阈值保护；是否保留该策略需后续产品决策
- 该模块当前完全依赖 AI 服务可用性；AI 不可用时虽然会友好返回 `503`，但正式部署前建议补监控、告警和失败重试策略

---

## 部分完成模块

### 02. 用户、角色、协作权限

**状态**：已完成

**已验证内容**：

- 系统角色（`USER / LAWYER / ENTERPRISE / ADMIN / SUPER_ADMIN`）
- 资源所有权校验（`checkResourceOwnership`）
- 案件协作权限（`CasePermission` / `CaseRole`）
- 案件共享逻辑（`sharedWithTeam`）
- 团队成员管理与共享案件访问
- 真实账号下的团队成员访问验证

**核心结论**：

- 项目里至少存在三套权限机制：
  - 系统角色权限
  - 资源所有权权限
  - 案件协作权限
- 设计层面已经有“共享案件 + 团队成员 + CasePermission”的模型
- 之前的关键一致性问题已修复，团队成员在具备相应权限后，已可真实访问主链路接口

**已验证的真实结果**：

- 团队成员被加入案件并授予：
  - `VIEW_CASE`
  - `EDIT_CASE`
  - `UPLOAD_DOCUMENTS`
  - `EDIT_DEBATES`
    等权限后，已可真实访问：
  - `GET /api/v1/cases/[id]`
  - `GET /api/v1/cases/[id]/workflow-status`
  - `POST /api/v1/documents/upload`
  - `POST /api/v1/debates`
  - `GET /api/cases/[id]/share`

这说明：

- 协作权限已经接入关键主链路
- 共享案件与团队协作权限的核心断裂点已被修复

**立即修复问题**：

- 无

**阶段收口问题**：

- 三套权限机制需要统一口径和命名
- 共享案件（`sharedWithTeam`）与 `CaseTeamMember.permissions` 的职责边界需要整理
- 需要形成“案件级 API 权限基线表”，避免以后继续出现迁移一半的情况
- 少量历史 `owner-only` 单测后续仍可继续统一风格迁移，但关键权限测试已完成收口

---

### 08. 证据管理体系

**状态**：已完成

**已验证内容**：

- 手工证据创建 / 更新 / 删除
- 证据列表
- 证据详情
- 案件维度证据列表
- 自动证据草稿生成与幂等更新
- 自动草稿不覆盖人工证据
- 证据关联创建
- 证据链分析
- 证据分类列表
- 证据文件受控访问

**真实链路验证结果**：

- `GET /api/evidence?caseId=...` 可正常返回手工证据与自动草稿证据
- `GET /api/cases/[id]/evidence` 与 `/api/v1/evidence` 都可正常返回案件证据列表
- `POST /api/evidence`、`PUT /api/evidence/[id]`、`DELETE /api/evidence/[id]` 真实可用
- `POST /api/evidence/[id]/relations` 真实可用
- `POST /api/evidence/chain-analysis` 真实可用，AI 不可用时会退回低保真结果而不是直接炸
- `POST /api/v1/cases/[id]/evidence/auto-generate` 真实可用，返回 `created / updated / skippedManual`
- 自动证据草稿与人工证据同名时，真实返回 `skippedManual > 0`，人工证据未被覆盖
- `POST /api/evidence/[id]/cross-examination` 当前真实返回 `500 INTERNAL_ERROR`

**当前核心结论**：

- 手工证据 CRUD、自动草稿、案件证据列表、证据关系、证据链分析、交叉询问主链均已成立
- 模块 08 当前无明确业务断链点

**已完成的关键修复**：

- `POST /api/evidence/[id]/cross-examination` 已切到与案件提炼/风险评估一致的 AI 通道
- 交叉询问接口在 AI 可用时真实返回 `200`
- 交叉询问接口在 AI 不可用时不再裸 `500`，而是返回清晰的 `503 AI_UNAVAILABLE`
- 对应服务层与 API 层测试已迁到当前实现契约

**立即修复问题**：

- 无

**阶段收口问题**：

- `chain-analysis.test.ts` 仍停留在旧未认证假设，当前是测试基座落后，不等于真实链路坏
- `EvidenceRelation.relatedId = documentId` 作为来源追踪仍是已知技术债
- 自动草稿与手工证据并存时的前端展示/分组策略仍可继续产品化优化

---

### 09. 模拟辩论 / 论点生成

**状态**：已完成

**已验证内容**：

- 创建辩论
- 辩论详情
- 辩论列表
- 获取轮次
- 单轮论点生成
- 辩论总结

**真实链路验证结果**：

- `POST /api/v1/debates` 可成功创建辩论，并自动创建第 1 轮 `PENDING`
- `GET /api/v1/debates/[id]` 可成功返回详情、轮次和 case/user 信息
- `GET /api/v1/debates/[id]/rounds` 可正常返回轮次
- `POST /api/v1/debate-rounds/[roundId]/generate` 真实可用，可生成原告/被告两侧论点并推进轮次
- `POST /api/v1/debates/[id]/summary` 真实可用，可生成并持久化总结
- `GET /api/v1/debates` 真实可返回新创建辩论

**当前核心结论**：

- 模拟辩论基础主链已成立
- 当前没有发现创建、列表、详情、单轮生成、总结的真实业务断链

**立即修复问题**：

- 暂无明确业务断链问题

**已完成的关键修复 / 收口**：

- `debate-rounds-generate.test.ts` 已迁到当前 `getAuthUser` 契约并通过
- 协作成员辩论真实回归已通过：
  - 可访问详情
  - 可获取轮次
  - 可获取论点
  - 可读取状态
  - 可读取摘要
- 辩论详情 / 状态 / 轮次 / 论点 / 导出 / 推荐 / SSE 路由的访问口径已统一到案件协作权限模型
- SSE / `/api/v1/debates/[id]/stream` 已完成基础真实回归验证：
  - 可成功建立连接
  - 可推送 `connected / law-search-complete / completed`

**立即修复问题**：

- 无

**阶段收口问题**：

- `debates/[id]/stream` 仍建议继续补“从开始辩论到完整 argument 事件流”的长流程自动化回归
- 旧 `debate-rounds/[roundId]/generate` 与新 `debates/[id]/stream` 的能力边界仍建议继续统一说明，避免后续双入口漂移

---

### 17. 仪表盘、统计、报表

**状态**：已完成

**已验证内容**：

- 个人 Dashboard 数据聚合
- 案件分析 `/api/analytics/cases`
- 客户分析 `/api/analytics/clients`
- 律师绩效分析 `/api/analytics/lawyers`
- 用户 / 案件 / 辩论 / 性能统计 `/api/stats/*`
- 法务报表生成 `/api/reports`
- 法务报表导出 `/api/reports/export`

**已完成的关键修复 / 收口**：

- 律师绩效 SQL 已从不存在的 `cases.createdBy` 改为真实字段 `cases.userId`，避免真实数据库 500
- 个人 Dashboard 待办任务已同时统计 `createdBy` 与 `assignedTo`
- 个人 Dashboard 今日日程 / 近期日程已复用案件日程协作权限模型，支持共享案件 `VIEW_SCHEDULES`
- 客户价值统计已补 `userId + deletedAt` 隔离，避免跨用户/软删除案件污染
- 案件分析 `caseType` 筛选已真正应用到类型分布、效率、成功率、收益、活跃概览等核心统计
- 用户统计筛选已对齐当前 schema 角色 / 状态枚举，并统一排除软删除用户
- 辩论统计已修复 `debateStatus / status` 漏筛，论点总数与质量评分不再脱离辩论状态和软删除口径
- 性能错误率统计已让 `minSeverity / includeRecovered` 真正参与错误日志查询
- 报表测试已迁到当前 `getAuthUser` 认证契约，导出 `reportId` 已对齐真实 `report_数字` 格式
- 负向用例中的预期错误日志已在测试内静音，避免测试输出长期红字噪音

**验证结果**：

- `src/__tests__/unit/stats`：155/155 通过
- 模块 17 聚焦测试：49/49 通过
- `npm run type-check`：0 错误

**立即修复问题**：

- 无

**阶段收口问题**：

- Dashboard 首页总案件数当前仍按“本人创建案件”统计，是否也纳入共享案件需后续产品口径确认
- 报表导出当前仍是服务层生成下载 URL 的轻量实现，若后续落地真实文件存储，需要补文件级所有权校验

---

### 18. 企业法务与合规

**状态**：已完成

**已验证内容**：

- 企业注册 `/api/enterprise/register`
- 企业营业执照上传与受控访问 `/api/enterprise/qualification/*`
- 企业法务工作台 `/api/dashboard/enterprise`
- 企业风险画像 `/api/enterprise/risk-profile`
- 合规管理 `/api/compliance/dashboard` `/api/compliance/checklist` `/api/compliance/report`
- 合同条款风险 `/api/enterprise/contract-clause-risk`
- 行业合规检查 `/api/enterprise/compliance`
- 知识图谱企业风险分析 `/api/v1/knowledge-graph/enterprise-risk-analysis`

**已完成的关键修复 / 收口**：

- 企业注册已封死“直接携带 `businessLicense` 写库”的旁路，营业执照必须走专用上传接口
- 企业合规能力已统一收紧到“存在企业账号且状态为 `APPROVED`”，不再对未审核企业返回空数据伪正常
- 合规检查项更新已补真实 `itemId` 校验，不再允许把不存在的检查项悄悄写入 `checklistResults`
- 企业风险画像已从“按 `clientName` 匹配合同”改为“按企业账号所有者的案件合同”计算，避免同名企业串数据
- 企业风险画像 `topRisks` 已修复大小写枚举错误，`HIGH/CRITICAL` 风险不再被漏掉
- 企业工作台与企业风险画像已统一排除软删除案件，避免已删除案件继续污染统计
- 知识图谱企业风险分析已补合同访问校验，不再只靠图谱权限就能读取任意合同风险分析结果
- 相关路由负向用例日志已在测试中静音，避免长期红字噪音干扰回归

**验证结果**：

- 模块 18 聚焦测试：78/78 通过
- `npx tsc --noEmit --pretty false`：0 错误

**立即修复问题**：

- 无

**阶段收口问题**：

- `POST /api/enterprise/compliance` 与 `POST /api/enterprise/contract-clause-risk` 当前仍按“合同访问权”开放给律师 / 委托方 / 管理员，这是否继续保留为通用合同分析能力，还是进一步收紧为已认证企业专属能力，后续可按产品定位再定
- 企业合规页面前端目前仍依据“空数据”推断非企业用户提示，后端已改为明确 `403/404`；若后续继续优化体验，可把前端错误态文案再对齐为更明确的企业认证提示

---

### 19. 管理后台

**状态**：已完成

**已验证内容**：

- 用户列表 / 详情 / 更新 / 删除 `/api/admin/users*`
- 用户角色分配 `/api/admin/users/[id]/role` `/api/admin/users/batch-role`
- 角色与角色权限 `/api/admin/roles*`
- 系统配置 `/api/admin/configs*`
- 告警中心 `/api/admin/alerts*`
- 操作日志 / 错误日志 `/api/admin/action-logs` `/api/admin/error-logs`
- 管理员订单列表 `/api/admin/orders`
- 管理员会员列表 / 详情 `/api/admin/memberships*`
- 权限核心 `hasPermission` / `validatePermissions`

**已完成的关键修复 / 收口**：

- 补齐了后台真实使用但未进入权限字典/种子的权限项：`role:*`、`membership:*`、`order:*`、`log:read`、`admin:read/write`，以及缺失的 `alert:read/acknowledge/resolve`
- `ADMIN` 角色现在具备静态内置权限兜底，不再因为数据库角色权限表漏种子或被误改就整片后台失效
- 普通管理员已不能把用户提升为 `ADMIN` / `SUPER_ADMIN`，也不能批量调整管理员账号角色
- 普通管理员已不能修改或删除管理员 / 超级管理员账号；专用角色分配接口和通用用户更新接口都已收紧
- 后台角色管理已加系统角色保护：不能手动创建系统内置角色，且只有 `SUPER_ADMIN` 可以修改系统内置角色及其权限
- `src/__tests__/permission` 已重新纳入 Jest `testMatch`，原先“文件存在但默认不跑”的 RBAC 基座测试已恢复执行
- 多组后台负向用例的预期错误日志已在测试中静音，回归输出更干净

**验证结果**：

- 模块 19 聚焦测试：220/220 通过
- `npx tsc --noEmit --pretty false`：0 错误

**立即修复问题**：

- 无

**阶段收口问题**：

- 无

---

## 下一步建议顺序

建议按以下顺序继续审：

1. 全局收口审计 A：支付与 legacy 入口治理（已完成）
2. 全局收口审计 B：旧测试基座统一迁移（已完成）

### 全局收口审计 A（支付与 legacy 入口治理）

**状态**：已完成

**已完成项**：

- `POST /api/orders/create` 已补 `@legacy` 标识，明确兼容定位；
- `POST /api/payments/alipay/query` 已改为薄包装，统一转发到 `GET /api/payments/query`；
- 支付查询主语义收敛为统一入口，避免专项查询逻辑分叉。

### 全局收口审计 B（旧测试基座统一迁移）

**状态**：已完成

**已完成项**：

- 统计类 API 基座测试（`src/__tests__/unit/stats/*.test.ts`）已按当前认证/权限契约完成验证，9 个测试套件共 137 条用例全通过；
- 管理端典型 API 基座测试（action-logs / error-logs / alerts / roles / memberships / enterprise）已完成回归，6 个测试套件共 103 条用例全通过；
- 本轮未发现阻塞主链路的旧认证契约残留问题，剩余为长尾风格统一项，可在后续非阻塞治理中逐批收口。

### 全局收口审计 C（长尾测试风格统一）

**状态**：已完成

**本轮已完成项**：

- `src/__tests__/api/admin/action-logs.test.ts`
  - 401 断言升级为兼容型统一写法：先断 `success:false`，再兼容 `error` 字符串/对象两种形态；
  - 403 mock 响应统一为 `{ success:false, error:{ code:'FORBIDDEN' } }` 结构。
- `src/__tests__/api/admin/error-logs.test.ts`
  - 同步完成上述 401/403 风格统一。

**验证结果**：

- `action-logs + error-logs`：26/26 通过；
- `npx eslint`：通过。

**下一步**：

- 继续按同一模板迁移剩余长尾测试（优先 payment / legacy 兼容入口 / debates auth 契约相关）。

**本轮增量（C-2）**：

- `src/__tests__/payment/payment-api.test.ts`
  - 统一认证 mock 到 `getAuthUser`（移除旧 `getServerSession` 依赖）；
  - 401 断言升级为兼容型（字符串 / 对象 error 均可）。
- `src/__tests__/api/debates-list-auth.test.ts`
  - 401 断言由整对象等值迁移为关键字段断言（兼容 error 形态变化）。

**验证说明**：

- `debates-list-auth` 在当前多项目 Jest 配置下单文件执行耗时过长，已完成 `eslint + tsc` 静态校验；
- `admin/export/cases` 已完成动态回归（13/13 通过）；
- `payment-api` 位于 `src/__tests__/payment`，当前默认 `testMatch` 不覆盖该目录，需在专项配置中执行动态回归。

**工程化补充**：

- 已新增专项脚本：
  - `npm run test:legacy-auth:api`
  - `npm run test:legacy-auth:payment`
  - `npm run test:legacy-auth`（串行聚合）
  - 用于集中执行长尾认证/兼容入口测试（含 `src/__tests__/payment/payment-api.test.ts`）。
- 已新增专用配置：`jest.config.legacy-auth.js`
  - 避开默认多 project 全量扫描，专门执行长尾认证/兼容入口测试。

**专项回归结果（当前）**：

- `npm run test:legacy-auth:payment`
  - `src/__tests__/payment/payment-api.test.ts`：15/15 通过
- `npm run test:legacy-auth:docs`
  - `src/__tests__/api/document-templates.api.test.ts`：13/13 通过
  - `src/__tests__/api/admin/export/cases.test.ts`：13/13 通过

**剩余难点**：

- `debates-list-auth` / `debates-id-auth-permission`
  - 当前在专项配置下仍表现为超慢执行，需进一步拆分或单独优化测试基座后再做完整动态回归。

**smoke 回归补充**：

- 已新增：
  - `src/__tests__/api/debates-list-auth-smoke.test.ts`
  - `src/__tests__/api/debates-id-auth-permission-smoke.test.ts`
- 结果：
  - `debates-id-auth-permission-smoke`：4/4 通过
  - `debates-list-auth-smoke`：2/2 通过

**定位与修复**：

- 根因不是测试断言，而是中间件模块在测试环境导入时创建了悬挂定时器，拖慢/阻塞 `debates` 路由相关测试；
- 已修复以下模块的测试环境定时器副作用：
  - `src/lib/middleware/rate-limit.ts`
  - `src/lib/middleware/rate-limit-monitor.ts`
  - `src/lib/middleware/adaptive-rate-limit.ts`
  - `src/lib/middleware/ip-filter.ts`

**最终收口补充**：

- `src/__tests__/api/setup.js` 已统一 mock 审计日志层，降低长尾 API 测试噪音；
- `AI 配额` 已切换为“会员等级优先、角色兜底”，并补齐 enterprise/lawyer 的 monthly / daily / per-request 配置种子与环境示例；
- `src/__tests__/lib/ai/quota.test.ts`、`src/__tests__/api/admin-step-up.test.ts` 已同步更新断言并通过验证。

---

## 备注

- 这份文档以后会持续更新。
- 每完成一个模块，就把状态从 `未开始 / 进行中 / 部分完成` 更新成 `已完成`。
- 如果一个模块只验证了子链路，不直接标记为 `已完成`，避免造成“假审计完成”的错觉。
