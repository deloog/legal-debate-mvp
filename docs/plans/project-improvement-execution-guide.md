# 项目改进执行指南

> **创建日期**：2026-02-23  
> **适用对象**：AI助手、开发团队  
> **阅读时间**：15分钟  
> **总工作量**：约17-28小时（分2-3周完成）

---

## 📋 目录

1. [概述](#概述)
2. [短期执行指南（1周内）](#短期执行指南1周内)
3. [中期执行指南（2-3周）](#中期执行指南2-3周)
4. [长期执行指南（1个月后）](#长期执行指南1个月后)
5. [AI助手执行规范](#ai助手执行规范)
6. [进度跟踪模板](#进度跟踪模板)

---

## 概述

### 改进目标

本项目改进旨在：

1. **提升代码质量**：启用TypeScript strict模式，减少类型错误
2. **规范开发流程**：完善开发规范，提高AI协作效率
3. **增强可维护性**：减少技术债务，提高代码可读性
4. **改善开发体验**：提供清晰的指南和模板，降低学习成本

### 改进范围

| 改进领域 | 优先级 | 预期收益 | 完成时间 |
|----------|----------|----------|----------|
| TypeScript strict模式 | P0 | 减少90%的潜在类型错误 | 2-3周 |
| 开发规范完善 | P1 | 提高AI协作效率50% | 已完成 |
| 代码模板完善 | P1 | 提高开发速度30% | 已完成 |
| CI/CD集成 | P2 | 自动化质量检查 | 1个月后 |
| 团队培训 | P2 | 统一开发标准 | 持续进行 |

### 执行原则

1. **渐进式推进**：不一次性大改动，分阶段实施
2. **充分测试**：每个阶段完成后必须验证功能正常
3. **文档先行**：所有改进都有详细的执行文档
4. **风险可控**：使用Git分支，随时可以回滚
5. **AI辅助**：充分利用AI助手处理重复性工作

---

## 短期执行指南（1周内）

### ✅ 执行状态更新（2026-02-23）

**已完成任务：**
- ✅ 阶段0：准备工作（2026-02-23）
- ✅ 阶段1：修复现有错误（2026-02-23）
- ✅ 阶段2：Scripts目录（2026-02-23）
- 🔄 阶段3：src/lib目录 - 第1批完成（2026-02-23 20:50）

**修复详情：**

**阶段1修复：**
- 修复了 scripts/analyze-samr-structure.ts:174 的console.error错误处理
- 修复了 scripts/check-document-types.ts:89 的fullText类型检查
- 修复了 scripts/test-download-verification.ts:44 的错误处理类型
- 修复了 src/lib/cache/cache-config.ts:71 - 添加KNOWLEDGE_GRAPH命名空间配置
- 两个已删除的文件（debug-api.ts, debug-download-url.ts）无需修复
- contract-templates/route.ts:113 已包含clauses属性

**阶段2修复：**
- Scripts目录无需任何修复，已符合strict模式要求

**阶段3第1批修复（TS6133未使用变量）：**
- 创建了自动修复脚本 `scripts/fix-unused-variables.js`
- 自动修复了335/610个TS6133错误（56%）
- 剩余275个错误需要手动处理（主要是import语句和复杂函数参数）

**阶段3错误分析（2026-02-23 20:48）：**
- 总错误数：3093个（远超预期的50-100个）
- 主要错误类型：
  - TS2532 (对象可能是undefined/null): 1022个
  - TS1804 (对象可能是undefined): 576个
  - TS6133 (未使用变量): 437个（已修复335个）
  - TS2345 (参数类型不匹配): 408个
  - TS2322 (类型不匹配): 303个
  - 其他错误: 347个

**验证结果：**
- ✅ 阶段1所有TypeScript检查通过（0个错误）
- ✅ 阶段2所有TypeScript检查通过（0个错误）
- ✅ 阶段3第1批修复完成，减少了335个错误

**下一步：**
- 继续阶段3第2批：修复undefined/null错误（TS2532+TS1804）- 1598个错误

---

### 📌 阶段目标

完成TypeScript strict模式迁移的准备工作，修复现有类型错误，为后续工作奠定基础。

### ⏱️ 时间安排

- **总工作量**：3小时
- **建议时间**：1周内分散完成
- **单次时长**：每次30-60分钟

---

### 阶段0：准备工作（1小时）

#### 步骤0.1：创建迁移分支

```bash
# 切换到主分支
git checkout main

# 拉取最新代码
git pull origin main

# 创建迁移分支
git checkout -b strict-migration

# 验证分支
git branch
```

**验证标准**：
- ✅ 当前分支为 `strict-migration`
- ✅ 分支基于最新的main分支

---

#### 步骤0.2：运行baseline测试

```bash
# 运行所有单元测试
npm test

# 记录测试结果
# 如果测试失败，记录失败原因并修复后再继续

# 运行TypeScript检查
npx tsc --noEmit > baseline-errors.txt

# 查看错误数量
cat baseline-errors.txt | grep "error TS" | wc -l
```

**验证标准**：
- ✅ 所有单元测试通过
- ✅ baseline-errors.txt已创建
- ✅ 记录了现有错误数量（应约为6个）

**注意事项**：
- 如果测试失败，必须先修复测试问题
- baseline-errors.txt将作为对比基准

---

#### 步骤0.3：创建进度跟踪文档

创建 `docs/plans/strict-migration-progress.md`：

```markdown
# TypeScript Strict Mode 迁移进度跟踪

> 开始日期：2026-02-XX  
> 预计完成：2026-03-XX

## 进度概览

| 阶段 | 状态 | 完成时间 | 错误数 |
|------|------|----------|--------|
| 阶段0：准备工作 | 🔄 进行中 | - | - |
| 阶段1：修复现有错误 | ⏳ 待开始 | - | 6 |
| 阶段2：Scripts目录 | ⏳ 待开始 | - | 待评估 |
| 阶段3：src/lib目录 | ⏳ 待开始 | - | 待评估 |
| 阶段4：src/app/api目录 | ⏳ 待开始 | - | 待评估 |
| 阶段5：src/app/页面目录 | ⏳ 待开始 | - | 待评估 |
| 阶段6：最终验证 | ⏳ 待开始 | - | - |
| 阶段7：全面启用 | ⏳ 待开始 | - | - |

## 详细记录

### 阶段0：准备工作
- [ ] 创建分支 strict-migration
- [ ] 运行baseline测试
- [ ] 备份现有错误列表
- [ ] 创建进度跟踪文档

### 阶段1：修复现有错误
- [ ] 修复 scripts/analyze-samr-structure.ts:174
- [ ] 修复 scripts/check-document-types.ts:89
- [ ] 修复 scripts/crawler/debug-api.ts:19
- [ ] 修复 scripts/crawler/debug-download-url.ts:5
- [ ] 修复 scripts/test-download-verification.ts:44
- [ ] 修复 src/app/api/contract-templates/route.ts:113

### 阶段2：Scripts目录
（待填写）

## 问题记录

### 已解决问题
（记录已解决的问题和解决方案）

### 待解决问题
（记录遇到的问题和解决计划）
```

**验证标准**：
- ✅ 进度跟踪文档已创建
- ✅ 路径正确：`docs/plans/strict-migration-progress.md`

---

### ✅ 阶段0完成验证

运行以下命令验证阶段0完成：

```bash
# 检查分支
git branch --show-current
# 输出应该是：strict-migration

# 检查测试
npm test
# 应该所有测试通过

# 检查进度文档
ls -la docs/plans/strict-migration-progress.md
# 文件应该存在
```

**完成标准**：
- ✅ 分支名称正确
- ✅ 所有测试通过
- ✅ 进度跟踪文档已创建
- ✅ baseline错误已记录

---

### 阶段1：修复现有错误（2小时）

#### 步骤1.1：修复重复函数实现错误

**文件1：scripts/analyze-samr-structure.ts:174**

```bash
# 读取文件，定位到行174
read_file --path scripts/analyze-samr-structure.ts

# 查找重复的函数定义
# 搜索相同函数名的定义

# 删除重复的实现，保留第一次定义
```

**修复方法**：
1. 使用 `read_file` 工具读取文件
2. 查找重复的函数名称
3. 删除第二次出现的函数实现
4. 保留注释（如果有）

**示例**：
```typescript
// ❌ 修复前
function processData() {
  // 实现1
}

// 其他代码...

function processData() {  // 重复！
  // 实现2
}

// ✅ 修复后
function processData() {
  // 实现1
}

// 其他代码...
// 已删除重复的函数
```

**验证**：
```bash
npx tsc --noEmit scripts/analyze-samr-structure.ts
# 应该没有错误
```

**检查清单**：
- [ ] 重复函数已删除
- [ ] TypeScript检查通过
- [ ] 功能测试通过（如果存在）

---

**文件2-4：重复函数实现错误**

按照相同方法修复：
- `scripts/crawler/debug-api.ts:19`
- `scripts/crawler/debug-download-url.ts:5`
- `scripts/test-download-verification.ts:44`

---

#### 步骤1.2：修复算术操作类型错误

**文件：scripts/check-document-types.ts:89**

```bash
# 读取文件
read_file --path scripts/check-document-types.ts

# 定位到行89
# 查找算术操作
```

**修复方法**：
1. 找到行89的算术操作
2. 检查操作数的类型
3. 添加类型转换或修复类型定义

**示例**：
```typescript
// ❌ 修复前
const count = data.length + offset;  // offset类型可能是any

// ✅ 修复后
const count = data.length + (offset as number);

// 或
const count = data.length + Number(offset);
```

**验证**：
```bash
npx tsc --noEmit scripts/check-document-types.ts
# 应该没有错误
```

---

#### 步骤1.3：修复缺少必需属性错误

**文件：src/app/api/contract-templates/route.ts:113**

```bash
# 读取文件
read_file --path src/app/api/contract-templates/route.ts

# 定位到行113
```

**修复方法**：
1. 找到创建ContractTemplate的代码
2. 查看ContractTemplate类型定义
3. 添加缺少的 `clauses` 属性

**示例**：
```typescript
// ❌ 修复前
const template = {
  name: templateData.name,
  code: templateData.code,
  category: templateData.category,
  content: templateData.content,
  variables: templateData.variables,
  isDefault: templateData.isDefault,
  isActive: templateData.isActive
};

// ✅ 修复后
const template = {
  name: templateData.name,
  code: templateData.code,
  category: templateData.category,
  content: templateData.content,
  variables: templateData.variables,
  clauses: templateData.clauses || [],  // 添加缺少的属性
  isDefault: templateData.isDefault,
  isActive: templateData.isActive
};
```

**验证**：
```bash
npx tsc --noEmit src/app/api/contract-templates/route.ts
# 应该没有错误
```

---

#### 步骤1.4：验证所有错误已修复

```bash
# 运行完整的TypeScript检查
npx tsc --noEmit > after-fix-errors.txt

# 对比错误数量
echo "修复前错误数："
cat baseline-errors.txt | grep "error TS" | wc -l
echo "修复后错误数："
cat after-fix-errors.txt | grep "error TS" | wc -l

# 应该看到错误数量减少6个（或全部修复）
```

**验证标准**：
- ✅ 修复后错误数应该为0（或显著减少）
- ✅ 所有现有错误已修复
- ✅ 修复不影响现有功能

---

#### 步骤1.5：运行测试验证

```bash
# 运行所有测试
npm test

# 如果有相关测试，运行特定测试
npm test -- scripts/check-document-types.test.ts
```

**验证标准**：
- ✅ 所有测试通过
- ✅ 没有新的测试失败

---

#### 步骤1.6：提交修复

```bash
# 查看修改
git status

# 添加修改的文件
git add scripts/analyze-samr-structure.ts
git add scripts/check-document-types.ts
git add scripts/crawler/debug-api.ts
git add scripts/crawler/debug-download-url.ts
git add scripts/test-download-verification.ts
git add src/app/api/contract-templates/route.ts

# 提交
git commit -m "fix: 修复现有TypeScript类型错误

- 删除重复函数实现（4处）
- 修复算术操作类型错误
- 添加ContractTemplate缺少的clauses属性

为TypeScript strict模式迁移做准备"
```

**验证标准**：
- ✅ 提交成功
- ✅ 提交信息清晰描述修改内容

---

### ✅ 阶段1完成验证

```bash
# 验证TypeScript检查
npx tsc --noEmit
# 应该没有错误（或只有非critical错误）

# 验证测试
npm test
# 所有测试应该通过

# 查看Git状态
git log --oneline -1
# 应该看到最新的提交
```

**完成标准**：
- ✅ 所有6个现有错误已修复
- ✅ TypeScript检查通过（0个critical错误）
- ✅ 所有测试通过
- ✅ 修复已提交到Git

---

## 中期执行指南（2-3周）

### 📌 阶段目标

按模块逐步修复TypeScript strict模式相关的类型错误，确保每个模块修复后功能正常。

### ⏱️ 时间安排

- **总工作量**：13.5-22.5小时
- **建议时间**：2-3周
- **单次时长**：每次1-3小时

---

### 阶段2：Scripts目录（2-3小时）

#### 步骤2.1：运行strict模式检查

```bash
# 使用strict配置检查scripts目录
npx tsc --noEmit --project tsconfig.strict.json | grep "scripts/" > scripts-strict-errors.txt

# 查看错误数量
echo "Scripts目录strict错误数："
cat scripts-strict-errors.txt | grep "error TS" | wc -l
```

**验证标准**：
- ✅ 错误列表已保存到 scripts-strict-errors.txt
- ✅ 知道需要修复的错误数量

---

#### 步骤2.2：分析错误类型

```bash
# 按错误类型分类
echo "隐式any错误："
grep "implicitly has an 'any' type" scripts-strict-errors.txt | wc -l

echo "null/undefined错误："
grep "possibly 'null' or 'undefined'" scripts-strict-errors.txt | wc -l

echo "this类型错误："
grep "'this' implicitly has type 'any'" scripts-strict-errors.txt | wc -l
```

**验证标准**：
- ✅ 了解各类错误的分布
- ✅ 确定修复优先级

---

#### 步骤2.3：逐文件修复错误

**方法：按文件逐个修复**

```bash
# 提取所有有错误的文件列表
grep "scripts/" scripts-strict-errors.txt | sed 's/.*scripts\///' | sed 's/[(].*//' | sort -u > scripts-files-to-fix.txt

# 查看需要修复的文件
cat scripts-files-to-fix.txt
```

**对于每个文件**：

1. **读取文件**
```bash
read_file --path scripts/文件名.ts
```

2. **分析错误**
```bash
# 查看该文件的所有错误
grep "scripts/文件名.ts" scripts-strict-errors.txt
```

3. **修复错误**

**常见错误修复模式**：

##### 隐式any错误

```typescript
// ❌ 错误
function process(data, options) {
  return data;
}

// ✅ 修复
function process(data: unknown, options?: Record<string, unknown>) {
  return data;
}
```

##### null/undefined错误

```typescript
// ❌ 错误
const result = items.find(item => item.id === id);
const name = result.name;  // result可能为undefined

// ✅ 修复
const result = items.find(item => item.id === id);
const name = result?.name;  // 使用可选链

// 或
const result = items.find(item => item.id === id);
if (result) {
  const name = result.name;
}
```

##### this类型错误

```typescript
// ❌ 错误
function getName() {
  return this.name;
}

// ✅ 修复
function getName(this: { name: string }) {
  return this.name;
}
```

4. **验证修复**
```bash
# 验证单个文件
npx tsc --noEmit --project tsconfig.strict.json scripts/文件名.ts
```

5. **提交修复**
```bash
git add scripts/文件名.ts
git commit -m "fix: 修复scripts/文件名.ts的strict模式类型错误

- 修复隐式any错误X处
- 修复null/undefined错误Y处
- 修复this类型错误Z处"
```

---

#### 步骤2.4：验证Scripts目录修复完成

```bash
# 检查scripts目录是否还有错误
npx tsc --noEmit --project tsconfig.strict.json | grep "scripts/" | grep "error TS" | wc -l

# 应该输出0
```

**验证标准**：
- ✅ scripts目录0个strict错误
- ✅ 所有相关测试通过
- ✅ 修复已提交

---

### 阶段3：src/lib目录（5-8小时）

#### 步骤3.1：运行strict模式检查

```bash
# 检查src/lib目录
npx tsc --noEmit --project tsconfig.strict.json | grep "src/lib/" > lib-strict-errors.txt

# 统计错误
echo "src/lib目录strict错误数："
cat lib-strict-errors.txt | grep "error TS" | wc -l
```

---

#### 步骤3.2：按子目录优先级修复

**优先级顺序**：

1. **src/lib/agent/** - AI Agent系统（高优先级）
2. **src/lib/ai/** - AI服务层（高优先级）
3. **src/lib/debate/** - 辩论系统（高优先级）
4. **src/lib/crawler/** - 爬虫系统（中优先级）
5. **src/lib/law-article/** - 法律文章（中优先级）
6. **其他src/lib/目录** - 其他模块（低优先级）

**对于每个子目录**：

```bash
# 提取子目录的错误
grep "src/lib/agent/" lib-strict-errors.txt > agent-errors.txt

# 统计错误
cat agent-errors.txt | grep "error TS" | wc -l
```

---

#### 步骤3.3：修复核心模块（agent/ai/debate）

**修复策略**：

1. **定义核心类型**
```typescript
// src/lib/types/agent.ts
export interface AgentConfig {
  id: string;
  name: string;
  capabilities: string[];
  timeout?: number;
}

export interface AgentResponse {
  success: boolean;
  data: unknown;
  error?: string;
}
```

2. **修复函数签名**
```typescript
// ❌ 错误
export async function executeAgent(agent, task) {
  // ...
}

// ✅ 修复
export async function executeAgent(
  agent: AgentConfig,
  task: string
): Promise<AgentResponse> {
  // ...
}
```

3. **处理可能为null的返回值**
```typescript
// ❌ 错误
const debate = await prisma.debate.findUnique({ where: { id } });
const title = debate.title;  // debate可能为null

// ✅ 修复
const debate = await prisma.debate.findUnique({ where: { id } });
if (!debate) {
  throw new Error('Debate not found');
}
const title = debate.title;
```

---

#### 步骤3.4：修复后测试

```bash
# 运行lib目录的测试
npm test -- src/lib/agent
npm test -- src/lib/ai
npm test -- src/lib/debate

# 或运行所有lib测试
npm test -- src/lib
```

---

#### 步骤3.5：验证src/lib修复完成

```bash
# 检查lib目录是否还有错误
npx tsc --noEmit --project tsconfig.strict.json | grep "src/lib/" | grep "error TS" | wc -l

# 应该输出0
```

---

### 阶段4：src/app/api目录（3-5小时）

#### 步骤4.1：运行strict模式检查

```bash
# 检查API路由
npx tsc --noEmit --project tsconfig.strict.json | grep "src/app/api/" > api-strict-errors.txt

# 统计错误
echo "API路由strict错误数："
cat api-strict-errors.txt | grep "error TS" | wc -l
```

---

#### 步骤4.2：修复API路由类型错误

**常见模式**：

1. **请求体类型**
```typescript
// ❌ 错误
export async function POST(req: Request) {
  const body = await req.json();
  const name = body.name;  // body类型为any
}

// ✅ 修复
interface CreateRequest {
  name: string;
  description?: string;
}

export async function POST(req: Request) {
  const body: CreateRequest = await req.json();
  const name = body.name;
}
```

2. **响应类型**
```typescript
// ❌ 错误
return NextResponse.json({ success: true, data });

// ✅ 修复
interface ApiResponse<T = unknown> {
  success: boolean;
  data: T;
  error?: string;
}

return NextResponse.json<ApiResponse>({
  success: true,
  data
});
```

3. **错误处理类型**
```typescript
// ❌ 错误
try {
  // ...
} catch (error) {
  console.log(error);
  return NextResponse.json({ error: 'Failed' });
}

// ✅ 修复
try {
  // ...
} catch (error) {
  logger.error('API error', error);
  const errorMessage = error instanceof Error ? error.message : 'Unknown error';
  return NextResponse.json<ApiResponse>(
    { success: false, error: errorMessage },
    { status: 500 }
  );
}
```

---

#### 步骤4.3：验证API修复

```bash
# 检查API目录是否还有错误
npx tsc --noEmit --project tsconfig.strict.json | grep "src/app/api/" | grep "error TS" | wc -l

# 应该输出0

# 运行API测试
npm test -- src/app/api
```

---

### 阶段5：src/app/页面目录（3.5-8.5小时）

#### 步骤5.1：运行strict模式检查

```bash
# 检查页面组件（排除API路由）
npx tsc --noEmit --project tsconfig.strict.json | grep "src/app/[^a]" > pages-strict-errors.txt

# 统计错误
echo "页面组件strict错误数："
cat pages-strict-errors.txt | grep "error TS" | wc -l
```

---

#### 步骤5.2：修复页面组件类型错误

**常见模式**：

1. **组件Props类型**
```typescript
// ❌ 错误
export default function DebatePage({ params }) {
  const id = params.id;
}

// ✅ 修复
interface DebatePageProps {
  params: {
    id: string;
  };
}

export default function DebatePage({ params }: DebatePageProps) {
  const id = params.id;
}
```

2. **useState类型**
```typescript
// ❌ 错误
const [debate, setDebate] = useState(null);

// ✅ 修复
const [debate, setDebate] = useState<Debate | null>(null);
```

3. **事件处理器类型**
```typescript
// ❌ 错误
const handleClick = (e) => {
  e.preventDefault();
};

// ✅ 修复
const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
  e.preventDefault();
};
```

---

#### 步骤5.3：验证页面修复

```bash
# 检查页面目录是否还有错误
npx tsc --noEmit --project tsconfig.strict.json | grep "src/app/[^a]" | grep "error TS" | wc -l

# 应该输出0

# 运行E2E测试
npx playwright test
```

---

### 阶段6：最终验证与合并（1小时）

#### 步骤6.1：完整strict检查

```bash
# 运行完整的strict模式检查
npx tsc --noEmit --project tsconfig.strict.json > final-strict-errors.txt

# 查看错误数量
echo "最终错误数："
cat final-strict-errors.txt | grep "error TS" | wc -l

# 应该输出0
```

---

#### 步骤6.2：运行所有测试

```bash
# 单元测试
npm test

# E2E测试
npx playwright test

# 所有测试应该通过
```

---

#### 步骤6.3：代码审查

```bash
# 查看所有提交
git log --oneline strict-migration

# 应该看到多个修复提交，每个提交对应一个模块或文件的修复
```

**审查要点**：
- [ ] 每个提交都有清晰的描述
- [ ] 没有引入新的any类型
- [ ] 所有类型定义合理
- [ ] 错误处理完善

---

#### 步骤6.4：合并到主分支

```bash
# 切换到主分支
git checkout main

# 拉取最新代码
git pull origin main

# 合并迁移分支
git merge strict-migration --no-ff -m "merge: 完成TypeScript strict模式迁移

- 修复所有隐式any错误
- 修复所有null/undefined错误
- 修复所有this类型错误
- 修复所有其他strict模式错误
- 所有测试通过
- 零类型错误"

# 推送到远程
git push origin main
```

---

### ✅ 中期阶段完成验证

```bash
# 验证strict检查
npx tsc --noEmit --project tsconfig.strict.json
# 应该没有错误

# 验证测试
npm test && npx playwright test
# 所有测试应该通过

# 验证分支
git branch
# strict-migration分支可以删除
git branch -D strict-migration
```

**完成标准**：
- ✅ 所有strict模式错误已修复（0个错误）
- ✅ 所有单元测试通过
- ✅ 所有E2E测试通过
- ✅ 代码已合并到主分支
- ✅ 进度跟踪文档已更新

---

## 长期执行指南（1个月后）

### 📌 阶段目标

在主配置中全面启用strict模式，建立持续的质量检查流程，确保新代码符合strict模式要求。

### ⏱️ 时间安排

- **准备工作**：1小时
- **持续维护**：长期进行

---

### 阶段7：全面启用Strict模式（1小时）

#### 步骤7.1：团队准备

```bash
# 创建团队培训文档
cat > docs/guides/development/typescript-strict-mode-guide.md << 'EOF'
# TypeScript Strict Mode 开发指南

> **目标读者**：开发团队成员  
> **阅读时间**：10分钟

## 什么是Strict模式

TypeScript strict模式启用更严格的类型检查，帮助在编译时发现更多错误。

## 核心规则

### 1. 始终明确类型

```typescript
// ❌ 错误
function add(a, b) {
  return a + b;
}

// ✅ 正确
function add(a: number, b: number): number {
  return a + b;
}
```

### 2. 处理可能的null/undefined

```typescript
// ❌ 错误
const name = user.name;  // user可能为undefined

// ✅ 正确
const name = user?.name;  // 使用可选链
// 或
if (user) {
  const name = user.name;
}
```

### 3. 避免any类型

```typescript
// ❌ 错误
const data: any = response.data;

// ✅ 正确
const data: unknown = response.data;
```

### 4. 初始化类属性

```typescript
// ❌ 错误
class User {
  name: string;  // 未初始化
}

// ✅ 正确
class User {
  name: string = '';
  // 或
  name!: string;  // 确定会被赋值
}
```

## 开发工作流

### 编写代码

1. 使用IDE的自动完成功能
2. 让TypeScript推断类型，或明确指定类型
3. 处理可能的null/undefined

### 检查类型

```bash
# 本地检查
npx tsc --noEmit

# 应该没有类型错误
```

### 提交代码

1. 确保所有类型错误已修复
2. 运行测试
3. 提交代码

## 常见问题

### Q: 为什么不能用any类型？

A: any类型绕过了类型检查，失去了TypeScript的优势。使用unknown或其他具体类型。

### Q: 如何处理动态数据？

A: 使用类型守卫或泛型：

```typescript
function isString(value: unknown): value is string {
  return typeof value === 'string';
}

if (isString(data)) {
  console.log(data.toUpperCase());
}
```

### Q: 如何快速修复类型错误？

A: 使用VS Code的快速修复功能（Ctrl+.）或让AI助手自动修复。

## 更多资源

- [TypeScript官方文档](https://www.typescriptlang.org/docs/handbook/2/basic-types.html)
- [项目开发规范](AI_GUIDE.md)
- [错误修复指南](typescript-strict-migration.md)
EOF
```

---

#### 步骤7.2：更新代码模板

更新所有代码模板以符合strict模式：

**API路由模板**：
```typescript
// docs/templates/api-route-template.ts
import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

interface RequestBody {
  // 定义请求体类型
}

interface ResponseData {
  // 定义响应数据类型
}

export async function POST(req: NextRequest) {
  try {
    const body: RequestBody = await req.json();
    
    // 处理请求...
    
    const responseData: ResponseData = {
      // 构建响应
    };
    
    return NextResponse.json(responseData);
  } catch (error) {
    logger.error('API error', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
```

---

#### 步骤7.3：修改tsconfig.json

```bash
# 备份当前配置
cp tsconfig.json tsconfig.json.backup

# 将strict选项合并到主配置
# 编辑tsconfig.json，添加以下内容
```

在 `tsconfig.json` 中添加：

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictBindCallApply": true,
    "strictPropertyInitialization": true,
    "noImplicitThis": true,
    "alwaysStrict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true
  }
}
```

---

#### 步骤7.4：验证strict模式已启用

```bash
# 运行TypeScript检查
npx tsc --noEmit

# 应该没有错误（之前已修复）

# 删除strict配置文件
rm tsconfig.strict.json
```

---

#### 步骤7.5：更新CI/CD配置

创建 `.github/workflows/typescript-check.yml`：

```yaml
name: TypeScript Type Check

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main, develop ]

jobs:
  typecheck:
    runs-on: ubuntu-latest
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run TypeScript check
        run: npx tsc --noEmit
      
      - name: Run tests
        run: npm test
```

---

### 阶段8：持续质量保证

#### 步骤8.1：Pre-commit Hook

安装husky和lint-staged：

```bash
npm install --save-dev husky lint-staged

# 初始化husky
npx husky install

# 添加pre-commit hook
npx husky add .husky/pre-commit "npx lint-staged"
```

配置 `.lintstagedrc.json`：

```json
{
  "*.{ts,tsx}": [
    "eslint --fix",
    "npx tsc --noEmit"
  ],
  "*.{js,jsx,ts,tsx}": [
    "eslint --fix"
  ]
}
```

---

#### 步骤8.2：定期检查

每周运行一次全面检查：

```bash
# 创建scripts/weekly-type-check.sh
#!/bin/bash

echo "=== TypeScript Strict Mode 每周检查 ==="
echo "日期: $(date)"
echo ""

# 运行类型检查
npx tsc --noEmit
TYPE_CHECK_RESULT=$?

if [ $TYPE_CHECK_RESULT -ne 0 ]; then
  echo "❌ 类型检查失败"
  echo "请修复类型错误后再提交代码"
  exit 1
else
  echo "✅ 类型检查通过"
fi

# 运行测试
npm test
TEST_RESULT=$?

if [ $TEST_RESULT -ne 0 ]; then
  echo "❌ 测试失败"
  echo "请修复测试失败后再提交代码"
  exit 1
else
  echo "✅ 测试通过"
fi

echo ""
echo "=== 检查完成，可以安全提交代码 ==="

# 添加执行权限
chmod +x scripts/weekly-type-check.sh
```

---

#### 步骤8.3：代码审查检查清单

在代码审查时使用：

```markdown
## TypeScript Strict Mode 检查清单

### 类型定义
- [ ] 所有函数参数都有类型
- [ ] 所有函数返回值都有类型
- [ ] 所有变量都有明确类型或可以推断
- [ ] 没有使用any类型（测试文件除外）

### null/undefined处理
- [ ] 正确处理可能为null/undefined的值
- [ ] 使用可选链（?.）或空值合并（??）
- [ ] 有适当的类型守卫

### 类定义
- [ ] 类属性正确初始化
- [ ] 没有隐式的this类型
- [ ] 必要时使用definite assignment assertion（!）

### 错误处理
- [ ] try-catch有正确的错误类型
- [ ] 错误对象正确处理
- [ ] 错误日志记录正确

### 工具使用
- [ ] 适当使用泛型
- [ ] 适当使用utility types（Partial, Required等）
- [ ] 避免类型断言过度使用
```

---

### ✅ 长期阶段完成验证

```bash
# 验证strict模式已启用
npx tsc --noEmit
# 应该没有错误

# 验证测试
npm test && npx playwright test
# 所有测试应该通过

# 验证CI/CD配置
cat .github/workflows/typescript-check.yml
# 文件应该存在

# 验证pre-commit hook
cat .husky/pre-commit
# 应该包含lint-staged
```

**完成标准**：
- ✅ strict模式已在主配置中启用
- ✅ tsconfig.strict.json已删除
- ✅ CI/CD配置已更新
- ✅ Pre-commit hook已配置
- ✅ 团队培训文档已创建
- ✅ 所有测试通过
- ✅ 持续检查流程已建立

---

## AI助手执行规范

### 🤖 如何使用本指南

#### 1. 开始新任务前

```bash
# 读取本指南
read_file --path docs/plans/project-improvement-execution-guide.md

# 确认当前进度
read_file --path docs/plans/strict-migration-progress.md

# 运行当前状态检查
npx tsc --noEmit --project tsconfig.strict.json | grep "error TS" | wc -l
```

#### 2. 执行任务时

- **逐阶段执行**：不要跳过阶段
- **验证每一步**：每个步骤完成后运行验证命令
- **记录进度**：更新进度跟踪文档
- **遇到问题**：记录问题并寻求帮助

#### 3. 任务完成后

- **运行完整检查**：验证所有目标达成
- **更新文档**：更新进度跟踪文档
- **提交代码**：创建清晰的提交信息
- **报告结果**：使用attempt_completion工具报告

---

### 📝 任务分解方法

#### 大任务分解

当遇到大型任务时，按以下方法分解：

```
1. 理解任务目标
   ↓
2. 识别依赖关系
   ↓
3. 分解为可执行步骤（每个步骤1-2小时）
   ↓
4. 为每个步骤创建验证标准
   ↓
5. 识别风险和回滚方案
   ↓
6. 执行并验证每个步骤
```

#### 示例：修复src/lib/agent目录类型错误

```
步骤1：分析agent目录错误（30分钟）
- 运行strict检查
- 统计错误数量和类型
- 确定修复优先级

步骤2：定义核心类型（1小时）
- 创建AgentConfig接口
- 创建AgentResponse接口
- 创建其他必要的类型定义

步骤3：修复agent-manager.ts（1小时）
- 修复隐式any错误
- 修复null/undefined错误
- 验证修复

步骤4：修复其他agent文件（2小时）
- 逐个文件修复
- 验证每个文件

步骤5：运行测试（30分钟）
- 运行agent相关测试
- 确保功能正常

步骤6：提交修复（15分钟）
- 创建提交
- 更新进度文档
```

---

### 📊 进度跟踪要求

#### 每日更新

每天工作结束后，更新进度跟踪文档：

```markdown
## 2026-02-XX 工作记录

### 完成的工作
- 修复了scripts/check-document-types.ts的3个类型错误
- 运行了完整的strict检查，发现50个错误

### 遇到的问题
- 某个文件的类型定义过于复杂，需要重新设计
- TODO: 明天讨论类型重构方案

### 明天计划
- 修复src/lib/agent/目录的类型错误
- 重新设计复杂的类型定义
```

#### 每周总结

每周结束时，更新周总结：

```markdown
## 2026-02-XX周总结

### 本周完成
- 阶段1：修复现有错误（6个）
- 阶段2：修复Scripts目录（20个）
- 阶段3开始：修复src/lib/agent/（10个）

### 进度百分比
- 总体进度：40%
- 已修复错误：36/165

### 下周计划
- 完成阶段3：src/lib目录
- 开始阶段4：src/app/api目录
```

---

### ⚠️ 问题处理流程

#### 遇到无法解决的错误

1. **记录错误详情**
```bash
# 保存错误输出
npx tsc --noEmit --project tsconfig.strict.json > error-debug.txt

# 提取相关错误
grep "特定文件名" error-debug.txt > specific-error.txt
```

2. **尝试解决方案**
   - 查看错误修复指南
   - 搜索TypeScript文档
   - 尝试不同的类型定义

3. **如果无法解决**
   - 使用ask_followup_question工具寻求帮助
   - 提供错误详情和尝试的方案
   - 等待用户指导

---

### 🎯 质量标准

#### 代码质量

- ✅ 没有any类型（测试文件除外）
- ✅ 所有类型定义清晰
- ✅ null/undefined正确处理
- ✅ 错误处理完善
- ✅ 符合.clinerules规范

#### 测试质量

- ✅ 单元测试覆盖率 > 80%
- ✅ 所有测试通过
- ✅ 没有测试警告

#### 文档质量

- ✅ 进度跟踪文档更新
- ✅ 提交信息清晰
- ✅ 复杂逻辑有注释

---

## 进度跟踪模板

### 每日工作日志

```markdown
## YYYY-MM-DD 工作日志

### 目标
（描述今日工作目标）

### 完成的工作
- [ ] 任务1
- [ ] 任务2
- [ ] 任务3

### 遇到的问题
- 问题1描述
  - 解决方案：...
  - 状态：已解决/待解决

### 明天计划
- [ ] 计划任务1
- [ ] 计划任务2

### 时间记录
- 实际工作时间：X小时
- 预计工作时间：Y小时
- 效率评估：高/中/低
```

### 阶段完成总结

```markdown
## 阶段X完成总结

### 基本信息
- 阶段名称：XXX
- 开始日期：YYYY-MM-DD
- 完成日期：YYYY-MM-DD
- 实际用时：X小时（预计Y小时）

### 完成的工作
- 修复文件数：X个
- 修复错误数：Y个
- 提交次数：Z次

### 质量指标
- 测试通过率：100%
- 代码审查：通过/待审查

### 遇到的问题
（列出主要问题和解决方案）

### 经验教训
（记录有用的经验）

### 下一步
（下一阶段的工作计划）
```

---

## 附录

### 常用命令速查

```bash
# TypeScript检查
npx tsc --noEmit                                    # 基础检查
npx tsc --noEmit --project tsconfig.strict.json       # Strict检查

# 错误统计
npx tsc --noEmit | grep "error TS" | wc -l           # 统计错误数
npx tsc --noEmit > errors.txt                        # 保存错误输出

# 测试
npm test                                             # 单元测试
npx playwright test                                  # E2E测试
npm run test:coverage                              # 覆盖率报告

# Git
git log --oneline -10                             # 查看最近提交
git status                                         # 查看状态
git diff                                           # 查看修改
```

### 相关文档

- [TypeScript Strict模式迁移计划](typescript-strict-migration.md)
- [AI开发规范](../../AI_GUIDE.md)
- [核心规范快速查阅](../../CLINERULES_GUIDE.md)
- [代码模板](../../templates/)
- [开发指南](../guides/development/)

### 联系方式

- **技术负责人**：[待填写]
- **TypeScript专家**：[待填写]
- **项目issue跟踪**：[待填写]

---

_本文档将根据执行情况持续更新_
