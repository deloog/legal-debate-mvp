import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { getAuthUser } from '@/lib/middleware/auth';
import { z } from 'zod';
import { TimelineEventListResponse, CaseTimelineEventType } from '@/types/case';
import { logger } from '@/lib/logger';

const createTimelineEventSchema = z.object({
  eventType: z.enum([
    'FILING',
    'PRETRIAL',
    'TRIAL',
    'JUDGMENT',
    'APPEAL',
    'EXECUTION',
    'CLOSED',
    'CUSTOM',
  ]),
  title: z.string().min(1, '标题不能为空').max(200),
  description: z.string().max(2000).optional(),
  eventDate: z.string().or(z.date()).pipe(z.coerce.date()),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

/**
 * GET /api/v1/cases/[id]/timeline
 * 获取案件的时间线
 */
export const GET = async (
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse<TimelineEventListResponse | { error: string }>> => {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const caseId = params.id;

    // 验证案件是否存在且属于当前用户
    const existingCase = await prisma.case.findFirst({
      where: {
        id: caseId,
        userId: authUser.userId,
      },
    });

    if (!existingCase) {
      return NextResponse.json({ error: '案件不存在' }, { status: 404 });
    }

    // 获取查询参数
    const searchParams = request.nextUrl.searchParams;
    const eventType = searchParams.get(
      'eventType'
    ) as CaseTimelineEventType | null;
    const sortBy =
      (searchParams.get('sortBy') as 'eventDate' | 'createdAt') || 'eventDate';
    const sortOrder =
      (searchParams.get('sortOrder') as 'asc' | 'desc') || 'desc';

    // 构建查询条件
    const where: Record<string, unknown> = { caseId };
    if (eventType && Object.values(CaseTimelineEventType).includes(eventType)) {
      where.eventType = eventType;
    }

    // 获取时间线事件
    const events = await prisma.caseTimeline.findMany({
      where,
      orderBy: { [sortBy]: sortOrder },
    });

    const total = events.length;

    // 转换为TimelineEvent类型以解决枚举和metadata类型不匹配
    const convertedEvents = events.map(event => ({
      ...event,
      eventType: event.eventType as unknown as CaseTimelineEventType,
      metadata: (event.metadata as Record<string, unknown> | null) ?? null,
    }));

    return NextResponse.json({
      events: convertedEvents,
      total,
      caseId,
    });
  } catch (error) {
    logger.error('获取时间线失败:', error);
    return NextResponse.json({ error: '获取时间线失败' }, { status: 500 });
  }
};

/**
 * POST /api/v1/cases/[id]/timeline
 * 创建时间线事件
 */
export const POST = async (
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse | { error: string }> => {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const caseId = params.id;

    // 验证案件是否存在且属于当前用户
    const existingCase = await prisma.case.findFirst({
      where: {
        id: caseId,
        userId: authUser.userId,
      },
    });

    if (!existingCase) {
      return NextResponse.json({ error: '案件不存在' }, { status: 404 });
    }

    const body = await request.json();
    const validatedData = createTimelineEventSchema.parse(body);

    // 创建时间线事件
    const timelineEvent = await prisma.caseTimeline.create({
      data: {
        caseId,
        eventType: validatedData.eventType,
        title: validatedData.title,
        description: validatedData.description || null,
        eventDate: validatedData.eventDate,
        metadata: (validatedData.metadata || {}) as never,
      },
    });

    return NextResponse.json(timelineEvent, { status: 201 });
  } catch (error) {
    logger.error('创建时间线事件失败:', error);
    return NextResponse.json({ error: '创建时间线事件失败' }, { status: 500 });
  }
};
