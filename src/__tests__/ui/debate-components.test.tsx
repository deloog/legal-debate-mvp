import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  Argument,
  ArgumentType,
  DebateRound,
  ArgumentSide,
  RoundStatus,
} from '@prisma/client';
import { ArgumentCard } from '@/app/debates/components/argument-card';
import { ArgumentColumn } from '@/app/debates/components/argument-column';
import { RoundSelector } from '@/app/debates/components/round-selector';
import { StreamingOutput } from '@/app/debates/components/streaming-output';

/**
 * 辩论界面组件测试套件
 * 测试辩论界面的各个组件功能
 */

describe('辩论界面组件', () => {
  describe('ArgumentCard 组件', () => {
    const mockArgument: Argument = {
      id: 'arg1',
      roundId: 'round1',
      side: 'PLAINTIFF' as ArgumentSide,
      type: 'MAIN_POINT' as ArgumentType,
      content: '这是原告方的主要论点：合同违约责任应由被告承担',
      createdAt: new Date('2024-01-15T10:00:00.000Z'),
      updatedAt: new Date('2024-01-15T10:00:00.000Z'),
      aiProvider: 'deepseek',
      generationTime: 1500,
      confidence: 0.85,
      reasoning: null,
      legalBasis: null,
      logicScore: null,
      legalScore: null,
      overallScore: null,
    };

    it('应该正确渲染论点卡片', () => {
      render(<ArgumentCard argument={mockArgument} />);

      expect(screen.getByText('主要论点')).toBeInTheDocument();
      expect(screen.getByText(/这是原告方的主要论点/)).toBeInTheDocument();
    });

    it('应该显示AI提供者信息', () => {
      render(<ArgumentCard argument={mockArgument} />);

      expect(screen.getByText('AI:')).toBeInTheDocument();
      expect(screen.getByText('deepseek')).toBeInTheDocument();
    });

    it('应该显示置信度', () => {
      render(<ArgumentCard argument={mockArgument} />);

      expect(screen.getByText('置信度:')).toBeInTheDocument();
      expect(screen.getByText('85%')).toBeInTheDocument();
    });

    it('应该显示生成时间', () => {
      render(<ArgumentCard argument={mockArgument} />);

      expect(screen.getByText('1500ms')).toBeInTheDocument();
    });

    it('应该显示流式输出状态', () => {
      render(<ArgumentCard argument={mockArgument} isStreaming />);

      expect(screen.getByText('AI生成中...')).toBeInTheDocument();
    });

    it('应该展开详细信息', async () => {
      const user = userEvent.setup();
      render(<ArgumentCard argument={mockArgument} />);

      const expandButton = screen.getByText('详细信息');
      await user.click(expandButton);

      expect(screen.getByText('论点ID:')).toBeInTheDocument();
      expect(screen.getByText('论点方:')).toBeInTheDocument();
      expect(screen.getByText('原告')).toBeInTheDocument();
    });

    it('应该正确显示不同的论点类型', () => {
      const rebuttalArgument = {
        ...mockArgument,
        type: 'REBUTTAL' as ArgumentType,
      };
      render(<ArgumentCard argument={rebuttalArgument} />);

      expect(screen.getByText('反驳论点')).toBeInTheDocument();
    });

    it('应该正确显示证据类型', () => {
      const evidenceArgument = {
        ...mockArgument,
        type: 'EVIDENCE' as ArgumentType,
      };
      render(<ArgumentCard argument={evidenceArgument} />);

      expect(screen.getByText('证据引用')).toBeInTheDocument();
    });

    it('应该正确显示法律依据类型', () => {
      const legalArgument = {
        ...mockArgument,
        type: 'LEGAL_BASIS' as ArgumentType,
      };
      render(<ArgumentCard argument={legalArgument} />);

      expect(screen.getByText('法律依据')).toBeInTheDocument();
    });
  });

  describe('ArgumentColumn 组件', () => {
    const mockArguments: Argument[] = [
      {
        id: 'arg1',
        roundId: 'round1',
        side: 'PLAINTIFF' as ArgumentSide,
        type: 'MAIN_POINT' as ArgumentType,
        content: '原告论点1',
        createdAt: new Date('2024-01-15T10:00:00.000Z'),
        updatedAt: new Date('2024-01-15T10:00:00.000Z'),
        aiProvider: 'deepseek',
        generationTime: 1000,
        confidence: 0.9,
        reasoning: null,
        legalBasis: null,
        logicScore: null,
        legalScore: null,
        overallScore: null,
      },
      {
        id: 'arg2',
        roundId: 'round1',
        side: 'PLAINTIFF' as ArgumentSide,
        type: 'SUPPORTING' as ArgumentType,
        content: '支持论据',
        createdAt: new Date('2024-01-15T10:05:00.000Z'),
        updatedAt: new Date('2024-01-15T10:05:00.000Z'),
        aiProvider: 'deepseek',
        generationTime: 1000,
        confidence: 0.9,
        reasoning: null,
        legalBasis: null,
        logicScore: null,
        legalScore: null,
        overallScore: null,
      },
    ];

    it('应该正确渲染论点列', () => {
      render(
        <ArgumentColumn
          title='原告方'
          side='PLAINTIFF'
          arguments={mockArguments}
          accentColor='blue'
        />
      );

      expect(screen.getByText('原告方')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument();
    });

    it('应该筛选正确方别的论点', () => {
      render(
        <ArgumentColumn
          title='被告方'
          side='DEFENDANT'
          arguments={mockArguments}
          accentColor='red'
        />
      );

      expect(screen.getByText('被告方')).toBeInTheDocument();
      expect(screen.getByText('暂无论点')).toBeInTheDocument();
    });

    it('应该显示正在流式输出的论点', () => {
      render(
        <ArgumentColumn
          title='原告方'
          side='PLAINTIFF'
          arguments={mockArguments}
          streamingArgumentId='arg1'
          accentColor='blue'
        />
      );

      expect(screen.getByText('AI生成中...')).toBeInTheDocument();
    });

    it('应该正确使用不同的强调色', () => {
      const { rerender } = render(
        <ArgumentColumn
          title='被告方'
          side='DEFENDANT'
          arguments={mockArguments}
          accentColor='red'
        />
      );

      expect(screen.getByText('被告方')).toHaveClass('bg-red-500');

      rerender(
        <ArgumentColumn
          title='中立方'
          side='NEUTRAL'
          arguments={mockArguments}
          accentColor='gray'
        />
      );

      expect(screen.getByText('中立方')).toHaveClass('bg-gray-500');
    });
  });

  describe('RoundSelector 组件', () => {
    const mockRounds: DebateRound[] = [
      {
        id: 'round1',
        debateId: 'debate1',
        roundNumber: 1,
        status: 'COMPLETED',
        startedAt: new Date('2024-01-15T10:00:00.000Z'),
        completedAt: new Date('2024-01-15T11:00:00.000Z'),
        createdAt: new Date('2024-01-15T09:00:00.000Z'),
        updatedAt: new Date('2024-01-15T11:00:00.000Z'),
      },
      {
        id: 'round2',
        debateId: 'debate1',
        roundNumber: 2,
        status: 'IN_PROGRESS',
        startedAt: new Date('2024-01-15T11:00:00.000Z'),
        completedAt: new Date('2024-01-15T12:00:00.000Z'),
        createdAt: new Date('2024-01-15T10:00:00.000Z'),
        updatedAt: new Date('2024-01-15T12:00:00.000Z'),
      },
      {
        id: 'round3',
        debateId: 'debate1',
        roundNumber: 3,
        status: 'PENDING',
        startedAt: new Date('2024-01-15T12:00:00.000Z'),
        completedAt: new Date('2024-01-15T13:00:00.000Z'),
        createdAt: new Date('2024-01-15T11:00:00.000Z'),
        updatedAt: new Date('2024-01-15T13:00:00.000Z'),
      },
    ];

    it('应该正确渲染轮次选择器', () => {
      const onRoundChange = jest.fn();
      render(
        <RoundSelector
          rounds={mockRounds}
          currentRoundId='round1'
          onRoundChange={onRoundChange}
        />
      );

      expect(screen.getByText('选择轮次')).toBeInTheDocument();
      expect(screen.getByText('第1轮')).toBeInTheDocument();
      expect(screen.getByText('第2轮')).toBeInTheDocument();
      expect(screen.getByText('第3轮')).toBeInTheDocument();
    });

    it('应该正确显示轮次状态', () => {
      render(
        <RoundSelector
          rounds={mockRounds}
          currentRoundId='round1'
          onRoundChange={() => {}}
        />
      );

      expect(screen.getByText('已完成')).toBeInTheDocument();
      expect(screen.getByText('进行中')).toBeInTheDocument();
      expect(screen.getByText('待开始')).toBeInTheDocument();
    });

    it('应该高亮当前选中的轮次', () => {
      render(
        <RoundSelector
          rounds={mockRounds}
          currentRoundId='round1'
          onRoundChange={() => {}}
        />
      );

      const round1Button = screen.getByText('第1轮').closest('button');
      expect(round1Button).toHaveClass('border-blue-500');
    });

    it('点击轮次应该调用回调', async () => {
      const user = userEvent.setup();
      const onRoundChange = jest.fn();
      render(
        <RoundSelector
          rounds={mockRounds}
          currentRoundId='round1'
          onRoundChange={onRoundChange}
        />
      );

      await user.click(screen.getByText('第2轮'));

      expect(onRoundChange).toHaveBeenCalledWith('round2');
    });

    it('应该显示轮次开始时间', () => {
      render(
        <RoundSelector
          rounds={mockRounds}
          currentRoundId='round1'
          onRoundChange={() => {}}
        />
      );

      expect(screen.getByText(/2024/)).toBeInTheDocument();
    });

    it('应该处理空轮次列表', () => {
      render(
        <RoundSelector
          rounds={[]}
          currentRoundId={null}
          onRoundChange={() => {}}
        />
      );

      expect(screen.getByText('暂无轮次')).toBeInTheDocument();
    });

    it('应该正确显示已终止状态', () => {
      const terminatedRound: DebateRound[] = [
        {
          ...mockRounds[0],
          status: 'TERMINATED' as RoundStatus,
        },
      ];

      render(
        <RoundSelector
          rounds={terminatedRound}
          currentRoundId='round1'
          onRoundChange={() => {}}
        />
      );

      expect(screen.getByText('已终止')).toBeInTheDocument();
    });
  });

  describe('StreamingOutput 组件', () => {
    it('应该正确渲染流式输出组件', () => {
      render(
        <StreamingOutput
          content='这是流式输出的测试内容'
          isStreaming={false}
          side='PLAINTIFF'
          accentColor='blue'
        />
      );

      expect(screen.getByText('原告')).toBeInTheDocument();
      expect(screen.getByText(/这是流式输出的测试内容/)).toBeInTheDocument();
    });

    it('应该显示生成中状态', () => {
      render(
        <StreamingOutput
          content=''
          isStreaming
          side='PLAINTIFF'
          accentColor='blue'
        />
      );

      expect(screen.getByText('生成中...')).toBeInTheDocument();
      expect(screen.getByText('AI正在生成论点...')).toBeInTheDocument();
    });

    it('应该显示已完成状态', () => {
      render(
        <StreamingOutput
          content='已完成的内容'
          isStreaming={false}
          side='DEFENDANT'
          accentColor='red'
        />
      );

      expect(screen.getByText('已完成')).toBeInTheDocument();
    });

    it('应该显示进度条', () => {
      render(
        <StreamingOutput
          content='部分内容'
          isStreaming
          side='PLAINTIFF'
          accentColor='blue'
        />
      );

      const progressBar = document.querySelector('.bg-blue-500');
      expect(progressBar).toBeInTheDocument();
    });

    it('应该使用不同的颜色风格', () => {
      const { rerender } = render(
        <StreamingOutput
          content='测试内容'
          isStreaming={false}
          side='PLAINTIFF'
          accentColor='blue'
        />
      );

      expect(screen.getByText('原告')).toBeInTheDocument();

      rerender(
        <StreamingOutput
          content='测试内容'
          isStreaming={false}
          side='DEFENDANT'
          accentColor='red'
        />
      );

      expect(screen.getByText('被告')).toBeInTheDocument();
    });

    it('应该在非流式状态且无内容时不渲染', () => {
      const { container } = render(
        <StreamingOutput
          content=''
          isStreaming={false}
          side='PLAINTIFF'
          accentColor='blue'
        />
      );

      expect(container.firstChild).toBeNull();
    });
  });

  describe('边界情况测试', () => {
    it('ArgumentCard应该处理缺少AI信息的论点', () => {
      const argumentWithoutAI = {
        id: 'arg1',
        roundId: 'round1',
        side: 'PLAINTIFF' as ArgumentSide,
        type: 'MAIN_POINT' as ArgumentType,
        content: '测试内容',
        createdAt: new Date(),
        updatedAt: new Date(),
      } as Argument;

      render(<ArgumentCard argument={argumentWithoutAI} />);

      expect(screen.queryByText('AI:')).not.toBeInTheDocument();
    });

    it('ArgumentCard应该处理被告方论点', () => {
      const defendantArgument = {
        id: 'arg1',
        roundId: 'round1',
        side: 'DEFENDANT' as ArgumentSide,
        type: 'MAIN_POINT' as ArgumentType,
        content: '被告方论点',
        createdAt: new Date(),
        updatedAt: new Date(),
      } as Argument;

      render(<ArgumentCard argument={defendantArgument} />);

      expect(screen.getByText('被告')).toBeInTheDocument();
    });

    it('ArgumentColumn应该处理空论点列表', () => {
      render(
        <ArgumentColumn
          title='原告方'
          side='PLAINTIFF'
          arguments={[]}
          accentColor='blue'
        />
      );

      expect(screen.getByText('暂无论点')).toBeInTheDocument();
    });

    it('RoundSelector应该处理单轮次', () => {
      const singleRound: DebateRound[] = [
        {
          id: 'round1',
          debateId: 'debate1',
          roundNumber: 1,
          status: 'COMPLETED',
          startedAt: new Date(),
          completedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      render(
        <RoundSelector
          rounds={singleRound}
          currentRoundId='round1'
          onRoundChange={() => {}}
        />
      );

      expect(screen.getByText('第1轮')).toBeInTheDocument();
    });
  });
});
