# 文档链接更新指南

## 📋 概述

由于文档重组（2026-01-01），所有文档从 `docs/` 根目录移动到了分类子目录中。本文档提供了所有需要更新的链接说明。

---

## 🔗 链接更新规则

### 通用规则

| 原路径                | 新路径                                       | 说明                                             |
| --------------------- | -------------------------------------------- | ------------------------------------------------ |
| `docs/`               | `../`                                        | 从 task-tracking/ 或 archive/ 目录引用上级 docs/ |
| `./ARCHITECTURE.md`   | `../architecture/agent/ARCHITECTURE.md`      | 架构文档                                         |
| `./DATABASE_MODEL.md` | `../architecture/database/DATABASE_MODEL.md` | 数据库模型                                       |
| `./REPORT.md`         | `../reports/REPORT.md`                       | 各类报告                                         |
| `./GUIDE.md`          | `../guides/GUIDE.md`                         | 操作指南                                         |
| `./audit/`            | `../audit/`                                  | 审计报告                                         |
| `./validation/`       | `../validation/`                             | 验证文档                                         |
| `./archive/`          | `../archive/`                                | 归档文档                                         |

---

## 📁 各目录链接更新说明

### docs/task-tracking/ 目录

从 `docs/task-tracking/` 引用的文档需要更新为：

```markdown
# 归档文档

- [Sprint 0 归档](../archive/sprint0-completed.md)
- [Sprint 1 归档](../archive/sprint1-completed.md)
- [问题解决记录](../archive/problems-and-solutions.md)
- [优化实施记录](../archive/optimization-records.md)

# 业务需求

- [业务需求文档](../business/BUSINESS_REQUIREMENTS.md)

# 架构文档

- [Agent架构设计](../architecture/agent/AGENT_ARCHITECTURE_V2.md)
- [数据库模型](../architecture/database/DATABASE_MODEL_V2.md)

# 操作指南

- [Manus集成指南](../guides/MANUS_INTEGRATION_GUIDE.md)
- [迁移指南](../guides/MIGRATION_GUIDE.md)
- [代码风格指南](../guides/CODE_STYLE.md)

# 测试文档

- [测试覆盖率指南](../testing/coverage/TEST_COVERAGE_GUIDE.md)
- [E2E测试报告](../testing/e2e/E2E_TEST_REPORT.md)

# 优化文档

- [DeepSeek优化报告](../optimization/ai/DEEPSEEK_OPTIMIZATION_REPORT.md)
- [前端性能优化报告](../optimization/frontend/FRONTEND_PERFORMANCE_OPTIMIZATION_REPORT.md)
- [后端性能优化报告](../optimization/backend/BACKEND_PERFORMANCE_OPTIMIZATION_REPORT.md)

# 报告文档

- [API错误处理改进报告](../reports/API_ERROR_HANDLING_IMPROVEMENT_REPORT.md)
- [API框架审计报告](../reports/API_FRAMEWORK_AUDIT_REPORT.md)
- [辩论API实施报告](../reports/DEBATE_API_IMPLEMENTATION_REPORT.md)
```

### docs/archive/ 目录

从 `docs/archive/` 引用的文档需要更新为：

```markdown
# 主任务追踪

- [主任务追踪文件](../AI_TASK_TRACKING.md)

# 业务需求

- [业务需求文档](../business/BUSINESS_REQUIREMENTS.md)

# 实施文档

- [实施待办清单](../task-tracking/IMPLEMENTATION_TODO.md)
- [Phase 2实施文档](../task-tracking/PHASE2_IMPLEMENTATION.md)

# 数据库文档

- [数据模型文档](../architecture/database/DATABASE_MODEL_V2.md)

# 操作指南

- [备份策略文档](../guides/BACKUP_STRATEGY.md)
- [迁移操作指南](../guides/MIGRATION_GUIDE.md)
```

### docs/business/ 目录

从 `docs/business/` 引用的文档需要更新为：

```markdown
# 架构文档

- [Agent架构设计 v2.0](../architecture/agent/AGENT_ARCHITECTURE_V2.md)
- [数据库模型 v2.0](../architecture/database/DATABASE_MODEL_V2.md)

# 操作指南

- [Manus集成指南](../guides/MANUS_INTEGRATION_GUIDE.md)

# 实施文档

- [AI任务追踪](../task-tracking/AI_TASK_TRACKING.md)
- [实施待办清单](../task-tracking/IMPLEMENTATION_TODO.md)
- [Phase 2实施文档](../task-tracking/PHASE2_IMPLEMENTATION.md)

# 测试文档

- [测试覆盖率指南](../testing/coverage/TEST_COVERAGE_GUIDE.md)
- [E2E测试报告](../testing/e2e/E2E_TEST_REPORT.md)

# 优化文档

- [DeepSeek优化报告](../optimization/ai/DEEPSEEK_OPTIMIZATION_REPORT.md)
- [前端性能优化报告](../optimization/frontend/FRONTEND_PERFORMANCE_OPTIMIZATION_REPORT.md)
- [后端性能优化报告](../optimization/backend/BACKEND_PERFORMANCE_OPTIMIZATION_REPORT.md)
```

