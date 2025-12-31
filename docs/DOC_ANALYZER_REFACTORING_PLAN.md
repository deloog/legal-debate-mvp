# DocAnalyzer模块化重构计划

## 📋 项目概述

### 背景

- `doc-analyzer-optimized.ts` 文件超过1500行，违反了项目最佳实践（max_lines_per_file: 200）
- 当准确率只有75%，响应时间16-91秒，远低于设计目标
- 需要实现混合架构（AI + 算法）和Reviewer审查机制

### 目标

1. 代码模块化：将1500行代码拆分为多个小模块
2. 提高准确率：从75% → 98%
3. 优化性能：响应时间从16-91秒 → 4-8秒
4. 建立审查机制：确保输出质量

## 🏗️ 新架构设计

### 目录结构

```
src/lib/agent/doc-analyzer/
├── index.ts                    # 主入口，导出DocAnalyzerAgent
├── core/
│   ├── types.ts              # 类型定义 ✅
│   └── constants.ts          # 常量定义 ✅
├── extractors/
│   ├── text-extractor.ts     # 文本提取器 ✅
│   ├── amount-extractor.ts   # 金额提取器 ✅
│   └── claim-extractor.ts   # 诉讼请求提取器 ✅
├── processors/
│   ├── ai-processor.ts      # AI处理逻辑 ✅
│   ├── rule-processor.ts    # 规则后处理器 ✅
│   └── cache-processor.ts  # 缓存处理器 ✅
├── validators/
│   ├── input-validator.ts   # 输入验证 ✅
│   ├── quality-validator.ts # 质量验证 ✅
│   └── role-validator.ts   # 角色验证 ✅
├── utils/
│   ├── prompt-builder.ts    # 提示词构建器 ⏳
│   ├── text-utils.ts       # 文本处理工具 ⏳
│   └── logger-utils.ts     # 日志工具 ⏳
├── __tests__/
│   ├── amount-extractor.test.ts ✅
│   └── claim-extractor.test.ts ✅
└── reviewers/              # 新增：审查机制
    ├── reviewer-manager.ts  # 审查管理器 ⏳
    ├── ai-reviewer.ts      # AI审查器 ⏳
    └── rule-reviewer.ts    # 规则审查器 ⏳
```

### 四层处理架构（混合架构）

```
第一层：快速过滤（算法，<10ms）
├─ OCR文本质量检查
├─ 文档类型分类
└─ 基础格式校验

第二层：AI核心理解（AI，2-5秒）
├─ 当事人角色识别
├─ 诉讼请求分类
├─ 金额模糊识别
└─ 语义关系抽取

第三层：规则验证（算法，<100ms）
├─ 强制补充LITIGATION_COST
├─ 复合请求二次拆解
├─ 金额格式标准化
├─ 当事人去重与验证
└─ 一致性检查

第四层：缓存（算法 + 存储，<10ms）
├─ Redis缓存命中
├─ 异步写入
└─ TTL管理
```

### Reviewer审查流程

```
1. AI初步分析 → 2. 规则后处理 → 3. Reviewer审查 → 4. 最终输出
```

## ✅ 已完成的工作

### 1. 核心类型定义

- **文件**: `src/lib/agent/doc-analyzer/core/types.ts`
- **内容**:
  - 输入输出类型定义
  - AI响应类型
  - 后处理类型
  - 审查类型
  - 配置类型
  - 缓存类型

### 2. 常量定义

- **文件**: `src/lib/agent/doc-analyzer/core/constants.ts`
- **内容**:
  - 默认配置
  - 诉讼请求类型映射
  - 中文数字映射
  - 缓存TTL映射
  - 后处理规则
  - 当事人角色识别标志
  - 质量验证规则
  - 典型案例示例
  - 错误和日志消息

### 3. 文本提取器

- **文件**: `src/lib/agent/doc-analyzer/extractors/text-extractor.ts`
- **功能**:
  - 支持PDF/DOCX/DOC/TXT/IMAGE格式
  - OCR文本识别
  - 文本分块处理
  - 词数统计
  - 文件大小获取

## ⏳ 待完成的工作

### 阶段1：核心提取器（优先级：高）✅

- [x] 创建金额提取器 (`amount-extractor.ts`)
  - 支持阿拉伯数字、中文大写、混合格式
  - 万元单位转换
  - 金额合理性验证
  - 去重和置信度评估
  - 完整单元测试（20个测试用例）
- [x] 创建诉讼请求提取器 (`claim-extractor.ts`)
  - 支持多种诉讼请求类型识别
  - 复合请求拆解
  - 智能推断缺失类型（诉讼费用、本金等）
  - 类型标准化
  - 完整单元测试（16个测试用例）

### 阶段2：处理器模块（优先级：高）

- [x] 创建AI处理器 (`ai-processor.ts`) ✅ 2025-12-25
- [x] 创建规则处理器 (`rule-processor.ts`) ✅ 2025-12-25
- [x] 创建缓存处理器 (`cache-processor.ts`) ✅ 2025-12-25

### 阶段3：验证器模块（优先级：中）

