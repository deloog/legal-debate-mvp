/**
 * IP过滤管理API
 * GET /api/admin/ip-filter - 获取IP列表
 * POST /api/admin/ip-filter - 添加IP到黑/白名单
 * DELETE /api/admin/ip-filter - 从列表中移除IP
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/middleware/auth';
import { validatePermissions } from '@/lib/middleware/permission-check';
import { ipFilter } from '@/lib/middleware/ip-filter';

/**
 * GET /api/admin/ip-filter
 * 获取黑名单和白名单
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  // 验证用户身份
  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json(
      { success: false, error: '未认证' },
      { status: 401 }
    );
  }

  // 检查权限
  const permissionError = await validatePermissions(request, 'admin:read');
  if (permissionError) {
    return permissionError;
  }

  try {
    const blacklist = ipFilter.getBlacklist();
    const whitelist = ipFilter.getWhitelist();
    const stats = ipFilter.getStats();

    return NextResponse.json({
      success: true,
      data: {
        blacklist,
        whitelist,
        stats,
      },
    });
  } catch (error) {
    console.error('[IP Filter] GET Error:', error);
    return NextResponse.json(
      { success: false, error: '获取IP列表失败' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/ip-filter
 * 添加IP到黑名单或白名单
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  // 验证用户身份
  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json(
      { success: false, error: '未认证' },
      { status: 401 }
    );
  }

  // 检查权限
  const permissionError = await validatePermissions(request, 'admin:write');
  if (permissionError) {
    return permissionError;
  }

  try {
    const body = await request.json();
    const { ip, listType, reason, expiresInMinutes } = body;

    // 验证参数
    if (!ip || typeof ip !== 'string') {
      return NextResponse.json(
        { success: false, error: 'IP地址必填' },
        { status: 400 }
      );
    }

    if (!listType || !['blacklist', 'whitelist'].includes(listType)) {
      return NextResponse.json(
        { success: false, error: '列表类型必须是 blacklist 或 whitelist' },
        { status: 400 }
      );
    }

    // 添加到相应的列表
    if (listType === 'blacklist') {
      ipFilter.addToBlacklist(ip, reason, expiresInMinutes);
    } else {
      ipFilter.addToWhitelist(ip, reason);
    }

    return NextResponse.json({
      success: true,
      message: `IP ${ip} 已添加到${listType === 'blacklist' ? '黑' : '白'}名单`,
    });
  } catch (error) {
    console.error('[IP Filter] POST Error:', error);
    return NextResponse.json(
      { success: false, error: '添加IP失败' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/ip-filter
 * 从黑名单或白名单移除IP
 */
export async function DELETE(request: NextRequest): Promise<NextResponse> {
  // 验证用户身份
  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json(
      { success: false, error: '未认证' },
      { status: 401 }
    );
  }

  // 检查权限
  const permissionError = await validatePermissions(request, 'admin:write');
  if (permissionError) {
    return permissionError;
  }

  try {
    const { searchParams } = new URL(request.url);
    const ip = searchParams.get('ip');
    const listType = searchParams.get('listType');

    if (!ip) {
      return NextResponse.json(
        { success: false, error: 'IP地址必填' },
        { status: 400 }
      );
    }

    if (!listType || !['blacklist', 'whitelist'].includes(listType)) {
      return NextResponse.json(
        { success: false, error: '列表类型必须是 blacklist 或 whitelist' },
        { status: 400 }
      );
    }

    // 从相应的列表移除
    let removed = false;
    if (listType === 'blacklist') {
      removed = ipFilter.removeFromBlacklist(ip);
    } else {
      removed = ipFilter.removeFromWhitelist(ip);
    }

    if (!removed) {
      return NextResponse.json(
        { success: false, error: 'IP不在列表中' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `IP ${ip} 已从${listType === 'blacklist' ? '黑' : '白'}名单移除`,
    });
  } catch (error) {
    console.error('[IP Filter] DELETE Error:', error);
    return NextResponse.json(
      { success: false, error: '移除IP失败' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/ip-filter/mode
 * 切换过滤模式
 */
export async function PUT(request: NextRequest): Promise<NextResponse> {
  // 验证用户身份
  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json(
      { success: false, error: '未认证' },
      { status: 401 }
    );
  }

  // 检查权限
  const permissionError = await validatePermissions(request, 'admin:write');
  if (permissionError) {
    return permissionError;
  }

  try {
    const body = await request.json();
    const { mode } = body;

    if (!mode || !['blacklist', 'whitelist', 'off'].includes(mode)) {
      return NextResponse.json(
        { success: false, error: '模式必须是 blacklist、whitelist 或 off' },
        { status: 400 }
      );
    }

    ipFilter.setMode(mode);

    return NextResponse.json({
      success: true,
      message: `过滤模式已切换为: ${mode}`,
      data: { mode },
    });
  } catch (error) {
    console.error('[IP Filter] PUT Error:', error);
    return NextResponse.json(
      { success: false, error: '切换模式失败' },
      { status: 500 }
    );
  }
}
