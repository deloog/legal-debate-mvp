# AI开发规范速查表

> **目标读者**：AI助手  
> **阅读时间**：3分钟  
> **重要程度**：⭐⭐⭐⭐⭐ 必读

---

## 🚀 快速入口

| 资源               | 路径                                                                                                       | 说明                     |
| ------------------ | ---------------------------------------------------------------------------------------------------------- | ------------------------ |
| **规范快速查阅**   | [`CLINERULES_GUIDE.md`](CLINERULES_GUIDE.md)                                                               | 3分钟速查，核心规则摘要  |
| **AI开发核心规范** | [`.clinerules`](.clinerules)                                                                               | 最高规范，所有AI必须遵守 |
| **AI助手指南**     | [`docs/guides/development/ai-assistant-guide.md`](docs/guides/development/ai-assistant-guide.md)           | 5分钟快速上手            |
| **代码风格指南**   | [`docs/guides/CODE_STYLE.md`](docs/guides/CODE_STYLE.md)                                                   | 编写代码时参考           |
| **架构决策记录**   | [`docs/architecture/ARCHITECTURE_DECISION_RECORDS.md`](docs/architecture/ARCHITECTURE_DECISION_RECORDS.md) | 架构设计理由             |
| **任务进度追踪**   | [`docs/task-tracking/AI_TASK_TRACKING.md`](docs/task-tracking/AI_TASK_TRACKING.md)                         | 当前任务状态             |

---

## ⚠️ 核心规则（必须遵守）

### 1. 禁止创建重复文件 ⭐⭐⭐⭐⭐

```typescript
// ❌ 禁止
- debate-generator-enhanced.ts  // 增强版
- debate-generator-v2.ts        // 版本2
- new-debate-generator.ts       // 新建版
- debate-generator-backup.ts    // 备份版

// ✅ 正确
- 直接在原文件 debate-generator.ts 上修改
- 使用 Git 进行版本控制
```

### 2. 文件位置规则 ⭐⭐⭐⭐⭐

| 文件类型 | 必须放在         | 禁止放在               |
| -------- | ---------------- | ---------------------- |
| 测试文件 | `src/__tests__/` | `src/lib/`, `scripts/` |
| 文档文件 | `docs/`          | 根目录, `src/`         |
| 脚本文件 | `scripts/`       | `src/`, `docs/`        |

### 3. 行数限制 ⭐⭐⭐⭐

- 单个文件最多 **500行**
- 超过200行建议拆分
- 超出必须拆分为多个小文件

### 4. 类型安全 ⭐⭐⭐⭐

```typescript
// ❌ 禁止
const data: any = getData();

// ✅ 正确
const data: unknown = getData();
// 或具体类型
const data: DataType = getData();
```

- **生产代码禁止使用 `any` 类型**
- 测试文件允许但不推荐

### 5. 错误处理 ⭐⭐⭐⭐

```typescript
// ✅ 正确
async function fetchData() {
  try {
    const data = await api.getData();
    return data;
  } catch (error) {
    logger.error('Failed to fetch data', error);
    throw error;
  }
}

// ❌ 错误
async function fetchData() {
  const data = await api.getData(); // 没有错误处理
  return data;
}
```

- 异步操作必须有错误处理
- 错误必须记录到日志系统（使用 `logger` 而非 `console`）

### 6. 命名导出 ⭐⭐⭐

```typescript
// ❌ 避免
export default class DocAnalyzer {}

// ✅ 推荐
export class DocAnalyzer {}
```

---

## 📋 任务执行检查清单

在报告任务完成时，必须满足：

- [ ] **功能实现完整**：所有需求功能已实现
- [ ] **测试通过验证**：相关测试全部通过，测试覆盖率达标
- [ ] **代码符合规范**：符合 `.clinerules` 规范，无ESLint/TypeScript错误
- [ ] **无破坏性更改**：现有功能不受影响，向后兼容
- [ ] **文件真实存在**：所有创建的文件确实存在且可访问

**重要**：禁止虚构完成度，必须实事求是！

---

## 🧪 测试配置

### E2E测试默认配置

```bash
# 默认使用Mock AI服务（不产生API费用）
USE_REAL_AI=false

# 仅在需要验证真实API行为时启用
USE_REAL_AI=true
```

### 测试覆盖率目标

- 单元测试：> 80%
- 测试文件位置：`src/__tests__/`

---

## 📁 项目结构速查

```
legal-debate-mvp/
├── src/
│   ├── app/                  # Next.js 页面和API路由
│   │   ├── api/             # API路由 (src/app/api/)
│   │   └── */page.tsx      # 页面组件
│   ├── lib/                 # 核心业务逻辑
│   │   ├── agent/           # 6个核心Agent
│   │   ├── ai/              # AI服务
│   │   └── debate/          # 辩论系统
│   └── __tests__/           # 测试文件
├── docs/                     # 文档
├── scripts/                  # 脚本
└── prisma/                   # 数据库模型
```

---

## 🔧 常用命令

```bash
# 运行测试
npm test

# 生成覆盖率报告
npm run test:coverage

# 运行E2E测试
npx playwright test

# 代码检查
npm run lint
```

---

## 📖 了解更多

- [规范快速查阅](CLINERULES_GUIDE.md) - .clinerules快速定位指南
- [AI类型安全指南](docs/guides/development/ai-type-safety.md)
- [AI行为规则](docs/guides/development/ai-behavior-rules.md)
- [API开发指南](docs/guides/development/api-development.md)
- [测试指南](docs/guides/development/testing-guide.md)

## 📋 TypeScript Strict模式

项目提供 `tsconfig.strict.json` 配置用于启用严格的类型检查：

```bash
# 使用strict配置检查
npx tsc --noEmit --project tsconfig.strict.json

# 查看迁移计划
cat docs/plans/typescript-strict-migration.md
```

详细迁移计划请参考：[`docs/plans/typescript-strict-migration.md`](docs/plans/typescript-strict-migration.md)

---

_此文档是AI开发的快速参考，完整规范请查看 `.clinerules` 或 [`CLINERULES_GUIDE.md`](CLINERULES_GUIDE.md)_
