import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { FeeCalculatorTabs } from '@/components/calculation/FeeCalculatorTabs';
import { FeeType } from '@/types/calculation';

describe('FeeCalculatorTabs', () => {
  const mockOnTabChange = jest.fn();

  it('renders correctly', () => {
    render(
      <FeeCalculatorTabs
        activeTab={FeeType.LAWYER_FEE}
        onTabChange={mockOnTabChange}
      />
    );
    expect(screen.getByText('律师费')).toHaveClass('text-blue-600');
    expect(screen.getByText('诉讼费')).toHaveClass('text-gray-500');
    expect(screen.getByText('差旅费')).toHaveClass('text-gray-500');
  });

  it('calls onTabChange when tab is clicked', () => {
    render(
      <FeeCalculatorTabs
        activeTab={FeeType.LAWYER_FEE}
        onTabChange={mockOnTabChange}
      />
    );

    fireEvent.click(screen.getByText('诉讼费'));
    expect(mockOnTabChange).toHaveBeenCalledWith(FeeType.LITIGATION_FEE);

    fireEvent.click(screen.getByText('差旅费'));
    expect(mockOnTabChange).toHaveBeenCalledWith(FeeType.TRAVEL_EXPENSE);
  });
});
