import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { FeeConfigManager } from '@/lib/calculation/fee-config-manager';
import { FeeConfigType } from '@prisma/client';
import { getAuthUser } from '@/lib/middleware/auth';
import { successResponse, errorResponse } from '@/lib/api-response';
import { logger } from '@/lib/logger';

const configManager = new FeeConfigManager(prisma);

export async function POST(req: NextRequest) {
  try {
    const authUser = await getAuthUser(req);
    const userId = authUser?.userId;

    if (!userId) {
      return errorResponse('Unauthorized', 401);
    }

    const body = await req.json();
    const { type, name, data, description, isDefault } = body;

    if (!type || !name || !data) {
      return errorResponse('Missing required configuration parameters', 400);
    }

    // 验证类型是否有效
    if (!Object.values(FeeConfigType).includes(type as FeeConfigType)) {
      return errorResponse(`Invalid fee configuration type: ${type}`, 400);
    }

    const config = await configManager.upsertConfig(
      userId,
      type as FeeConfigType,
      name,
      data,
      description,
      isDefault
    );

    return successResponse(config);
  } catch (error) {
    logger.error('Create fee config error:', error);
    return errorResponse('Failed to create configuration', 500);
  }
}

export async function GET(req: NextRequest) {
  try {
    const authUser = await getAuthUser(req);
    const userId = authUser?.userId;

    if (!userId) {
      return errorResponse('Unauthorized', 401);
    }

    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type') as FeeConfigType | null;

    if (type && !Object.values(FeeConfigType).includes(type)) {
      return errorResponse(`Invalid fee configuration type: ${type}`, 400);
    }

    const configs = await configManager.getUserConfigs(
      userId,
      type || undefined
    );

    return successResponse(configs);
  } catch (error) {
    logger.error('Get fee configs error:', error);
    return errorResponse('Failed to retrieve configurations', 500);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const authUser = await getAuthUser(req);
    const userId = authUser?.userId;

    if (!userId) {
      return errorResponse('Unauthorized', 401);
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return errorResponse('Missing configuration ID', 400);
    }

    await configManager.deleteConfig(userId, id);

    return successResponse({ success: true });
  } catch (error) {
    logger.error('Delete fee config error:', error);
    return errorResponse('Failed to delete configuration', 500);
  }
}
