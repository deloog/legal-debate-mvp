# 项目文件结构规范

## 根目录文件清单

### AI 助手配置（保留）

| 文件                  | 说明                 |
| --------------------- | -------------------- |
| `CLAUDE.md`           | Claude AI 助手主配置 |
| `.claudecoderules`    | Claude 代码规则      |
| `.clinerules`         | Cline 插件规则       |
| `.clineignore`        | Cline 忽略配置       |
| `AI_GUIDE.md`         | AI 使用指南          |
| `CLINERULES_GUIDE.md` | Cline 规则指南       |

### 项目配置（保留）

| 文件                             | 说明              |
| -------------------------------- | ----------------- |
| `package.json`                   | npm 包配置        |
| `package-lock.json`              | npm 锁定文件      |
| `tsconfig.json`                  | TypeScript 主配置 |
| `tsconfig.src.json`              | 源码 TS 配置      |
| `tsconfig.test.json`             | 测试 TS 配置      |
| `tsconfig.strict.json`           | 严格模式配置      |
| `tsconfig.strict-pragmatic.json` | 实用严格配置      |
| `next.config.ts`                 | Next.js 配置      |
| `next-env.d.ts`                  | Next.js 类型声明  |

### 代码质量工具（保留）

| 文件                         | 说明                |
| ---------------------------- | ------------------- |
| `eslint.config.mjs`          | ESLint 主配置       |
| `eslint.config.quick.mjs`    | ESLint 快速检查配置 |
| `commitlint.config.js`       | Commit 信息规范     |
| `jest.config.js`             | Jest 主配置         |
| `jest.config.integration.js` | Jest 集成测试配置   |
| `jest.global-setup.js/.ts`   | 测试全局设置        |
| `jest.global-teardown.js`    | 测试全局清理        |
| `jest.polyfill.js`           | 测试 Polyfill       |
| `jest.test-env.ts`           | 测试环境配置        |
| `jest-setup.d.ts`            | Jest 类型定义       |

### 样式与构建（保留）

| 文件                   | 说明                |
| ---------------------- | ------------------- |
| `tailwind.config.js`   | Tailwind CSS 配置   |
| `postcss.config.js`    | PostCSS 配置        |
| `playwright.config.ts` | Playwright E2E 配置 |

### 部署与容器（保留）

| 文件            | 说明            |
| --------------- | --------------- |
| `Dockerfile`    | Docker 构建文件 |
| `.dockerignore` | Docker 忽略配置 |

### 环境变量（保留）

| 文件                      | 说明                     |
| ------------------------- | ------------------------ |
| `.env`                    | 环境变量（不提交到 git） |
| `.env.example`            | 环境变量示例             |
| `.env.development`        | 开发环境配置             |
| `.env.test`               | 测试环境配置             |
| `.env.production`         | 生产环境配置             |
| `.env.production.example` | 生产环境示例             |

### Git（保留）

| 文件         | 说明         |
| ------------ | ------------ |
| `.gitignore` | Git 忽略配置 |
| `README.md`  | 项目说明文档 |

### 编译缓存（.gitignore 中，可保留或删除）

| 文件                        | 说明                |
| --------------------------- | ------------------- |
| `tsconfig.tsbuildinfo`      | TypeScript 编译缓存 |
| `tsconfig.src.tsbuildinfo`  | 源码编译缓存        |
| `tsconfig.test.tsbuildinfo` | 测试编译缓存        |

---

## 目录结构

```
legal_debate_mvp/
├── .github/                    # GitHub 配置
│   └── workflows/              # CI/CD 工作流
├── .vscode/                    # VSCode 配置
├── archive/                    # 归档文件（清理的文件）
│   ├── crawler-debug-scripts/
│   ├── eslint-reports/
│   ├── multi-version-backup/
│   └── typescript-error-reports/
├── config/                     # 配置文件
├── data/                       # 数据目录
│   ├── crawled/                # 爬虫采集数据
│   ├── dev.db                  # 开发数据库
│   └── dev.db-journal
├── docker/                     # Docker 相关
├── docs/                       # 文档
├── logs/                       # 日志文件（新创建）
│   ├── output.log
│   └── tsc-errors.log
├── prisma/                     # Prisma 数据库
├── public/                     # 静态资源
├── reports/                    # 测试报告（新创建）
│   ├── e2e-test-results.txt
│   ├── e2e-test-results-fixed.txt
│   ├── test-fail.txt
│   └── test-results.txt
├── scripts/                    # 脚本工具
├── src/                        # 源代码
│   ├── app/                    # Next.js App Router
│   ├── components/             # React 组件
│   ├── hooks/                  # React Hooks
│   ├── lib/                    # 工具库
│   ├── services/               # 业务服务
│   ├── styles/                 # 样式文件
│   ├── test-utils/             # 测试工具
│   ├── types/                  # 类型定义
│   └── utils/                  # 工具函数
└── [根目录配置文件...]
```

---

## 清理规范

### 应该归档的文件类型

1. **测试报告** → `reports/`
2. **日志文件** → `logs/`
3. **调试脚本** → `archive/`
4. **重复版本** → `archive/multi-version-backup/`
5. **ESLint/TS 临时报告** → `archive/eslint-reports/`, `archive/typescript-error-reports/`

### 必须保留在根目录的文件

1. **配置文件**: package.json, tsconfig.json, next.config.ts 等
2. **AI 配置**: CLAUDE.md, .clinerules, .claudecoderules 等
3. **环境文件**: .env, .env.example, .env.\*
4. **CI/CD**: .github/workflows/
5. **Git**: .gitignore, README.md

---

## 更新记录

### 2026-03-12 清理

- 创建 `logs/` 和 `reports/` 目录
- 移动测试报告到 `reports/`
- 移动日志文件到 `logs/`
- 归档 ESLint 和 TypeScript 临时报告
- 归档重复脚本文件
- 删除空文件
