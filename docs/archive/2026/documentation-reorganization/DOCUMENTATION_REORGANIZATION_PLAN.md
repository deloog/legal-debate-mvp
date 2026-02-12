# 📚 文档重组计划

## 当前问题分析

### 统计数据
- **总文档数**: 266 个 markdown 文件
- **根目录文档**: 114 个（过多，应控制在 10 个以内）
- **临时报告**: ~50 个 SUMMARY/REPORT/COMPLETION 文件

### 主要问题
1. ✗ 根目录文件过多（114个），难以查找
2. ✗ 临时性报告未归档，成为永久文档
3. ✗ 文件命名不规范（多个 FINAL_SUMMARY, COMPLETION_REPORT）
4. ✗ 文档分类不清晰，归档不及时
5. ✗ README.md 统计数据过时（显示58个，实际266个）

---

## 新的文档结构

```
docs/
├── README.md                          # 主导航文档
├── QUICK_START.md                     # 快速开始指南
├── CONTRIBUTING.md                    # 贡献指南（新增）
│
├── 📁 guides/                         # 操作指南（永久）
│   ├── development/                   # 开发指南
│   │   ├── CODE_STYLE.md
│   │   ├── API_DEVELOPMENT.md
│   │   └── TESTING_GUIDE.md
│   ├── deployment/                    # 部署指南
│   │   ├── SERVER_DEPLOYMENT.md
│   │   ├── DOCKER_GUIDE.md
│   │   └── PRODUCTION_CONFIG.md
│   ├── operations/                    # 运维指南
│   │   ├── BACKUP_STRATEGY.md
│   │   ├── MIGRATION_GUIDE.md
│   │   └── MONITORING_SETUP.md
│   └── user/                          # 用户指南
│       ├── DATA_IMPORT.md
│       └── VERSION_MANAGEMENT.md
│
├── 📁 architecture/                   # 架构设计（永久）
│   ├── decisions/                     # 架构决策记录（ADR）
│   │   └── ARCHITECTURE_DECISION_RECORDS.md
│   ├── database/                      # 数据库设计
│   │   ├── DATABASE_MODEL_V2.md
│   │   └── DATABASE_SETUP.md
│   ├── agent/                         # Agent 架构
│   │   └── AGENT_ARCHITECTURE_V2.md
│   └── system/                        # 系统架构
│       └── SYSTEM_OVERVIEW.md
│
├── 📁 features/                       # 功能专题（永久）
│   ├── docanalyzer/                   # 文档分析器
│   │   ├── README.md
│   │   ├── ARCHITECTURE.md
│   │   └── USER_GUIDE.md
│   ├── knowledge-graph/               # 知识图谱
│   │   ├── README.md
│   │   ├── IMPLEMENTATION.md
│   │   └── APPLICATION_GUIDE.md
│   ├── debate/                        # 辩论系统
│   │   └── DEBATE_RECOMMENDATION.md
│   └── auth/                          # 认证系统
│       └── AUTH_GUIDE.md
│
├── 📁 development/                    # 开发文档（永久）
│   ├── setup/                         # 环境搭建
│   │   ├── ENVIRONMENT_VARIABLES.md
│   │   └── DEPENDENCIES.md
│   ├── api/                           # API 文档
│   │   ├── API_SPECIFICATION.md
│   │   └── API_MIGRATION.md
│   ├── testing/                       # 测试文档
│   │   ├── TEST_STRATEGY.md
│   │   ├── E2E_GUIDE.md
│   │   └── COVERAGE_GUIDE.md
│   └── tools/                         # 开发工具
│       └── AI_ASSISTANT_GUIDE.md
│
├── 📁 operations/                     # 运维文档（永久）
│   ├── deployment/                    # 部署
│   │   ├── DEPLOYMENT_CHECKLIST.md
│   │   └── DOCKER_COMPOSE.md
│   ├── monitoring/                    # 监控
│   │   └── SYSTEM_MONITORING.md
│   └── troubleshooting/               # 故障排查
│       └── COMMON_ISSUES.md
│
├── 📁 reports/                        # 报告存档（分年月）
│   ├── 2026-01/                       # 2026年1月
│   │   ├── week1/
│   │   ├── week2/
│   │   ├── week3/
│   │   └── week4/
│   ├── 2026-02/                       # 2026年2月
│   │   └── week1/
│   └── README.md                      # 报告索引
│
├── 📁 archive/                        # 归档（过时文档）
│   ├── 2025/                          # 2025年归档
│   │   ├── sprints/                   # 冲刺归档
│   │   ├── optimization/              # 优化记录
│   │   └── migration/                 # 迁移记录
│   ├── deprecated/                    # 已废弃文档
│   └── README.md                      # 归档索引
│
└── 📁 project-management/             # 项目管理
    ├── sprints/                       # 冲刺管理
    │   ├── sprint-11/
    │   ├── sprint-12/
    │   └── current/
    ├── roadmap/                       # 路线图
    │   └── PRODUCT_ROADMAP.md
    └── business/                      # 业务文档
        └── BUSINESS_REQUIREMENTS.md
```

