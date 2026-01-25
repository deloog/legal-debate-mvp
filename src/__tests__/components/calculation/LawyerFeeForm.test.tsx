import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { LawyerFeeForm } from '@/components/calculation/LawyerFeeForm';
import { BillingMode } from '@/types/calculation';

describe('LawyerFeeForm', () => {
  const mockParams = {
    hours: 10,
    caseAmount: 50000,
    isWin: false,
    winAmount: 0,
    config: {
      mode: BillingMode.HOURLY,
      currency: 'CNY',
    },
  };

  const mockOnChange = jest.fn();

  it('renders correctly', () => {
    render(<LawyerFeeForm params={mockParams} onChange={mockOnChange} />);
    expect(screen.getByLabelText('工作时长 (小时)')).toHaveValue(10);
    expect(screen.getByLabelText('案件金额 (元)')).toHaveValue(50000);
  });

  it('calls onChange when inputs change', () => {
    render(<LawyerFeeForm params={mockParams} onChange={mockOnChange} />);

    fireEvent.change(screen.getByLabelText('工作时长 (小时)'), {
      target: { value: '20' },
    });
    expect(mockOnChange).toHaveBeenCalledWith({
      ...mockParams,
      hours: 20,
    });

    fireEvent.change(screen.getByLabelText('案件金额 (元)'), {
      target: { value: '100000' },
    });
    expect(mockOnChange).toHaveBeenCalledWith({
      ...mockParams,
      caseAmount: 100000,
    });
  });

  it('handles empty inputs gracefully', () => {
    render(
      <LawyerFeeForm
        params={{ ...mockParams, hours: undefined, caseAmount: undefined }}
        onChange={mockOnChange}
      />
    );
    expect(screen.getByLabelText('工作时长 (小时)')).toHaveValue(0);
    expect(screen.getByLabelText('案件金额 (元)')).toHaveValue(0);
  });
});
