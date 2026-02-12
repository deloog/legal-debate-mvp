# 📚 文档重组 - 快速开始

## 问题概述

- **当前状态**: 266个文档，根目录114个文件，结构混乱
- **目标状态**: 清晰的目录结构，根目录≤10个文件，易于查找

## 快速执行（推荐）

### 方案 A：自动化脚本（最快）

```powershell
# 1. 预览（不实际移动，仅查看）
.\scripts\reorganize-docs.ps1 -DryRun

# 2. 实际执行（自动备份）
.\scripts\reorganize-docs.ps1

# 3. 如果不需要备份（加快速度）
.\scripts\reorganize-docs.ps1 -Backup:$false
```

### 方案 B：手动整理（更谨慎）

按优先级分阶段执行：

#### 阶段 1: 归档临时报告（P0 - 最重要）

```bash
# 创建报告目录
mkdir -p docs/reports/2026-{01,02}/week{1,2,3,4}

# 移动最近的报告到 2026-02
mv docs/COMPLETE_WORK_SUMMARY.md docs/reports/2026-02/week1/
mv docs/FINAL_SUMMARY.md docs/reports/2026-02/week1/
mv docs/WORK_SUMMARY.md docs/reports/2026-02/week1/
mv docs/FINAL_COMPLETION_REPORT.md docs/reports/2026-02/week1/

# 移动1月份的报告
mv docs/CODE_QUALITY_FIX_*.md docs/reports/2026-01/week4/
mv docs/TYPE_*_FIX_*.md docs/reports/2026-01/week3/
```

#### 阶段 2: 重组指南文档（P1）

```bash
# 创建 guides 目录结构
mkdir -p docs/guides/{development,deployment,operations,user}

# 移动开发指南
mv docs/AI_ASSISTANT_QUICK_START.md docs/guides/development/
mv docs/API_DEVELOPMENT_GUIDE.md docs/guides/development/
mv docs/TESTING_GUIDE.md docs/guides/development/

# 移动用户指南
mv docs/DATA_IMPORT_USER_GUIDE.md docs/guides/user/
mv docs/VERSION_MANAGEMENT_QUICK_GUIDE.md docs/guides/user/

# 移动部署指南
mv docs/SERVER_DEPLOYMENT_QUICK_GUIDE.md docs/guides/deployment/
```

#### 阶段 3: 整理功能文档（P1）

```bash
# 创建 features 目录
mkdir -p docs/features/{docanalyzer,knowledge-graph,debate}

# 移动 docanalyzer 文档
mv docs/docanalyzer docs/features/

# 移动知识图谱文档
mv docs/KNOWLEDGE_GRAPH_*.md docs/features/knowledge-graph/
mv docs/CONTRACT_LAW_*.md docs/features/knowledge-graph/

# 移动辩论系统文档
mv docs/DEBATE_*.md docs/features/debate/
```

#### 阶段 4: 归档历史文档（P2）

```bash
# 创建归档目录
mkdir -p docs/archive/2025/{stages,sprints,optimization}

# 归档 Stage 文档
mv docs/stage*.md docs/archive/2025/stages/
mv docs/STAGE*.md docs/archive/2025/stages/

# 归档 Sprint 文档
mv docs/archive/sprint*.md docs/archive/2025/sprints/

# 归档优化记录
mv docs/OPTIMIZATION_*.md docs/archive/2025/optimization/
```

## 新的文档结构

```
docs/
├── README.md                    # 主导航
├── QUICK_START.md              # 快速开始
│
├── guides/                     # 📖 操作指南
│   ├── development/            # 开发指南
│   ├── deployment/             # 部署指南
│   ├── operations/             # 运维指南
│   └── user/                   # 用户手册
│
├── features/                   # 🎯 功能专题
│   ├── docanalyzer/           # 文档分析器
│   ├── knowledge-graph/       # 知识图谱
│   ├── debate/                # 辩论系统
│   └── auth/                  # 认证系统
│
├── development/                # 💻 开发文档
│   ├── setup/                 # 环境搭建
│   ├── api/                   # API 文档
│   ├── testing/               # 测试文档
│   └── tools/                 # 开发工具
│
├── operations/                 # 🔧 运维文档
│   ├── deployment/            # 部署
│   ├── monitoring/            # 监控
│   └── troubleshooting/       # 故障排查
│
├── reports/                    # 📊 报告存档
│   ├── 2026-01/               # 按月分类
│   └── 2026-02/
│
├── archive/                    # 📦 历史归档
│   ├── 2025/                  # 按年分类
│   └── deprecated/            # 已废弃
│
└── project-management/         # 📋 项目管理
    ├── sprints/               # 冲刺管理
    ├── roadmap/               # 路线图
    └── business/              # 业务文档
```

## 验证清单

整理完成后，检查：

- [ ] 根目录文件数 ≤ 15 个
- [ ] 所有临时报告已归档到 reports/
- [ ] 所有历史文档已归档到 archive/
- [ ] 每个主要目录都有 README.md
- [ ] 文档分类清晰，易于查找
- [ ] 更新了主 README.md 的统计数据

## 回滚方法

如果出现问题，可以快速回滚：

```bash
# 如果使用了自动脚本，会自动创建备份
# 备份目录格式：docs-backup-YYYYMMDD-HHMMSS

# 恢复备份
rm -rf docs
mv docs-backup-YYYYMMDD-HHMMSS docs
```

## 后续维护

### 每月第一周执行：

1. **检查根目录** - 是否有新增文件需要分类
2. **归档上月报告** - 移动到 reports/YYYY-MM/
3. **更新 README** - 确保统计数据准确

### 文档生命周期：

```
创建 → 使用（3个月） → 归档(reports/) → 可选删除(archive/deprecated/)
```

## 需要帮助？

查看详细计划：[docs/DOCUMENTATION_REORGANIZATION_PLAN.md](DOCUMENTATION_REORGANIZATION_PLAN.md)

---

**预计耗时**:
- 自动化脚本: 5-10 分钟
- 手动整理: 30-60 分钟

**风险**: 低（可随时回滚）