---

## 文档分类标准

### 永久性文档（保留在主目录）
- ✅ 架构设计文档
- ✅ 开发指南和规范
- ✅ 用户操作手册
- ✅ API 文档和规范
- ✅ 功能说明文档

### 临时性文档（需归档）
- 🗄️ 任务完成报告（COMPLETION_REPORT）
- 🗄️ 工作总结（WORK_SUMMARY）
- 🗄️ 阶段完成报告（STAGE_COMPLETION）
- 🗄️ 修复记录（FIX_REPORT）
- 🗄️ 测试结果（TEST_RESULTS）

### 归档文档（移入 archive）
- 📦 已完成的 Sprint 文档
- 📦 过时的优化记录
- 📦 历史迁移文档
- 📦 已废弃的方案

---

## 整理优先级

### P0 - 立即整理（影响日常使用）
1. **清理根目录** - 将 100+ 个文件分类到子目录
2. **归档临时报告** - 50+ 个 SUMMARY/REPORT 文件按时间归档
3. **更新 README** - 修正统计数据，更新导航

### P1 - 本周完成（重要但不紧急）
4. **规范文件命名** - 统一命名规则
5. **创建索引文件** - 每个目录添加 README
6. **整理 task-tracking** - 过多重复文档

### P2 - 后续优化（改善体验）
7. **添加文档模板** - 标准化新文档格式
8. **建立归档策略** - 定期清理临时文档
9. **文档审查流程** - 防止文档膨胀

---

## 迁移映射表

### 根目录 → guides/
```
AI_ASSISTANT_QUICK_START.md         → guides/development/AI_ASSISTANT_GUIDE.md
API_DEVELOPMENT_GUIDE.md            → guides/development/API_DEVELOPMENT.md
TESTING_GUIDE.md                    → guides/development/TESTING_GUIDE.md
DATA_IMPORT_USER_GUIDE.md           → guides/user/DATA_IMPORT.md
VERSION_MANAGEMENT_QUICK_GUIDE.md   → guides/user/VERSION_MANAGEMENT.md
SERVER_DEPLOYMENT_QUICK_GUIDE.md    → guides/deployment/SERVER_DEPLOYMENT.md
DATABASE_OPTIMIZATION_GUIDE.md      → guides/operations/DATABASE_OPTIMIZATION.md
BACKUP_STRATEGY.md                  → guides/operations/BACKUP_STRATEGY.md
```

### 根目录 → features/
```
CONTRACT_LAW_ARTICLE_ASSOCIATION_*.md → features/knowledge-graph/
KNOWLEDGE_GRAPH_*.md                  → features/knowledge-graph/
DEBATE_RECOMMENDATION_*.md            → features/debate/
docanalyzer/* (所有文件)               → features/docanalyzer/
```

### 根目录 → reports/2026-02/
```
COMPLETE_WORK_SUMMARY.md            → reports/2026-02/week1/complete-work-summary.md
FINAL_SUMMARY.md                    → reports/2026-02/week1/final-summary.md
WORK_SUMMARY.md                     → reports/2026-02/week1/work-summary.md
FINAL_COMPLETION_REPORT.md          → reports/2026-02/week1/final-completion-report.md
CODE_QUALITY_FIX_*_REPORT.md        → reports/2026-01/week4/code-quality-fix-*.md
TYPE_*_FIX_*.md                     → reports/2026-01/week3/type-*.md
```

