/**
 * 用户详情API - 管理员专用
 * 支持获取、更新、删除用户
 */

import { prisma } from '@/lib/db/prisma';
import { getAuthUser } from '@/lib/middleware/auth';
import { validatePermissions } from '@/lib/middleware/permission-check';
import {
  UpdateUserRequest,
  UserDetailResponse,
  UserStatistics,
} from '@/types/admin-user';
import { UserRole, UserStatus } from '@/types/auth';
import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import bcrypt from 'bcryptjs';
import {
  canManagePrivilegedRole,
  getFreshUserRole,
  requiresSuperAdminForUserRoleChange,
} from '@/lib/admin/role-security';

/**
 * 验证用户ID格式
 */
function isValidUserId(id: string): boolean {
  return id.length > 0 && /^[a-zA-Z0-9_-]+$/.test(id);
}

function isValidRole(role: string): role is UserRole {
  const validRoles: UserRole[] = [
    UserRole.USER,
    UserRole.LAWYER,
    UserRole.ENTERPRISE,
    UserRole.ADMIN,
    UserRole.SUPER_ADMIN,
  ];
  return validRoles.includes(role as UserRole);
}

/**
 * 验证状态枚举值
 */
function isValidStatus(status: string): status is UserStatus {
  const validStatuses: UserStatus[] = [
    UserStatus.ACTIVE,
    UserStatus.SUSPENDED,
    UserStatus.BANNED,
    UserStatus.INACTIVE,
  ];
  return validStatuses.includes(status as UserStatus);
}

/**
 * 获取用户统计信息
 */
async function getUserStatistics(userId: string): Promise<UserStatistics> {
  const [casesCount, debatesCount, documentsCount] = await Promise.all([
    prisma.case.count({
      where: { userId, deletedAt: null },
    }),
    prisma.debate.count({
      where: { userId, deletedAt: null },
    }),
    prisma.document.count({
      where: { userId, deletedAt: null },
    }),
  ]);

  return { casesCount, debatesCount, documentsCount };
}

// =============================================================================
// API处理函数
// =============================================================================