### docs/guides/ 目录

从 `docs/guides/` 引用的文档需要更新为：

```markdown
# 架构文档

- [数据库模型](../architecture/database/DATABASE_MODEL_V2.md)
- [Agent架构设计](../architecture/agent/AGENT_ARCHITECTURE_V2.md)

# 实施文档

- [Phase 2实施文档](../task-tracking/PHASE2_IMPLEMENTATION.md)
- [AI任务追踪](../task-tracking/AI_TASK_TRACKING.md)

# 业务需求

- [业务需求文档](../business/BUSINESS_REQUIREMENTS.md)

# 测试文档

- [测试策略文档](../reports/TEST_STRATEGY.md)
```

---

## ✅ 已完成的链接更新

### 1. docs/task-tracking/AI_TASK_TRACKING.md

- ✅ 更新归档文档链接（`./archive/` → `../archive/`）
- ✅ 更新架构文档链接（`docs/DATABASE_MODEL_V2.md` → `../architecture/database/DATABASE_MODEL_V2.md`）
- ✅ 更新Agent架构链接（`docs/AGENT_ARCHITECTURE_V2.md` → `../architecture/agent/AGENT_ARCHITECTURE_V2.md`）
- ✅ 更新操作指南链接（`docs/MANUS_INTEGRATION_GUIDE.md` → `../guides/MANUS_INTEGRATION_GUIDE.md`）

### 2. docs/business/BUSINESS_REQUIREMENTS.md

- ✅ 更新架构文档链接（使用 `../architecture/` 前缀）
- ✅ 更新实施文档链接（使用 `../task-tracking/` 前缀）
- ✅ 更新测试文档链接（使用 `../testing/` 前缀）
- ✅ 更新优化文档链接（使用 `../optimization/` 前缀）

### 3. docs/README.md

- ✅ 所有链接已正确，使用相对路径
- ✅ 分类目录链接正确

---

## ⏳ 待更新的链接

### docs/task-tracking/TASK_ARCHIVE_INDEX.md

需要更新以下链接：

- `AI_TASK_TRACKING.md` → `./AI_TASK_TRACKING.md` ✅
- `archive/sprint0-completed.md` → `../archive/sprint0-completed.md`
- `archive/sprint1-completed.md` → `../archive/sprint1-completed.md`
- `archive/problems-and-solutions.md` → `../archive/problems-and-solutions.md`
- `archive/optimization-records.md` → `../archive/optimization-records.md`
- `DATABASE_MODEL_V2.md` → `../architecture/database/DATABASE_MODEL_V2.md`
- `BUSINESS_REQUIREMENTS.md` → `../business/BUSINESS_REQUIREMENTS.md`
- `IMPLEMENTATION_TODO.md` → `./IMPLEMENTATION_TODO.md`
- `PHASE2_IMPLEMENTATION.md` → `./PHASE2_IMPLEMENTATION.md`

### docs/task-tracking/IMPLEMENTATION_TODO.md

需要更新以下链接：

- `BUSINESS_REQUIREMENTS.md` → `../business/BUSINESS_REQUIREMENTS.md`
- `PHASE2_IMPLEMENTATION.md` → `./PHASE2_IMPLEMENTATION.md`
- `TEST_STRATEGY.md` → `../reports/TEST_STRATEGY.md`
- `AI_TASK_TRACKING.md` → `./AI_TASK_TRACKING.md`

### docs/guides/MANUS_INTEGRATION_GUIDE.md

需要更新以下链接：

- `DATABASE_MODEL_V2.md` → `../architecture/database/DATABASE_MODEL_V2.md`
- `PHASE2_IMPLEMENTATION.md` → `../task-tracking/PHASE2_IMPLEMENTATION.md`
- `AGENT_ARCHITECTURE_V2.md` → `../architecture/agent/AGENT_ARCHITECTURE_V2.md`
- `AI_TASK_TRACKING.md` → `../task-tracking/AI_TASK_TRACKING.md`

### docs/guides/MIGRATION_TO_NEW_COMPUTER.md

