# 代码风格规范

本文档定义了项目的代码风格要求，所有AI生成的代码必须遵循这些规范。

## 📋 核心要求

### 1. 代码格式化

#### 字符串和引号

- **使用单引号**：所有字符串字面量使用单引号 `'string'`
- **JSX属性**：同样使用单引号 `<div className='container'>`
- **例外**：JSON文件必须使用双引号

#### 缩进

- **使用2空格缩进**，不使用制表符
- **不使用4空格**

#### 行长度

- **每行最大80字符**，超出时合理换行

### 2. 导出规范

#### 避免默认导出

```typescript
// ❌ 不推荐
export default function UserService() {}

// ✅ 推荐
export function UserService() {}
export const userService = {};
```

#### 例外情况

- **Next.js页面组件**：`src/app/` 目录下的页面组件可以使用默认导出
- **React组件库**：某些特殊情况下可以使用默认导出

### 3. 命名约定

#### 变量和函数

```typescript
// ✅ 推荐：camelCase
const userName = "john";
const getUserInfo = () => {};
const apiClient = axios.create();

// ❌ 不推荐：snake_case
const user_name = "john";
const get_user_info = () => {};
```

#### 常量

```typescript
// ✅ 推荐：UPPER_SNAKE_CASE
const API_BASE_URL = "https://api.example.com";
const MAX_RETRY_COUNT = 3;

// ❌ 不推荐
const apiUrl = "https://api.example.com";
const maxRetryCount = 3;
```

#### 文件名

- **组件文件**：PascalCase (`UserProfile.tsx`)
- **工具函数**：camelCase (`apiClient.ts`)
- **常量文件**：camelCase (`config.ts`)

### 4. 函数和类

#### 使用命名函数

```typescript
// ✅ 推荐
export function calculateTotal(price: number, tax: number): number {
  return price + tax;
}

// ❌ 不推荐：匿名函数导出
export const calculateTotal = function (price: number, tax: number): number {
  return price + tax;
};
```

#### 类定义

```typescript
// ✅ 推荐
export class DatabaseService {
  private connection: Connection;

  constructor(connection: Connection) {
    this.connection = connection;
  }
}

// ❌ 不推荐：匿名类
export default class {
  // ...
}
```

### 5. 类型定义

#### 优先使用TypeScript类型

```typescript
// ✅ 推荐：TypeScript类型
interface User {
  id: string;
  name: string;
  email: string;
}

function createUser(userData: User): User {
  // 实现逻辑
}

// ❌ 不推荐：JSDoc注释
/**
 * @typedef {Object} User
 * @property {string} id
 * @property {string} name
 * @property {string} email
 */
```

### 6. 安全性

#### 避免硬编码敏感信息

```typescript
// ✅ 推荐：使用环境变量
const apiKey = process.env.API_KEY;
const dbPassword = process.env.DB_PASSWORD;

// ❌ 不推荐：硬编码
const apiKey = "hardcoded-api-key";
const dbPassword = "hardcoded-password";
```

#### URL和配置

```typescript
// ✅ 推荐：配置文件或环境变量
const API_BASE_URL = process.env.API_BASE_URL || "http://localhost:3000";

// ❌ 不推荐：硬编码生产URL
const API_BASE_URL = "https://production-api.example.com";
```

### 7. 文件组织

#### 文件长度限制

- **最大200行**：单个文件不超过200行
- **超长文件拆分**：超过200行的功能应拆分为多个模块

#### 目录结构

```
src/
├── app/           # Next.js页面（可使用默认导出）
├── lib/           # 工具库和业务逻辑
├── components/     # React组件
├── types/         # TypeScript类型定义
├── utils/         # 工具函数
└── __tests__/     # 测试文件
```

## 🔧 工具和配置

### 现有工具

- **Prettier**：自动代码格式化（配置位于 `config/.prettierrc`）
- **ESLint**：代码质量检查
- **Husky + lint-staged**：预提交钩子

### 自定义检查脚本

运行以下命令检查代码风格：

```bash
npm run code-style:check
```

修复代码风格问题：

```bash
npm run code-style:fix
```

## 📝 AI开发指南

### 生成代码时的检查清单

- [ ] 使用单引号而非双引号
- [ ] 使用2空格缩进
- [ ] 避免不必要的默认导出
- [ ] 使用命名函数而非匿名函数
- [ ] 遵循camelCase命名约定
- [ ] 检查文件长度是否超过200行
- [ ] 避免硬编码敏感信息
- [ ] 使用TypeScript类型定义

### 特殊情况处理

1. **Next.js页面**：可以使用默认导出，但仍需遵循其他规范
2. **配置文件**：JSON文件使用双引号，保持原有格式
3. **第三方库集成**：遵循库的推荐用法，同时保持项目一致性

## 🚀 最佳实践

1. **一致性优先**：保持代码风格的一致性比绝对正确更重要
2. **工具辅助**：充分利用Prettier等自动化工具
3. **渐进式改进**：对现有代码的改进要渐进式进行
4. **文档同步**：代码变更时同步更新相关文档

## 🔍 验证方法

### 自动化检查

```bash
# 检查代码风格
npm run code-style:check

# 修复代码风格
npm run code-style:fix

# 运行所有检查
npm run lint
npm run format:check
npm run type-check
```

### 手动检查要点

- 查看生成的代码是否使用单引号
- 确认缩进是否为2空格
- 检查是否有不必要的默认导出
- 验证命名约定是否一致
- 确认文件长度是否合理

---

**注意**：这些规范不仅适用于新代码，也适用于对现有代码的修改。如果发现现有代码不符合规范，应该在修改时一并修复。
