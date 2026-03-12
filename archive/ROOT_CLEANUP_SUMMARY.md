# 根目录规范清理总结

## 清理时间
2026-03-12

## 清理原则
按照现代项目文件管理规范，保持根目录整洁：
1. 配置文件保留在根目录
2. 临时报告移动到专用目录
3. 日志文件移动到 logs/
4. AI 助手配置文件保留

---

## 清理内容

### 1. 创建专用目录
```
logs/       - 日志文件
reports/    - 测试报告
```

### 2. 移动的测试报告（4 个文件）
| 文件 | 原位置 | 新位置 |
|------|--------|--------|
| e2e-test-results.txt | 根目录 | reports/ |
| e2e-test-results-fixed.txt | 根目录 | reports/ |
| test-fail.txt | 根目录 | reports/ |
| test-results.txt | 根目录 | reports/ |

### 3. 移动的日志文件（2 个文件）
| 文件 | 原位置 | 新位置 |
|------|--------|--------|
| output.log | 根目录 | logs/ |
| tsc-errors.log | 根目录 | logs/ |

### 4. 移动的报告文件（1 个文件）
| 文件 | 原位置 | 新位置 |
|------|--------|--------|
| ai-poc-validation-report.json | 根目录 | reports/ |

### 5. 归档的废弃配置（1 个文件）
| 文件 | 说明 |
|------|------|
| .eslintrc.performance.js | 旧 ESLint 配置，已使用 eslint.config.mjs |

### 6. 删除的空文件（2 个文件）
| 文件 | 说明 |
|------|------|
| legal_debate_laws.backup | 空文件（0 字节） |
| nul | Windows 保留设备名文件 |

---

## 保留的根目录文件

### AI 助手配置（6 个）
- CLAUDE.md
- .claudecoderules
- .clinerules
- .clineignore
- AI_GUIDE.md
- CLINERULES_GUIDE.md

### 项目配置（14 个）
- package.json, package-lock.json
- tsconfig.json, tsconfig.src.json, tsconfig.test.json
- tsconfig.strict.json, tsconfig.strict-pragmatic.json
- next.config.ts, next-env.d.ts
- eslint.config.mjs, eslint.config.quick.mjs
- commitlint.config.js

### Jest 配置（8 个）
- jest.config.js, jest.config.integration.js
- jest.global-setup.js, jest.global-setup.ts
- jest.global-teardown.js
- jest.polyfill.js
- jest.test-env.ts
- jest-setup.d.ts

### 其他配置（8 个）
- tailwind.config.js
- postcss.config.js
- playwright.config.ts
- Dockerfile, .dockerignore
- .gitignore, README.md
- PROJECT_STRUCTURE.md

### 环境文件（6 个）
- .env, .env.example
- .env.development, .env.test
- .env.production, .env.production.example

### 编译缓存（3 个，在 .gitignore 中）
- tsconfig.tsbuildinfo
- tsconfig.src.tsbuildinfo
- tsconfig.test.tsbuildinfo

---

## 清理效果

| 指标 | 清理前 | 清理后 | 变化 |
|------|--------|--------|------|
| 根目录文件数 | ~48 | ~46 | -2 |
| 测试报告 | 4 | 0 (移至 reports/) | 整洁 |
| 日志文件 | 2 | 0 (移至 logs/) | 整洁 |
| 空/废弃文件 | 2 | 0 | 删除 |

---

## 目录结构

```
legal_debate_mvp/
├── logs/                       # 日志文件
│   ├── output.log
│   └── tsc-errors.log
├── reports/                    # 测试报告
│   ├── ai-poc-validation-report.json
│   ├── e2e-test-results.txt
│   ├── e2e-test-results-fixed.txt
│   ├── test-fail.txt
│   └── test-results.txt
├── [根目录配置文件...]
└── PROJECT_STRUCTURE.md        # 项目结构文档
```

---

## 验证

清理后运行测试：
```bash
npx jest src/__tests__/lib/crawler/
# Test Suites: 6 passed, 6 total
# Tests:       122 passed, 122 total
```

✅ 所有测试通过，生产代码未受影响
