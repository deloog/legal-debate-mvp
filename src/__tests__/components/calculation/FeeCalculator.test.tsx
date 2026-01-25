import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import FeeCalculator from '@/components/calculation/FeeCalculator';
import { FeeType, LitigationCaseType } from '@/types/calculation';

// Mock子组件以简化测试
jest.mock('@/components/calculation/FeeCalculatorTabs', () => ({
  FeeCalculatorTabs: ({
    activeTab,
    onTabChange,
  }: {
    activeTab: FeeType;
    onTabChange: (tab: FeeType) => void;
  }) => (
    <div data-testid='fee-calculator-tabs'>
      <button onClick={() => onTabChange(FeeType.LAWYER_FEE)}>律师费</button>
      <button onClick={() => onTabChange(FeeType.LITIGATION_FEE)}>
        诉讼费
      </button>
      <button onClick={() => onTabChange(FeeType.TRAVEL_EXPENSE)}>
        差旅费
      </button>
      <span data-testid='active-tab'>{activeTab}</span>
    </div>
  ),
}));

jest.mock('@/components/calculation/LawyerFeeForm', () => ({
  LawyerFeeForm: () => <div data-testid='lawyer-fee-form'>Lawyer Fee Form</div>,
}));

jest.mock('@/components/calculation/LitigationFeeForm', () => ({
  LitigationFeeForm: () => (
    <div data-testid='litigation-fee-form'>Litigation Fee Form</div>
  ),
}));

jest.mock('@/components/calculation/TravelExpenseForm', () => ({
  TravelExpenseForm: () => (
    <div data-testid='travel-expense-form'>Travel Expense Form</div>
  ),
}));

jest.mock('@/components/calculation/FeeBreakdown', () => {
  return function DummyFeeBreakdown({ result }: { result: any }) {
    return (
      <div data-testid='fee-breakdown'>
        Total: {result.totalAmount} {result.currency}
      </div>
    );
  };
});

describe('FeeCalculator', () => {
  beforeEach(() => {
    // 重置 fetch mock
    global.fetch = jest.fn();
  });

  it('renders correctly with default lawyer fee tab', () => {
    render(<FeeCalculator />);
    expect(screen.getByTestId('fee-calculator-tabs')).toBeInTheDocument();
    expect(screen.getByTestId('active-tab')).toHaveTextContent(
      FeeType.LAWYER_FEE
    );
    expect(screen.getByTestId('lawyer-fee-form')).toBeInTheDocument();
    expect(screen.queryByTestId('litigation-fee-form')).not.toBeInTheDocument();
  });

  it('switches tabs correctly', () => {
    render(<FeeCalculator />);

    fireEvent.click(screen.getByText('诉讼费'));
    expect(screen.getByTestId('active-tab')).toHaveTextContent(
      FeeType.LITIGATION_FEE
    );
    expect(screen.getByTestId('litigation-fee-form')).toBeInTheDocument();
    expect(screen.queryByTestId('lawyer-fee-form')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('差旅费'));
    expect(screen.getByTestId('active-tab')).toHaveTextContent(
      FeeType.TRAVEL_EXPENSE
    );
    expect(screen.getByTestId('travel-expense-form')).toBeInTheDocument();
  });

  it('calls API and displays result on calculation', async () => {
    const mockResult = {
      totalAmount: 1000,
      currency: 'CNY',
      items: [],
      breakdown: {
        [FeeType.LAWYER_FEE]: 1000,
      },
    };

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: mockResult }),
    });

    render(<FeeCalculator />);

    fireEvent.click(screen.getByText('开始计算'));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/calculate/fees',
        expect.objectContaining({
          method: 'POST',
        })
      );
    });

    await waitFor(() => {
      expect(screen.getByTestId('fee-breakdown')).toBeInTheDocument();
    });

    expect(screen.getByTestId('fee-breakdown')).toHaveTextContent(
      'Total: 1000 CNY'
    );
  });

  it('sends correct payload for Litigation Fee', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: {
          totalAmount: 500,
          currency: 'CNY',
          items: [],
          breakdown: {},
        },
      }),
    });

    render(<FeeCalculator />);

    // Switch to Litigation Fee tab
    fireEvent.click(screen.getByText('诉讼费'));

    // Click calculate
    fireEvent.click(screen.getByText('开始计算'));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/calculate/fees',
        expect.objectContaining({
          body: expect.stringContaining('"type":"LITIGATION_FEE"'),
        })
      );
    });
  });

  it('sends correct payload for Travel Expense', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: {
          totalAmount: 200,
          currency: 'CNY',
          items: [],
          breakdown: {},
        },
      }),
    });

    render(<FeeCalculator />);

    // Switch to Travel Expense tab
    fireEvent.click(screen.getByText('差旅费'));

    // Click calculate
    fireEvent.click(screen.getByText('开始计算'));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/calculate/fees',
        expect.objectContaining({
          body: expect.stringContaining('"type":"TRAVEL_EXPENSE"'),
        })
      );
    });
  });

  it('handles non-200 API response', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    const alertSpy = jest.spyOn(window, 'alert').mockImplementation();

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
    });

    render(<FeeCalculator />);

    fireEvent.click(screen.getByText('开始计算'));

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith(
        'Error calculating fee:',
        expect.any(Error)
      );
      expect(alertSpy).toHaveBeenCalledWith('计算失败，请检查输入参数');
    });

    consoleSpy.mockRestore();
    alertSpy.mockRestore();
  });

  it('handles API error', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    const alertSpy = jest.spyOn(window, 'alert').mockImplementation();

    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('API Error'));

    render(<FeeCalculator />);

    fireEvent.click(screen.getByText('开始计算'));

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalled();
      expect(alertSpy).toHaveBeenCalledWith('计算失败，请检查输入参数');
    });

    consoleSpy.mockRestore();
    alertSpy.mockRestore();
  });
});
