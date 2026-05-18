import { detectAndExtractCaseProposal } from '@/lib/agent/proposal/extractor';
import { AIServiceFactory } from '@/lib/ai/service-refactored';

const mockChatCompletion = jest.fn();

jest.mock('@/lib/ai/service-refactored', () => ({
  AIServiceFactory: {
    getInstance: jest.fn(),
  },
}));

jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

const mockGetInstance = AIServiceFactory.getInstance as jest.Mock;

const PROPOSAL_ID = 'prop-ext-test';
const MESSAGE_ID = 'msg-ext-test';
const TODAY = '2026-05-18';

function makeAiResponse(content: string) {
  return {
    choices: [{ message: { content } }],
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGetInstance.mockResolvedValue({ chatCompletion: mockChatCompletion });
});

describe('detectAndExtractCaseProposal', () => {
  it('AI 判断不应建案时返回 shouldCreate=false', async () => {
    mockChatCompletion.mockResolvedValue(
      makeAiResponse(
        JSON.stringify({
          shouldCreate: false,
          reason: '只是法律咨询，无当事人',
        })
      )
    );

    const result = await detectAndExtractCaseProposal(
      '离婚需要什么条件？',
      [],
      MESSAGE_ID,
      PROPOSAL_ID,
      TODAY
    );

    expect(result.shouldCreate).toBe(false);
    expect(result.data).toBeUndefined();
    // 检测为 false 时只调用一次 AI（跳过提取步骤）
    expect(mockChatCompletion).toHaveBeenCalledTimes(1);
  });

  it('AI 返回无效 JSON 时，检测阶段安全降级为 false', async () => {
    mockChatCompletion.mockResolvedValue(makeAiResponse('无效的回答'));

    const result = await detectAndExtractCaseProposal(
      '张三委托我处理离婚纠纷',
      [],
      MESSAGE_ID,
      PROPOSAL_ID,
      TODAY
    );

    expect(result.shouldCreate).toBe(false);
  });

  it('AI 判断应建案时调用提取 prompt，返回结构化数据', async () => {
    const detectJson = JSON.stringify({
      shouldCreate: true,
      reason: '包含当事人和案件类型',
    });
    const extractJson = JSON.stringify({
      parties: [
        {
          name: '张三',
          role: 'CLIENT',
          meta: { confidence: 0.9, needsConfirmation: false },
        },
        {
          name: '李某',
          role: 'OPPONENT',
          meta: { confidence: 0.85, needsConfirmation: false },
        },
      ],
      caseType: '离婚纠纷',
      caseTypeMeta: { confidence: 0.9, needsConfirmation: false },
      claims: [
        {
          text: '争夺女儿抚养权',
          meta: { confidence: 0.8, needsConfirmation: false },
        },
      ],
      keyDates: [
        {
          date: '2026-05-01',
          description: '首次咨询',
          type: 'CONSULT',
          meta: { confidence: 0.95, needsConfirmation: false },
        },
      ],
      disputeFocuses: [],
    });

    mockChatCompletion
      .mockResolvedValueOnce(makeAiResponse(detectJson))
      .mockResolvedValueOnce(makeAiResponse(extractJson));

    const result = await detectAndExtractCaseProposal(
      '委托人张三想和妻子李某离婚，争夺女儿抚养权，首次咨询在5月1日',
      [],
      MESSAGE_ID,
      PROPOSAL_ID,
      TODAY
    );

    expect(result.shouldCreate).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data!.parties).toHaveLength(2);
    expect(result.data!.parties[0].name).toBe('张三');
    expect(result.data!.caseType).toBe('离婚纠纷');
    expect(result.data!.claims[0].text).toBe('争夺女儿抚养权');
    expect(result.data!.keyDates).toHaveLength(1);
  });

  it('提取阶段 AI 返回空时，shouldCreate 降级为 false', async () => {
    const detectJson = JSON.stringify({
      shouldCreate: true,
      reason: '有当事人',
    });

    mockChatCompletion
      .mockResolvedValueOnce(makeAiResponse(detectJson))
      .mockResolvedValueOnce(makeAiResponse('非 JSON 内容'));

    const result = await detectAndExtractCaseProposal(
      '张三委托处理案件',
      [],
      MESSAGE_ID,
      PROPOSAL_ID,
      TODAY
    );

    expect(result.shouldCreate).toBe(false);
  });

  it('suggestedActions 中正确设置 dependsOnSequence', async () => {
    const detectJson = JSON.stringify({
      shouldCreate: true,
      reason: '有当事人',
    });
    const extractJson = JSON.stringify({
      parties: [{ name: '王五', role: 'CLIENT', meta: { confidence: 0.9 } }],
      caseType: '合同纠纷',
      caseTypeMeta: { confidence: 0.85 },
      claims: [{ text: '追偿货款', meta: { confidence: 0.9 } }],
      keyDates: [
        {
          date: '2026-03-01',
          description: '合同签署',
          type: 'OTHER',
          meta: { confidence: 0.9 },
        },
      ],
      disputeFocuses: [],
    });

    mockChatCompletion
      .mockResolvedValueOnce(makeAiResponse(detectJson))
      .mockResolvedValueOnce(makeAiResponse(extractJson));

    const result = await detectAndExtractCaseProposal(
      '王五委托追讨货款合同纠纷',
      [],
      MESSAGE_ID,
      PROPOSAL_ID,
      TODAY
    );

    expect(result.shouldCreate).toBe(true);
    const actions = result.data!.suggestedActions;

    // CREATE_CLIENT (seq=0) 无依赖
    const clientAction = actions.find(a => a.actionType === 'CREATE_CLIENT');
    expect(clientAction).toBeDefined();
    expect(clientAction!.dependsOnSequence).toBeUndefined();

    // CREATE_CASE (seq=1) 依赖 seq=0
    const caseAction = actions.find(a => a.actionType === 'CREATE_CASE');
    expect(caseAction).toBeDefined();
    expect(caseAction!.dependsOnSequence).toBe(0);

    // ADD_TIMELINE_EVENT (seq=2) 依赖 seq=1
    const timelineAction = actions.find(
      a => a.actionType === 'ADD_TIMELINE_EVENT'
    );
    expect(timelineAction).toBeDefined();
    expect(timelineAction!.dependsOnSequence).toBe(1);
  });

  it('附件文本与对话内容合并后一起发给 AI', async () => {
    const detectJson = JSON.stringify({
      shouldCreate: false,
      reason: '信息不足',
    });
    mockChatCompletion.mockResolvedValue(makeAiResponse(detectJson));

    await detectAndExtractCaseProposal(
      '请帮我分析这份委托书',
      ['委托书正文：委托人张三，案件类型：劳动仲裁'],
      MESSAGE_ID,
      PROPOSAL_ID,
      TODAY
    );

    const calledContent = mockChatCompletion.mock.calls[0][0].messages[0]
      .content as string;
    expect(calledContent).toContain('委托书正文');
    expect(calledContent).toContain('委托人张三');
  });
});
