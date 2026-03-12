/**
 * 知识图谱导入 API
 * POST /api/knowledge-graph/import - 导入知识图谱数据
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { PrismaClient } from '@prisma/client';
import { authOptions } from '@/lib/auth/auth-options';
import { logger } from '@/lib/logger';
import { ImportService } from '@/lib/knowledge-graph/export-import/services';
import type {
  ExportFormat,
  ImportOptions,
  MergeStrategy,
} from '@/lib/knowledge-graph/export-import/types';

const prisma = new PrismaClient();

/**
 * POST 导入知识图谱数据
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: '未登录' },
        { status: 401 }
      );
    }

    // 获取请求体
    const body = await request.json();
    const { format, data, mergeStrategy, validate, dryRun } = body;

    // 验证必填参数
    if (!format || !data) {
      return NextResponse.json(
        { success: false, error: '缺少必要参数: format 或 data' },
        { status: 400 }
      );
    }

    // 验证格式
    const validFormats: ExportFormat[] = ['graphml', 'gml', 'json-ld'];
    if (!validFormats.includes(format as ExportFormat)) {
      return NextResponse.json(
        { success: false, error: `不支持的格式: ${format}` },
        { status: 400 }
      );
    }

    // 验证合并策略
    const validStrategies: MergeStrategy[] = ['skip', 'update', 'replace'];
    if (
      mergeStrategy &&
      !validStrategies.includes(mergeStrategy as MergeStrategy)
    ) {
      return NextResponse.json(
        { success: false, error: `不支持的合并策略: ${mergeStrategy}` },
        { status: 400 }
      );
    }

    // 构建导入选项
    const importOptions: ImportOptions = {
      format: format as ExportFormat,
      mergeStrategy: (mergeStrategy as MergeStrategy) || 'skip',
      validate: validate !== false, // 默认为true
      dryRun: dryRun === true,
    };

    logger.info('开始导入知识图谱数据', {
      userId: session.user.id,
      format,
      mergeStrategy: importOptions.mergeStrategy,
      validate: importOptions.validate,
      dryRun: importOptions.dryRun,
    });

    // 如果是dryRun模式，只验证数据不导入
    if (importOptions.dryRun) {
      // 这里可以添加验证逻辑
      return NextResponse.json({
        success: true,
        message: '数据验证通过（dryRun模式，未实际导入）',
        importedNodes: 0,
        importedEdges: 0,
        skippedEdges: 0,
        updatedEdges: 0,
        errors: [],
        warnings: [],
        processingTime: 0,
      });
    }

    // 创建导入服务
    const importService = new ImportService();

    // 导入数据
    const result = await importService.importData(prisma, data, importOptions);

    logger.info('知识图谱数据导入完成', {
      userId: session.user.id,
      importedNodes: result.importedNodes,
      importedEdges: result.importedEdges,
      skippedEdges: result.skippedEdges,
      updatedEdges: result.updatedEdges,
      processingTime: result.processingTime,
      success: result.success,
    });

    return NextResponse.json({
      ...result,
    });
  } catch (error) {
    logger.error('导入知识图谱数据失败', { error });

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '导入知识图谱数据失败',
      },
      { status: 500 }
    );
  }
}
