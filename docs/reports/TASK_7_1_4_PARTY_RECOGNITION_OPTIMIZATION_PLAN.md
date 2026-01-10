# 任务7.1.4：当事人识别优化 - 实施方案

## 📋 任务概述

**目标**：提升当事人信息提取准确率从90%+提升至95%+

**当前状态**：
- 当事人识别准确率90%+
- 19个Bad Case测试通过率37%（7/19）
- 已实现基础三层架构（AI识别+算法兜底+AI审查）

**目标状态**：
- 19个Bad Case通过率≥90%（至少17/19）
- 当事人识别准确率≥95%
- 测试通过率100%

## 🏗️ 实施架构

### 现有三层架构

```
Layer 2: AI核心理解（AI识别当事人）
    ↓
Layer 3: 规则验证（PartyExtractor算法兜底）
    ↓
Layer 4: Reviewer审查（AI+规则双重审查）
    ↓
Layer 4.5: 审查结果应用（applyCorrections修正数据）
```

## 📝 优化计划

### 阶段1：优化AnalysisAgent（AI识别层）

**优化目标**：提升AI识别准确率

**具体措施**：

1. **增强Few-Shot示例库**
   - 新增5个高质量示例（覆盖Bad Case场景）
   - 新增场景：法定代表人误识别、代理人识别遗漏、公司当事人格式多样等

2. **优化AI提示词**
   - 调整temperature参数至0.05（减少随机性）
   - 明确角色定义（原告、被告、第三人、代理人）
   - 增强法定代表人和代理人过滤规则

3. **实现代码变更**：
   - 修改`src/lib/agent/doc-analyzer/processors/ai-processor.ts`
   - 修改`src/lib/agent/doc-analyzer/prompts/smart-prompt-builder.ts`
   - 修改`src/lib/agent/doc-analyzer/prompts/few-shot-library.ts`

**验收标准**：
- AI识别准确率提升5%+
- 新增5个Few-Shot示例

### 阶段2：优化PartyExtractor（算法兜底）

**优化目标**：提升算法兜底准确率和覆盖范围

**具体措施**：

1. **扩展正则表达式规则**
   - 新增公司名称识别模式（"公司"、"企业"、"集团"、"有限"等）
   - 新增多当事人识别模式（"原告：张三、李四、王五"）
   - 新增诉讼请求推断模式（"判令XX偿还借款"）

2. **增强过滤规则**
   - 优化法定代表人过滤（排除"法定代表人：张三"中的张三）
   - 优化代理人过滤（排除"代理律师：王律师"中的王律师）
   - 新增常见词汇过滤（"对方"、"被告方"、"原告方"等）

3. **实现代码变更**：
   - 修改`src/lib/agent/doc-analyzer/extractors/party-extractor.ts`

**验收标准**：
- 算法兜底准确率提升10%+
- 新增10条正则表达式规则

### 阶段3：执行VerificationAgent三重验证

**优化目标**：提升验证准确性和审查效果

**具体措施**：

1. **增强PartyVerifier验证规则**
   - 新增法定代表人误识别检查
   - 新增代理人识别遗漏检查
   - 新增多当事人完整性检查

2. **优化审查评分逻辑**
   - 调整审查阈值至0.7（原0.8）
   - 增强置信度计算逻辑
   - 优化修正建议生成

3. **实现代码变更**：
   - 修改`src/lib/agent/verification-agent/verifiers/party-verifier.ts`

**验收标准**：
- 验证准确率≥90%
- 新增5条验证规则

### 阶段4：MemoryAgent错误学习

**优化目标**：记录Bad Case错误模式，持续学习优化

**具体措施**：

1. **记录错误模式**
   - 记录法定代表人误识别案例
   - 记录代理人识别遗漏案例
   - 记录多当事人识别不完整案例

2. **生成学习报告**
   - 统计错误模式分布
   - 分析错误根因
   - 生成优化建议

3. **实现代码变更**：
   - 修改`src/lib/agent/memory-agent/error-learner.ts`
   - 创建错误模式分析脚本

**验收标准**：
- 记录所有Bad Case错误模式
- 生成优化建议报告

## 🧪 测试方案

### 单元测试

**测试文件**：`src/__tests__/agent/doc-analyzer/party-extraction-bad-case.test.ts`

**测试用例**：
- 19个Bad Case测试用例（已存在）
- 新增5个优化验证用例

**验收标准**：
- 测试通过率≥90%（至少17/19）
- 测试覆盖率≥90%

### 验证测试

**测试命令**：
```bash
npm test -- src/__tests__/agent/doc-analyzer/party-extraction-bad-case.test.ts
```

**验收标准**：
- 所有测试通过
- 无TypeScript编译错误
- 无ESLint错误

## 📊 进度追踪

### 任务分解

- [x] 分析现有代码和类型定义
- [x] 制定实施方案
- [ ] 阶段1：优化AnalysisAgent（AI识别层）
  - [ ] 新增5个Few-Shot示例
  - [ ] 优化AI提示词
  - [ ] 调整temperature参数
- [ ] 阶段2：优化PartyExtractor（算法兜底）
  - [ ] 扩展正则表达式规则
  - [ ] 增强过滤规则
- [ ] 阶段3：执行VerificationAgent三重验证
  - [ ] 增强PartyVerifier验证规则
  - [ ] 优化审查评分逻辑
- [ ] 阶段4：MemoryAgent错误学习
  - [ ] 记录错误模式
  - [ ] 生成学习报告
- [ ] 单元测试验证
- [ ] 更新任务追踪

## 📝 注意事项

1. **禁止创建新文件**：所有改进在原文件上进行
2. **代码行数限制**：文件≤200行，超过必须拆分
3. **类型安全**：禁止使用any类型，使用unknown替代
4. **测试要求**：测试通过率100%，覆盖率≥90%
5. **如实记录**：不得虚构完成度

## 📚 相关文档

- [PHASE3_IMPLEMENTATION.md](./PHASE3_IMPLEMENTATION.md)
- [PHASE3_AI_TASK_TRACKING.md](../PHASE3_AI_TASK_TRACKING.md)
- [AI_TYPE_SAFETY_GUIDE.md](../AI_TYPE_SAFETY_GUIDE.md)
