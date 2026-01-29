'use client';

import { useState, useCallback } from 'react';
import {
  Calculator,
  DollarSign,
  FileText,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

/**
 * 收费模式类型
 */
type FeeMode = 'FIXED' | 'RISK' | 'HOURLY' | 'STAGED';

/**
 * 费用计算结果
 */
interface FeeCalculationResult {
  feeMode: FeeMode;
  feeModeLabel: string;
  baseFee: number;
  adjustedFee: number;
  totalFee: number;
  breakdown: Array<{
    item: string;
    amount: number;
    description?: string;
  }>;
  riskFee?: {
    baseAmount: number;
    riskRate: number;
    potentialFee: number;
  };
  hourlyFee?: {
    hours: number;
    rate: number;
    total: number;
  };
  stagedFees?: Array<{
    stage: string;
    amount: number;
    percentage: number;
  }>;
  notes: string[];
}

/**
 * 组件属性
 */
interface FeeCalculatorCardProps {
  consultationId?: string;
  caseType?: string;
  caseAmount?: number;
  difficulty?: 'EASY' | 'MEDIUM' | 'HARD';
  onCalculate?: (result: FeeCalculationResult) => void;
}

/**
 * 收费模式选项
 */
const FEE_MODES: Array<{ value: FeeMode; label: string; description: string }> =
  [
    {
      value: 'FIXED',
      label: '固定收费',
      description: '一次性收取全部律师费',
    },
    {
      value: 'RISK',
      label: '风险代理',
      description: '前期收取少量费用，胜诉后按比例收取',
    },
    {
      value: 'HOURLY',
      label: '计时收费',
      description: '按实际工作时间收费',
    },
    {
      value: 'STAGED',
      label: '分阶段收费',
      description: '按案件进展分节点收费',
    },
  ];

/**
 * 费用计算器卡片组件
 */
export function FeeCalculatorCard({
  consultationId,
  caseType,
  caseAmount: initialCaseAmount,
  difficulty,
  onCalculate,
}: FeeCalculatorCardProps) {
  const [feeMode, setFeeMode] = useState<FeeMode>('FIXED');
  const [caseAmount, setCaseAmount] = useState<string>(
    initialCaseAmount?.toString() || ''
  );
  const [riskRate, setRiskRate] = useState<string>('15');
  const [estimatedHours, setEstimatedHours] = useState<string>('10');
  const [hourlyRate, setHourlyRate] = useState<string>('500');
  const [isCalculating, setIsCalculating] = useState(false);
  const [result, setResult] = useState<FeeCalculationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  // 执行计算
  const handleCalculate = useCallback(async () => {
    setIsCalculating(true);
    setError(null);

    try {
      const response = await fetch('/api/consultations/calculate-fee', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          consultationId,
          caseType,
          caseAmount: caseAmount ? parseFloat(caseAmount) : undefined,
          difficulty,
          feeMode,
          riskRate: riskRate ? parseFloat(riskRate) / 100 : undefined,
          estimatedHours: estimatedHours
            ? parseFloat(estimatedHours)
            : undefined,
          hourlyRate: hourlyRate ? parseFloat(hourlyRate) : undefined,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setResult(data.data);
        onCalculate?.(data.data);
      } else {
        setError(data.error?.message || '计算失败');
      }
    } catch {
      setError('网络错误，请重试');
    } finally {
      setIsCalculating(false);
    }
  }, [
    consultationId,
    caseType,
    caseAmount,
    difficulty,
    feeMode,
    riskRate,
    estimatedHours,
    hourlyRate,
    onCalculate,
  ]);

  // 格式化金额
  const formatMoney = (amount: number) => {
    return `¥${amount.toLocaleString()}`;
  };

  return (
    <div className='rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950'>
      {/* 头部 */}
      <div className='mb-6 flex items-center gap-2'>
        <Calculator className='h-5 w-5 text-blue-500' />
        <h2 className='text-lg font-semibold text-zinc-900 dark:text-zinc-50'>
          律师费计算器
        </h2>
      </div>

      {/* 收费模式选择 */}
      <div className='mb-6'>
        <Label className='mb-3 block text-sm font-medium'>收费模式</Label>
        <div className='grid grid-cols-2 gap-2'>
          {FEE_MODES.map(mode => (
            <button
              key={mode.value}
              type='button'
              onClick={() => {
                setFeeMode(mode.value);
                setResult(null);
              }}
              className={`rounded-lg border p-3 text-left transition-all ${
                feeMode === mode.value
                  ? 'border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-900/20'
                  : 'border-zinc-200 hover:border-zinc-300 dark:border-zinc-700 dark:hover:border-zinc-600'
              }`}
            >
              <p
                className={`text-sm font-medium ${
                  feeMode === mode.value
                    ? 'text-blue-700 dark:text-blue-300'
                    : 'text-zinc-900 dark:text-zinc-50'
                }`}
              >
                {mode.label}
              </p>
              <p className='mt-0.5 text-xs text-zinc-500 dark:text-zinc-400'>
                {mode.description}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* 计算参数 */}
      <div className='mb-6 space-y-4'>
        {/* 标的额 */}
        <div>
          <Label htmlFor='caseAmount' className='mb-1.5 block text-sm'>
            案件标的额（元）
          </Label>
          <Input
            id='caseAmount'
            type='number'
            value={caseAmount}
            onChange={e => {
              setCaseAmount(e.target.value);
              setResult(null);
            }}
            placeholder='请输入标的额'
          />
        </div>

        {/* 风险代理参数 */}
        {feeMode === 'RISK' && (
          <div>
            <Label htmlFor='riskRate' className='mb-1.5 block text-sm'>
              风险代理比例（%）
            </Label>
            <Input
              id='riskRate'
              type='number'
              value={riskRate}
              onChange={e => {
                setRiskRate(e.target.value);
                setResult(null);
              }}
              placeholder='默认15%'
              min={5}
              max={30}
            />
            <p className='mt-1 text-xs text-zinc-500'>建议范围：5% - 30%</p>
          </div>
        )}

        {/* 计时收费参数 */}
        {feeMode === 'HOURLY' && (
          <>
            <div>
              <Label htmlFor='hourlyRate' className='mb-1.5 block text-sm'>
                小时费率（元/小时）
              </Label>
              <Input
                id='hourlyRate'
                type='number'
                value={hourlyRate}
                onChange={e => {
                  setHourlyRate(e.target.value);
                  setResult(null);
                }}
                placeholder='默认500元/小时'
              />
            </div>
            <div>
              <Label htmlFor='estimatedHours' className='mb-1.5 block text-sm'>
                预估工时（小时）
              </Label>
              <Input
                id='estimatedHours'
                type='number'
                value={estimatedHours}
                onChange={e => {
                  setEstimatedHours(e.target.value);
                  setResult(null);
                }}
                placeholder='请输入预估工时'
              />
            </div>
          </>
        )}
      </div>

      {/* 计算按钮 */}
      <Button
        onClick={handleCalculate}
        disabled={isCalculating}
        className='w-full'
        variant='primary'
      >
        {isCalculating ? (
          <>
            <RefreshCw className='mr-2 h-4 w-4 animate-spin' />
            计算中...
          </>
        ) : (
          <>
            <Calculator className='mr-2 h-4 w-4' />
            计算费用
          </>
        )}
      </Button>

      {/* 错误提示 */}
      {error && (
        <div className='mt-4 flex items-center gap-2 rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300'>
          <AlertCircle className='h-4 w-4' />
          {error}
        </div>
      )}

      {/* 计算结果 */}
      {result && (
        <div className='mt-6 space-y-4'>
          {/* 总费用展示 */}
          <div className='rounded-lg bg-blue-50 p-4 dark:bg-blue-900/20'>
            <div className='flex items-center justify-between'>
              <div className='flex items-center gap-2'>
                <DollarSign className='h-5 w-5 text-blue-500' />
                <span className='text-sm text-zinc-600 dark:text-zinc-400'>
                  {result.feeModeLabel}
                </span>
              </div>
              <div className='text-right'>
                <p className='text-2xl font-bold text-zinc-900 dark:text-zinc-50'>
                  {formatMoney(result.totalFee)}
                </p>
                {result.riskFee && (
                  <p className='text-xs text-zinc-500'>
                    + 胜诉后风险代理费{' '}
                    {formatMoney(result.riskFee.potentialFee)}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* 费用明细 */}
          <div>
            <button
              onClick={() => setShowDetails(!showDetails)}
              className='flex w-full items-center justify-between rounded-md p-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800'
            >
              <span className='flex items-center gap-2'>
                <FileText className='h-4 w-4' />
                费用明细
              </span>
              {showDetails ? (
                <ChevronUp className='h-4 w-4' />
              ) : (
                <ChevronDown className='h-4 w-4' />
              )}
            </button>

            {showDetails && (
              <div className='mt-2 space-y-2 rounded-md border border-zinc-200 p-3 dark:border-zinc-700'>
                {result.breakdown.map((item, index) => (
                  <div
                    key={index}
                    className='flex items-center justify-between text-sm'
                  >
                    <div>
                      <span className='text-zinc-700 dark:text-zinc-300'>
                        {item.item}
                      </span>
                      {item.description && (
                        <span className='ml-2 text-xs text-zinc-500'>
                          {item.description}
                        </span>
                      )}
                    </div>
                    <span className='font-medium text-zinc-900 dark:text-zinc-50'>
                      {formatMoney(item.amount)}
                    </span>
                  </div>
                ))}

                {/* 分阶段收费详情 */}
                {result.stagedFees && (
                  <div className='mt-3 border-t border-zinc-200 pt-3 dark:border-zinc-700'>
                    <p className='mb-2 text-xs font-medium text-zinc-500'>
                      分阶段付款明细
                    </p>
                    {result.stagedFees.map((stage, index) => (
                      <div
                        key={index}
                        className='flex items-center justify-between text-sm'
                      >
                        <span className='text-zinc-600 dark:text-zinc-400'>
                          {stage.stage}（{(stage.percentage * 100).toFixed(0)}
                          %）
                        </span>
                        <span className='font-medium text-zinc-900 dark:text-zinc-50'>
                          {formatMoney(stage.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* 风险代理详情 */}
                {result.riskFee && (
                  <div className='mt-3 border-t border-zinc-200 pt-3 dark:border-zinc-700'>
                    <p className='mb-2 text-xs font-medium text-zinc-500'>
                      风险代理说明
                    </p>
                    <div className='text-sm text-zinc-600 dark:text-zinc-400'>
                      <p>标的额：{formatMoney(result.riskFee.baseAmount)}</p>
                      <p>
                        风险比例：{(result.riskFee.riskRate * 100).toFixed(0)}%
                      </p>
                      <p className='font-medium text-green-600 dark:text-green-400'>
                        胜诉后可获：{formatMoney(result.riskFee.potentialFee)}
                      </p>
                    </div>
                  </div>
                )}

                {/* 计时收费详情 */}
                {result.hourlyFee && (
                  <div className='mt-3 border-t border-zinc-200 pt-3 dark:border-zinc-700'>
                    <p className='mb-2 text-xs font-medium text-zinc-500'>
                      计时收费说明
                    </p>
                    <div className='text-sm text-zinc-600 dark:text-zinc-400'>
                      <p>小时费率：{formatMoney(result.hourlyFee.rate)}/小时</p>
                      <p>预估工时：{result.hourlyFee.hours}小时</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 备注说明 */}
          {result.notes.length > 0 && (
            <div className='rounded-md bg-zinc-50 p-3 dark:bg-zinc-900'>
              <p className='mb-2 text-xs font-medium text-zinc-500'>备注</p>
              <ul className='space-y-1'>
                {result.notes.map((note, index) => (
                  <li
                    key={index}
                    className='flex items-start gap-2 text-xs text-zinc-600 dark:text-zinc-400'
                  >
                    <span className='mt-1 h-1 w-1 shrink-0 rounded-full bg-zinc-400' />
                    {note}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