- [x] 创建输入验证器 (`input-validator.ts`) ✅ 2025-12-25
- [x] 创建质量验证器 (`quality-validator.ts`) ✅ 2025-12-25
- [x] 创建角色验证器 (`role-validator.ts`) ✅ 2025-12-25

### 阶段4：工具模块（优先级：中）✅

- [x] 创建提示词构建器 (`prompt-builder.ts`) ✅ 2025-12-25
- [x] 创建文本处理工具 (`text-utils.ts`) ✅ 2025-12-25
- [x] 创建日志工具 (`logger-utils.ts`) ✅ 2025-12-25

### 阶段5：Reviewer模块（优先级：高） ✅ 2025-12-25

- [x] 创建审查管理器 (`reviewer-manager.ts`) ✅
- [x] 创建AI审查器 (`ai-reviewer.ts`) ✅
- [x] 创建规则审查器 (`rule-reviewer.ts`) ✅

### 阶段6：主Agent类（优先级：高）✅ 2025-12-25

- [x] 创建DocAnalyzerAgent主类 (`doc-analyzer-agent.ts`) ✅
- [x] 集成所有模块 ✅
- [x] 实现四层处理架构 ✅
- [x] 实现Reviewer审查流程 ✅

### 阶段7：测试和优化（优先级：高）✅ 2025-12-25

- [x] 编写单元测试（验证器模块：input-validator, quality-validator, role-validator）✅
- [x] Bad Case回归测试（诉讼费用遗漏、复合请求拆解等6个案例）✅
- [x] 模块化完整测试套件（12个测试套件，210个测试用例全部通过）✅
- [x] 修复法定代表人过滤功能（rule-processor.ts中添加filterLegalRepresentatives）✅
- [x] 清理旧代码（删除doc-analyzer-optimized.ts）✅
- [x] 更新测试引用（doc-analyzer.test.ts和document-accuracy.test.ts改为使用DocAnalyzerAgent）✅
- [x] 编写集成测试（端到端测试：doc-analyzer-integration.test.ts，11个测试用例）✅
- [x] 编写性能测试（响应时间基准测试：doc-analyzer-performance.test.ts，6个测试用例）✅
- [x] 扩展Bad Case测试（金额识别16个、诉讼请求识别12个测试用例）✅

**重要说明**：

1. **单元测试状态**：所有12个测试套件共210个测试用例全部通过
2. **Bad Case测试**：6个回归测试全部通过，包括：
   - LITIGATION_COST遗漏修复
   - 复合请求拆解
   - 法定代表人过滤
3. **集成测试**：端到端测试已创建，测试完整流程、四层架构、Reviewer审查等
4. **性能测试**：首次分析、缓存、并发、性能基准等测试已创建
5. **Bad Case扩展**：金额识别和诉讼请求识别Bad Case测试库已扩展
6. **代码规范**：所有新文件符合max_lines_per_file: 200的限制

## 📊 预期效果

| 指标             | 当前    | 目标      | 提升     |
| ---------------- | ------- | --------- | -------- |
| 当事人信息准确率 | 90%     | ≥98%      | +8%      |
| 诉讼请求准确率   | 75%     | ≥95%      | +20%     |
| 金额识别精度     | 75%     | ≥99%      | +24%     |
| AI响应时间       | 16-91秒 | <5秒      | 80%+     |
| 缓存命中率       | 0%      | >70%      | +70%     |
| 代码行数         | 1500+   | <200/模块 | 符合规范 |

## 🔄 迁移策略

### 阶段性迁移

1. **第一阶段**：创建新模块，保持旧代码不变
2. **第二阶段**：逐步将功能迁移到新模块
3. **第三阶段**：更新API调用点，使用新模块
4. **第四阶段**：删除旧代码
5. **第五阶段**：测试和优化

### 向后兼容性

- 保持现有的API接口不变
- 通过适配器模式兼容旧接口
- 渐进式迁移，降低风险

## 🚀 实施时间表

### Week 1: 核心模块开发

- Day 1-2: 提取器和处理器模块
- Day 3-4: 验证器和工具模块
- Day 5: Reviewer模块

### Week 2: 集成和测试

- Day 1-2: 主Agent类和集成
- Day 3-4: 测试编写和执行
- Day 5: 性能优化和Bug修复

### Week 3: 部署和监控

- Day 1-2: 灰度发布
- Day 3-4: 监控和问题修复
- Day 5: 全面发布

## 📝 注意事项

### 代码规范

- 遵循项目现有的代码风格（单引号、2空格缩进）
- 避免使用默认导出，优先使用命名导出
- 使用 TypeScript 类型定义而非 JSDoc 注释
- 每个文件不超过200行

### 测试要求

- 每个模块都需要单元测试
- 关键路径需要集成测试
- 性能测试确保响应时间达标
- Bad Case回归测试确保准确率

### 文档要求

- 更新 API 文档（如有变更）
- 记录优化效果和经验教训
- 更新 `docs/AI_TASK_TRACKING.md`

---

_文档版本：v1.2_  
_创建时间：2025-12-25_  
_最后更新：2025-12-25_  
_状态：进行中（阶段4工具模块已完成）_
