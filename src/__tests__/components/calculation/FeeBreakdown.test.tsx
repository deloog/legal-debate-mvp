import React from 'react';
import { render, screen } from '@testing-library/react';
import FeeBreakdown from '@/components/calculation/FeeBreakdown';
import { FeeType } from '@/types/calculation';

describe('FeeBreakdown', () => {
  const mockResult = {
    totalAmount: 15000,
    currency: 'CNY',
    items: [
      {
        id: '1',
        name: '律师费',
        type: FeeType.LAWYER_FEE,
        amount: 10000,
        currency: 'CNY',
        description: '小时费率计算',
      },
      {
        id: '2',
        name: '诉讼费',
        type: FeeType.LITIGATION_FEE,
        amount: 5000,
        currency: 'CNY',
        description: '财产案件',
      },
    ],
    breakdown: {
      [FeeType.LAWYER_FEE]: 10000,
      [FeeType.LITIGATION_FEE]: 5000,
      [FeeType.TRAVEL_EXPENSE]: 0,
      [FeeType.OTHER_EXPENSE]: 0,
    },
  };

  it('renders correctly', () => {
    render(<FeeBreakdown result={mockResult} />);
    expect(screen.getByText('费用明细清单')).toBeInTheDocument();
    expect(screen.getAllByText('律师费')).toHaveLength(2); // In section header and row
    expect(screen.getAllByText('诉讼费')).toHaveLength(2); // In section header and row
    expect(screen.getAllByText('10,000 CNY')).toHaveLength(2); // In row and subtotal
    expect(screen.getAllByText('5,000 CNY')).toHaveLength(2); // In row and subtotal
    expect(screen.getByText('15,000 CNY')).toBeInTheDocument();
  });
});
