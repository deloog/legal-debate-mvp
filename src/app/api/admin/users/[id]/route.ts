/**
 * 用户管理API - 管理员专用
 * 演示权限中间件的使用
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { getAuthUser } from '@/lib/middleware/auth';
import { validatePermissions } from '@/lib/middleware/permission-check';

// 获取单个用户（管理员权限）
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  // 验证用户身份
  const user = await getAuthUser(request);
  if (!user) {
    return Response.json(
      { error: '未认证', message: '请先登录' },
      {
        status: 401,
      }
    ) as unknown as NextResponse;
  }

  // 检查权限
  const permissionError = await validatePermissions(request, 'user:read');

  if (permissionError) {
    return permissionError;
  }

  // 获取用户ID
  const userId = params.id;

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        username: true,
        name: true,
        role: true,
        status: true,
        createdAt: true,
      },
    });

    if (!user) {
      return Response.json(
        { error: '用户不存在', message: `用户ID ${userId} 不存在` },
        { status: 404 }
      ) as unknown as NextResponse;
    }

    return Response.json(
      { data: { user } },
      { status: 200 }
    ) as unknown as NextResponse;
  } catch (error) {
    console.error('获取用户信息失败:', error);
    return Response.json(
      { error: '服务器错误', message: '获取用户信息失败' },
      { status: 500 }
    ) as unknown as NextResponse;
  }
}

// 更新用户（管理员权限）
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  // 验证用户身份
  const user = await getAuthUser(request);
  if (!user) {
    return Response.json(
      { error: '未认证', message: '请先登录' },
      {
        status: 401,
      }
    ) as unknown as NextResponse;
  }

  // 检查权限（需要update权限）
  const permissionError = await validatePermissions(request, 'user:update');

  if (permissionError) {
    return permissionError;
  }

  // 获取用户ID
  const userId = params.id;

  try {
    const body = await request.json();
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        name: body.name,
        status: body.status,
      },
    });

    return Response.json(
      { data: { user: updatedUser } },
      { status: 200 }
    ) as unknown as NextResponse;
  } catch (error) {
    console.error('更新用户失败:', error);
    return Response.json(
      { error: '服务器错误', message: '更新用户失败' },
      { status: 500 }
    ) as unknown as NextResponse;
  }
}

// 删除用户（管理员权限）
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  // 验证用户身份
  const user = await getAuthUser(request);
  if (!user) {
    return Response.json(
      { error: '未认证', message: '请先登录' },
      {
        status: 401,
      }
    ) as unknown as NextResponse;
  }

  // 检查权限（需要delete权限）
  const permissionError = await validatePermissions(request, 'user:delete');

  if (permissionError) {
    return permissionError;
  }

  // 获取用户ID
  const userId = params.id;

  try {
    await prisma.user.delete({
      where: { id: userId },
    });

    return Response.json(
      { data: { message: '用户已删除' } },
      { status: 200 }
    ) as unknown as NextResponse;
  } catch (error) {
    console.error('删除用户失败:', error);
    return Response.json(
      { error: '服务器错误', message: '删除用户失败' },
      { status: 500 }
    ) as unknown as NextResponse;
  }
}
