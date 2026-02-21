/**
 * 单个系统配置API - 管理员专用
 * 支持获取、更新、删除单个配置
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { getAuthUser } from '@/lib/middleware/auth';
import { validatePermissions } from '@/lib/middleware/permission-check';
import { UpdateConfigRequest } from '@/types/config';
import { logger } from '@/lib/logger';

// =============================================================================
// 辅助函数
// =============================================================================

/**
 * 验证配置值类型
 */
function validateConfigValue(value: unknown, type: string): boolean {
  switch (type) {
    case 'STRING':
      return typeof value === 'string';
    case 'NUMBER':
      return typeof value === 'number' && !Number.isNaN(value);
    case 'BOOLEAN':
      return typeof value === 'boolean';
    case 'ARRAY':
      return Array.isArray(value);
    case 'OBJECT':
      return (
        typeof value === 'object' && value !== null && !Array.isArray(value)
      );
    default:
      return false;
  }
}

// =============================================================================
// API处理函数
// =============================================================================

/**
 * GET /api/admin/configs/[key]
 * 获取单个配置（管理员权限）
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { key: string } }
): Promise<Response> {
  // 验证用户身份
  const user = await getAuthUser(request);
  if (!user) {
    return Response.json(
      { error: '未认证', message: '请先登录' },
      { status: 401 }
    );
  }

  // 检查权限
  const permissionError = await validatePermissions(request, 'system:config');
  if (permissionError) {
    return permissionError;
  }

  try {
    const { key } = params;

    // 查询配置
    const config = await prisma.systemConfig.findUnique({
      where: { key },
    });

    if (!config) {
      return Response.json(
        { error: '未找到', message: `配置${key}不存在` },
        { status: 404 }
      );
    }

    return Response.json({ data: config }, { status: 200 });
  } catch (error) {
    logger.error('获取配置失败:', error);
    return Response.json(
      { error: '服务器错误', message: '获取配置失败' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/configs/[key]
 * 更新配置（管理员权限）
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { key: string } }
): Promise<Response> {
  // 验证用户身份
  const user = await getAuthUser(request);
  if (!user) {
    return Response.json(
      { error: '未认证', message: '请先登录' },
      { status: 401 }
    );
  }

  // 检查权限
  const permissionError = await validatePermissions(request, 'system:config');
  if (permissionError) {
    return permissionError;
  }

  try {
    const { key } = params;
    const body: UpdateConfigRequest = await request.json();

    // 查找配置
    const existingConfig = await prisma.systemConfig.findUnique({
      where: { key },
    });

    if (!existingConfig) {
      return Response.json(
        { error: '未找到', message: `配置${key}不存在` },
        { status: 404 }
      );
    }

    // 构建更新数据
    const updateData: Record<string, unknown> = {};

    if (body.description !== undefined) {
      updateData.description = body.description;
    }

    if (body.isPublic !== undefined) {
      updateData.isPublic = body.isPublic;
    }

    if (body.isRequired !== undefined) {
      updateData.isRequired = body.isRequired;
    }

    if (body.defaultValue !== undefined) {
      updateData.defaultValue = body.defaultValue;
    }

    if (body.validationRules !== undefined) {
      updateData.validationRules = body.validationRules;
    }

    // 更新配置值（如果提供）
    if (body.value !== undefined) {
      // 验证配置值类型
      if (!validateConfigValue(body.value, existingConfig.type)) {
        return Response.json(
          {
            error: '参数错误',
            message: `配置值类型与指定类型${existingConfig.type}不匹配`,
          },
          { status: 400 }
        );
      }
      updateData.value = body.value;
    }

    // 更新配置
    const updatedConfig = await prisma.systemConfig.update({
      where: { key },
      data: updateData,
    });

    return Response.json(
      {
        message: '配置更新成功',
        data: updatedConfig,
      },
      { status: 200 }
    );
  } catch (error) {
    logger.error('更新配置失败:', error);
    return Response.json(
      { error: '服务器错误', message: '更新配置失败' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/configs/[key]
 * 删除配置（管理员权限）
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { key: string } }
): Promise<Response> {
  // 验证用户身份
  const user = await getAuthUser(request);
  if (!user) {
    return Response.json(
      { error: '未认证', message: '请先登录' },
      { status: 401 }
    );
  }

  // 检查权限
  const permissionError = await validatePermissions(request, 'system:config');
  if (permissionError) {
    return permissionError;
  }

  try {
    const { key } = params;

    // 查找配置
    const existingConfig = await prisma.systemConfig.findUnique({
      where: { key },
    });

    if (!existingConfig) {
      return Response.json(
        { error: '未找到', message: `配置${key}不存在` },
        { status: 404 }
      );
    }

    // 检查是否为必填配置
    if (existingConfig.isRequired) {
      return Response.json(
        {
          error: '禁止操作',
          message: '必填配置不能删除',
        },
        { status: 403 }
      );
    }

    // 删除配置
    await prisma.systemConfig.delete({
      where: { key },
    });

    return Response.json(
      {
        message: '配置删除成功',
        data: { key },
      },
      { status: 200 }
    );
  } catch (error) {
    logger.error('删除配置失败:', error);
    return Response.json(
      { error: '服务器错误', message: '删除配置失败' },
      { status: 500 }
    );
  }
}
