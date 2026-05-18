import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { getAuthUser } from '@/lib/middleware/auth';
import { recoverStuckProposals } from '@/lib/cron/proposal-recovery';
import { logger } from '@/lib/logger';

const CRON_SECRET = process.env.CRON_SECRET;

async function requireAdminOrCron(request: NextRequest): Promise<boolean> {
  // 允许携带 CRON_SECRET 的外部调用（如 Vercel Cron / 外部定时服务）
  const cronHeader = request.headers.get('x-cron-secret');
  if (CRON_SECRET && cronHeader === CRON_SECRET) return true;

  // 允许管理员手动触发
  const user = await getAuthUser(request);
  if (!user) return false;

  const dbUser = await prisma.user.findUnique({
    where: { id: user.userId },
    select: { role: true },
  });
  return dbUser?.role === 'ADMIN' || dbUser?.role === 'SUPER_ADMIN';
}

/** GET /api/v1/proposals/recovery — 查询当前卡死中的提案数量 */
export async function GET(request: NextRequest) {
  if (!(await requireAdminOrCron(request))) {
    return NextResponse.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: '未授权' } },
      { status: 401 }
    );
  }

  const count = await prisma.agentProposal.count({
    where: {
      status: 'EXECUTING',
      updatedAt: { lt: new Date(Date.now() - 15 * 60 * 1000) },
    },
  });

  return NextResponse.json({ success: true, data: { stuckCount: count } });
}

/** POST /api/v1/proposals/recovery — 触发卡死提案恢复 */
export async function POST(request: NextRequest) {
  if (!(await requireAdminOrCron(request))) {
    return NextResponse.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: '未授权' } },
      { status: 401 }
    );
  }

  try {
    const recovered = await recoverStuckProposals();
    logger.info(`proposal-recovery API: 恢复了 ${recovered} 个提案`);
    return NextResponse.json({
      success: true,
      data: {
        recovered,
        message: recovered > 0 ? `已恢复 ${recovered} 个卡死提案` : '无需恢复',
      },
    });
  } catch (err) {
    logger.error(
      'proposal-recovery API 执行失败',
      err instanceof Error ? err : new Error(String(err))
    );
    return NextResponse.json(
      {
        success: false,
        error: { code: 'INTERNAL_SERVER_ERROR', message: '恢复失败' },
      },
      { status: 500 }
    );
  }
}
