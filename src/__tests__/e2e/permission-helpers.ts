/**
 * 权限E2E测试辅助函数
 */

import type { APIRequestContext } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { hashPassword } from '@/lib/auth/password';
import { generateAccessToken } from '@/lib/auth/jwt';

// =============================================================================
// 测试基础URL
// =============================================================================
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

// =============================================================================
// 测试数据库连接
// =============================================================================
// 注意：这个函数只在测试环境使用，用于创建测试用户
let prismaClient: PrismaClient | null = null;

/**
 * 获取测试用的Prisma客户端
 */
function getTestPrismaClient(): PrismaClient {
  if (!prismaClient) {
    prismaClient = new PrismaClient({
      datasources: {
        db: {
          url: process.env.DATABASE_URL,
        },
      },
    });
  }
  return prismaClient;
}

// =============================================================================
// 测试数据类型定义
// =============================================================================

interface TestCaseData {
  id: string;
  title: string;
  userId: string;
}

interface PermissionTestUser {
  id: string;
  email: string;
  password: string;
  username: string;
  name: string;
  role: string;
  token: string;
}

interface PermissionResponseData {
  success?: boolean;
  error?: string;
  message?: string;
  data?: unknown;
}

interface ResourceResponseData {
  data?: {
    id: string;
    title?: string;
    userId?: string;
  };
  error?: string;
  message?: string;
}

// =============================================================================
// 测试辅助函数
// =============================================================================

/**
 * 创建测试用户
 * 注意：此函数使用数据库直接操作而非API注册，以便创建不同角色的测试用户
 */
export async function createTestUser(
  _apiContext: APIRequestContext,
  role: 'USER' | 'LAWYER' | 'ADMIN' | 'SUPER_ADMIN' = 'USER'
): Promise<PermissionTestUser> {
  const timestamp = Date.now();
  const shortId = String(timestamp).slice(-6);
  const email = `test-${timestamp}@example.com`;
  const password = 'TestPass123';
  const username = `test${shortId}`;
  const name = `TestUser${shortId}`;

  // 直接使用Prisma创建测试用户，这样可以设置任意角色
  const prisma = getTestPrismaClient();
  const hashedPassword = await hashPassword(password);

  const user = await prisma.user.create({
    data: {
      email,
      username,
      name,
      password: hashedPassword,
      role,
      status: 'ACTIVE',
    },
  });

  // 手动创建JWT token（为了测试需要）
  const token = generateAccessToken({
    userId: user.id,
    email: user.email,
    role: user.role,
  });

  return {
    id: user.id,
    email,
    password,
    username,
    name,
    role,
    token,
  };
}

/**
 * 创建测试案件
 */
export async function createTestCase(
  apiContext: APIRequestContext,
  token: string
): Promise<TestCaseData> {
  const timestamp = Date.now();
  const shortId = String(timestamp).slice(-6);

  const response = await apiContext.post(`${BASE_URL}/api/v1/cases`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    data: {
      title: `测试案件${shortId}`,
      description: '这是一个测试案件',
      type: 'civil',
      amount: '10000',
      plaintiffName: '原告姓名',
      defendantName: '被告姓名',
    },
  });

  const data = await response.json();

  return {
    id: data.data?.id || '',
    title: data.data?.title || '',
    userId: data.data?.userId || '',
  };
}

/**
 * 获取案件详情
 */
export async function getTestCase(
  apiContext: APIRequestContext,
  caseId: string,
  token: string
): Promise<ResourceResponseData> {
  const response = await apiContext.get(`${BASE_URL}/api/v1/cases/${caseId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return await response.json();
}

/**
 * 更新案件详情
 */
export async function updateTestCase(
  apiContext: APIRequestContext,
  caseId: string,
  token: string,
  updates: Partial<TestCaseData>
): Promise<ResourceResponseData> {
  const response = await apiContext.put(`${BASE_URL}/api/v1/cases/${caseId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    data: updates,
  });

  return await response.json();
}

/**
 * 删除案件
 */
export async function deleteTestCase(
  apiContext: APIRequestContext,
  caseId: string,
  token: string
): Promise<{ status: number; data?: ResourceResponseData }> {
  const response = await apiContext.delete(
    `${BASE_URL}/api/v1/cases/${caseId}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  let data: ResourceResponseData | undefined;
  try {
    data = await response.json();
  } catch {
    // 没有响应体（如204状态）
  }

  return { status: response.status(), data };
}

/**
 * 获取用户信息（管理员API）
 */
export async function getUserInfo(
  apiContext: APIRequestContext,
  userId: string,
  token: string
): Promise<PermissionResponseData> {
  const response = await apiContext.get(
    `${BASE_URL}/api/admin/users/${userId}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  return await response.json();
}

/**
 * 更新用户信息（管理员API）
 */
export async function updateUserInfo(
  apiContext: APIRequestContext,
  userId: string,
  token: string,
  updates: Partial<{ name: string; status: string }>
): Promise<PermissionResponseData> {
  const response = await apiContext.put(
    `${BASE_URL}/api/admin/users/${userId}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      data: updates,
    }
  );

  return await response.json();
}

/**
 * 删除用户（管理员API）
 */
export async function deleteUserInfo(
  apiContext: APIRequestContext,
  userId: string,
  token: string
): Promise<PermissionResponseData> {
  const response = await apiContext.delete(
    `${BASE_URL}/api/admin/users/${userId}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  return await response.json();
}

/**
 * 验证响应是否为权限错误
 * 返回true表示是权限错误，false表示不是权限错误
 */
export function isPermissionError(data: PermissionResponseData): boolean {
  const isError = data.error === '权限不足' || data.message?.includes('权限');
  return isError === true;
}

/**
 * 验证响应是否成功
 * 返回true表示响应成功，false表示响应失败
 */
export function isSuccessResponse(data: PermissionResponseData): boolean {
  // 检查是否没有错误且包含数据
  const hasNoError = data.error === undefined;
  const hasData = data.data !== undefined;
  return hasNoError === true && hasData === true;
}

/**
 * 等待指定时间
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 生成唯一的测试标识符
 */
export function generateTestPrefix(): string {
  return `test-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}
