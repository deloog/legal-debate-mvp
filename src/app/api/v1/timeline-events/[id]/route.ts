import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { getAuthUser } from '@/lib/middleware/auth';
import { z } from 'zod';
import { logger } from '@/lib/logger';

const updateTimelineEventSchema = z.object({
  eventType: z
    .enum([
      'FILING',
      'PRETRIAL',
      'TRIAL',
      'JUDGMENT',
      'APPEAL',
      'EXECUTION',
      'CLOSED',
      'CUSTOM',
    ])
    .optional(),
  title: z.string().min(1, '标题不能为空').max(200).optional(),
  description: z.string().max(2000).optional(),
  eventDate: z.string().or(z.date()).pipe(z.coerce.date()).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

/**
 * GET /api/v1/timeline-events/[id]
 * 获取单个时间线事件
 */
export const GET = async (
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> => {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const eventId = params.id;

    // 获取时间线事件并验证权限
    const event = await prisma.caseTimeline.findFirst({
      where: {
        id: eventId,
      },
      include: {
        case: true,
      },
    });

    if (!event) {
      return NextResponse.json({ error: '时间线事件不存在' }, { status: 404 });
    }

    // 验证用户权限
    if (event.case.userId !== authUser.userId) {
      return NextResponse.json({ error: '无权限访问' }, { status: 403 });
    }

    return NextResponse.json(event);
  } catch (error) {
    logger.error('获取时间线事件失败:', error);
    return NextResponse.json({ error: '获取时间线事件失败' }, { status: 500 });
  }
};

/**
 * PUT /api/v1/timeline-events/[id]
 * 更新时间线事件
 */
export const PUT = async (
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> => {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const eventId = params.id;

    // 获取时间线事件并验证权限
    const existingEvent = await prisma.caseTimeline.findFirst({
      where: {
        id: eventId,
      },
      include: {
        case: true,
      },
    });

    if (!existingEvent) {
      return NextResponse.json({ error: '时间线事件不存在' }, { status: 404 });
    }

    // 验证用户权限
    if (existingEvent.case.userId !== authUser.userId) {
      return NextResponse.json({ error: '无权限访问' }, { status: 403 });
    }

    const body = await request.json();
    const validatedData = updateTimelineEventSchema.parse(body);

    // 更新时间线事件
    const updatedEvent = await prisma.caseTimeline.update({
      where: { id: eventId },
      data: {
        eventType: validatedData.eventType || existingEvent.eventType,
        title: validatedData.title || existingEvent.title,
        description:
          validatedData.description !== undefined
            ? validatedData.description
            : existingEvent.description,
        eventDate: validatedData.eventDate || existingEvent.eventDate,
        metadata: (validatedData.metadata ?? existingEvent.metadata) as never,
      },
    });

    return NextResponse.json(updatedEvent);
  } catch (error) {
    logger.error('更新时间线事件失败:', error);
    return NextResponse.json({ error: '更新时间线事件失败' }, { status: 500 });
  }
};

/**
 * DELETE /api/v1/timeline-events/[id]
 * 删除时间线事件
 */
export const DELETE = async (
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> => {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const eventId = params.id;

    // 获取时间线事件并验证权限
    const existingEvent = await prisma.caseTimeline.findFirst({
      where: {
        id: eventId,
      },
      include: {
        case: true,
      },
    });

    if (!existingEvent) {
      return NextResponse.json({ error: '时间线事件不存在' }, { status: 404 });
    }

    // 验证用户权限
    if (existingEvent.case.userId !== authUser.userId) {
      return NextResponse.json({ error: '无权限访问' }, { status: 403 });
    }

    // 删除时间线事件
    await prisma.caseTimeline.delete({
      where: { id: eventId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('删除时间线事件失败:', error);
    return NextResponse.json({ error: '删除时间线事件失败' }, { status: 500 });
  }
};
