/**
 * 系统配置API - 管理员专用
 * 支持分页、筛选、搜索、创建、批量更新
 */

import { NextRequest } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { getAuthUser } from '@/lib/middleware/auth';
import { validatePermissions } from '@/lib/middleware/permission-check';
import {
  ConfigQueryParams,
  ConfigResponse,
  CreateConfigRequest,
  BatchUpdateConfigRequest,
  isValidConfigType,
  isValidConfigCategory,
} from '@/types/config';
import {
  successResponse,
  createdResponse,
  unauthorizedResponse,
  serverErrorResponse,
  errorResponse,
} from '@/lib/api-response';
import { logger } from '@/lib/logger';

// =============================================================================
// 辅助函数
// =============================================================================

/**
 * 解析查询参数
 */
function parseQueryParams(request: NextRequest): ConfigQueryParams {
  const url = new URL(request.url);
  return {
    page: url.searchParams.get('page') ?? '1',
    limit: url.searchParams.get('limit') ?? '20',
    category: url.searchParams.get('category') ?? undefined,
    type: url.searchParams.get('type') ?? undefined,
    isPublic: url.searchParams.get('isPublic') ?? undefined,
    search: url.searchParams.get('search') ?? undefined,
  };
}

/**
 * 构建Prisma查询条件
 */
function buildWhereClause(params: ConfigQueryParams) {
  const where: Record<string, unknown> = {};

  if (params.category && isValidConfigCategory(params.category)) {
    where.category = params.category;
  }

  if (params.type && isValidConfigType(params.type)) {
    where.type = params.type;
  }

  if (params.isPublic !== undefined) {
    where.isPublic = params.isPublic === 'true';
  }

  if (params.search && params.search.trim() !== '') {
    where.OR = [
      { key: { contains: params.search, mode: 'insensitive' } },
      { description: { contains: params.search, mode: 'insensitive' } },
    ];
  }

  return where;
}

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
 * GET /api/admin/configs
 * 获取配置列表（管理员权限）
 */
export async function GET(request: NextRequest): Promise<Response> {
  // 验证用户身份
  const user = await getAuthUser(request);
  if (!user) {
    return unauthorizedResponse();
  }

  // 检查权限
  const permissionError = await validatePermissions(
    request,
    'system:config',
  );
  if (permissionError) {
    return permissionError;
  }

  try {
    // 解析查询参数
    const params = parseQueryParams(request);
    const page = Math.max(1, Number.parseInt(params.page, 10));
    const limit = Math.min(100, Math.max(1, Number.parseInt(params.limit, 10)));
    const skip = (page - 1) * limit;

    // 构建查询条件
    const where = buildWhereClause(params);

    // 查询配置总数
    const total = await prisma.systemConfig.count({ where });

    // 查询配置列表
    const configs = await prisma.systemConfig.findMany({
      where,
      skip,
      take: limit,
      orderBy: {
        category: 'asc',
        key: 'asc',
      },
    });

    // 构建响应数据
    const responseData: ConfigResponse = {
      configs,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };

    return successResponse(responseData, '获取配置列表成功');
  } catch (error) {
    logger.error('获取配置列表失败:', error);
    return serverErrorResponse('获取配置列表失败');
  }
}

/**
 * POST /api/admin/configs
 * 创建新配置（管理员权限）
 */
export async function POST(request: NextRequest): Promise<Response> {
  // 验证用户身份
  const user = await getAuthUser(request);
  if (!user) {
    return unauthorizedResponse();
  }

  // 检查权限
  const permissionError = await validatePermissions(request, 'system:config');
  if (permissionError) {
    return permissionError;
  }

  try {
    const body: CreateConfigRequest = await request.json();

    // 验证必填字段
    if (!body.key || !body.value || !body.type || !body.category) {
      return errorResponse('缺少必填字段：key, value, type, category', 400);
    }

    // 验证配置类型
    if (!isValidConfigType(body.type)) {
      return errorResponse(`无效的配置类型：${body.type}`, 400);
    }

    // 验证配置分类
    if (!isValidConfigCategory(body.category)) {
      return errorResponse(`无效的配置分类：${body.category}`, 400);
    }

    // 验证配置值类型
    if (!validateConfigValue(body.value, body.type)) {
      return errorResponse(`配置值类型与指定类型${body.type}不匹配`, 400);
    }

    // 检查配置键是否已存在
    const existingConfig = await prisma.systemConfig.findUnique({
      where: { key: body.key },
    });

    if (existingConfig) {
      return errorResponse(`配置键${body.key}已存在`, 409);
    }

    // 创建配置
    const newConfig = await prisma.systemConfig.create({
      data: {
        key: body.key,
        value: body.value as Prisma.InputJsonValue,
        type: body.type,
        category: body.category,
        description: body.description ?? null,
        isPublic: body.isPublic ?? false,
        isRequired: body.isRequired ?? false,
        defaultValue: body.defaultValue as
          | Prisma.InputJsonValue
          | Prisma.NullableJsonNullValueInput,
        validationRules: body.validationRules as
          | Prisma.InputJsonValue
          | Prisma.NullableJsonNullValueInput,
      },
    });

    return createdResponse(newConfig, '配置创建成功');
  } catch (error) {
    logger.error('创建配置失败:', error);
    return serverErrorResponse('创建配置失败');
  }
}

/**
 * PUT /api/admin/configs
 * 批量更新配置（管理员权限）
 */
export async function PUT(request: NextRequest): Promise<Response> {
  // 验证用户身份
  const user = await getAuthUser(request);
  if (!user) {
    return unauthorizedResponse();
  }

  // 检查权限
  const permissionError = await validatePermissions(request, 'system:config');
  if (permissionError) {
    return permissionError;
  }

  try {
    const body: BatchUpdateConfigRequest = await request.json();

    // 验证请求体
    if (!body.configs || !Array.isArray(body.configs)) {
      return errorResponse('缺少configs数组', 400);
    }

    if (body.configs.length === 0) {
      return errorResponse('configs数组不能为空', 400);
    }

    const updatedConfigs = [];
    const errors: Array<{ key: string; message: string }> = [];

    // 遍历更新每个配置
    for (const item of body.configs) {
      if (!item.key) {
        errors.push({ key: '', message: '配置键不能为空' });
        continue;
      }

      try {
        // 查找配置
        const existingConfig = await prisma.systemConfig.findUnique({
          where: { key: item.key },
        });

        if (!existingConfig) {
          errors.push({ key: item.key, message: '配置不存在' });
          continue;
        }

        // 验证配置值类型
        if (!validateConfigValue(item.value, existingConfig.type)) {
          errors.push({
            key: item.key,
            message: `配置值类型与指定类型${existingConfig.type}不匹配`,
          });
          continue;
        }

        // 更新配置
        const updatedConfig = await prisma.systemConfig.update({
          where: { key: item.key },
          data: {
            value: item.value as Prisma.InputJsonValue,
          },
        });

        updatedConfigs.push(updatedConfig);
      } catch (updateError) {
        logger.error(`更新配置${item.key}失败:`, updateError);
        errors.push({
          key: item.key,
          message: `更新失败：${String(updateError)}`,
        });
      }
    }

    return successResponse(
      {
        updated: updatedConfigs.length,
        failed: errors.length,
        configs: updatedConfigs,
        errors: errors.length > 0 ? errors : undefined,
      },
      '批量更新完成'
    );
  } catch (error) {
    logger.error('批量更新配置失败:', error);
    return serverErrorResponse('批量更新配置失败');
  }
}
