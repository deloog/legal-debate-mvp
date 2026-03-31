/**
 * 知识图谱审计报告生成API端点
 *
 * POST /api/knowledge-graph/audit/report
 * 生成审计报告（访问审计、变更审计、合规报告）
 */

import { NextRequest, NextResponse } from 'next/server';
import { AccessAuditGenerator } from '@/lib/knowledge-graph/audit-report/access-audit-generator';
import { ChangeAuditGenerator } from '@/lib/knowledge-graph/audit-report/change-audit-generator';
import { ComplianceGenerator } from '@/lib/knowledge-graph/audit-report/compliance-generator';
import {
  AuditReportType,
  AuditReportFormat,
  GenerateReportParams,
} from '@/lib/knowledge-graph/audit-report/types';
import { getAuthUser } from '@/lib/middleware/auth';
import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/logger';

/**
 * 生成审计报告
 */
export async function POST(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) {
      return NextResponse.json(
        { error: 'UNAUTHORIZED', message: '请先登录' },
        { status: 401 }
      );
    }

    // 从DB实时读取角色，仅管理员可生成审计报告
    const dbUser = await prisma.user.findUnique({
      where: { id: authUser.userId },
      select: { role: true },
    });
    if (dbUser?.role !== 'ADMIN' && dbUser?.role !== 'SUPER_ADMIN') {
      return NextResponse.json(
        { error: 'FORBIDDEN', message: '权限不足，仅管理员可生成审计报告' },
        { status: 403 }
      );
    }

    // 解析请求体
    const body = await request.json();

    // 验证请求参数
    const {
      startDate,
      endDate,
      reportType,
      format = AuditReportFormat.JSON,
    } = body as Partial<GenerateReportParams>;

    // 必填参数验证
    if (!startDate || !endDate || !reportType) {
      return NextResponse.json(
        {
          error: 'BAD_REQUEST',
          message: '缺少必填参数：startDate、endDate、reportType',
        },
        { status: 400 }
      );
    }

    // 验证报告类型
    if (
      !Object.values(AuditReportType).includes(reportType as AuditReportType)
    ) {
      return NextResponse.json(
        {
          error: 'INVALID_REPORT_TYPE',
          message: `无效的报告类型：${reportType}`,
        },
        { status: 400 }
      );
    }

    // 验证报告格式
    if (
      !Object.values(AuditReportFormat).includes(format as AuditReportFormat)
    ) {
      return NextResponse.json(
        {
          error: 'INVALID_FORMAT',
          message: `无效的报告格式：${format}`,
        },
        { status: 400 }
      );
    }

    // PDF 格式暂不可用（需集成 pdfkit 等依赖）
    if (format === AuditReportFormat.PDF) {
      return NextResponse.json(
        {
          error: 'FORMAT_NOT_SUPPORTED',
          message: 'PDF 格式暂不支持，请使用 JSON 格式',
        },
        { status: 501 }
      );
    }

    // 根据报告类型选择生成器
    const generatorMap = {
      [AuditReportType.ACCESS_AUDIT]: new AccessAuditGenerator(),
      [AuditReportType.CHANGE_AUDIT]: new ChangeAuditGenerator(),
      [AuditReportType.COMPLIANCE]: new ComplianceGenerator(),
    };

    const generator = generatorMap[reportType as AuditReportType];

    // 生成报告
    const params: GenerateReportParams = {
      startDate,
      endDate,
      reportType: reportType as AuditReportType,
      format: format as AuditReportFormat,
      userId: authUser.userId,
    };

    const report = await generator.generate(params);

    // 返回报告
    logger.info('审计报告生成成功', {
      reportType,
      userId: authUser.userId,
      period: { startDate, endDate },
    });

    return NextResponse.json(
      {
        success: true,
        data: report,
      },
      { status: 200 }
    );
  } catch (error) {
    logger.error('审计报告生成失败', { error });

    // 错误处理
    if (error instanceof Error) {
      if (error.message.includes('无效的日期格式')) {
        return NextResponse.json(
          {
            error: 'INVALID_DATE_FORMAT',
            message: error.message,
          },
          { status: 400 }
        );
      }
      if (error.message.includes('开始日期不能大于结束日期')) {
        return NextResponse.json(
          {
            error: 'INVALID_DATE_RANGE',
            message: error.message,
          },
          { status: 400 }
        );
      }
    }

    return NextResponse.json(
      {
        error: 'INTERNAL_SERVER_ERROR',
        message: '服务器内部错误',
      },
      { status: 500 }
    );
  }
}

/**
 * 获取支持的报告类型列表
 */
export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) {
      return NextResponse.json(
        { error: 'UNAUTHORIZED', message: '请先登录' },
        { status: 401 }
      );
    }

    // 返回支持的报告类型和格式
    return NextResponse.json(
      {
        success: true,
        data: {
          reportTypes: Object.values(AuditReportType).map(type => ({
            value: type,
            label:
              type === AuditReportType.ACCESS_AUDIT
                ? '访问审计报告'
                : type === AuditReportType.CHANGE_AUDIT
                  ? '变更审计报告'
                  : '合规报告',
            description:
              type === AuditReportType.ACCESS_AUDIT
                ? '统计知识图谱的访问行为'
                : type === AuditReportType.CHANGE_AUDIT
                  ? '统计知识图谱的变更行为'
                  : '统计知识图谱的合规情况（基于PIPL）',
          })),
          formats: Object.values(AuditReportFormat).map(format => ({
            value: format,
            label: format === AuditReportFormat.JSON ? 'JSON格式' : 'PDF格式',
            description:
              format === AuditReportFormat.JSON
                ? '结构化JSON数据'
                : 'PDF文档（需安装 pdfkit 依赖后启用）',
            available: format === AuditReportFormat.JSON,
          })),
        },
      },
      { status: 200 }
    );
  } catch (error) {
    logger.error('获取报告类型列表失败', { error });

    return NextResponse.json(
      {
        error: 'INTERNAL_SERVER_ERROR',
        message: '服务器内部错误',
      },
      { status: 500 }
    );
  }
}
