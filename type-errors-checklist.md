# TypeScript 类型错误修复清单

**总计：93个错误**
**生成时间：2026-02-11**

---

## 📊 错误统计

| 类别 | 数量 | 进度 |
|------|------|------|
| Jest DOM Matcher 类型错误 | 31 | ⬜ 0/31 |
| Fetch Mock 类型错误 | 2 | ⬜ 0/2 |
| Reminder 类型错误 | 30 | ⬜ 0/30 |
| Case Status Monitor 参数错误 | 3 | ⬜ 0/3 |
| Membership 权限配置类型错误 | 25 | ⬜ 0/25 |
| Task 类型错误 | 4 | ⬜ 0/4 |
| Usage 类型错误 | 2 | ⬜ 0/2 |

---

## 📝 详细错误清单

### 1️⃣ Jest DOM Matcher 类型错误 (31个)

**问题描述：** Jest DOM matchers (toBeInTheDocument, toBeDisabled, toHaveClass) 类型声明未被正确识别

**影响文件：**
- `src/__tests__/components/feedback/RecommendationFeedbackButton.test.tsx`
- `src/__tests__/components/feedback/RelationFeedbackButton.test.tsx`

**修复策略：** 需要更新全局类型声明，确保 @testing-library/jest-dom 的类型被正确导入

#### RecommendationFeedbackButton.test.tsx (13个错误)

- [ ] **错误1** (行31): toBeInTheDocument 不存在
- [ ] **错误2** (行32): toBeInTheDocument 不存在
- [ ] **错误3** (行33): toBeInTheDocument 不存在
- [ ] **错误4** (行115): toBeInTheDocument 不存在
- [ ] **错误5** (行131): toBeInTheDocument 不存在
- [ ] **错误6** (行156): toBeDisabled 不存在
- [ ] **错误7** (行159): toBeDisabled 不存在
- [ ] **错误8** (行176): toBeInTheDocument 不存在
- [ ] **错误9** (行207): toHaveClass 不存在
- [ ] **错误10** (行220): toBeInTheDocument 不存在
- [ ] **错误11** (行230): toHaveClass 不存在
- [ ] **错误12** (行237): toBeDisabled 不存在
- [ ] **错误13** (行138): fetch mock Promise<unknown> 类型错误

#### RelationFeedbackButton.test.tsx (18个错误)

- [ ] **错误14** (行39): toBeInTheDocument 不存在
- [ ] **错误15** (行40): toBeInTheDocument 不存在
- [ ] **错误16** (行41): toBeInTheDocument 不存在
- [ ] **错误17** (行96): toBeInTheDocument 不存在
- [ ] **错误18** (行112): toBeInTheDocument 不存在
- [ ] **错误19** (行144): toBeInTheDocument 不存在
- [ ] **错误20** (行160): toBeInTheDocument 不存在
- [ ] **错误21** (行185): toBeDisabled 不存在
- [ ] **错误22** (行188): toBeDisabled 不存在
- [ ] **错误23** (行205): toBeInTheDocument 不存在
- [ ] **错误24** (行236): toHaveClass 不存在
- [ ] **错误25** (行249): toBeInTheDocument 不存在
- [ ] **错误26** (行257): toHaveClass 不存在
- [ ] **错误27** (行264): toBeDisabled 不存在
- [ ] **错误28** (行274): toBeInTheDocument 不存在
- [ ] **错误29** (行275): toBeInTheDocument 不存在
- [ ] **错误30** (行276): toBeInTheDocument 不存在
- [ ] **错误31** (行167): fetch mock Promise<unknown> 类型错误

---

### 2️⃣ Reminder 类型错误 (30个)

**问题描述：** Reminder 类型定义与实际使用不匹配，缺少必需属性，类型不正确

**影响文件：**
- `src/__tests__/components/reminder/ReminderList.test.tsx`
- `src/__tests__/components/reminder/ReminderSettings.test.tsx`
- `src/__tests__/lib/notification/reminder/reminder-service.test.ts`