需要更新以下链接：

- `DATABASE_SETUP.md` → `../architecture/database/DATABASE_SETUP.md`
- `README.md` → `../README.md`
- `MIGRATION_GUIDE.md` → `./MIGRATION_GUIDE.md`

### docs/archive/problems-and-solutions.md

需要更新以下链接：

- `../AI_TASK_TRACKING.md` → `../task-tracking/AI_TASK_TRACKING.md`
- `sprint0-completed.md` → `./sprint0-completed.md`
- `sprint1-completed.md` → `./sprint1-completed.md`
- `optimization-records.md` → `./optimization-records.md`

### docs/archive/sprint0-completed.md

需要更新以下链接：

- `AI_POC_VALIDATION_REPORT.md` → `../validation/AI_POC_VALIDATION_REPORT.md`
- `BUSINESS_REQUIREMENTS.md` → `../business/BUSINESS_REQUIREMENTS.md`
- `IMPLEMENTATION_TODO.md` → `../task-tracking/IMPLEMENTATION_TODO.md`
- `PHASE2_IMPLEMENTATION.md` → `../task-tracking/PHASE2_IMPLEMENTATION.md`
- `AI_TASK_TRACKING.md` → `../task-tracking/AI_TASK_TRACKING.md`

### docs/archive/sprint1-completed.md

需要更新以下链接：

- `BACKUP_STRATEGY.md` → `../guides/BACKUP_STRATEGY.md`
- `MIGRATION_GUIDE.md` → `../guides/MIGRATION_GUIDE.md`
- `AI_TASK_TRACKING.md` → `../task-tracking/AI_TASK_TRACKING.md`

### docs/archive/optimization-records.md

需要更新以下链接：

- `AI_TASK_TRACKING.md` → `../task-tracking/AI_TASK_TRACKING.md`
- `problems-and-solutions.md` → `./problems-and-solutions.md`
- `sprint0-completed.md` → `./sprint0-completed.md`
- `sprint1-completed.md` → `./sprint1-completed.md`

---

## 🔧 批量更新脚本

如果需要批量更新链接，可以使用以下 PowerShell 脚本：

```powershell
# 更新 task-tracking 目录下的链接
$files = Get-ChildItem "docs\task-tracking\" -Filter "*.md"
foreach ($file in $files) {
    $content = Get-Content $file.FullName -Raw
    $content = $content -replace '\]\(\./archive/', '](../archive/'
    $content = $content -replace '\]\(docs/', '](../'
    $content = $content -replace '\]\(\.\./DATABASE_MODEL_V2\.md\)', '](../architecture/database/DATABASE_MODEL_V2.md)'
    $content = $content -replace '\]\(\.\./AGENT_ARCHITECTURE_V2\.md\)', '](../architecture/agent/AGENT_ARCHITECTURE_V2.md)'
    $content = $content -replace '\]\(\.\./MANUS_INTEGRATION_GUIDE\.md\)', '](../guides/MANUS_INTEGRATION_GUIDE.md)'
    Set-Content $file.FullName -Value $content -NoNewline
}
```

---

## 📋 检查清单

在更新链接后，请检查以下内容：

- [ ] 所有相对路径链接正确
- [ ] 没有死链接
- [ ] 链接指向的文档实际存在
- [ ] 链接在浏览器中可以正常打开
- [ ] Markdown 格式正确

---

## 🎯 优先级

### 高优先级（必须立即修复）

1. docs/task-tracking/AI_TASK_TRACKING.md - 主要任务追踪文档
2. docs/task-tracking/TASK_ARCHIVE_INDEX.md - 归档索引
3. docs/task-tracking/IMPLEMENTATION_TODO.md - 实施待办清单
4. docs/business/BUSINESS_REQUIREMENTS.md - 业务需求文档
5. docs/README.md - 文档导航索引

### 中优先级（应该尽快修复）

1. docs/guides/MANUS_INTEGRATION_GUIDE.md - Manus集成指南
2. docs/guides/MIGRATION_TO_NEW_COMPUTER.md - 迁移指南
3. docs/archive/ 下的所有文档 - 历史文档

### 低优先级（可以稍后修复）

1. 其他文档中的次要链接
2. 归档文档中的历史链接

---

## 💡 建议

1. **使用相对路径**：所有链接使用相对路径，便于移植
2. **定期检查**：每次移动文档后，检查并更新相关链接
3. **自动化测试**：考虑使用脚本自动检测死链接
4. **版本控制**：链接更新应该提交到版本控制系统

---

_文档版本: v1.0_  
_创建时间: 2026-01-01_  
_维护者: AI Assistant_
