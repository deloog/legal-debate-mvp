# 🎯 功能专题文档

各功能模块的详细文档和实现说明。

## 功能模块

### 📄 文档分析器 (docanalyzer/)

智能文档分析系统，用于解析法律文档并提取关键信息。

**主要文档**:
- 重构计划
- 安全修复报告
- 准确率评估报告
- 架构修复报告
- Phase 3 最终报告

**功能**: 自动提取案件当事人、诉求、证据、时间线等信息

---

### 🔗 知识图谱 (knowledge-graph/)

法律知识图谱系统，管理法律条文、案例、判例之间的关联关系。

**主要文档**:
- [应用指南](knowledge-graph/application-guide.md) - 如何使用知识图谱
- [实现路线图](knowledge-graph/implementation-roadmap.md) - 实现计划
- [合同法关联](knowledge-graph/contract-law-usage.md) - 合同法条款关联
- [法律版本管理](knowledge-graph/law-version-management.md) - 版本管理策略

**功能**:
- 法律条文关联推荐
- 相似案例检索
- 法律版本管理
- 合同法条款智能关联

---

### ⚖️ 辩论系统 (debate/)

辩论观点推荐和生成系统。

**主要文档**:
- [推荐实现](debate/recommendation-implementation.md) - 辩论推荐系统实现

**功能**:
- 基于案情自动生成辩论观点
- 推荐相关法律依据
- 提供辩论策略建议

---

### 🔐 认证系统 (auth/)

用户认证和授权系统。

**主要文档**:
- (待补充)

**功能**:
- 用户登录注册
- 权限管理
- OAuth 集成

---

## 如何使用

1. **开发新功能**: 先阅读对应模块的文档
2. **了解架构**: 查看架构和实现文档
3. **API 集成**: 参考 API 文档和示例
4. **问题排查**: 查看报告中的已知问题和解决方案

---

**维护说明**: 每个功能模块应包含：
- README.md - 模块概述
- ARCHITECTURE.md - 架构设计
- API.md - API 文档
- CHANGELOG.md - 变更记录
