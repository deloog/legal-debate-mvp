# 项目文件规范整理计划

> 创建日期: 2026-02-12
> 状态: 待审批
> 目的: 规范化项目文件结构，提高可维护性

## 📋 目录

1. [当前问题分析](#当前问题分析)
2. [整理原则](#整理原则)
3. [必须在根目录的文件](#必须在根目录的文件)
4. [文件整理计划](#文件整理计划)
5. [风险评估](#风险评估)
6. [执行步骤](#执行步骤)

---

## 当前问题分析

### 1. 根目录文件过多 (严重)
- **测试输出文件**: 98个 `.txt` 和 `.log` 文件
- **覆盖率目录**: 12个 `coverage-*` 目录
- **临时文件**: 多个临时调试文件

这些文件虽然在 `.gitignore` 中配置了忽略，但仍存在于工作目录中，影响项目整洁度。

### 2. 配置文件重复和位置不当 (中等)

#### 重复的配置文件:
| 文件 | 根目录 | config/ 目录 | 问题 |
|------|--------|-------------|------|
| `commitlint.config.js` | ✓ | ✓ | 重复存在 |
| `eslint.config.mjs` | ✓ | ✓ | 重复存在 |
| `postcss.config.*` | `.js` | `.mjs` | 格式不一致 |

#### 位置不当的配置文件:
| 文件 | 当前位置 | 应在位置 | 原因 |
|------|----------|----------|------|
| `next.config.ts` | `config/` | 根目录 | Next.js 要求在根目录 |
| `playwright.config.ts` | `config/` | 根目录 | Playwright 默认查找根目录 |
| `tsconfig.json` | `config/` | 根目录 | TypeScript 要求在根目录 |

### 3. 不规范的目录结构 (轻微)
- `%APPDATA%/` - Windows 环境变量目录，不应在项目中
- `just-laws/` - 数据文件，应移到 `data/` 目录
- `dist/` - 构建产物目录（应在 .gitignore 中）

### 4. 文档分散 (轻微)
- 根目录有多个报告文档（`CODE_QUALITY_*.md`）
- 应该全部移到 `docs/` 目录

---

## 整理原则

### 1. 配置文件优先级原则
遵循工具官方文档的约定，确保配置文件在正确的位置。

### 2. 单一真实来源原则 (Single Source of Truth)
- 同一配置不应重复存在
- 如需在多处使用，应通过引用方式

### 3. 分类存储原则
- 源代码 → `src/`
- 配置文件 → 根目录或 `config/`（视工具要求）
- 文档 → `docs/`
- 脚本 → `scripts/`
- 数据 → `data/`
- 测试输出 → `test-output/`（临时）

### 4. 安全原则
- 不删除可能影响远程仓库的文件
- 对于不确定的文件，先移动到归档目录
- 保留所有源代码和配置

---

## 必须在根目录的文件

根据工具和框架的约定，以下文件**必须**保留在根目录：

### 1. 项目配置文件 (必须)
```
package.json              # npm/yarn 包管理
package-lock.json         # 依赖锁定文件
tsconfig.json             # TypeScript 主配置
next.config.ts            # Next.js 配置
```

### 2. 代码规范配置 (必须)
```
eslint.config.mjs         # ESLint 配置
.eslintrc.performance.js  # 性能检查配置
prettier.config.js        # Prettier 配置（或使用 package.json）
commitlint.config.js      # Git 提交规范
```

### 3. 样式配置 (必须)
```
tailwind.config.js        # Tailwind CSS 配置
postcss.config.js         # PostCSS 配置
```

### 4. 测试配置 (推荐在根目录)
```
jest.config.js            # Jest 主配置
jest.config.integration.js
jest.global-setup.js
jest.global-teardown.js
playwright.config.ts      # Playwright E2E 测试
```

### 5. Git 和 CI/CD (必须)
```
.gitignore                # Git 忽略规则
.dockerignore             # Docker 忽略规则
Dockerfile                # Docker 配置
```

### 6. IDE 和工具配置 (必须)
```
.claudecoderules          # Claude Code 规则
.clinerules               # Cline 规则
.clineignore              # Cline 忽略规则
.husky/                   # Git hooks
```

### 7. 环境变量 (必须)
```
.env                      # 本地环境变量（不提交）
.env.production           # 生产环境变量（不提交）
```

### 8. 文档 (推荐)
```
README.md                 # 项目说明
```

---

## 文件整理计划

### 阶段 1: 清理临时和测试输出文件 ⚠️ 安全级别: 高

#### 1.1 创建测试输出归档目录
```bash
mkdir -p test-output/archive
mkdir -p test-output/coverage-archive
```

#### 1.2 移动测试输出文件 (98个文件)
将以下模式的文件移动到 `test-output/archive/`:
- `*-test*.txt`
- `*-output*.txt`
- `*-report.txt`
- `*-coverage*.txt`
- `admin-*.txt`
- `day*-*.txt`
- `dev-*.log`
- `evidence-*.txt`
- `export-*.txt`
- `final-*.txt`
- `lib-*.txt`
- `order-*.txt`
- `payment-*.txt`
- `reports-*.txt`
- `risk-*.txt`
- `stats-*.txt`
- `team-*.txt`
- `type-errors*.txt`
- `type-errors*.log`

**排除**: 不移动以下文件
- `package.json`
- `package-lock.json`
- `tsconfig*.json`

#### 1.3 移动覆盖率目录 (12个目录)
将以下目录移动到 `test-output/coverage-archive/`:
```
coverage-api/
coverage-e2e-diagnosis/
coverage-integration/
coverage-memory/
coverage-memory-final/
coverage-migrator/
coverage-app/
coverage-components/
coverage-communications/
coverage-final/
... (所有 coverage-* 目录)
```

#### 1.4 移动调试和临时文件
```
build-output.log → test-output/archive/
output.txt → test-output/archive/
nul → 删除
temp_append.txt → test-output/archive/
temp-fix.txt → test-output/archive/
esl → test-output/archive/
validate-result.json → test-output/archive/
```

### 阶段 2: 整理配置文件 ⚠️ 安全级别: 中

#### 2.1 移动 Next.js 配置到根目录 (关键)
```bash
# 备份现有配置
cp config/next.config.ts config/next.config.ts.backup

# 移动到根目录
mv config/next.config.ts ./next.config.ts

# 验证: 运行 npm run build 检查是否正常
```

#### 2.2 移动 Playwright 配置到根目录
```bash
# 备份
cp config/playwright.config.ts config/playwright.config.ts.backup

# 移动
mv config/playwright.config.ts ./playwright.config.ts

# 更新 package.json 中的测试命令（如果需要）
```

#### 2.3 移动 TypeScript 配置到根目录
```bash
# 检查是否有根目录 tsconfig.json
# 如果有，需要合并配置
# 如果没有，直接移动

# 备份
cp config/tsconfig.json config/tsconfig.json.backup

# 检查根目录是否已有 tsconfig.json
# 如果已有，需要手动合并配置
```

#### 2.4 删除重复的配置文件
```bash
# 保留根目录版本，删除 config/ 目录中的重复文件

# 1. commitlint.config.js
rm config/commitlint.config.js

# 2. eslint.config.mjs
rm config/eslint.config.mjs

# 3. postcss 统一使用 .js 版本
# 保留根目录的 postcss.config.js
rm config/postcss.config.mjs
```

#### 2.5 统一 Prettier 配置位置
```bash
# 检查 config/.prettierrc 内容
# 将配置合并到 package.json 或根目录 .prettierrc
# 删除 config/.prettierrc
```

### 阶段 3: 整理目录结构 ⚠️ 安全级别: 中

#### 3.1 删除不规范的目录
```bash
# 删除 %APPDATA% 目录（不应在项目中）
rm -rf "%APPDATA%"

# 确保 dist/ 在 .gitignore 中
# 可以删除 dist/ 目录（会在构建时重新生成）
```

#### 3.2 整理数据目录
```bash
# 移动 just-laws 到 data 目录
mv just-laws data/just-laws
# just-laws.zip 可以删除或移到 data/
mv just-laws.zip data/just-laws.zip
```

#### 3.3 整理文档
将根目录的报告文档移动到 `docs/`:
```bash
mv CODE_QUALITY_FIX_FINAL_REPORT.md docs/
mv CODE_QUALITY_FIX_REPORT.md docs/
mv CODE_QUALITY_FIX_REPORT_PHASE2.md docs/
mv CODE_QUALITY_ISSUES.md docs/
```

#### 3.4 整理测试脚本
检查以下文件是否为临时调试文件:
```bash
test-generate-api-debug.ts
test-generate-endpoint.ts
```
如果是临时文件，移动到 `test-output/archive/`

### 阶段 4: 更新 .gitignore ⚠️ 安全级别: 低

#### 4.1 添加新的忽略规则
在 `.gitignore` 中添加:
```gitignore
# Test output archive
/test-output/

# Build artifacts
/dist/
*.tsbuildinfo

# System files
%APPDATA%/
nul
.nul
```

#### 4.2 确保现有忽略规则覆盖所有临时文件

### 阶段 5: 优化 config/ 目录结构 ⚠️ 安全级别: 低

保留在 `config/` 目录中的文件（这些文件适合集中管理）:
```
config/
├── .pgpass                           # PostgreSQL 密码文件
├── docker-compose.yml                # Docker 编排配置
├── docker-compose.prod.yml           # 生产环境 Docker 配置
├── load-env.ts                       # 环境变量加载
├── load-env.prod.ts                  # 生产环境变量加载
├── logger.config.ts                  # 日志配置
├── redis.config.ts                   # Redis 配置
├── winston.config.ts                 # Winston 日志配置
├── alertmanager/                     # 告警管理配置
├── filebeat/                         # 日志收集配置
├── grafana/                          # 监控面板配置
├── logstash/                         # 日志处理配置
└── test-results/                     # 测试结果（临时）
```

---

## 风险评估

### 高风险操作 🔴
1. **移动 next.config.ts** - Next.js 必须在根目录找到此文件
   - 风险: 构建失败
   - 缓解: 移动后立即测试 `npm run build`

2. **删除配置文件** - 可能影响工具运行
   - 风险: 工具无法找到配置
   - 缓解: 先备份，逐个测试

### 中风险操作 🟡
1. **移动测试配置文件**
   - 风险: 测试运行失败
   - 缓解: 更新 package.json 中的测试脚本路径

2. **合并 TypeScript 配置**
   - 风险: 类型检查错误
   - 缓解: 运行 `npm run type-check` 验证

### 低风险操作 🟢
1. **移动测试输出文件** - 这些是生成的文件
2. **移动文档文件** - 不影响功能
3. **更新 .gitignore** - 只影响版本控制

---

## 执行步骤

### 准备工作

#### 1. 创建备份
```bash
# 创建完整项目备份（建议）
# 或者确保 git status 干净，可以随时回滚

git status
# 如果有未提交的更改，先提交或储藏
```

#### 2. 创建必要的目录
```bash
mkdir -p test-output/archive
mkdir -p test-output/coverage-archive
mkdir -p data
```

### 执行顺序（按优先级和风险级别）

#### Step 1: 清理临时文件（低风险，立即改善）
```bash
# 执行阶段 1.2, 1.3, 1.4
# 移动测试输出文件和覆盖率目录
```

#### Step 2: 整理文档（低风险）
```bash
# 执行阶段 3.3
# 移动报告文档到 docs/
```

#### Step 3: 整理数据目录（低风险）
```bash
# 执行阶段 3.2
# 移动 just-laws 到 data/
```

#### Step 4: 更新 .gitignore（低风险）
```bash
# 执行阶段 4
# 更新 .gitignore 文件
```

#### Step 5: 整理配置文件（中-高风险，需要测试）
```bash
# 执行阶段 2

# 5.1 移动 next.config.ts
mv config/next.config.ts ./next.config.ts
npm run build  # 验证

# 5.2 移动 playwright.config.ts
mv config/playwright.config.ts ./playwright.config.ts
npm run test:e2e -- --help  # 验证

# 5.3 删除重复配置文件
rm config/commitlint.config.js
rm config/eslint.config.mjs
rm config/postcss.config.mjs

# 5.4 验证所有工具
npm run lint
npm run format:check
npm run type-check
```

#### Step 6: 清理不规范目录（中风险）
```bash
# 执行阶段 3.1
rm -rf "%APPDATA%"
# 可选: rm -rf dist/
```

#### Step 7: 最终验证
```bash
# 运行所有关键命令验证项目正常
npm run type-check
npm run lint
npm run build
npm run test
```

### 验证清单

完成后检查以下内容:

- [ ] `npm run dev` 正常启动
- [ ] `npm run build` 构建成功
- [ ] `npm run lint` 无错误
- [ ] `npm run type-check` 无错误
- [ ] `npm run test` 测试通过
- [ ] `git status` 显示预期的变更
- [ ] 所有配置文件在正确位置
- [ ] 根目录整洁，无临时文件

---

## 预期结果

### 根目录结构（整理后）
```
legal-debate-mvp/
├── .claudecoderules
├── .clineignore
├── .clinerules
├── .dockerignore
├── .env
├── .env.production
├── .eslintrc.performance.js
├── .git/
├── .github/
├── .gitignore
├── .husky/
├── commitlint.config.js
├── config/                    # 应用配置目录
├── data/                      # 数据文件目录
│   ├── just-laws/
│   └── ...
├── docker/
├── docs/                      # 文档目录（整理后）
├── Dockerfile
├── eslint.config.mjs
├── eslint.config.quick.mjs
├── jest.config.js
├── jest.config.integration.js
├── jest.global-setup.js
├── jest.global-teardown.js
├── jest.polyfill.js
├── jest.test-env.ts
├── jest-setup.d.ts
├── logs/                      # 应用日志
├── next.config.ts             # ← 从 config/ 移动
├── next-env.d.ts
├── node_modules/
├── package.json
├── package-lock.json
├── playwright.config.ts       # ← 从 config/ 移动
├── postcss.config.js
├── prisma/
├── public/
├── README.md
├── scripts/
├── src/
├── tailwind.config.js
├── test-output/               # 新建（临时文件归档）
│   ├── archive/
│   └── coverage-archive/
├── tsconfig.json
├── tsconfig.src.json
└── tsconfig.test.json
```

### 统计改善

| 指标 | 整理前 | 整理后 | 改善 |
|------|--------|--------|------|
| 根目录文件数 | ~170 | ~35 | -79% |
| 测试输出文件 | 98 | 0 | -100% |
| 覆盖率目录 | 12 | 0 | -100% |
| 配置文件重复 | 3 处 | 0 | -100% |
| 不规范目录 | 2 | 0 | -100% |

---

## 后续建议

### 1. 建立文件管理规范
创建 `docs/FILE_ORGANIZATION_GUIDELINES.md` 文档，规定:
- 测试输出应自动输出到 `test-output/` 目录
- 临时文件命名规范
- 定期清理规则

### 2. 添加自动化清理脚本
在 `scripts/` 目录创建:
```bash
scripts/clean-temp-files.sh   # 清理临时文件
scripts/clean-test-output.sh  # 清理测试输出
```

添加到 package.json:
```json
{
  "scripts": {
    "clean": "tsx scripts/clean-temp-files.ts",
    "clean:test": "tsx scripts/clean-test-output.ts"
  }
}
```

### 3. 更新 CI/CD 流程
确保 CI/CD 不依赖被移动的文件

### 4. 团队沟通
- 向团队成员说明文件结构变更
- 更新开发文档
- 确保所有人同步最新的项目结构

---

## 附录

### A. 配置文件位置参考

| 工具/框架 | 配置文件 | 必须位置 | 官方文档 |
|-----------|----------|----------|----------|
| Next.js | next.config.ts | 根目录 | [Next.js Config](https://nextjs.org/docs/api-reference/next.config.js/introduction) |
| TypeScript | tsconfig.json | 根目录 | [TSConfig](https://www.typescriptlang.org/docs/handbook/tsconfig-json.html) |
| ESLint | eslint.config.mjs | 根目录 | [ESLint Config](https://eslint.org/docs/user-guide/configuring/) |
| Prettier | .prettierrc | 根目录或package.json | [Prettier Config](https://prettier.io/docs/en/configuration.html) |
| Jest | jest.config.js | 根目录 | [Jest Config](https://jestjs.io/docs/configuration) |
| Playwright | playwright.config.ts | 根目录 | [Playwright Config](https://playwright.dev/docs/test-configuration) |
| Tailwind | tailwind.config.js | 根目录 | [Tailwind Config](https://tailwindcss.com/docs/configuration) |
| PostCSS | postcss.config.js | 根目录 | [PostCSS Config](https://github.com/postcss/postcss#usage) |
| Commitlint | commitlint.config.js | 根目录 | [Commitlint Config](https://commitlint.js.org/#/reference-configuration) |

### B. 常见问题

**Q: 为什么不把所有配置文件都放到 config/ 目录？**
A: 因为大多数工具默认在项目根目录查找配置文件。虽然可以通过命令行参数指定配置文件路径，但这会增加配置复杂度和出错风险。

**Q: 测试输出文件可以直接删除吗？**
A: 建议先移动到归档目录，观察一段时间后再删除，以防有遗漏的重要信息。

**Q: config/ 目录的作用是什么？**
A: config/ 目录应该存放应用级别的配置（如 Redis、Logger、Docker 等），而不是工具级别的配置。

**Q: 如果整理后出现问题怎么办？**
A:
1. 使用 git 回滚: `git checkout .`
2. 恢复备份文件
3. 检查验证清单中的每一项
4. 查看工具的错误信息，定位具体问题

---

## 总结

本次整理将:
1. ✅ 清理 98 个临时测试输出文件
2. ✅ 移除 12 个覆盖率目录
3. ✅ 解决 3 处配置文件重复问题
4. ✅ 修正配置文件位置（next.config.ts, playwright.config.ts 等）
5. ✅ 规范目录结构
6. ✅ 提高项目整洁度 79%

整理后，项目结构将更加规范、易于维护，符合业界最佳实践。

---

**审批状态**: ⏳ 待审批
**预计执行时间**: 30-45 分钟
**回滚难度**: 低（使用 Git 可快速回滚）

如果批准此计划，请确认后即可开始执行。
