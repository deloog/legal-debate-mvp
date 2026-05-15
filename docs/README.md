# 📚 项目文档导航

> 法律辩论 MVP 项目文档中心 - 清晰组织，易于查找

**最后更新**: 2026-02-12
**文档总数**: 273 个（已重组完成）
**根目录文件**: 1 个（仅此 README）✨

---

## 🗂️ 文档目录结构

```
docs/
├── 📖 guides/              # 操作指南（永久参考）
├── 🎯 features/            # 功能专题文档
├── 💻 development/         # 开发文档
├── 🔧 operations/          # 运维文档
├── 📊 reports/             # 报告存档（按月）
├── 📦 archive/             # 历史归档
└── 📋 project-management/  # 项目管理
```

---

## 📖 操作指南 (guides/)

日常开发和运维的参考手册

### 开发指南 (development/)

- [AI 助手使用指南](guides/development/ai-assistant-guide.md) - AI 辅助开发最佳实践
- [API 开发指南](guides/development/api-development.md) - API 设计和实现规范
- [测试指南](guides/development/testing-guide.md) - 测试策略和最佳实践
- [AI 行为规则](guides/development/ai-behavior-rules.md) - AI 行为规范
- [AI 类型安全](guides/development/ai-type-safety.md) - AI 代码类型安全指南

### 部署指南 (deployment/)

- [服务器部署](guides/deployment/server-deployment.md) - 服务器部署快速指南
- [数据迁移](guides/deployment/data-migration.md) - 数据迁移部署指南
- [生产发布执行手册](guides/deployment/production-release-runbook.md) - 2026-05-15 晚间生产部署执行清单

### 运维指南 (operations/)

- [数据库优化](guides/operations/database-optimization.md) - 数据库性能优化
- [数据库查询优化](guides/operations/database-query-optimization.md) - 查询性能优化
- [备份策略](guides/operations/backup-strategy.md) - 数据备份和恢复
- [迁移指南](guides/operations/migration-guide.md) - 系统迁移指南

### 用户手册 (user/)

- [数据导入](guides/user/data-import.md) - 数据导入用户指南
- [版本管理](guides/user/version-management.md) - 版本管理快速指南
- [法律数据下载](guides/user/just-laws-download.md) - Just Laws 下载指南
- [真实法律数据](guides/user/real-legal-data.md) - 真实法律数据使用指南

---

## 🎯 功能专题 (features/)

各功能模块的详细文档

### 📄 文档分析器 (docanalyzer/)

- [重构计划](features/docanalyzer/DOC_ANALYZER_REFACTORING_PLAN.md)
- [安全修复报告](features/docanalyzer/DOC_ANALYZER_SECURITY_FIX_REPORT.md)
- [准确率评估](features/docanalyzer/DOCANALYZER_ACCURACY_EVALUATION_REPORT.md)
- [架构修复](features/docanalyzer/DOCANALYZER_ARCHITECTURE_FIX.md)
- [更多文档...](features/docanalyzer/)

### 🔗 知识图谱 (knowledge-graph/)

- [应用指南](features/knowledge-graph/application-guide.md) - 知识图谱应用指南
- [实现路线图](features/knowledge-graph/implementation-roadmap.md) - 实现路线图
- [合同法关联](features/knowledge-graph/contract-law-usage.md) - 合同法条款关联
- [法律版本管理](features/knowledge-graph/law-version-management.md) - 法律版本管理策略

### ⚖️ 辩论系统 (debate/)

- [推荐实现](features/debate/recommendation-implementation.md) - 辩论推荐系统实现

---

## 💻 开发文档 (development/)

### 环境搭建 (setup/)

- [环境变量](development/setup/environment-variables.md) - 环境变量配置

### API 文档 (api/)

- [API 路径迁移](development/api/api-paths-migration.md) - API 路径迁移指南

### 测试文档 (testing/)

- [测试数据工厂](development/testing/test-data-factory.md) - 测试数据生成
- [E2E AI 配置](development/testing/e2e-ai-config.md) - E2E 测试 AI 配置
- [API 测试审计 Mock 规范](development/testing/API_TEST_AUDIT_MOCK_GUIDELINES.md) - API 测试中统一处理审计日志 mock 的约定
- [测试覆盖率](development/testing/coverage/) - 覆盖率报告
- [E2E 测试](development/testing/e2e/) - E2E 测试文档
- [单元测试](development/testing/unit/) - 单元测试文档

### 审计报告 (audit/)

- [任务审计报告](development/audit/) - 各任务审计结果

### 验证文档 (validation/)

- [AI POC 验证](development/validation/AI_POC_VALIDATION_REPORT.md)

---

## 🔧 运维文档 (operations/)

### 部署 (deployment/)

- [部署检查清单](operations/deployment/deployment-checklist.md)
- [Docker Compose](operations/deployment/docker-compose.md)
- [生产环境配置](operations/deployment/production-config.md)
- [生产发布执行手册](guides/deployment/production-release-runbook.md)

### 监控 (monitoring/)

- [系统监控](operations/monitoring/system-monitoring.md) - 系统监控实现

---

## 📊 报告存档 (reports/)

按时间组织的项目报告

### 2026年2月 (2026-02/)

- [Week 1](reports/2026-02/week1/) - 最新完成报告
  - 完整工作总结、最终总结、生产进度等

### 2026年1月 (2026-01/)

- [Week 4](reports/2026-01/week4/) - 代码质量修复、关键修复
- [Week 3](reports/2026-01/week3/) - 知识图谱、类型修复
- [Week 2](reports/2026-01/week2/) - 数据分析、前后端差距分析
- [Week 1](reports/2026-01/week1/) - 生产准备、优化计划

