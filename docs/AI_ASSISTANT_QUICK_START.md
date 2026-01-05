# AI助手快速上手指南

> **目标读者**：AI助手、开发人员、项目经理  
> **阅读时间**：5-10分钟  
> **最后更新**：2026-01-04

---

## 🎯 5分钟快速了解项目

### 第1步：了解项目基本信息（1分钟）

**必读文档**：

1. `/README.md` - 项目概述、技术栈、核心功能
2. `docs/business/BUSINESS_REQUIREMENTS.md` - 业务需求和目标

**关键信息**：

- **项目类型**：基于AI大模型的法律诉讼智能分析系统
- **核心功能**：文档解析、法条检索、辩论生成、多轮辩论
- **技术栈**：Next.js 15 + Prisma + PostgreSQL + DeepSeek/智谱
- **准确率目标**：88分 → 95分+（当前93.4分）

### 第2步：了解当前进度（2分钟）

**必读文档**：
`docs/task-tracking/AI_TASK_TRACKING.md` - 任务进度追踪

**如何快速查看**：

1. 滚动到文件顶部，查看"总体进度"部分
2. 查看"Sprint 6"章节（当前活跃Sprint）
3. 查看"进行中"或未完成任务的状态标记

**当前状态速览**（2026-01-04）：

- **Sprint 6**：Manus架构增强（16/17任务完成，94.1%）
- **总体进度**：36/37任务完成（97.2%）
- **下一步**：完成准确性验证，优化论点逻辑性，修复E2E测试

### 第3步：了解技术架构（2分钟）

**必读文档**：

1. `docs/task-tracking/MANUS_INTEGRATION_GUIDE.md` - Manus架构理念
2. `docs/task-tracking/AGENT_ARCHITECTURE_V2.md` - 6个核心Agent设计

**核心概念**：

- **6个核心Agent**：PlanningAgent、AnalysisAgent、LegalAgent、GenerationAgent、VerificationAgent、MemoryAgent
- **PEV三层架构**：Planning（规划层）→ Execution（执行层）→ Verification（验证层）
- **三层记忆管理**：Working Memory（1小时TTL）→ Hot Memory（7天TTL）→ Cold Memory（永久）
- **三重验证机制**：事实准确性 + 逻辑一致性 + 任务完成度

---

## 🔧 常见任务操作流程

### 任务A：修复Bug

**场景**：发现系统中的Bug需要修复

**操作流程**：

1. **检查历史问题**

   ```bash
   # 查看 docs/archive/problems-and-solutions.md
   # 搜索类似问题或错误信息
   ```

2. **检查测试报告**

   ```bash
   # 查看 docs/testing/ 目录
   # 查找相关测试失败报告
   ```

3. **定位问题代码**

   ```bash
   # 根据错误信息定位到对应模块
   # 常见模块：
   #   - src/lib/agent/          # Agent相关
   #   - src/lib/ai/            # AI服务相关
   #   - src/lib/debate/         # 辩论系统
   #   - src/app/api/v1/        # API路由
   ```

4. **修复并测试**

   ```bash
   # 修复代码
   npm test                    # 运行单元测试
   npm run test:coverage      # 查看覆盖率
   ```

5. **更新任务追踪**
   - 在 `docs/task-tracking/AI_TASK_TRACKING.md` 中记录修复过程

**时间预估**：30分钟 - 2小时（取决于Bug复杂度）

---

### 任务B：添加新功能

**场景**：根据需求添加新功能

**操作流程**：

1. **记录任务**
   - 在 `docs/task-tracking/AI_TASK_TRACKING.md` 中添加新任务
   - 使用标准格式：
     ```markdown
     [ ] 任务描述 🕐 开始时间 (进行中)
     ```

2. **参考架构设计**
   - 查看 `docs/architecture/` 相关架构文档
   - 查看 `docs/task-tracking/AGENT_ARCHITECTURE_V2.md` 了解Agent设计

3. **遵循代码规范**
   - **必须阅读**：`docs/guides/CODE_STYLE.md`
   - **必须遵守**：`.clinerules` 中的规则
   - **重要规则**：
     - ✅ 所有改进在原文件上进行（禁止创建增强版、v2等）
     - ✅ 单个文件最多500行
     - ✅ 使用命名导出，避免默认导出
     - ✅ 生产代码禁止使用`any`类型

4. **编写代码**
   - 按照架构设计实现功能
   - 编写对应的单元测试（放到 `src/__tests__/`）
   - 确保测试覆盖率 > 80%

5. **运行测试**

   ```bash
   npm test                    # 运行所有测试
   npm run test:coverage      # 查看覆盖率
   ```

