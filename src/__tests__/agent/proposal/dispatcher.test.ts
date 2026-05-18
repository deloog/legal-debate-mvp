import { runDispatcher } from '@/lib/agent/proposal/dispatcher';
import { prisma } from '@/lib/db/prisma';
import { createCase, addTimelineEvent } from '@/lib/case/service';
import { createClient } from '@/lib/client/service';

jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    agentProposal: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    proposalAction: {
      update: jest.fn(),
      findMany: jest.fn(),
    },
    case: {
      update: jest.fn(),
    },
  },
}));

jest.mock('@/lib/case/service', () => ({
  createCase: jest.fn(),
  addTimelineEvent: jest.fn(),
}));

jest.mock('@/lib/client/service', () => ({
  createClient: jest.fn(),
}));

jest.mock('@/lib/notification/reminder-service', () => ({
  reminderService: { createReminder: jest.fn() },
}));

jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

// 类型化 mock 引用
const p = prisma as {
  agentProposal: { findUnique: jest.Mock; update: jest.Mock };
  proposalAction: { update: jest.Mock; findMany: jest.Mock };
  case: { update: jest.Mock };
};
const mockCreateClient = createClient as jest.Mock;
const mockCreateCase = createCase as jest.Mock;
const mockAddTimelineEvent = addTimelineEvent as jest.Mock;

const PROPOSAL_ID = 'proposal-test-1';
const USER_ID = 'user-test-1';
const CLIENT_ACTION_ID = 'action-client-1';
const CASE_ACTION_ID = 'action-case-1';

function makeAction(overrides: Record<string, unknown>) {
  return {
    id: 'action-default',
    proposalId: PROPOSAL_ID,
    sequence: 0,
    actionType: 'CREATE_CLIENT',
    label: '创建客户',
    params: {},
    selected: true,
    status: 'PENDING',
    dependsOnId: null,
    idempotencyKey: `${PROPOSAL_ID}-CREATE_CLIENT-0`,
    resourceType: null,
    resourceId: null,
    error: null,
    retryCount: 0,
    revertStatus: 'PENDING',
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  p.proposalAction.update.mockResolvedValue({});
  p.agentProposal.update.mockResolvedValue({});
  p.case.update.mockResolvedValue({});
});

