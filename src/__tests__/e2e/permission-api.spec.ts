/**
 * 权限系统E2E测试 - API权限控制测试
 *
 * 注意：这些测试针对管理员API（/api/admin/users/），但该API目前不存在
 * 根据PERMISSION_SYSTEM_TEST_REPORT.md，管理员API不在任务8范围内
 * 因此这些测试被跳过，待管理员API实现后再启用
 */

import { test, expect } from '@playwright/test';
import {
  createTestUser,
  getUserInfo,
  updateUserInfo,
  deleteUserInfo,
  isPermissionError,
} from './permission-helpers';

// =============================================================================
// API权限控制测试
// =============================================================================
test.describe('API权限控制（管理员API - 未实现）', () => {
  // 注意：管理员API（/api/admin/users/）当前不存在，以下测试全部跳过
  // 待管理员API实现后，移除test.skip即可启用测试

  test.skip('user:read权限应该能够查看用户信息', async ({ request }) => {
    const admin = await createTestUser(request, 'ADMIN');
    const user = await createTestUser(request, 'USER');

    const response = await getUserInfo(request, user.id, admin.token);

    expect(response.error).toBeUndefined();
  });

  test.skip('没有user:read权限应该无法查看用户信息', async ({ request }) => {
    const user1 = await createTestUser(request, 'USER');
    const user2 = await createTestUser(request, 'USER');

    const response = await getUserInfo(request, user2.id, user1.token);

    expect(isPermissionError(response)).toBe(true);
  });

  test.skip('user:update权限应该能够更新用户信息', async ({ request }) => {
    const admin = await createTestUser(request, 'ADMIN');
    const user = await createTestUser(request, 'USER');

    const response = await updateUserInfo(request, user.id, admin.token, {
      name: '更新的名称',
    });

    expect(response.error).toBeUndefined();
  });

  test.skip('没有user:update权限应该无法更新用户信息', async ({ request }) => {
    const user1 = await createTestUser(request, 'USER');
    const user2 = await createTestUser(request, 'USER');

    const response = await updateUserInfo(request, user2.id, user1.token, {
      name: '未授权的更新',
    });

    expect(isPermissionError(response)).toBe(true);
  });

  test.skip('user:delete权限应该能够删除用户', async ({ request }) => {
    const admin = await createTestUser(request, 'ADMIN');
    const user = await createTestUser(request, 'USER');

    const response = await deleteUserInfo(request, user.id, admin.token);

    expect(response.error).toBeUndefined();
  });

  test.skip('没有user:delete权限应该无法删除用户', async ({ request }) => {
    const user1 = await createTestUser(request, 'USER');
    const user2 = await createTestUser(request, 'USER');

    const response = await deleteUserInfo(request, user2.id, user1.token);

    expect(response.error).toBe('权限不足');
  });

  test.skip('权限不足应该返回403状态码', async ({ request }) => {
    const user1 = await createTestUser(request, 'USER');
    const user2 = await createTestUser(request, 'USER');

    const response = await request.get(
      `${process.env.BASE_URL}/api/admin/users/${user2.id}`,
      {
        headers: {
          Authorization: `Bearer ${user1.token}`,
        },
      }
    );

    expect(response.status()).toBe(403);
  });

  test.skip('未认证请求应该返回401状态码', async ({ request }) => {
    const response = await request.get(
      `${process.env.BASE_URL}/api/admin/users/some-id`
    );

    expect(response.status()).toBe(401);
  });
});