6. **更新任务状态**
   ```markdown
   [x] 任务描述 ✅ 完成时间 (AI完成)
   ```

**时间预估**：1-3天（取决于功能复杂度）

---

### 任务C：优化性能

**场景**：系统响应慢，需要优化

**操作流程**：

1. **检查优化历史**

   ```bash
   # 查看 docs/optimization/ 目录
   # 常见优化报告：
   #   - BACKEND_PERFORMANCE_OPTIMIZATION_REPORT.md
   #   - FRONTEND_PERFORMANCE_OPTIMIZATION_REPORT.md
   #   - DEEPSEEK_OPTIMIZATION_REPORT.md
   ```

2. **性能测试**

   ```bash
   # 运行性能测试脚本
   npm run test:performance
   # 或使用
   node scripts/test-api-performance.ts
   ```

3. **定位性能瓶颈**
   - 使用测试报告找出慢API或函数
   - 查看日志中的执行时间
   - 分析数据库查询（如果数据库相关）

4. **实施优化**
   - **数据库优化**：添加索引、优化查询、使用缓存
   - **API优化**：减少AI调用、实现缓存、优化算法
   - **前端优化**：懒加载、代码分割、优化渲染

5. **验证优化效果**

   ```bash
   npm run test:performance
   # 对比优化前后的性能指标
   ```

6. **记录优化报告**
   - 在 `docs/optimization/` 创建优化报告
   - 记录优化前后对比

**时间预估**：2-4小时

---

### 任务D：运行测试

**场景**：验证代码质量和功能完整性

**单元测试（Jest）**

```bash
# 运行所有测试
npm test

# 运行单个测试文件
npm test -- path/to/test.test.ts

# 生成覆盖率报告
npm run test:coverage

# 查看覆盖率HTML报告
open coverage/lcov-report/index.html
```

**E2E测试（Playwright）**

```bash
# 运行所有E2E测试
npx playwright test

# 运行单个测试文件
npx playwright test path/to/test.spec.ts

# 运行测试并生成报告
npx playwright test --reporter=html
```

**测试覆盖率目标**：

- 单元测试：> 80%
- 集成测试：关键路径 100%
- E2E测试：核心流程 > 90%

---

### 任务E：部署到生产环境

**场景**：将代码部署到生产环境

**操作流程**：

1. **检查部署指南**

   ```bash
   # 阅读 docs/guides/MIGRATION_GUIDE.md
   # 阅读 docs/guides/MIGRATION_TO_NEW_COMPUTER.md
   ```

2. **环境配置**

   ```bash
   # 确保 .env.production 配置正确
   # 检查数据库连接字符串
   # 检查API密钥
   ```

3. **数据库迁移**

   ```bash
   # 生成Prisma客户端
   npx prisma generate

   # 应用生产环境迁移
   npx prisma migrate deploy
   ```

4. **构建项目**

   ```bash
   # 构建Next.js项目
   npm run build
   ```

5. **部署**

   ```bash
   # 如果使用Vercel
   vercel --prod

   # 如果使用Docker
   docker build -t legal-debate .
   docker run -p 3000:3000 legal-debate
   ```

6. **验证部署**
   ```bash
   # 访问生产环境URL
   # 运行E2E测试验证功能
   npx playwright test
   ```

**时间预估**：1-2小时

---

## 📋 关键文档索引

### 必读文档（优先级：高）

这些文档**必须**在开始任何任务前阅读：

| 文档路径                                        | 说明             | 使用场景               |
| ----------------------------------------------- | ---------------- | ---------------------- |
| `docs/task-tracking/AI_TASK_TRACKING.md`        | 任务进度追踪     | 了解当前进度、记录任务 |
| `docs/task-tracking/MANUS_INTEGRATION_GUIDE.md` | Manus架构理念    | 了解核心技术架构       |
| `.clinerules`                                   | AI开发规范       | 遵守开发规则           |
| `docs/task-tracking/AGENT_ARCHITECTURE_V2.md`   | 6个核心Agent设计 | 了解Agent接口和职责    |

### 参考文档（优先级：中）

| 文档路径                                          | 说明           | 使用场景       |
| ------------------------------------------------- | -------------- | -------------- |
| `docs/README.md`                                  | 文档导航索引   | 查找特定文档   |
| `docs/guides/CODE_STYLE.md`                       | 代码风格指南   | 编写代码时参考 |
| `docs/architecture/database/DATABASE_MODEL_V2.md` | 数据库模型设计 | 数据库相关开发 |
| `docs/business/BUSINESS_REQUIREMENTS.md`          | 业务需求文档   | 理解业务需求   |

### 存档文档（优先级：低）