/**
 * GET /api/admin/users/[id]
 * 获取用户详细信息（管理员权限）
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  // 验证用户身份
  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json(
      { error: '未认证', message: '请先登录' },
      { status: 401 }
    ) as unknown as NextResponse;
  }

  // 检查权限
  const permissionError = await validatePermissions(request, 'user:read');
  if (permissionError) {
    return permissionError;
  }

  const userId = (await params).id;

  // 验证用户ID
  if (!isValidUserId(userId)) {
    return NextResponse.json(
      { error: '无效参数', message: '用户ID格式不正确' },
      { status: 400 }
    ) as unknown as NextResponse;
  }

  try {
    // 查询用户基本信息
    const userData = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        username: true,
        name: true,
        role: true,
        status: true,
        phone: true,
        address: true,
        bio: true,
        avatar: true,
        createdAt: true,
        updatedAt: true,
        lastLoginAt: true,
        loginCount: true,
        emailVerified: true,
      },
    });

    if (!userData) {
      return NextResponse.json(
        { error: '未找到', message: '用户不存在' },
        { status: 404 }
      ) as unknown as NextResponse;
    }

    // 查询律师资格认证
    const lawyerQualification = await prisma.lawyerQualification.findFirst({
      where: { userId },
      select: {
        id: true,
        licenseNumber: true,
        fullName: true,
        lawFirm: true,
        status: true,
        submittedAt: true,
        reviewedAt: true,
        reviewNotes: true,
      },
    });

    // 查询企业认证
    const enterpriseAccount = await prisma.enterpriseAccount.findUnique({
      where: { userId },
      select: {
        id: true,
        enterpriseName: true,
        creditCode: true,
        legalPerson: true,
        industryType: true,
        status: true,
        submittedAt: true,
        reviewedAt: true,
        expiresAt: true,
      },
    });

    // 获取用户统计信息
    const statistics = await getUserStatistics(userId);

    // 构建响应数据
    const responseData: UserDetailResponse = {
      user: userData,
      lawyerQualification,
      enterpriseAccount,
      statistics,
    };

    return NextResponse.json(
      { success: true, data: responseData },
      { status: 200 }
    ) as unknown as NextResponse;
  } catch (error) {
    logger.error('获取用户详情失败:', error);
    return NextResponse.json(
      { error: '服务器错误', message: '获取用户详情失败' },
      { status: 500 }
    ) as unknown as NextResponse;
  }
}

/**
 * PUT /api/admin/users/[id]
 * 更新用户信息（管理员权限）
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  // 验证用户身份
  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json(
      { error: '未认证', message: '请先登录' },
      { status: 401 }
    ) as unknown as NextResponse;
  }

  // 检查权限
  const permissionError = await validatePermissions(request, 'user:update');
  if (permissionError) {
    return permissionError;
  }

  const userId = (await params).id;

  // 验证用户ID
  if (!isValidUserId(userId)) {
    return NextResponse.json(
      { error: '无效参数', message: '用户ID格式不正确' },
      { status: 400 }
    ) as unknown as NextResponse;
  }

  try {
    // 解析请求体
    const body = (await request.json()) as UpdateUserRequest;

    const [currentUserRole, targetUser] = await Promise.all([
      getFreshUserRole(user.userId),
      prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, role: true },
      }),
    ]);

    if (!targetUser) {
      return NextResponse.json(
        { error: '未找到', message: '用户不存在' },
        { status: 404 }
      ) as unknown as NextResponse;
    }

    // 验证角色和状态
    if (body.role !== undefined && !isValidRole(body.role)) {
      return NextResponse.json(
        { error: '无效参数', message: '角色值不正确' },
        { status: 400 }
      ) as unknown as NextResponse;
    }

    if (
      body.role !== undefined &&
      userId === user.userId &&
      body.role !== targetUser.role
    ) {
      return NextResponse.json(
        { error: '禁止操作', message: '不能通过后台修改自己的角色' },
        { status: 403 }
      ) as unknown as NextResponse;
    }

    if (
      requiresSuperAdminForUserRoleChange(targetUser.role, body.role) &&
      !canManagePrivilegedRole(currentUserRole)
    ) {
      return NextResponse.json(
        {
          error: '权限不足',
          message: '只有超级管理员可以管理管理员或超级管理员账号',
        },
        { status: 403 }
      ) as unknown as NextResponse;
    }

    if (body.status !== undefined && !isValidStatus(body.status)) {
      return NextResponse.json(
        { error: '无效参数', message: '状态值不正确' },
        { status: 400 }
      ) as unknown as NextResponse;
    }

    // 构建更新数据
    const updateData: Record<string, unknown> = {};
    if (body.username !== undefined) {
      updateData.username = body.username;
    }
    if (body.name !== undefined) {
      updateData.name = body.name;
    }
    if (body.role !== undefined) {
      updateData.role = body.role;
    }
    if (body.status !== undefined) {
      updateData.status = body.status;
    }
    if (body.phone !== undefined) {
      updateData.phone = body.phone;
    }
    if (body.address !== undefined) {
      updateData.address = body.address;
    }
    if (body.bio !== undefined) {
      updateData.bio = body.bio;
    }

    // 密码重置：只有 SUPER_ADMIN 可操作，且新密码不能少于8位
    if (body.newPassword !== undefined && body.newPassword !== '') {
      if (body.newPassword.length < 8) {
        return NextResponse.json(
          { error: '参数错误', message: '新密码不能少于8位' },
          { status: 400 }
        ) as unknown as NextResponse;
      }
      const currentUserInDb = await prisma.user.findUnique({
        where: { id: user.userId },
        select: { role: true },
      });
      if (currentUserInDb?.role !== 'SUPER_ADMIN') {
        return NextResponse.json(
          { error: '权限不足', message: '只有超级管理员可以重置密码' },
          { status: 403 }
        ) as unknown as NextResponse;
      }
      updateData.password = await bcrypt.hash(body.newPassword, 10);
    }

    // 更新用户
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        email: true,
        username: true,
        name: true,
        role: true,
        status: true,
        phone: true,
        address: true,
        bio: true,
        avatar: true,
        createdAt: true,
        updatedAt: true,
        lastLoginAt: true,
        loginCount: true,
        emailVerified: true,
      },
    });

    return NextResponse.json(
      { data: { user: updatedUser }, message: '更新成功' },
      { status: 200 }
    ) as unknown as NextResponse;
  } catch (error) {
    logger.error('更新用户信息失败:', error);
    if (
      error instanceof Error &&
      error.message.includes('Record to update not found')
    ) {
      return NextResponse.json(
        { error: '未找到', message: '用户不存在' },
        { status: 404 }
      ) as unknown as NextResponse;
    }
    return NextResponse.json(
      { error: '服务器错误', message: '更新用户信息失败' },
      { status: 500 }
    ) as unknown as NextResponse;
  }
}

/**
 * DELETE /api/admin/users/[id]
 * 删除用户（软删除，管理员权限）
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  // 验证用户身份
  const currentUser = await getAuthUser(request);
  if (!currentUser) {
    return NextResponse.json(
      { error: '未认证', message: '请先登录' },
      { status: 401 }
    ) as unknown as NextResponse;
  }

  // 检查权限
  const permissionError = await validatePermissions(request, 'user:delete');
  if (permissionError) {
    return permissionError;
  }

  const userId = (await params).id;

  // 验证用户ID
  if (!isValidUserId(userId)) {
    return NextResponse.json(
      { error: '无效参数', message: '用户ID格式不正确' },
      { status: 400 }
    ) as unknown as NextResponse;
  }

  // 不允许删除自己
  if (userId === currentUser.userId) {
    return NextResponse.json(
      { error: '禁止操作', message: '不能删除自己的账户' },
      { status: 403 }
    ) as unknown as NextResponse;
  }

  try {
    const [currentUserRole, targetUser] = await Promise.all([
      getFreshUserRole(currentUser.userId),
      prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, role: true },
      }),
    ]);

    if (!targetUser) {
      return NextResponse.json(
        { error: '未找到', message: '用户不存在' },
        { status: 404 }
      ) as unknown as NextResponse;
    }

    if (
      requiresSuperAdminForUserRoleChange(targetUser.role, targetUser.role) &&
      !canManagePrivilegedRole(currentUserRole)
    ) {
      return NextResponse.json(
        {
          error: '权限不足',
          message: '只有超级管理员可以删除管理员或超级管理员账号',
        },
        { status: 403 }
      ) as unknown as NextResponse;
    }

    // 软删除用户
    await prisma.user.update({
      where: { id: userId },
      data: {
        deletedAt: new Date(),
        status: 'INACTIVE',
      },
    });

    return NextResponse.json(
      { message: '删除成功' },
      { status: 200 }
    ) as unknown as NextResponse;
  } catch (error) {
    logger.error('删除用户失败:', error);
    return NextResponse.json(
      { error: '服务器错误', message: '删除用户失败' },
      { status: 500 }
    ) as unknown as NextResponse;
  }
}

/**
 * OPTIONS /api/admin/users/[id]
 * CORS预检请求
 */
export async function OPTIONS(): Promise<NextResponse> {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin':
        process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      'Access-Control-Allow-Methods': 'GET, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  });
}
