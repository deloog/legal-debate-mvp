/**
 * 知识图谱导出 API
 * GET /api/knowledge-graph/export - 导出知识图谱数据
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { PrismaClient } from '@prisma/client';
import { authOptions } from '@/lib/auth/auth-options';
import { logger } from '@/lib/logger';
import { ExportService } from '@/lib/knowledge-graph/export-import/services';
import type { ExportFormat, ExportFilterOptions } from '@/lib/knowledge-graph/export-import/types';

const prisma = new PrismaClient();

/**
 * GET 导出知识图谱数据
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: '未登录' },
        { status: 401 }
      );
    }

    // 解析查询参数
    const searchParams = request.nextUrl.searchParams;
    const format = (searchParams.get('format') || 'json-ld') as ExportFormat;
    const compress = searchParams.get('compress') === 'true';

    // 解析过滤条件
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');
    const relationTypesParam = searchParams.get('relationTypes');
    const minStrengthParam = searchParams.get('minStrength');
    const maxStrengthParam = searchParams.get('maxStrength');
    const verificationStatusParam = searchParams.get('verificationStatus');
    const discoveryMethodParam = searchParams.get('discoveryMethod');

    const filter: ExportFilterOptions = {
      format,
    };

    if (startDateParam) {
      filter.startDate = new Date(startDateParam);
    }

    if (endDateParam) {
      filter.endDate = new Date(endDateParam);
    }

    if (relationTypesParam) {
      filter.relationTypes = relationTypesParam.split(',');
    }

    if (minStrengthParam) {
      filter.minStrength = parseFloat(minStrengthParam);
    }

    if (maxStrengthParam) {
      filter.maxStrength = parseFloat(maxStrengthParam);
    }

    if (verificationStatusParam) {
      filter.verificationStatus = verificationStatusParam.split(',');
    }

    if (discoveryMethodParam) {
      filter.discoveryMethod = discoveryMethodParam.split(',');
    }

    // 创建导出服务
    const exportService = new ExportService();

    // 导出数据
    const graphData = await exportService.exportData(prisma, {
      format,
      filter,
      compress,
    });

    // 格式化数据
    const formattedData = exportService.formatExportData(graphData, format);

    // 生成文件名
    const filename = exportService.generateFilename(format);

    // 设置响应头
    const contentType = getContentType(format);

    logger.info('知识图谱数据导出成功', {
      userId: session.user.id,
      format,
      nodeCount: graphData.nodes.length,
      edgeCount: graphData.edges.length,
      filename,
    });

    // 返回数据
    return new NextResponse(formattedData, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    logger.error('导出知识图谱数据失败', { error });

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '导出知识图谱数据失败',
      },
      { status: 500 }
    );
  }
}

/**
 * 根据格式获取Content-Type
 */
function getContentType(format: ExportFormat): string {
  switch (format) {
    case 'graphml':
      return 'application/xml; charset=utf-8';
    case 'gml':
      return 'application/x-gml';
    case 'json-ld':
      return 'application/ld+json; charset=utf-8';
    default:
      return 'application/json; charset=utf-8';
  }
}