| 文档路径                                 | 说明           | 使用场景     |
| ---------------------------------------- | -------------- | ------------ |
| `docs/archive/sprint0-completed.md`      | Sprint 0归档   | 历史任务参考 |
| `docs/archive/sprint1-completed.md`      | Sprint 1归档   | 历史任务参考 |
| `docs/archive/problems-and-solutions.md` | 问题和解决方案 | 遇到问题参考 |

---

## ⚠️ AI开发约束（重要！）

从 `.clinerules` 文件中提取的关键规则，**必须严格遵守**：

### 1. 禁止创建重复文件

❌ **禁止**：

- `enhanced-debate-generator.ts`（增强版）
- `debate-generator-v2.ts`（版本2）
- `new-debate-generator.ts`（新建版）
- `debate-generator-new.ts`（新建版）
- `debate-generator-backup.ts`（备份版）

✅ **正确做法**：

- 直接在 `debate-generator.ts` 上进行修改
- 使用Git进行版本控制

**原因**：避免代码碎片化，保持项目整洁

---

### 2. 文件位置规则

| 文件类型 | 必须放在         | 禁止放在               |
| -------- | ---------------- | ---------------------- |
| 测试文件 | `src/__tests__/` | `src/lib/`、`scripts/` |
| 文档文件 | `docs/`          | 项目根目录、`src/`     |
| 脚本文件 | `scripts/`       | `src/`、`docs/`        |

---

### 3. 代码质量规则

#### 行数限制

- **单个文件最多500行**
- 如果超出，必须拆分为多个小文件

#### 类型安全

- **生产代码禁止使用`any`类型**
- 测试文件允许使用`any`（但不推荐）
- 使用TypeScript interface定义类型

#### 命名规范

- **避免使用默认导出**，优先使用命名导出

  ```typescript
  // ❌ 错误
  export default class DocAnalyzer {}

  // ✅ 正确
  export class DocAnalyzer {}
  ```

#### 硬编码限制

- **禁止硬编码敏感配置和路径**

  ```typescript
  // ❌ 错误
  const dbUrl = "postgresql://user:password@localhost:5432/db";

  // ✅ 正确
  const dbUrl = process.env.DATABASE_URL;
  ```

---

### 4. 错误处理规则

- **异步操作必须有错误处理**

  ```typescript
  // ✅ 正确
  async function fetchData() {
    try {
      const data = await api.getData();
      return data;
    } catch (error) {
      logger.error("Failed to fetch data", error);
      throw error;
    }
  }

  // ❌ 错误
  async function fetchData() {
    const data = await api.getData();
    return data; // 没有错误处理
  }
  ```

- **错误必须记录到日志系统**

---

### 5. 完成度验证标准

在报告任务完成时，必须满足以下条件：

- [ ] **功能实现完整**：所有需求功能已实现
- [ ] **测试通过验证**：相关测试全部通过
- [ ] **代码符合规范**：符合`.clinerules`规范
- [ ] **无破坏性更改**：现有功能不受影响
- [ ] **文件真实存在**：所有创建的文件确实存在

**重要**：禁止虚构完成度，必须实事求是！

---

## 🎯 当前项目状态速览

### 总体进度

| Sprint   | 任务数 | 已完成 | 进度      | 状态      |
| -------- | ------ | ------ | --------- | --------- |
| Sprint 0 | 5      | 5      | 100%      | ✅ 已归档 |
| Sprint 1 | 1      | 1      | 100%      | ✅ 已归档 |
| Sprint 2 | 3      | 3      | 100%      | ✅ 已完成 |
| Sprint 3 | 8      | 8      | 100%      | ✅ 已完成 |
| Sprint 4 | 4      | 4      | 100%      | ✅ 已完成 |
| Sprint 5 | 6      | 6      | 100%      | ✅ 已完成 |
| Sprint 6 | 17     | 16     | 94.1%     | 🔄 进行中 |
| **总计** | **44** | **43** | **97.7%** |           |

### 关键指标

| 指标           | 当前值 | 目标值  | 状态      |
| -------------- | ------ | ------- | --------- |
| 文档解析准确率 | 93.4分 | 95分+   | ⚠️ 接近   |
| API测试通过率  | 99.6%  | >95%    | ✅ 达标   |
| E2E测试通过率  | 44.4%  | >90%    | ❌ 未达标 |
| AI成本降低     | 基准   | -40~60% | 🔄 进行中 |
| 错误恢复率     | 90%    | >90%    | ✅ 达标   |

### 下一步重点

1. **提升文档解析准确率**：93.4分 → 95分+
2. **修复E2E测试**：44.4% → 90%+
3. **优化论点逻辑性**：88% → 90%+
4. **性能优化**：API响应时间 < 2秒，缓存命中率 > 60%

---

## 📞 遇到问题怎么办？

