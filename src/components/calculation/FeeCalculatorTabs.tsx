import React from 'react';
import { ExpenseCategory } from '@/types/calculation';

interface FeeCalculatorTabsProps {
  activeTab: ExpenseCategory;
  onTabChange: (tab: ExpenseCategory) => void;
}

export function FeeCalculatorTabs({
  activeTab,
  onTabChange,
}: FeeCalculatorTabsProps) {
  const tabs = [
    { type: ExpenseCategory.LAWYER_FEE, label: '律师费' },
    { type: ExpenseCategory.LITIGATION_FEE, label: '诉讼费' },
    { type: ExpenseCategory.TRAVEL_EXPENSE, label: '差旅费' },
  ] as const;

  return (
    <div className='flex space-x-4 mb-6 border-b'>
      {tabs.map(tab => (
        <button
          key={tab.type}
          className={`pb-2 px-4 ${
            activeTab === tab.type
              ? 'border-b-2 border-blue-500 text-blue-600'
              : 'text-gray-500'
          }`}
          onClick={() => {
            onTabChange(tab.type);
          }}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
