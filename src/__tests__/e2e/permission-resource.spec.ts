/**
 * 权限系统E2E测试 - 资源所有权测试
 */

import { test, expect } from '@playwright/test';
import {
  createTestUser,
  createTestCase,
  getTestCase,
  updateTestCase,
  deleteTestCase,
  isPermissionError,
  isSuccessResponse,
} from './permission-helpers';

// =============================================================================
// 资源所有权测试
// =============================================================================
test.describe('资源所有权控制', () => {
  test('用户应该能够访问自己创建的案件', async ({ request }) => {
    const user = await createTestUser(request, 'USER');
    const testCase = await createTestCase(request, user.token);

    const response = await getTestCase(request, testCase.id, user.token);

    expect(isSuccessResponse(response)).toBe(true);
    expect(response.data?.id).toBe(testCase.id);
  });

  test('用户应该能够更新自己创建的案件', async ({ request }) => {
    const user = await createTestUser(request, 'USER');
    const testCase = await createTestCase(request, user.token);

    const response = await updateTestCase(request, testCase.id, user.token, {
      title: '更新的案件标题',
    });

    expect(isSuccessResponse(response)).toBe(true);
  });

  test('用户应该能够删除自己创建的案件', async ({ request }) => {
    const user = await createTestUser(request, 'USER');
    const testCase = await createTestCase(request, user.token);

    const response = await deleteTestCase(request, testCase.id, user.token);

    expect(response.status).toBe(204);
  });

  test('用户应该无法访问他人创建的案件', async ({ request }) => {
    const user1 = await createTestUser(request, 'USER');
    const user2 = await createTestUser(request, 'USER');
    const testCase = await createTestCase(request, user1.token);

    const response = await getTestCase(request, testCase.id, user2.token);

    expect(isPermissionError(response)).toBe(true);
  });

  test('用户应该无法更新他人创建的案件', async ({ request }) => {
    const user1 = await createTestUser(request, 'USER');
    const user2 = await createTestUser(request, 'USER');
    const testCase = await createTestCase(request, user1.token);

    const response = await updateTestCase(request, testCase.id, user2.token, {
      title: '未授权的更新',
    });

    expect(isPermissionError(response)).toBe(true);
  });

  test('用户应该无法删除他人创建的案件', async ({ request }) => {
    const user1 = await createTestUser(request, 'USER');
    const user2 = await createTestUser(request, 'USER');
    const testCase = await createTestCase(request, user1.token);

    const response = await deleteTestCase(request, testCase.id, user2.token);

    expect(response.status).toBe(403);
  });

  test('管理员应该能够访问所有案件', async ({ request }) => {
    const admin = await createTestUser(request, 'ADMIN');
    const user = await createTestUser(request, 'USER');
    const testCase = await createTestCase(request, user.token);

    const response = await getTestCase(request, testCase.id, admin.token);

    expect(isSuccessResponse(response)).toBe(true);
  });

  test('管理员应该能够更新所有案件', async ({ request }) => {
    const admin = await createTestUser(request, 'ADMIN');
    const user = await createTestUser(request, 'USER');
    const testCase = await createTestCase(request, user.token);

    const response = await updateTestCase(request, testCase.id, admin.token, {
      title: '管理员更新的案件',
    });

    expect(isSuccessResponse(response)).toBe(true);
  });
});
