import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { LawGraphTab } from '@/app/cases/[id]/components/LawGraphTab';

const pushMock = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: pushMock,
  }),
}));

jest.mock('@/components/law-article/LawArticleGraphVisualization', () => ({
  LawArticleGraphVisualization: ({
    graphData,
    centerArticleId,
  }: {
    graphData?: { nodes: Array<{ id: string }> };
    centerArticleId?: string;
  }) => (
    <div data-testid='case-law-graph'>
      {graphData
        ? `graphData:${graphData.nodes.map(node => node.id).join(',')}`
        : `center:${centerArticleId}`}
    </div>
  ),
}));

jest.mock('@/components/debate/ReasoningChainViewer', () => ({
  ReasoningChainViewer: () => <div data-testid='reasoning-viewer' />,
}));

global.fetch = jest.fn() as jest.MockedFunction<typeof fetch>;

describe('LawGraphTab', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('应该直接使用案件图谱接口返回的graphData渲染，而不是重新按中心法条拉取普通图谱', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          hasData: true,
          articleIds: ['article-case'],
          conflicts: [],
          evolutionChain: [],
          recommendedArticleIds: ['article-recommended'],
          keyInferences: [],
          applicationAnalysis: {
            version: '2.0',
            summary: {
              coreCount: 1,
              supportingCount: 1,
              riskCount: 0,
              overallConfidence: 'high',
              headline: '已形成以 民法典第667条 为核心的法条适用路线',
            },
            coreArticles: [
              {
                articleId: 'article-case',
                title: '民法典第667条',
                lawName: '民法典',
                articleNumber: '667',
                score: 0.91,
                confidence: 'high',
                sourceLabel: '适用性分析',
                status: 'VALID',
                reasons: ['借款合同关系基础'],
                useGuidance: '可作为本案主轴法条使用。',
                excerpt:
                  '借款合同是借款人向贷款人借款，到期返还借款并支付利息的合同。',
              },
            ],
            supportingArticles: [
              {
                articleId: 'article-recommended',
                title: '民法典第668条',
                relationType: 'COMPLETES',
                relationLabel: '补充',
                anchorArticleId: 'article-case',
                anchorTitle: '民法典第667条',
                confidence: 'medium',
                score: 0.72,
                reason: '可补充说明借款合同形式。',
              },
            ],
            riskArticles: [],
            applicationRoute: [
              {
                id: 'claim_basis',
                title: '确定请求权或抗辩基础',
                status: 'ready',
                articleIds: ['article-case'],
                description: '优先围绕高适用度法条组织诉请。',
                action: '把最高适用度法条放在论证主轴。',
              },
            ],
            nextActions: ['把核心法条逐条映射到争议焦点和证据目录。'],
          },
          graphData: {
            nodes: [
              {
                id: 'article-case',
                lawName: '民法典',
                articleNumber: '667',
                category: '#3B82F6',
                level: 0,
              },
              {
                id: 'article-recommended',
                lawName: '民法典',
                articleNumber: '668',
                category: '#10B981',
                level: 1,
              },
            ],
            links: [
              {
                source: 'article-case',
                target: 'article-recommended',
                relationType: 'COMPLETES',
                strength: 0.8,
                confidence: 0.9,
              },
            ],
          },
        },
      }),
    });

    render(<LawGraphTab caseId='case-1' />);

    await waitFor(() => {
      expect(screen.getByTestId('case-law-graph')).toHaveTextContent(
        'graphData:article-case,article-recommended'
      );
    });

    expect(screen.getByText('案件法条适用分析 2.0')).toBeInTheDocument();
    expect(
      screen.getByText('已形成以 民法典第667条 为核心的法条适用路线')
    ).toBeInTheDocument();
    expect(screen.getByText('本案核心法条')).toBeInTheDocument();
    expect(screen.getByText('适用路线图')).toBeInTheDocument();
    expect(screen.getByText('民法典第667条')).toBeInTheDocument();
    expect(screen.getByText('民法典第668条 →')).toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledWith('/api/cases/case-1/law-graph', {
      credentials: 'include',
    });
  });

  it('无数据时应该提示通过法条适用性分析或辩论沉淀法条', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          hasData: false,
          articleIds: [],
          conflicts: [],
          evolutionChain: [],
          recommendedArticleIds: [],
          keyInferences: [],
          applicationAnalysis: {
            version: '2.0',
            summary: {
              coreCount: 0,
              supportingCount: 0,
              riskCount: 0,
              overallConfidence: 'low',
              headline: '尚未形成可用的法条适用分析',
            },
            coreArticles: [],
            supportingArticles: [],
            riskArticles: [],
            applicationRoute: [],
            nextActions: [],
          },
          graphData: { nodes: [], links: [] },
        },
      }),
    });

    render(<LawGraphTab caseId='case-1' />);

    expect(
      await screen.findByText(
        '完成法条适用性分析或辩论后，系统会沉淀涉案法条并自动生成关系图谱。'
      )
    ).toBeInTheDocument();
  });
});
