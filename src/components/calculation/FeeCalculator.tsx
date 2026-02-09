import React, { useState } from 'react';
import {
  FeeCalculationResult,
  ExpenseCategory,
  LitigationCaseType,
  TravelExpenseItem,
  BillingMode,
  LitigationFeeCalculationParams,
  LawyerFeeCalculationParams,
  TravelExpenseCalculationParams,
} from '@/types/calculation';
import { FeeCalculatorTabs } from './FeeCalculatorTabs';
import { LawyerFeeForm } from './LawyerFeeForm';
import { LitigationFeeForm } from './LitigationFeeForm';
import { TravelExpenseForm } from './TravelExpenseForm';
import FeeBreakdown from './FeeBreakdown';

export default function FeeCalculator() {
  const [activeTab, setActiveTab] = useState<ExpenseCategory>(ExpenseCategory.LAWYER_FEE);
  const [result, setResult] = useState<FeeCalculationResult | null>(null);
  const [loading, setLoading] = useState(false);

  // 律师费表单状态
  const [lawyerFeeParams, setLawyerFeeParams] =
    useState<LawyerFeeCalculationParams>({
      hours: 0,
      caseAmount: 0,
      isWin: false,
      winAmount: 0,
      config: {
        mode: BillingMode.HOURLY,
        currency: 'CNY',
      },
    });

  // 诉讼费表单状态
  const [litigationFeeParams, setLitigationFeeParams] =
    useState<LitigationFeeCalculationParams>({
      caseType: LitigationCaseType.PROPERTY,
      amount: 0,
      isReduced: false,
    });

  // 差旅费表单状态
  const [travelExpenseParams, setTravelExpenseParams] =
    useState<TravelExpenseCalculationParams>({
      days: 1,
      peopleCount: 1,
      expenses: [] as TravelExpenseItem[],
    });

  const calculateFee = async () => {
    setLoading(true);
    try {
      let payload: Record<string, unknown> = { type: activeTab };

      switch (activeTab) {
        case ExpenseCategory.LAWYER_FEE:
          payload = { ...payload, ...lawyerFeeParams };
          break;
        case ExpenseCategory.LITIGATION_FEE:
          payload = { ...payload, ...litigationFeeParams };
          break;
        case ExpenseCategory.TRAVEL_EXPENSE:
          payload = { ...payload, ...travelExpenseParams };
          break;
      }

      const response = await fetch('/api/calculate/fees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error('Calculation failed');

      const data = await response.json();
      setResult(data.data);
    } catch (error) {
      console.error('Error calculating fee:', error);
      alert('计算失败，请检查输入参数');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className='bg-white shadow rounded-lg p-6'>
      <h2 className='text-xl font-bold mb-6'>费用计算器</h2>

      <FeeCalculatorTabs activeTab={activeTab} onTabChange={setActiveTab} />

      {/* 表单区域 */}
      <div className='mb-6'>
        {activeTab === ExpenseCategory.LAWYER_FEE && (
          <LawyerFeeForm
            params={lawyerFeeParams}
            onChange={setLawyerFeeParams}
          />
        )}

        {activeTab === ExpenseCategory.LITIGATION_FEE && (
          <LitigationFeeForm
            params={litigationFeeParams}
            onChange={setLitigationFeeParams}
          />
        )}

        {activeTab === ExpenseCategory.TRAVEL_EXPENSE && (
          <TravelExpenseForm
            params={travelExpenseParams}
            onChange={setTravelExpenseParams}
          />
        )}

        <div className='mt-6'>
          <button
            onClick={calculateFee}
            disabled={loading}
            className='w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50'
          >
            {loading ? '计算中...' : '开始计算'}
          </button>
        </div>
      </div>

      {/* 结果展示 */}
      {result && <FeeBreakdown result={result} />}
    </div>
  );
}