### 问题1：找不到文档

**解决方法**：

1. 查看 `docs/README.md` 文档导航索引
2. 使用IDE的搜索功能（Ctrl+Shift+F）
3. 查看 `docs/task-tracking/TASK_ARCHIVE_INDEX.md` 归档索引

---

### 问题2：不理解架构设计

**解决方法**：

1. 阅读 `docs/task-tracking/MANUS_INTEGRATION_GUIDE.md`（Manus理念）
2. 阅读 `docs/task-tracking/AGENT_ARCHITECTURE_V2.md`（6个Agent设计）
3. 查看 `docs/architecture/` 目录下的架构文档

---

### 问题3：代码规范疑问

**解决方法**：

1. 查看 `.clinerules`（AI开发规范）
2. 查看 `docs/guides/CODE_STYLE.md`（代码风格指南）
3. 查看现有代码示例（如 `src/lib/agent/`）

---

### 问题4：测试失败

**解决方法**：

1. 查看测试报告 `docs/testing/` 目录
2. 检查测试Mock配置是否正确
3. 查看日志文件 `test-results/`
4. 参考 `docs/archive/problems-and-solutions.md` 中的类似问题

---

### 问题5：历史问题参考

**解决方法**：

1. 查看 `docs/archive/problems-and-solutions.md`
2. 搜索错误信息或关键词
3. 参考已验证的解决方案

---

## 📚 学习路径建议

### 新手AI助手（第一天）

1. 阅读 `/README.md`（10分钟）
2. 阅读 `docs/business/BUSINESS_REQUIREMENTS.md`（10分钟）
3. 阅读 `docs/task-tracking/AI_TASK_TRACKING.md`（15分钟）
4. 阅读 `.clinerules`（10分钟）
5. **总计**：45分钟

### 进阶AI助手（第一周）

1. 阅读 `docs/task-tracking/MANUS_INTEGRATION_GUIDE.md`（30分钟）
2. 阅读 `docs/task-tracking/AGENT_ARCHITECTURE_V2.md`（30分钟）
3. 阅读 `docs/guides/CODE_STYLE.md`（20分钟）
4. 查看 `src/lib/agent/` 实现代码（2小时）
5. **总计**：3.5小时

### 高级AI助手（持续）

1. 定期查看 `docs/task-tracking/AI_TASK_TRACKING.md`（每周）
2. 定期查看 `docs/optimization/` 优化报告（每周）
3. 定期查看 `docs/testing/` 测试报告（每周）
4. 参与代码审查和架构讨论（持续）

---

## 🔍 快速搜索技巧

### 按类型搜索

```bash
# 搜索测试文件
find src/__tests__ -name "*.test.ts"

# 搜索Agent文件
find src/lib/agent -name "*.ts"

# 搜索API路由
find src/app/api -name "route.ts"
```

### 按内容搜索

```bash
# 在所有文档中搜索关键词
grep -r "Manus架构" docs/

# 在代码中搜索函数
grep -r "function generateArgument" src/lib/
```

### 使用IDE搜索

- **VS Code**：`Ctrl+Shift+F`（全局搜索）
- **WebStorm**：`Ctrl+Shift+F`（全局搜索）
- **搜索范围**：选择特定目录（如`docs/`、`src/lib/`）

---

## 📝 文档更新频率

| 文档                                     | 更新频率       | 责任方     |
| ---------------------------------------- | -------------- | ---------- |
| `docs/task-tracking/AI_TASK_TRACKING.md` | 每次任务完成后 | AI助手     |
| `docs/README.md`                         | 每月或重大变更 | 项目负责人 |
| `docs/architecture/`                     | 架构变更时     | 架构师     |
| `.clinerules`                            | 规范变更时     | 项目负责人 |

---

## ✅ 检查清单

在开始任何开发任务前，确认以下事项：

- [ ] 已阅读 `/README.md` 了解项目
- [ ] 已阅读 `docs/task-tracking/AI_TASK_TRACKING.md` 了解当前进度
- [ ] 已阅读 `.clinerules` 了解开发规范
- [ ] 已了解相关架构设计文档
- [ ] 已配置好开发环境（数据库、API密钥等）
- [ ] 已拉取最新代码

---

## 🎉 欢迎加入律伴助手项目！

如果您在快速上手过程中遇到任何问题，请：

1. 查看 `docs/README.md` 完整文档导航
2. 查看 `docs/archive/problems-and-solutions.md` 历史问题
3. 在 `docs/task-tracking/AI_TASK_TRACKING.md` 中记录问题

祝您开发顺利！ 🚀

---

_文档版本: v1.0_  
_创建时间: 2026-01-04_  
_维护者: 开发团队_