**修复策略：** 需要检查 Reminder 类型定义，补充缺少的属性或修改测试数据

#### ReminderList.test.tsx (3个错误)

- [ ] **错误32** (行23): Reminder 缺少 content, scheduledAt, channel, sentAt 属性
- [ ] **错误33** (行38): Reminder 缺少 content, scheduledAt, channel, sentAt 属性
- [ ] **错误34** (行41): ReminderType.DEADLINE 不存在

#### ReminderSettings.test.tsx (4个错误)

- [ ] **错误35** (行14): ReminderSettings 缺少 advanceDays 属性
- [ ] **错误36** (行19): ReminderSettings 缺少 advanceDays 属性
- [ ] **错误37** (行24): ReminderSettings 缺少 autoRemind 属性
- [ ] **错误38** (行29): ReminderSettings 缺少 priorities 属性

#### reminder-service.test.ts (23个错误)

- [ ] **错误39** (行90): CreateReminderInput 类型不匹配
- [ ] **错误40** (行109): CreateReminderInput 类型不匹配
- [ ] **错误41** (行130): id 类型错误 - number vs string
- [ ] **错误42** (行131): id 类型错误 - number vs string
- [ ] **错误43** (行149): id 类型错误 - number vs string
- [ ] **错误44** (行150): id 类型错误 - number vs string
- [ ] **错误45** (行315): ReminderSettings 缺少 advanceDays 属性
- [ ] **错误46** (行320): ReminderSettings 缺少 advanceDays 属性
- [ ] **错误47** (行325): ReminderSettings 缺少 autoRemind 属性
- [ ] **错误48** (行330): ReminderSettings 缺少 priorities 属性
- [ ] **错误49** (行354): 参数数量错误 - 期望5-6个，实际4个
- [ ] **错误50** (行368): ReminderGenerator.getDefaultPreferences 方法不存在
- [ ] **错误51** (行382): ReminderSettings 缺少 advanceDays 属性
- [ ] **错误52** (行389): ReminderGenerator.mergePreferences 方法不存在
- [ ] **错误53** (行431): Reminder 类型参数不匹配
- [ ] **错误54** (行441): Reminder 类型参数不匹配
- [ ] **错误55** (行455): Reminder 类型参数不匹配
- [ ] **错误56** (行470): Reminder 缺少 content, scheduledAt, channel, sentAt 属性
- [ ] **错误57** (行471): Reminder 缺少 content, scheduledAt, channel, sentAt 属性
- [ ] **错误58** (行486): Reminder 缺少 content, scheduledAt, channel, sentAt 属性

---

### 3️⃣ Case Status Monitor 参数错误 (3个)

**问题描述：** case-status-monitor 函数调用参数数量错误

**影响文件：** `src/__tests__/lib/case/case-status-monitor.test.ts`

**修复策略：** 检查函数签名，调整参数数量从5个改为3-4个

- [ ] **错误59** (行284): 期望3-4个参数，实际5个
- [ ] **错误60** (行304): 期望3-4个参数，实际5个
- [ ] **错误61** (行322): 期望3-4个参数，实际5个

---

### 4️⃣ Membership 权限配置类型错误 (25个)

**问题描述：** MembershipPermissionConfig 类型缺少多个权限属性

**影响文件：**
- `src/__tests__/prisma/seed-membership-integrity.test.ts`
- `src/__tests__/prisma/seed-membership-permissions.test.ts`

**修复策略：** 检查 MembershipPermissionConfig 类型定义，补充缺失的属性或移除测试中的无效断言

**缺失属性：**
- canUseAdvancedFeatures
- canUseBatchProcessing
- canUseDeepSeek
- canUseZhipuAI
- canUseCustomModel
- prioritySupport
- dedicatedSupport

#### seed-membership-integrity.test.ts (8个错误)

