# API 测试审计日志 Mock 规范

## 目的

为 API 测试建立统一约定，避免因为 `@/lib/audit/logger` 未完整 mock 而出现：

- 测试输出大量无意义错误日志
- 因 Prisma `actionLog` 未 mock 完整导致偶发报错
- 新增测试时重复补同类样板代码

当前项目已在 [src/**tests**/api/setup.js](/d:/legal_debate_mvp/src/__tests__/api/setup.js) 中统一静音审计日志层。

## 适用范围

适用于所有走 `src/__tests__/api/**` 的 API 测试，特别是以下场景：

- 调用 `createAuditLog`
- 调用 `logCreateAction`
- 调用 `logUpdateAction`
- 调用 `logDeleteAction`
- 调用 `logViewAction`
- 调用 `logAIAction`

## 默认规则

1. API 测试默认应依赖 `src/__tests__/api/setup.js` 中的统一 mock。
2. 新增 API 测试时，除非测试目标就是“验证审计日志调用行为”，否则不要在测试文件里重复 mock 审计日志。
3. 如果测试只关心业务响应，不应因为审计日志侧效果污染输出或导致失败。

## 当前统一 mock

公共 setup 已统一 mock：

```js
jest.mock('@/lib/audit/logger', () => ({
  createAuditLog: jest.fn().mockResolvedValue(undefined),
  logCreateAction: jest.fn().mockResolvedValue(undefined),
  logUpdateAction: jest.fn().mockResolvedValue(undefined),
  logDeleteAction: jest.fn().mockResolvedValue(undefined),
  logViewAction: jest.fn().mockResolvedValue(undefined),
  logAIAction: jest.fn().mockResolvedValue(undefined),
}));
```

含义：

- 审计日志调用不阻塞主流程
- 审计日志不向控制台输出噪音
- 新增 API 测试无需重复补这段样板代码

## 什么时候不要用公共 mock

当测试目标本身就是“验证审计日志被正确调用”时，不要依赖公共静音 mock，而应在测试文件中显式覆盖：

- 重新 mock `@/lib/audit/logger`
- 断言参数、调用次数、字段映射

推荐做法：

```ts
jest.mock('@/lib/audit/logger', () => ({
  createAuditLog: jest.fn().mockResolvedValue(undefined),
}));

import { createAuditLog } from '@/lib/audit/logger';

expect(createAuditLog).toHaveBeenCalledWith(
  expect.objectContaining({
    userId: 'user-1',
    actionCategory: 'ADMIN',
  })
);
```

## 新增 API 测试模板

建议新增 API 测试时遵守：

1. 优先 mock业务依赖，而不是审计依赖
2. 认证统一 mock `getAuthUser`
3. 权限统一 mock `validatePermissions`
4. 审计日志默认依赖公共 setup，不重复写

示例：

```ts
jest.mock('@/lib/middleware/auth', () => ({
  getAuthUser: jest.fn(),
}));

jest.mock('@/lib/middleware/permission-check', () => ({
  validatePermissions: jest.fn(),
}));

jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    someModel: {
      findMany: jest.fn(),
    },
  },
}));
```

## 风格约定

1. 认证失败断言优先断 `status`。
2. 错误对象优先写兼容型断言：

```ts
const errorCode =
  typeof data.error === 'string' ? data.error : data.error?.code;
expect(errorCode).toBe('UNAUTHORIZED');
```

3. 不再使用“整对象等值”去断言完整错误响应，除非该测试就是在锁定完整契约。

## 后续建议

1. `src/test-utils/setup.ts` 保持前端/组件测试职责，不混入 API 审计 mock。
2. 如果后续出现新的审计 helper，请同步加到 `src/__tests__/api/setup.js`。
3. 若未来要测试真实审计写库链路，应建立单独的 `audit integration` 测试，而不是污染普通 API 用例。