### 根目录 → archive/2025/
```
stage1-*.md                         → archive/2025/stages/stage1-*.md
STAGE2_*.md                         → archive/2025/stages/stage2-*.md
STAGE3_*.md                         → archive/2025/stages/stage3-*.md
sprint*-completed.md                → archive/2025/sprints/sprint*-completed.md
optimization-records.md             → archive/2025/optimization/optimization-records.md
```

### task-tracking/ 目录清理
```
删除重复文档：
- PHASE3_AI_TASK_TRACKING_TEMP.md (临时文件)
- docs/task-tracking/docs/ (重复嵌套)

合并相似文档：
- SPRINT*_TASK_TRACKING.md → sprints/sprint-*/tracking.md
- STAGE*_*_REPORT.md → stages/stage-*/report.md
```

---

## 文件命名规范

### 规则
1. 使用小写字母和连字符：`feature-name.md`
2. 避免使用全大写：`CODE_STYLE.md` → `code-style.md`
3. 日期格式统一：`YYYY-MM-DD` 或 `YYYY-MM`
4. 避免重复前缀：`DOCANALYZER_ARCHITECTURE_FIX.md` → `architecture-fix.md`（在 docanalyzer/ 目录下）
5. 版本号后缀：`document-v2.md` 或 `document-2024-01.md`

### 示例
```
✗ DOCANALYZER_ARCHITECTURE_FIX_FINAL_REPORT.md
✓ features/docanalyzer/architecture-fix-report-final.md

✗ KNOWLEDGE_GRAPH_STAGE3_REPORT.md
✓ features/knowledge-graph/stage3-report.md

✗ CODE_QUALITY_FIX_REPORT_PHASE2.md
✓ reports/2026-01/week3/code-quality-fix-phase2.md
```

---

## 实施步骤

### 第一步：准备工作
```bash
# 1. 备份当前 docs 目录
cp -r docs docs-backup-$(date +%Y%m%d)

# 2. 创建新目录结构
mkdir -p docs/{guides/{development,deployment,operations,user},features/{docanalyzer,knowledge-graph,debate,auth},development/{setup,api,testing,tools},operations/{deployment,monitoring,troubleshooting},reports/{2026-01/{week1,week2,week3,week4},2026-02/{week1,week2}},archive/{2025/{sprints,optimization,migration,stages},deprecated},project-management/{sprints/{sprint-11,sprint-12,current},roadmap,business}}
```

### 第二步：批量迁移
使用脚本自动迁移文件（见下一节）

### 第三步：更新引用
```bash
# 全局搜索并更新文档内部链接
# 需要手动检查和更新
```

### 第四步：清理和验证
```bash
# 1. 验证所有文件已迁移
# 2. 检查链接是否正确
# 3. 更新 README.md
# 4. 删除空目录
```

---

## 迁移脚本

将在下一步提供自动化迁移脚本。

---

## 成功标准

- ✅ 根目录文件数 ≤ 10 个
- ✅ 所有临时报告已归档（按时间组织）
- ✅ 文档分类清晰，易于查找
- ✅ README.md 准确反映文档结构
- ✅ 所有文档链接正常
- ✅ 建立文档维护机制

---

## 维护策略

### 定期审查（每月）
1. 检查根目录是否有新增文件需要分类
2. 将上月的临时报告归档
3. 更新 README.md 统计数据

### 文档生命周期
```
创建 → 使用（3个月） → 归档（reports/） → 可选删除（archive/deprecated/）
```

### 归档策略
- **活跃文档**（最近3个月）：保留在主目录
- **历史文档**（3-12个月）：移入 reports/
- **过时文档**（>12个月）：移入 archive/
- **废弃文档**：移入 archive/deprecated/（考虑删除）

---

**执行时间估算**: 2-3 小时
**风险级别**: 低（可随时回滚备份）
**建议**: 分阶段执行，先处理 P0，再处理 P1 和 P2
