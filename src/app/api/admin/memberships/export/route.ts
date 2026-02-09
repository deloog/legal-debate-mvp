/**
 * 会员列表导出API - 管理员专用
 * 支持CSV格式导出会员列表
 */

import { serverErrorResponse, unauthorizedResponse } from '@/lib/api-response';
import { prisma } from '@/lib/db/prisma';
import { getAuthUser } from '@/lib/middleware/auth';
import { validatePermissions } from '@/lib/middleware/permission-check';
import type {
  ExportMembershipData,
  ExportQueryParams,
} from '@/types/admin-membership';
import { NextRequest, NextResponse } from 'next/server';

// =============================================================================
// 辅助函数
// =============================================================================

/**
 * 验证等级枚举值
 */
function isValidTier(tier: string): boolean {
  const validTiers = ['FREE', 'BASIC', 'PROFESSIONAL', 'ENTERPRISE'];
  return validTiers.includes(tier);
}

/**
 * 验证状态枚举值
 */
function isValidStatus(status: string): boolean {
  const validStatuses = [
    'ACTIVE',
    'EXPIRED',
    'CANCELLED',
    'SUSPENDED',
    'PENDING',
  ];
  return validStatuses.includes(status);
}

/**
 * 解析查询参数
 */
function parseQueryParams(request: NextRequest): ExportQueryParams {
  const url = new URL(request.url);
  return {
    tier: url.searchParams.get('tier') ?? undefined,
    status: url.searchParams.get('status') ?? undefined,
    search: url.searchParams.get('search') ?? undefined,
  };
}

/**
 * 构建Prisma查询条件
 */
function buildWhereClause(params: ExportQueryParams) {
  const where: Record<string, unknown> = {};

  if (params.tier && isValidTier(params.tier)) {
    where.tier = {
      tier: params.tier,
    };
  }

  if (params.status && isValidStatus(params.status)) {
    where.status = params.status;
  }

  if (params.search && params.search.trim() !== '') {
    where.user = {
      OR: [
        { email: { contains: params.search, mode: 'insensitive' } },
        { username: { contains: params.search, mode: 'insensitive' } },
        { name: { contains: params.search, mode: 'insensitive' } },
      ],
    };
  }

  return where;
}

/**
 * 生成CSV格式数据
 */
function generateCSV(memberships: ExportMembershipData[]): string {
  // CSV表头
  const headers = [
    '用户ID',
    '用户邮箱',
    '用户名',
    '会员等级',
    '等级名称',
    '状态',
    '开始日期',
    '结束日期',
    '自动续费',
    '取消时间',
    '取消原因',
    '暂停时间',
    '暂停原因',
    '备注',
    '创建时间',
    '更新时间',
  ];

  // 状态映射
  const statusMap: Record<string, string> = {
    ACTIVE: '生效中',
    EXPIRED: '已过期',
    CANCELLED: '已取消',
    SUSPENDED: '已暂停',
    PENDING: '待生效',
  };

  // 格式化日期
  const formatDate = (date: Date | null) => {
    if (!date) return '';
    return new Date(date).toLocaleDateString('zh-CN');
  };

  // 生成CSV内容
  const csvRows = memberships.map(m => [
    m.userId,
    m.userEmail,
    m.userName || '',
    m.tierName,
    m.tierDisplayName,
    statusMap[m.status] || m.status,
    formatDate(m.startDate),
    formatDate(m.endDate),
    m.autoRenew ? '是' : '否',
    formatDate(m.cancelledAt),
    m.cancelledReason || '',
    formatDate(m.pausedAt),
    m.pausedReason || '',
    m.notes || '',
    formatDate(m.createdAt),
    formatDate(m.updatedAt),
  ]);

  // 转义CSV字段
  const escapeCSV = (field: string) => {
    if (field === '') return '';
    if (field.includes(',') || field.includes('"') || field.includes('\n')) {
      return `"${field.replace(/"/g, '""')}"`;
    }
    return field;
  };

  const csvContent = [
    headers.map(escapeCSV).join(','),
    ...csvRows.map(row => row.map(escapeCSV).join(',')),
  ].join('\n');

  // 添加BOM以支持Excel中文显示
  return '\uFEFF' + csvContent;
}

// =============================================================================
// API处理函数
// =============================================================================

/**
 * GET /api/admin/memberships/export
 * 导出会员列表为CSV（管理员权限）
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  // 验证用户身份
  const user = await getAuthUser(request);
  if (!user) {
    return unauthorizedResponse();
  }

  // 检查权限
  const permissionError = await validatePermissions(request, 'user:read');
  if (permissionError) {
    return permissionError;
  }

  try {
    // 解析查询参数
    const params = parseQueryParams(request);
    const where = buildWhereClause(params);

    // 查询所有符合条件的会员
    const memberships = await prisma.userMembership.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            username: true,
            name: true,
          },
        },
        tier: {
          select: {
            id: true,
            name: true,
            displayName: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // 转换为导出数据格式
    const exportData: ExportMembershipData[] = memberships.map(m => ({
      userId: m.userId,
      userEmail: m.user.email,
      userName: m.user.name ?? m.user.username,
      tierName: m.tier.name,
      tierDisplayName: m.tier.displayName,
      status: m.status,
      startDate: m.startDate,
      endDate: m.endDate,
      autoRenew: m.autoRenew,
      cancelledAt: m.cancelledAt,
      cancelledReason: m.cancelledReason,
      pausedAt: m.pausedAt,
      pausedReason: m.pausedReason,
      notes: m.notes,
      createdAt: m.createdAt,
      updatedAt: m.updatedAt,
    }));

    // 生成CSV内容
    const csvContent = generateCSV(exportData);

    // 设置文件名
    const timestamp = new Date().toISOString().slice(0, 10);
    const filename = `memberships_${timestamp}.csv`;

    // 返回CSV文件
    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
      },
    });
  } catch (error) {
    console.error('导出会员列表失败:', error);
    return serverErrorResponse('导出会员列表失败');
  }
}
