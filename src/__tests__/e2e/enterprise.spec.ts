/**
 * 企业认证E2E测试
 * 测试企业注册、资质上传、审核等完整流程
 */

import type { APIRequestContext } from '@playwright/test';
import { test, expect } from '@playwright/test';
import { request as APIRequest } from '@playwright/test';
import {
  createTestUserAndLogin,
  adminLogin,
  generateTestEnterpriseData,
  generateTestBusinessLicense,
  registerEnterprise,
  getEnterpriseInfo,
  uploadBusinessLicense,
  reviewEnterprise,
} from './enterprise-helpers';

test.describe('企业认证E2E测试', () => {
  let apiContext: APIRequestContext;

  test.beforeAll(async () => {
    apiContext = await APIRequest.newContext();
  });

  test.afterAll(async () => {
    await apiContext.dispose();
  });

  // =============================================================================
  // 企业注册流程测试
  // =============================================================================

  test.describe('企业注册流程', () => {
    test('应该成功注册企业账号', async () => {
      const { token } = await createTestUserAndLogin(apiContext);
      const enterpriseData = generateTestEnterpriseData();

      const response = await registerEnterprise(
        apiContext,
        token,
        enterpriseData
      );
      const responseObj = response as {
        success: boolean;
        message: string;
        data?: { enterprise: { id: string; status: string } };
      };

      expect(responseObj.success).toBe(true);
      expect(responseObj.data?.enterprise.id).toBeDefined();
      expect(responseObj.data?.enterprise.status).toBe('PENDING');
    });

    test('应该拒绝重复的统一社会信用代码', async () => {
      const { token } = await createTestUserAndLogin(apiContext);
      const enterpriseData = generateTestEnterpriseData();

      // 第一次注册
      await registerEnterprise(apiContext, token, enterpriseData);

      // 尝试用相同的信用代码注册另一个企业
      const { token: token2 } = await createTestUserAndLogin(apiContext);
      const response = await registerEnterprise(
        apiContext,
        token2,
        enterpriseData
      );
      const responseObj = response as { success: boolean; message: string };

      expect(responseObj.success).toBe(false);
      expect(responseObj.message).toContain('已被注册');
    });

    test('应该拒绝无效的企业名称', async () => {
      const { token } = await createTestUserAndLogin(apiContext);
      const enterpriseData = generateTestEnterpriseData();
      enterpriseData.enterpriseName = 'A'; // 过短

      const response = await registerEnterprise(
        apiContext,
        token,
        enterpriseData
      );
      const responseObj = response as { success: boolean };

      expect(responseObj.success).toBe(false);
    });

    test('应该拒绝无效的统一社会信用代码', async () => {
      const { token } = await createTestUserAndLogin(apiContext);
      const enterpriseData = generateTestEnterpriseData();
      enterpriseData.creditCode = 'INVALID'; // 格式错误

      const response = await registerEnterprise(
        apiContext,
        token,
        enterpriseData
      );
      const responseObj = response as { success: boolean };

      expect(responseObj.success).toBe(false);
    });
  });

  // =============================================================================
  // 企业资质上传测试
  // =============================================================================

  test.describe('企业资质上传', () => {
    test('应该成功上传营业执照', async () => {
      const { token } = await createTestUserAndLogin(apiContext);
      const enterpriseData = generateTestEnterpriseData();
      await registerEnterprise(apiContext, token, enterpriseData);

      const licenseData = generateTestBusinessLicense();
      const response = await uploadBusinessLicense(apiContext, token, {
        businessLicense: licenseData,
      });
      const responseObj = response as unknown as {
        success: boolean;
        message: string;
        data?: { enterprise: { status: string } };
      };

      expect(responseObj.success).toBe(true);
      expect(responseObj.message).toContain('上传成功');
    });

    test('应该拒绝未注册用户上传资质', async () => {
      const { token } = await createTestUserAndLogin(apiContext);
      const licenseData = generateTestBusinessLicense();

      const response = await uploadBusinessLicense(apiContext, token, {
        businessLicense: licenseData,
      });
      const responseObj = response as { success: boolean; error?: string };

      expect(responseObj.success).toBe(false);
      expect(responseObj.error).toBe('NOT_FOUND');
    });

    test('应该拒绝非Base64格式的图片', async () => {
      const { token } = await createTestUserAndLogin(apiContext);
      const enterpriseData = generateTestEnterpriseData();
      await registerEnterprise(apiContext, token, enterpriseData);

      const response = await uploadBusinessLicense(apiContext, token, {
        businessLicense: 'not-a-base64-image',
      });
      const responseObj = response as { success: boolean };

      expect(responseObj.success).toBe(false);
    });
  });

  // =============================================================================
  // 企业信息查询测试
  // =============================================================================

  test.describe('企业信息查询', () => {
    test('应该获取企业账号信息', async () => {
      const { token } = await createTestUserAndLogin(apiContext);
      const enterpriseData = generateTestEnterpriseData();
      await registerEnterprise(apiContext, token, enterpriseData);

      const response = await getEnterpriseInfo(apiContext, token);
      const responseObj = response as {
        success: boolean;
        data?: { enterprise: { enterpriseName: string } };
      };

      expect(responseObj.success).toBe(true);
      expect(responseObj.data?.enterprise.enterpriseName).toBe(
        enterpriseData.enterpriseName
      );
    });

    test('应该拒绝未登录用户查询', async () => {
      const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
      const response = await apiContext.get(`${baseUrl}/api/enterprise/me`);
      const responseObj = (await response.json()) as {
        success: boolean;
        error?: string;
      };

      expect(responseObj.success).toBe(false);
      expect(responseObj.error).toBe('UNAUTHORIZED');
    });
  });

  // =============================================================================
  // 企业审核流程测试
  // =============================================================================

  test.describe('企业审核流程', () => {
    test('应该成功通过企业审核', async () => {
      const { token } = await createTestUserAndLogin(apiContext);
      const enterpriseData = generateTestEnterpriseData();
      await registerEnterprise(apiContext, token, enterpriseData);
      await uploadBusinessLicense(apiContext, token, {
        businessLicense: generateTestBusinessLicense(),
      });

      // 管理员登录并审核
      const { token: adminToken } = await adminLogin(apiContext);
      const enterpriseResponse = await getEnterpriseInfo(apiContext, token);
      const enterpriseId =
        (
          enterpriseResponse as unknown as {
            data?: { enterprise: { id: string } };
          }
        ).data?.enterprise.id || '';

      const reviewResponse = await reviewEnterprise(
        apiContext,
        adminToken,
        enterpriseId,
        {
          reviewAction: 'APPROVE',
          reviewNotes: '审核通过',
        }
      );

      const reviewResponseObj = reviewResponse as {
        success: boolean;
        message: string;
        data?: { status: string };
      };

      expect(reviewResponseObj.success).toBe(true);
      expect(reviewResponseObj.data?.status).toBe('APPROVED');
    });

    test('应该成功拒绝企业审核', async () => {
      const { token } = await createTestUserAndLogin(apiContext);
      const enterpriseData = generateTestEnterpriseData();
      await registerEnterprise(apiContext, token, enterpriseData);

      // 管理员登录并审核
      const { token: adminToken } = await adminLogin(apiContext);
      const enterpriseResponse = await getEnterpriseInfo(apiContext, token);
      const enterpriseId =
        (
          enterpriseResponse as unknown as {
            data?: { enterprise: { id: string } };
          }
        ).data?.enterprise.id || '';

      const reviewResponse = await reviewEnterprise(
        apiContext,
        adminToken,
        enterpriseId,
        {
          reviewAction: 'REJECT',
          reviewNotes: '企业信息不完整',
        }
      );

      const reviewResponseObj = reviewResponse as {
        success: boolean;
        message: string;
        data?: { status: string };
      };

      expect(reviewResponseObj.success).toBe(true);
      expect(reviewResponseObj.data?.status).toBe('REJECTED');
    });

    test('应该拒绝非管理员用户审核', async () => {
      const { token } = await createTestUserAndLogin(apiContext);
      const enterpriseData = generateTestEnterpriseData();
      await registerEnterprise(apiContext, token, enterpriseData);
      const enterpriseResponse = await getEnterpriseInfo(apiContext, token);
      const enterpriseId =
        (
          enterpriseResponse as unknown as {
            data?: { enterprise: { id: string } };
          }
        ).data?.enterprise.id || '';

      const reviewResponse = await reviewEnterprise(
        apiContext,
        token,
        enterpriseId,
        {
          reviewAction: 'APPROVE',
        }
      );

      const reviewResponseObj = reviewResponse as {
        success: boolean;
        error?: string;
      };

      expect(reviewResponseObj.success).toBe(false);
      expect(reviewResponseObj.error).toBe('FORBIDDEN');
    });
  });
});