describe('runDispatcher', () => {
  it('提案不存在时直接返回', async () => {
    p.agentProposal.findUnique.mockResolvedValue(null);
    await runDispatcher(PROPOSAL_ID);
    expect(p.agentProposal.update).not.toHaveBeenCalled();
  });

  it('CREATE_CLIENT → CREATE_CASE 依赖链：clientId 正确注入', async () => {
    const clientAction = makeAction({
      id: CLIENT_ACTION_ID,
      sequence: 0,
      actionType: 'CREATE_CLIENT',
      params: { name: '张三' },
      idempotencyKey: `${PROPOSAL_ID}-CREATE_CLIENT-0`,
    });
    const caseAction = makeAction({
      id: CASE_ACTION_ID,
      sequence: 1,
      actionType: 'CREATE_CASE',
      params: {
        title: '张三 - 离婚纠纷案',
        type: 'other',
        description: '争夺抚养权',
      },
      dependsOnId: CLIENT_ACTION_ID,
      idempotencyKey: `${PROPOSAL_ID}-CREATE_CASE-1`,
    });

    p.agentProposal.findUnique.mockResolvedValue({
      id: PROPOSAL_ID,
      userId: USER_ID,
      actions: [clientAction, caseAction],
    });

    mockCreateClient.mockResolvedValue({ id: 'client-abc' });
    mockCreateCase.mockResolvedValue({ id: 'case-xyz' });

    p.proposalAction.findMany.mockResolvedValue([
      { status: 'COMPLETED', selected: true },
      { status: 'COMPLETED', selected: true },
    ]);

    await runDispatcher(PROPOSAL_ID);

    // createClient 应被调用
    expect(mockCreateClient).toHaveBeenCalledWith(
      expect.objectContaining({ name: '张三', userId: USER_ID }),
      expect.any(String)
    );

    // createCase 应被调用（clientId 经由 prisma.case.update 注入，不在此参数中）
    expect(mockCreateCase).toHaveBeenCalledTimes(1);

    // 注入的 clientId 通过 prisma.case.update 写入，验证调用是否正确
    expect(p.case.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'case-xyz' },
        data: { clientId: 'client-abc' },
      })
    );

    // 最终 proposal 状态应为 COMPLETED
    expect(p.agentProposal.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'COMPLETED' }),
      })
    );
  });

  it('某个 action 失败时，proposal 状态为 PARTIALLY_COMPLETED', async () => {
    const clientAction = makeAction({
      id: CLIENT_ACTION_ID,
      sequence: 0,
      actionType: 'CREATE_CLIENT',
      params: { name: '李四' },
    });
    const caseAction = makeAction({
      id: CASE_ACTION_ID,
      sequence: 1,
      actionType: 'CREATE_CASE',
      params: { title: '李四案', type: 'other', description: '' },
      dependsOnId: CLIENT_ACTION_ID,
    });

    p.agentProposal.findUnique.mockResolvedValue({
      id: PROPOSAL_ID,
      userId: USER_ID,
      actions: [clientAction, caseAction],
    });

    mockCreateClient.mockResolvedValue({ id: 'client-def' });
    mockCreateCase.mockRejectedValue(new Error('DB 写入超时'));

    p.proposalAction.findMany.mockResolvedValue([
      { status: 'COMPLETED', selected: true },
      { status: 'FAILED', selected: true },
    ]);

    await runDispatcher(PROPOSAL_ID);

    expect(p.agentProposal.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'PARTIALLY_COMPLETED' }),
      })
    );
  });

  it('全部 action 失败时，proposal 状态为 FAILED', async () => {
    const clientAction = makeAction({
      id: CLIENT_ACTION_ID,
      sequence: 0,
      actionType: 'CREATE_CLIENT',
      params: { name: '王五' },
    });

    p.agentProposal.findUnique.mockResolvedValue({
      id: PROPOSAL_ID,
      userId: USER_ID,
      actions: [clientAction],
    });

    mockCreateClient.mockRejectedValue(new Error('服务不可用'));

    p.proposalAction.findMany.mockResolvedValue([
      { status: 'FAILED', selected: true },
    ]);

    await runDispatcher(PROPOSAL_ID);

    expect(p.agentProposal.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'FAILED' }),
      })
    );
  });

  it('status 为 COMPLETED 的 action 直接跳过（幂等）', async () => {
    const completedAction = makeAction({
      id: CLIENT_ACTION_ID,
      sequence: 0,
      actionType: 'CREATE_CLIENT',
      params: { name: '赵六' },
      status: 'COMPLETED',
      resourceType: 'Client',
      resourceId: 'client-existing',
    });

    p.agentProposal.findUnique.mockResolvedValue({
      id: PROPOSAL_ID,
      userId: USER_ID,
      actions: [completedAction],
    });

    p.proposalAction.findMany.mockResolvedValue([
      { status: 'COMPLETED', selected: true },
    ]);

    await runDispatcher(PROPOSAL_ID);

    // 已完成的 action 不应再调用 createClient
    expect(mockCreateClient).not.toHaveBeenCalled();
    expect(p.agentProposal.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'COMPLETED' }),
      })
    );
  });

  it('未勾选（selected=false）的 action 被跳过', async () => {
    const unselectedAction = makeAction({
      id: CLIENT_ACTION_ID,
      sequence: 0,
      actionType: 'CREATE_CLIENT',
      params: { name: '钱七' },
      selected: false,
      status: 'SKIPPED',
    });

    p.agentProposal.findUnique.mockResolvedValue({
      id: PROPOSAL_ID,
      userId: USER_ID,
      actions: [unselectedAction],
    });

    p.proposalAction.findMany.mockResolvedValue([
      { status: 'SKIPPED', selected: false },
    ]);

    await runDispatcher(PROPOSAL_ID);

    expect(mockCreateClient).not.toHaveBeenCalled();
  });

  it('ADD_TIMELINE_EVENT：多事件并发创建，返回第一个事件 ID', async () => {
    const caseId = 'case-timeline-test';
    const timelineAction = makeAction({
      id: 'action-timeline',
      sequence: 2,
      actionType: 'ADD_TIMELINE_EVENT',
      params: {
        caseId,
        events: [
          { date: '2026-01-01', description: '首次咨询', type: 'CONSULT' },
          { date: '2026-02-01', description: '事故发生', type: 'INCIDENT' },
        ],
      },
      idempotencyKey: `${PROPOSAL_ID}-ADD_TIMELINE_EVENT-2`,
    });

    p.agentProposal.findUnique.mockResolvedValue({
      id: PROPOSAL_ID,
      userId: USER_ID,
      actions: [timelineAction],
    });

    mockAddTimelineEvent
      .mockResolvedValueOnce({ id: 'event-1' })
      .mockResolvedValueOnce({ id: 'event-2' });

    p.proposalAction.findMany.mockResolvedValue([
      { status: 'COMPLETED', selected: true },
    ]);

    await runDispatcher(PROPOSAL_ID);

    expect(mockAddTimelineEvent).toHaveBeenCalledTimes(2);

    // resourceId 应为第一个事件的 id
    const updateCall = p.proposalAction.update.mock.calls.find(
      (call: unknown[]) =>
        (call[0] as { data: { status: string } }).data?.status === 'COMPLETED'
    );
    expect(updateCall?.[0]).toMatchObject({
      data: expect.objectContaining({ resourceId: 'event-1' }),
    });
  });
});