---

## 📦 历史归档 (archive/)

过时的历史文档

### 2025年归档 (2025/)

- [Stages](archive/2025/stages/) - Stage 1-3 完成报告
- [Sprints](archive/2025/sprints/) - Sprint 0-1 完成记录
- [优化记录](archive/2025/optimization/) - 历史优化记录
- [性能优化](archive/2025/optimization/performance/) - 性能优化报告

### 已废弃文档 (deprecated/)

- [废弃文档](archive/deprecated/) - 不再使用的文档

---

## 📋 项目管理 (project-management/)

### 冲刺管理 (sprints/)

- [Sprint 11](project-management/sprints/sprint-11/) - 任务追踪和进度
- [Sprint 12](project-management/sprints/sprint-12/)
- [当前冲刺](project-management/sprints/current/)

### 业务文档 (business/)

- [业务需求](project-management/business/BUSINESS_REQUIREMENTS.md) - 业务需求文档

---

## 🚀 快速导航

### 我想要...

#### 📖 了解项目

- **新手入门** → 查看 [业务需求](project-management/business/BUSINESS_REQUIREMENTS.md)
- **了解架构** → 查看 [架构目录](architecture/)
- **查看进度** → 查看 [Sprint 11 任务追踪](project-management/sprints/sprint-11/)

#### 💻 开始开发

- **环境配置** → [环境变量](development/setup/environment-variables.md)
- **API 开发** → [API 开发指南](guides/development/api-development.md)
- **AI 辅助** → [AI 助手指南](guides/development/ai-assistant-guide.md)
- **代码规范** → [开发指南](guides/development/)

#### 🧪 测试相关

- **测试策略** → [测试指南](guides/development/testing-guide.md)
- **E2E 测试** → [E2E 配置](development/testing/e2e-ai-config.md)
- **测试数据** → [测试数据工厂](development/testing/test-data-factory.md)
- **API 测试规范** → [API 测试审计 Mock 规范](development/testing/API_TEST_AUDIT_MOCK_GUIDELINES.md)

#### 🚀 部署运维

- **部署服务器** → [服务器部署](guides/deployment/server-deployment.md)
- **生产发布** → [生产发布执行手册](guides/deployment/production-release-runbook.md)
- **数据库优化** → [数据库优化](guides/operations/database-optimization.md)
- **系统监控** → [系统监控](operations/monitoring/system-monitoring.md)

#### 🎯 功能开发

- **文档分析** → [DocAnalyzer 文档](features/docanalyzer/)
- **知识图谱** → [知识图谱文档](features/knowledge-graph/)
- **辩论系统** → [辩论系统文档](features/debate/)

#### 📊 查看报告

- **最新进展** → [2026-02 报告](reports/2026-02/)
- **历史记录** → [2026-01 报告](reports/2026-01/)
- **归档文档** → [历史归档](archive/)

---

## 📊 文档统计

| 分类                   | 文档数  | 说明           |
| ---------------------- | ------- | -------------- |
| 📖 guides/             | 15+     | 操作指南和手册 |
| 🎯 features/           | 15+     | 功能专题文档   |
| 💻 development/        | 50+     | 开发相关文档   |
| 🔧 operations/         | 5+      | 运维文档       |
| 📊 reports/            | 100+    | 按月归档的报告 |
| 📦 archive/            | 60+     | 历史文档       |
| 📋 project-management/ | 20+     | 项目管理文档   |
| **总计**               | **266** | **所有文档**   |

---

## 💡 使用提示

1. **新用户**: 先阅读 [业务需求](project-management/business/BUSINESS_REQUIREMENTS.md) 了解项目背景
2. **开发人员**: 查看 [guides/development/](guides/development/) 了解开发规范
3. **AI 助手**: 从 [AI 助手指南](guides/development/ai-assistant-guide.md) 开始
4. **遇到问题**: 查看 [归档/问题和解决方案](archive/2025/sprints/problems-and-solutions.md)
5. **查看历史**: 浏览 [reports/](reports/) 和 [archive/](archive/)

---

## 📝 文档维护

### 维护策略

- **活跃文档**（最近3个月）: 保留在主目录
- **历史报告**（3-12个月）: 移入 `reports/`
- **过时文档**（>12个月）: 移入 `archive/`
- **废弃文档**: 移入 `archive/deprecated/`

### 每月第一周任务

1. 检查根目录是否有新增文件需要分类
2. 将上月的临时报告归档到 `reports/`
3. 更新本 README 的统计数据

---

## 🔄 文档更新日志

### 2026-02-12 ⭐

- ✨ **完成文档大重组** - 273个文档从混乱到清晰
- 📁 **新目录结构** - 8个一级分类，清晰易查
- 🗂️ **按月归档报告** - reports/2026-01/, reports/2026-02/
- 📦 **历史文档归档** - archive/2025/
- ✅ **根目录精简** - 从114个文件减少到**仅1个**（README.md）
- 📋 [查看重组详情](archive/2026/documentation-reorganization/)

### 2026-01-01

- 🎉 首次文档重组尝试（不完整）

---

## 📞 需要帮助？

- **文档问题**: 查看 [DOCS_REORGANIZATION_SUMMARY.md](DOCS_REORGANIZATION_SUMMARY.md)
- **重组说明**: 查看 [DOCUMENTATION_REORGANIZATION_PLAN.md](DOCUMENTATION_REORGANIZATION_PLAN.md)
- **快速开始**: 查看 [REORGANIZATION_QUICK_START.md](REORGANIZATION_QUICK_START.md)

---

_文档版本: v3.0 (重组完成版)_
_最后更新: 2026-02-12_
_维护者: AI Assistant_
