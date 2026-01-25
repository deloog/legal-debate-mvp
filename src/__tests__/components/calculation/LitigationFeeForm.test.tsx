import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { LitigationFeeForm } from '@/components/calculation/LitigationFeeForm';
import { LitigationCaseType } from '@/types/calculation';

describe('LitigationFeeForm', () => {
  const mockParams = {
    caseType: LitigationCaseType.PROPERTY,
    amount: 100000,
    isReduced: false,
  };

  const mockOnChange = jest.fn();

  it('renders correctly', () => {
    render(<LitigationFeeForm params={mockParams} onChange={mockOnChange} />);
    expect(screen.getByLabelText('案件类型')).toHaveValue(
      LitigationCaseType.PROPERTY
    );
    expect(screen.getByLabelText('标的金额 (元)')).toHaveValue(100000);
    expect(screen.getByLabelText('减半收取 (如简易程序)')).not.toBeChecked();
  });

  it('calls onChange when inputs change', () => {
    render(<LitigationFeeForm params={mockParams} onChange={mockOnChange} />);

    fireEvent.change(screen.getByLabelText('案件类型'), {
      target: { value: LitigationCaseType.DIVORCE },
    });
    expect(mockOnChange).toHaveBeenCalledWith({
      ...mockParams,
      caseType: LitigationCaseType.DIVORCE,
    });

    fireEvent.change(screen.getByLabelText('标的金额 (元)'), {
      target: { value: '200000' },
    });
    expect(mockOnChange).toHaveBeenCalledWith({
      ...mockParams,
      amount: 200000,
    });

    fireEvent.click(screen.getByLabelText('减半收取 (如简易程序)'));
    expect(mockOnChange).toHaveBeenCalledWith({
      ...mockParams,
      isReduced: true,
    });
  });
});
