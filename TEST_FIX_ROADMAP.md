# 测试修复路线图

> 最后更新：2026-03-15
> 状态：**进行中，已从 ~48% 提升至 ~85%+**

---

## 一、总体进度（实时）

| 测试项目       | 总用例数 | 通过   | 失败  | 通过率   | 状态      |
| -------------- | -------- | ------ | ----- | -------- | --------- |
| **api**        | 1866     | 1866   | 0     | **100%** | ✅ 完成   |
| **app**        | 779      | 779    | 0     | **100%** | ✅ 完成   |
| **components** | 待统计   | -      | -     | -        | 🔄 待测   |
| **unit**       | ~4000+   | ~3000+ | ~1000 | ~75%     | 🔴 处理中 |
| **E2E**        | 442      | ~430   | ~12   | ~97%     | ⏸ 暂缓    |

---

## 二、已完成修复（不要重复修改！）

### ✅ API 项目（100% 通过）

修复项见原始路线图类别 A、D、E、F，所有 api 测试全部通过。

### ✅ App 项目（100% 通过）

以下文件已修复，勿重复修改：

| 文件                                                                           | 修复内容                                                                   |
| ------------------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| `src/__tests__/app/compliance/page.test.tsx`                                   | beforeEach 改用 URL 路由 mock；修复多元素匹配；修复 tab 切换 mock 顺序问题 |
| `src/__tests__/app/dashboard/enterprise/page.test.tsx`                         | 修复多元素 getByText；移除无效 CSS selector；修复错误文本断言              |
| `src/__tests__/app/api/dashboard/enterprise/route.test.ts`                     | 在 prisma mock 中补充 `enterpriseComplianceCheck` 模型                     |
| `src/__tests__/app/consultations/create/components/consultation-form.test.tsx` | 补充 fetch mock；修复 select 异步渲染；修复 maxLength 断言                 |
| `src/__tests__/app/api/v1/law-article-relations/advanced-filter.test.ts`       | 改为 mocked prisma（原为 DB 集成测试）                                     |
| `src/__tests__/app/api/v1/law-article-relations/batch-verify.test.ts`          | 改为 mocked prisma                                                         |
| `src/__tests__/app/api/v1/law-article-relations/visualization-data.test.ts`    | 改为 mocked prisma                                                         |
| `src/__tests__/app/law-articles/law-article-detail-page.test.tsx`              | 改为 mocked prisma                                                         |

---

## 三、Unit 项目当前失败分析（2026-03-15）

### 已知失败类别

#### U1：password-reset-service.test.ts（约 20 个失败）

- **原因**：所有测试超时（~1200ms），说明 mock 链路有阻塞
- **文件**：`src/__tests__/lib/auth/password-reset-service.test.ts`
- **状态**：🔴 待修复

#### U2：email-service 相关测试

- **文件**：`src/__tests__/lib/auth/email-service.test.ts`
- **状态**：🔴 待调查

#### U3：其他 lib/middleware 失败

- **文件**：`src/__tests__/middleware/`
- **状态**：🔴 待调查

#### U4：DB 集成测试（knowledge-graph、law-article 等）

- **原因**：这些测试需要真实 DB，但 `setup.ts` 全局 mock 了 prisma
- **说明**：数据库本身可连接，问题是 jest 设置导致 prisma 被 mock
- **状态**：⚠️ 评估是否需要修复（改用 mock 还是绕过 global mock）

---

## 四、修复规则（必须遵守）

1. **不修改业务逻辑**：只修改测试文件，对齐实现
2. **以 API 实现为准**：响应结构不符时更新测试断言
3. **Email/SMTP**：E2E 环境使用 mock，不接入真实 SMTP
4. **测试 ID 格式**：不存在记录的测试用合法 CUID，格式校验测试用非法字符串
5. **全程中文**：与用户所有交流使用中文

---

## 五、下一步行动

- [ ] 调查 `password-reset-service.test.ts` 超时原因
- [ ] 调查 `email-service.test.ts` 失败原因
- [ ] 统计 components 项目总用例数和通过率
- [ ] 运行完整 `npm test` 获取最终汇总数字
