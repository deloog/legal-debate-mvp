import React from 'react';
import { FeeCalculationResult, FeeItem, ExpenseCategory } from '@/types/calculation';

interface FeeBreakdownProps {
  result: FeeCalculationResult;
}

export default function FeeBreakdown({ result }: FeeBreakdownProps) {
  // 按费用类型分组
  const groupedItems = result.items.reduce(
    (acc, item) => {
      if (!acc[item.type]) {
        acc[item.type] = [];
      }
      acc[item.type].push(item);
      return acc;
    },
    {} as Record<ExpenseCategory, FeeItem[]>
  );

  const getTypeName = (type: ExpenseCategory) => {
    switch (type) {
      case ExpenseCategory.LAWYER_FEE:
        return '律师费';
      case ExpenseCategory.LITIGATION_FEE:
        return '诉讼费';
      case ExpenseCategory.TRAVEL_EXPENSE:
        return '差旅费';
      case ExpenseCategory.OTHER_EXPENSE:
        return '其他费用';
      default:
        return '未知费用';
    }
  };

  return (
    <div className='bg-white shadow rounded-lg overflow-hidden'>
      <div className='px-6 py-4 border-b border-gray-200'>
        <h3 className='text-lg font-medium text-gray-900'>费用明细清单</h3>
      </div>

      <div className='px-6 py-4'>
        {Object.entries(groupedItems).map(([type, items]) => (
          <div key={type} className='mb-6 last:mb-0'>
            <h4 className='text-sm font-medium text-gray-500 uppercase tracking-wider mb-3'>
              {getTypeName(type as ExpenseCategory)}
            </h4>
            <div className='bg-gray-50 rounded-md overflow-hidden'>
              <table className='min-w-full divide-y divide-gray-200'>
                <thead className='bg-gray-100'>
                  <tr>
                    <th
                      scope='col'
                      className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'
                    >
                      项目名称
                    </th>
                    <th
                      scope='col'
                      className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'
                    >
                      描述
                    </th>
                    <th
                      scope='col'
                      className='px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider'
                    >
                      金额
                    </th>
                  </tr>
                </thead>
                <tbody className='divide-y divide-gray-200'>
                  {items.map(item => (
                    <tr key={item.id}>
                      <td className='px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900'>
                        {item.name}
                      </td>
                      <td className='px-6 py-4 text-sm text-gray-500'>
                        {item.description}
                      </td>
                      <td className='px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900'>
                        {item.amount.toLocaleString()} {item.currency}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className='mt-2 text-right'>
              <span className='text-sm text-gray-500 mr-2'>小计:</span>
              <span className='text-sm font-medium text-gray-900'>
                {result.breakdown[type as ExpenseCategory].toLocaleString()}{' '}
                {result.currency}
              </span>
            </div>
          </div>
        ))}

        <div className='mt-8 border-t border-gray-200 pt-4 flex justify-end items-center'>
          <span className='text-base font-medium text-gray-900 mr-4'>
            总计费用:
          </span>
          <span className='text-2xl font-bold text-blue-600'>
            {result.totalAmount.toLocaleString()} {result.currency}
          </span>
        </div>
      </div>
    </div>
  );
}
