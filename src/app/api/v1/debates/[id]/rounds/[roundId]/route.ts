import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; roundId: string }> }
) {
  try {
    const { id, roundId } = await params;

    // 验证参数
    if (!id || !roundId) {
      return NextResponse.json(
        { success: false, error: '缺少必要参数' },
        { status: 400 }
      );
    }

    // 验证debate是否存在
    const debate = await prisma.debate.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!debate) {
      return NextResponse.json(
        { success: false, error: '辩论不存在' },
        { status: 404 }
      );
    }

    // 获取指定轮次（Argument模型没有legalBasis关联字段）
    const round = await prisma.debateRound.findUnique({
      where: {
        id: roundId,
        debateId: id,
      },
      include: {
        arguments: true,
      },
    });

    if (!round) {
      return NextResponse.json(
        { success: false, error: '辩论轮次不存在' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        id: round.id,
        debateId: round.debateId,
        roundNumber: round.roundNumber,
        status: round.status,
        startedAt: round.startedAt,
        completedAt: round.completedAt,
        createdAt: round.createdAt,
        updatedAt: round.updatedAt,
        arguments: round.arguments.map(arg => ({
          id: arg.id,
          side: arg.side,
          content: arg.content,
          type: arg.type,
        })),
      },
    });
  } catch (error) {
    console.error('获取辩论轮次失败:', error);
    return NextResponse.json(
      { success: false, error: '服务器内部错误' },
      { status: 500 }
    );
  }
}
