/**
 * 权限系统E2E测试 - RBAC功能测试
 */

import { test, expect } from '@playwright/test';
import {
  createTestUser,
  createTestCase,
  getTestCase,
  updateTestCase,
  deleteTestCase,
  isPermissionError,
} from './permission-helpers';

// =============================================================================
// 测试配置
// =============================================================================
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

// =============================================================================
// RBAC权限测试
// =============================================================================
test.describe('RBAC权限控制', () => {
  test('普通用户应该能够访问自己创建的资源', async ({ request }) => {
    const user = await createTestUser(request, 'USER');
    const testCase = await createTestCase(request, user.token);

    const response = await getTestCase(request, testCase.id, user.token);

    expect(isPermissionError(response)).toBe(false);
    expect(response.data?.id).toBe(testCase.id);
  });

  test('普通用户应该能够修改自己创建的资源', async ({ request }) => {
    const user = await createTestUser(request, 'USER');
    const testCase = await createTestCase(request, user.token);

    const response = await updateTestCase(request, testCase.id, user.token, {
      title: '更新的案件标题',
    });

    expect(isPermissionError(response)).toBe(false);
  });

  test('普通用户应该无法访问他人创建的资源', async ({ request }) => {
    const user1 = await createTestUser(request, 'USER');
    const user2 = await createTestUser(request, 'USER');
    const testCase = await createTestCase(request, user1.token);

    const response = await getTestCase(request, testCase.id, user2.token);

    expect(isPermissionError(response)).toBe(true);
  });

  test('普通用户应该无法修改他人创建的资源', async ({ request }) => {
    const user1 = await createTestUser(request, 'USER');
    const user2 = await createTestUser(request, 'USER');
    const testCase = await createTestCase(request, user1.token);

    const response = await updateTestCase(request, testCase.id, user2.token, {
      title: '未授权的更新',
    });

    expect(isPermissionError(response)).toBe(true);
  });

  test('普通用户应该无法删除他人创建的资源', async ({ request }) => {
    const user1 = await createTestUser(request, 'USER');
    const user2 = await createTestUser(request, 'USER');
    const testCase = await createTestCase(request, user1.token);

    const response = await deleteTestCase(request, testCase.id, user2.token);

    expect(response.status).toBe(403);
  });

  test('未登录用户应该无法访问需要权限的资源', async ({ request }) => {
    // 先创建一个有效的案件ID
    const user = await createTestUser(request, 'USER');
    const testCase = await createTestCase(request, user.token);

    // 使用无效token访问
    const invalidToken = 'invalid.token.here';
    const response = await request.get(
      `${BASE_URL}/api/v1/cases/${testCase.id}`,
      {
        headers: {
          Authorization: `Bearer ${invalidToken}`,
        },
      }
    );

    // 由于使用无效token，认证中间件会返回401
    expect(response.status()).toBe(401);
  });
});
