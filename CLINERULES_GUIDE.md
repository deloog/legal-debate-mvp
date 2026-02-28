# AI开发核心规范 - 快速查阅指南

> **目标读者**：AI助手  
> **阅读时间**：3分钟  
> **重要程度**：⭐⭐⭐⭐⭐ 必读

---

## 🚀 快速查阅本规范

### 3分钟速查
- **核心规则摘要**：阅读 [`AI_GUIDE.md`](AI_GUIDE.md)（根目录）
- **完整规范**：查看 [`.clinerules`](.clinerules) 文件
- **本文档**：提供快速定位和查阅指南

### 快速定位

| 想要... | 查看章节 |
|---------|----------|
| 创建新文件 | CRITICAL_RULES → no_duplicate_files |
| 文件放哪 | HIGH_PRIORITY_RULES → file_location_rules |
| 类型安全 | HIGH_PRIORITY_RULES → no_any_type |
| 错误处理 | STANDARD_RULES → error_handling_rules |
| 测试规范 | STANDARD_RULES → testing_rules |
| 性能优化 | performance_optimization |
| 任务完成验证 | completion_verification |

### 开发指南
- **详细指南**：[`docs/guides/development/`](docs/guides/development/)
- **代码模板**：[`docs/templates/`](docs/templates/)
- **AI协作规范**：[`docs/guides/development/ai-collaboration.md`](docs/guides/development/ai-collaboration.md)

---

## 📋 规则层级概览

### ⭐⭐⭐⭐⭐ CRITICAL_RULES（必须遵守）

违反这些规则将导致严重问题：

| 规则 | 说明 |
|------|------|
| no_duplicate_files | 禁止创建增强版、v2、new_等重复文件 |
| modify_original | 所有改进必须在原文件上进行 |
| no_false_reporting | 禁止虚构完成度，必须实事求是 |

**后果**：代码碎片化、测试不可信、项目混乱

---

### ⭐⭐⭐⭐ HIGH_PRIORITY_RULES（重要规则）

影响代码质量和维护性：

| 规则 | 说明 |
|------|------|
| max_lines_per_file | 单个文件最多500行 |
| file_location_rules | 测试/文档/脚本文件位置规则 |
| no_hardcoded_values | 禁止硬编码敏感配置 |
| no_any_type | 生产代码禁止使用any类型 |
| opportunistic_cleanup | 修改文件时顺带修复已存在问题 |

**后果**：代码可读性降低、维护困难、安全风险

---

### ⭐⭐⭐ STANDARD_RULES（标准规范）

遵循现代TypeScript最佳实践：

| 规则 | 说明 |
|------|------|
| code_style_requirements | 代码风格要求 |
| error_handling_rules | 错误处理规则 |
| testing_rules | 测试规范 |

**后果**：代码风格不一致、测试不完整、错误难以追踪

---

## 🎯 核心规则速查

### 1. 文件创建规则 ⭐⭐⭐⭐⭐

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

| 文件类型 | 必须放在 | 禁止放在 |
|----------|----------|----------|
| 测试文件 | `src/__tests__/` | `src/lib/`, `scripts/` |
| 文档文件 | `docs/` | 根目录, `src/` |
| 脚本文件 | `scripts/` | `src/`, `docs/` |

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

### 6. 代码风格 ⭐⭐⭐

```typescript
// ✅ 推荐
export class DocAnalyzer {}

// ❌ 避免
export default class DocAnalyzer {}
```

- 使用单引号而非双引号
- 使用2空格缩进
- 避免使用默认导出，优先使用命名导出（Next.js页面组件除外）
- 类型定义使用TypeScript interface

---

## ✅ 任务完成验证清单

在报告任务完成时，必须满足：

- [ ] **功能实现完整**：所有需求功能已实现
- [ ] **测试通过验证**：相关测试全部通过，测试覆盖率达标
- [ ] **代码符合规范**：符合 `.clinerules` 规范，无ESLint/TypeScript错误
- [ ] **无破坏性更改**：现有功能不受影响，向后兼容
- [ ] **文件真实存在**：所有创建的文件确实存在且可访问

**重要**：禁止虚构完成度，必须实事求是！

---

## 📖 深入学习

- [AI助手指南](docs/guides/development/ai-assistant-guide.md) - 5分钟快速上手
- [AI类型安全指南](docs/guides/development/ai-type-safety.md) - 类型安全详细说明
- [API开发指南](docs/guides/development/api-development.md) - API路由开发
- [测试指南](docs/guides/development/testing-guide.md) - 测试规范

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

# TypeScript类型检查
npx tsc --noEmit
```

---

_本文档是 `.clinerules` 的快速查阅指南，完整规范请查看 `.clinerules` 文件_
