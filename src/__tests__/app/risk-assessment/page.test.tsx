/**
 * 风险评估页面组件测试
 * 测试覆盖率目标：90%+
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import RiskAssessmentPage from '@/app/risk-assessment/page';

// Mock fetch
global.fetch = jest.fn();

describe('风险评估页面测试', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          id: 'assessment-001',
          caseId: 'case-001',
          caseTitle: '测试案件',
          assessedAt: new Date().toISOString(),
          assessmentTime: 1500,
          overallRiskLevel: 'medium',
          overallRiskScore: 65,
          winProbability: 70,
          risks: [],
          statistics: {
            totalRisks: 3,
            criticalRisks: 0,
            highRisks: 1,
            mediumRisks: 2,
            lowRisks: 0,
            byCategory: {},
            byType: {},
          },
          suggestions: [],
          timeline: [],
        },
      }),
    });
  });

  it('应该正确渲染页面标题', () => {
    render(<RiskAssessmentPage />);
    expect(screen.getByText('法律风险评估')).toBeInTheDocument();
  });

  it('应该显示风险评估表单', () => {
    render(<RiskAssessmentPage />);
    expect(screen.getByLabelText(/案件标题/)).toBeInTheDocument();
    expect(screen.getByLabelText(/案件类型/)).toBeInTheDocument();
    expect(screen.getByLabelText(/案件描述/)).toBeInTheDocument();
  });

  it('应该显示当事人信息输入框', () => {
    render(<RiskAssessmentPage />);
    expect(screen.getByLabelText(/原告/)).toBeInTheDocument();
    expect(screen.getByLabelText(/被告/)).toBeInTheDocument();
  });

  it('应该允许添加案件事实', () => {
    render(<RiskAssessmentPage />);
    const addFactButton = screen.getByText('添加事实');
    fireEvent.click(addFactButton);

    const factInputs = screen.getAllByPlaceholderText(/请输入案件事实/);
    expect(factInputs.length).toBeGreaterThan(0);
  });

  it('应该允许添加诉讼请求', () => {
    render(<RiskAssessmentPage />);
    const addClaimButton = screen.getByText('添加诉讼请求');
    fireEvent.click(addClaimButton);

    const claimInputs = screen.getAllByPlaceholderText(/请输入诉讼请求/);
    expect(claimInputs.length).toBeGreaterThan(0);
  });

  it('应该允许添加证据', () => {
    render(<RiskAssessmentPage />);
    const addEvidenceButton = screen.getByText('添加证据');
    fireEvent.click(addEvidenceButton);

    expect(screen.getByPlaceholderText('证据名称')).toBeInTheDocument();
  });

  it('应该允许添加法律依据', () => {
    render(<RiskAssessmentPage />);
    const addLegalBasisButton = screen.getByText('添加法律依据');
    fireEvent.click(addLegalBasisButton);

    expect(screen.getByPlaceholderText('法律名称')).toBeInTheDocument();
  });

  it('应该验证必填字段', async () => {
    render(<RiskAssessmentPage />);
    const submitButton = screen.getByText('开始评估');

    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/请填写案件标题/)).toBeInTheDocument();
    });
  });

  it('应该成功提交评估表单', async () => {
    render(<RiskAssessmentPage />);

    // 填写表单
    fireEvent.change(screen.getByLabelText(/案件标题/), {
      target: { value: '测试案件' },
    });
    fireEvent.change(screen.getByLabelText(/案件类型/), {
      target: { value: '劳动争议' },
    });
    fireEvent.change(screen.getByLabelText(/案件描述/), {
      target: { value: '这是一个测试案件' },
    });
    fireEvent.change(screen.getByLabelText(/原告/), {
      target: { value: '张三' },
    });
    fireEvent.change(screen.getByLabelText(/被告/), {
      target: { value: '某公司' },
    });

    // 添加事实
    fireEvent.click(screen.getByText('添加事实'));
    const factInput = screen.getByPlaceholderText(/请输入案件事实/);
    fireEvent.change(factInput, { target: { value: '事实1' } });

    // 添加诉讼请求
    fireEvent.click(screen.getByText('添加诉讼请求'));
    const claimInput = screen.getByPlaceholderText(/请输入诉讼请求/);
    fireEvent.change(claimInput, { target: { value: '请求1' } });

    // 提交表单
    const submitButton = screen.getByText('开始评估');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/risk-assessment',
        expect.objectContaining({
          method: 'POST',
        })
      );
    });
  });

  it('应该显示评估结果', async () => {
    render(<RiskAssessmentPage />);

    // 填写并提交表单
    fireEvent.change(screen.getByLabelText(/案件标题/), {
      target: { value: '测试案件' },
    });
    fireEvent.change(screen.getByLabelText(/案件类型/), {
      target: { value: '劳动争议' },
    });
    fireEvent.change(screen.getByLabelText(/案件描述/), {
      target: { value: '这是一个测试案件' },
    });
    fireEvent.change(screen.getByLabelText(/原告/), {
      target: { value: '张三' },
    });
    fireEvent.change(screen.getByLabelText(/被告/), {
      target: { value: '某公司' },
    });

    fireEvent.click(screen.getByText('添加事实'));
    fireEvent.change(screen.getByPlaceholderText(/请输入案件事实/), {
      target: { value: '事实1' },
    });

    fireEvent.click(screen.getByText('添加诉讼请求'));
    fireEvent.change(screen.getByPlaceholderText(/请输入诉讼请求/), {
      target: { value: '请求1' },
    });

    fireEvent.click(screen.getByText('开始评估'));

    await waitFor(() => {
      expect(screen.getByText('评估结果')).toBeInTheDocument();
      expect(screen.getByText(/总体风险等级/)).toBeInTheDocument();
      expect(screen.getByText(/风险评分/)).toBeInTheDocument();
    });
  });

  it('应该显示风险统计图表', async () => {
    render(<RiskAssessmentPage />);

    // 提交表单并等待结果
    fireEvent.change(screen.getByLabelText(/案件标题/), {
      target: { value: '测试案件' },
    });
    fireEvent.change(screen.getByLabelText(/案件类型/), {
      target: { value: '劳动争议' },
    });
    fireEvent.change(screen.getByLabelText(/案件描述/), {
      target: { value: '这是一个测试案件' },
    });
    fireEvent.change(screen.getByLabelText(/原告/), {
      target: { value: '张三' },
    });
    fireEvent.change(screen.getByLabelText(/被告/), {
      target: { value: '某公司' },
    });

    fireEvent.click(screen.getByText('添加事实'));
    fireEvent.change(screen.getByPlaceholderText(/请输入案件事实/), {
      target: { value: '事实1' },
    });

    fireEvent.click(screen.getByText('添加诉讼请求'));
    fireEvent.change(screen.getByPlaceholderText(/请输入诉讼请求/), {
      target: { value: '请求1' },
    });

    fireEvent.click(screen.getByText('开始评估'));

    await waitFor(() => {
      expect(screen.getByText('风险分布')).toBeInTheDocument();
    });
  });

  it('应该处理API错误', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      json: async () => ({
        success: false,
        error: {
          code: 'ASSESSMENT_ERROR',
          message: '评估失败',
        },
      }),
    });

    render(<RiskAssessmentPage />);

    fireEvent.change(screen.getByLabelText(/案件标题/), {
      target: { value: '测试案件' },
    });
    fireEvent.change(screen.getByLabelText(/案件类型/), {
      target: { value: '劳动争议' },
    });
    fireEvent.change(screen.getByLabelText(/案件描述/), {
      target: { value: '这是一个测试案件' },
    });
    fireEvent.change(screen.getByLabelText(/原告/), {
      target: { value: '张三' },
    });
    fireEvent.change(screen.getByLabelText(/被告/), {
      target: { value: '某公司' },
    });

    fireEvent.click(screen.getByText('添加事实'));
    fireEvent.change(screen.getByPlaceholderText(/请输入案件事实/), {
      target: { value: '事实1' },
    });

    fireEvent.click(screen.getByText('添加诉讼请求'));
    fireEvent.change(screen.getByPlaceholderText(/请输入诉讼请求/), {
      target: { value: '请求1' },
    });

    fireEvent.click(screen.getByText('开始评估'));

    await waitFor(() => {
      expect(screen.getByText(/评估失败/)).toBeInTheDocument();
    });
  });

  it('应该允许删除案件事实', () => {
    render(<RiskAssessmentPage />);

    // 添加两个事实
    fireEvent.click(screen.getByText('添加事实'));
    fireEvent.click(screen.getByText('添加事实'));

    const deleteButtons = screen.getAllByLabelText('删除事实');
    expect(deleteButtons.length).toBe(2);

    // 删除第一个
    fireEvent.click(deleteButtons[0]);

    const remainingButtons = screen.getAllByLabelText('删除事实');
    expect(remainingButtons.length).toBe(1);
  });

  it('应该允许删除诉讼请求', () => {
    render(<RiskAssessmentPage />);

    // 添加两个诉讼请求
    fireEvent.click(screen.getByText('添加诉讼请求'));
    fireEvent.click(screen.getByText('添加诉讼请求'));

    const deleteButtons = screen.getAllByLabelText('删除诉讼请求');
    expect(deleteButtons.length).toBe(2);

    // 删除第一个
    fireEvent.click(deleteButtons[0]);

    const remainingButtons = screen.getAllByLabelText('删除诉讼请求');
    expect(remainingButtons.length).toBe(1);
  });

  it('应该显示加载状态', async () => {
    (global.fetch as jest.Mock).mockImplementationOnce(
      () =>
        new Promise(resolve =>
          setTimeout(
            () =>
              resolve({
                ok: true,
                json: async () => ({ success: true, data: {} }),
              }),
            100
          )
        )
    );

    render(<RiskAssessmentPage />);

    fireEvent.change(screen.getByLabelText(/案件标题/), {
      target: { value: '测试案件' },
    });
    fireEvent.change(screen.getByLabelText(/案件类型/), {
      target: { value: '劳动争议' },
    });
    fireEvent.change(screen.getByLabelText(/案件描述/), {
      target: { value: '这是一个测试案件' },
    });
    fireEvent.change(screen.getByLabelText(/原告/), {
      target: { value: '张三' },
    });
    fireEvent.change(screen.getByLabelText(/被告/), {
      target: { value: '某公司' },
    });

    fireEvent.click(screen.getByText('添加事实'));
    fireEvent.change(screen.getByPlaceholderText(/请输入案件事实/), {
      target: { value: '事实1' },
    });

    fireEvent.click(screen.getByText('添加诉讼请求'));
    fireEvent.change(screen.getByPlaceholderText(/请输入诉讼请求/), {
      target: { value: '请求1' },
    });

    fireEvent.click(screen.getByText('开始评估'));

    expect(screen.getByText('评估中...')).toBeInTheDocument();
  });
});