- [ ] **错误62** (行85): canUseAdvancedFeatures 属性不存在
- [ ] **错误63** (行87): canUseBatchProcessing 属性不存在
- [ ] **错误64** (行88): canUseDeepSeek 属性不存在
- [ ] **错误65** (行89): canUseZhipuAI 属性不存在
- [ ] **错误66** (行90): canUseCustomModel 属性不存在
- [ ] **错误67** (行91): prioritySupport 属性不存在
- [ ] **错误68** (行92): dedicatedSupport 属性不存在

#### seed-membership-permissions.test.ts (17个错误)

- [ ] **错误69** (行29): canUseAdvancedFeatures 属性不存在
- [ ] **错误70** (行31): canUseBatchProcessing 属性不存在
- [ ] **错误71** (行32): prioritySupport 属性不存在
- [ ] **错误72** (行33): dedicatedSupport 属性不存在
- [ ] **错误73** (行47): canUseAdvancedFeatures 属性不存在
- [ ] **错误74** (行49): canUseBatchProcessing 属性不存在
- [ ] **错误75** (行50): prioritySupport 属性不存在
- [ ] **错误76** (行51): dedicatedSupport 属性不存在
- [ ] **错误77** (行65): canUseAdvancedFeatures 属性不存在
- [ ] **错误78** (行67): canUseBatchProcessing 属性不存在
- [ ] **错误79** (行68): canUseCustomModel 属性不存在
- [ ] **错误80** (行69): prioritySupport 属性不存在
- [ ] **错误81** (行70): dedicatedSupport 属性不存在
- [ ] **错误82** (行84): canUseAdvancedFeatures 属性不存在
- [ ] **错误83** (行86): canUseBatchProcessing 属性不存在
- [ ] **错误84** (行87): canUseCustomModel 属性不存在
- [ ] **错误85** (行88): prioritySupport 属性不存在
- [ ] **错误86** (行89): dedicatedSupport 属性不存在

---

### 5️⃣ Task 类型错误 (4个)

**问题描述：** CreateTaskInput 缺少必需的 type 属性

**影响文件：** `src/__tests__/types/task.test.ts`

**修复策略：** 为测试对象添加 type 属性或使用 as any 断言

- [ ] **错误87** (行138): CreateTaskInput 缺少 type 属性
- [ ] **错误88** (行151): CreateTaskInput 缺少 type 属性
- [ ] **错误89** (行170): CreateTaskInput 参数类型不匹配
- [ ] **错误90** (行185): CreateTaskInput 参数类型不匹配

---

### 6️⃣ Usage 类型错误 (2个)

**问题描述：** Usage 测试对象缺少 tier 和 limits 属性

**影响文件：** `src/__tests__/usage/record-usage.test.ts`

**修复策略：** 检查类型定义，补充缺失属性

- [ ] **错误91** (行371): tier 属性不存在
- [ ] **错误92** (行372): limits 属性不存在

---

## 🔧 修复计划

### 阶段1: 类型声明文件修复 (优先级：高)
1. 修复 Jest DOM matchers 类型声明
2. 检查并修复 Reminder 类型定义
3. 检查并修复 MembershipPermissionConfig 类型定义

### 阶段2: 测试文件修复 (优先级：中)
1. 修复 Feedback 组件测试文件
2. 修复 Reminder 相关测试文件
3. 修复 Case Status Monitor 测试文件
4. 修复 Membership 测试文件
5. 修复 Task 测试文件
6. 修复 Usage 测试文件

### 阶段3: 验证 (优先级：高)
1. 运行 `npm run type-check` 验证所有错误已修复
2. 确保没有新的类型错误引入

---

## 📌 注意事项

1. **批量修复优先：** 对于同类错误（如 Jest DOM matchers），优先进行批量修复
2. **类型定义优先：** 先修复类型定义文件，再修复测试文件
3. **增量验证：** 每修复一个类别后，立即运行 type-check 验证
4. **保持一致性：** 确保修复方案与现有代码风格一致

---

**最后更新：** 2026-02-11
**修复进度：** 0/93 (0%)
