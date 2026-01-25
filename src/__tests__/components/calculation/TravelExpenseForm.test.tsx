import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { TravelExpenseForm } from '@/components/calculation/TravelExpenseForm';

describe('TravelExpenseForm', () => {
  const mockParams = {
    days: 3,
    peopleCount: 2,
    expenses: [],
  };

  const mockOnChange = jest.fn();

  it('renders correctly', () => {
    render(<TravelExpenseForm params={mockParams} onChange={mockOnChange} />);
    expect(screen.getByLabelText('出差天数')).toHaveValue(3);
    expect(screen.getByLabelText('人数')).toHaveValue(2);
  });

  it('calls onChange when inputs change', () => {
    render(<TravelExpenseForm params={mockParams} onChange={mockOnChange} />);

    fireEvent.change(screen.getByLabelText('出差天数'), {
      target: { value: '5' },
    });
    expect(mockOnChange).toHaveBeenCalledWith({
      ...mockParams,
      days: 5,
    });

    fireEvent.change(screen.getByLabelText('人数'), {
      target: { value: '4' },
    });
    expect(mockOnChange).toHaveBeenCalledWith({
      ...mockParams,
      peopleCount: 4,
    });
  });
});
