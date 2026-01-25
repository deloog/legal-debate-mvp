/**
 * 法律时效计算器组件
 *
 * 提供用户友好的界面，计算诉讼时效、上诉时效、执行时效
 */

'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  StatuteType,
  CaseTypeForStatute,
  SpecialCircumstances,
  getStatuteTypeLabel,
  getRiskLevelLabel,
  type StatuteCalculationResult,
} from '@/types/statute';

interface StatuteCalculatorProps {
  onCalculationComplete?: (result: StatuteCalculationResult) => void;
  defaultCaseId?: string;
}

export function StatuteCalculator({
  onCalculationComplete,
  defaultCaseId = '',
}: StatuteCalculatorProps) {
  // 表单状态
  const [caseId, setCaseId] = useState(defaultCaseId);
  const [statuteType, setStatuteType] = useState<StatuteType>(
    StatuteType.LITIGATION
  );
  const [caseType, setCaseType] = useState<CaseTypeForStatute>(
    CaseTypeForStatute.CIVIL
  );
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // 特殊情况
  const [specialCircumstances, setSpecialCircumstances] = useState<
    SpecialCircumstances[]
  >([]);

  // 计算结果
  const [result, setResult] = useState<StatuteCalculationResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>('');

  // 提醒配置
  const [enableReminder, setEnableReminder] = useState(true);
  const [reminderDays, setReminderDays] = useState<number[]>([30, 15, 7, 1]);

  /**
   * 处理特殊情况复选框变化
   */
  function handleSpecialCircumstanceChange(
    circumstance: SpecialCircumstances,
    checked: boolean
  ): void {
    if (checked) {
      setSpecialCircumstances([...specialCircumstances, circumstance]);
    } else {
      setSpecialCircumstances(
        specialCircumstances.filter(sc => sc !== circumstance)
      );
    }
  }

  /**
   * 计算时效
   */
  async function handleCalculate(): Promise<void> {
    // 重置状态
    setError('');
    setResult(null);
    setIsLoading(true);

    try {
      // 验证表单
      if (!caseId.trim()) {
        setError('请输入案件ID');
        setIsLoading(false);
        return;
      }

      if (!startDate) {
        setError('请选择起始日期');
        setIsLoading(false);
        return;
      }

      const startDateObj = new Date(startDate);
      if (isNaN(startDateObj.getTime())) {
        setError('起始日期格式无效');
        setIsLoading(false);
        return;
      }

      if (endDate) {
        const endDateObj = new Date(endDate);
        if (isNaN(endDateObj.getTime())) {
          setError('结束日期格式无效');
          setIsLoading(false);
          return;
        }

        if (endDateObj < startDateObj) {
          setError('结束日期不能早于起始日期');
          setIsLoading(false);
          return;
        }
      }

      // 调用API
      const response = await fetch('/api/statute/calculate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          caseId: caseId.trim(),
          statuteType,
          caseType,
          startDate: startDateObj.toISOString(),
          endDate: endDate ? new Date(endDate).toISOString() : undefined,
          specialCircumstances:
            specialCircumstances.length > 0 ? specialCircumstances : undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '计算失败');
      }

      const data: StatuteCalculationResult = await response.json();

      // 如果启用提醒，生成提醒
      if (enableReminder && !data.isExpired) {
        await generateReminder(data);
      }

      setResult(data);

      // 回调
      if (onCalculationComplete) {
        onCalculationComplete(data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '计算失败，请重试');
    } finally {
      setIsLoading(false);
    }
  }

  /**
   * 生成提醒
   */
  async function generateReminder(
    calculationResult: StatuteCalculationResult
  ): Promise<void> {
    try {
      const response = await fetch('/api/reminders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'DEADLINE',
          title: `${getStatuteTypeLabel(calculationResult.statuteType)}即将到期`,
          message: `案件 ${calculationResult.caseId} 的${getStatuteTypeLabel(
            calculationResult.statuteType
          )}将于${calculationResult.deadlineDate.toLocaleDateString('zh-CN')}到期`,
          reminderTime: calculationResult.deadlineDate.toISOString(),
          channels: ['IN_APP', 'EMAIL'],
          relatedType: 'Case',
          relatedId: calculationResult.caseId,
        }),
      });

      if (!response.ok) {
        console.warn('生成提醒失败:', await response.text());
      }
    } catch (err) {
      console.warn('生成提醒失败:', err);
    }
  }

  /**
   * 重置表单
   */
  function handleReset(): void {
    setCaseId(defaultCaseId);
    setStatuteType(StatuteType.LITIGATION);
    setCaseType(CaseTypeForStatute.CIVIL);
    setStartDate('');
    setEndDate('');
    setSpecialCircumstances([]);
    setResult(null);
    setError('');
  }

  /**
   * 获取风险等级颜色
   */
  function getRiskLevelColor(remainingDays: number): string {
    if (remainingDays <= 0) return 'bg-red-500';
    if (remainingDays <= 7) return 'bg-orange-500';
    if (remainingDays <= 30) return 'bg-yellow-500';
    return 'bg-green-500';
  }

  return (
    <div className='space-y-6'>
      <Card>
        <CardHeader>
          <CardTitle>法律时效计算器</CardTitle>
          <CardDescription>
            计算诉讼时效、上诉时效、执行时效，避免错过法律期限
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-4'>
          {/* 案件ID */}
          <div className='space-y-2'>
            <Label htmlFor='caseId'>案件ID *</Label>
            <Input
              id='caseId'
              placeholder='请输入案件ID'
              value={caseId}
              onChange={e => setCaseId(e.target.value)}
            />
          </div>

          {/* 时效类型 */}
          <div className='space-y-2'>
            <Label htmlFor='statuteType'>时效类型 *</Label>
            <select
              id='statuteType'
              className='w-full rounded border border-gray-300 px-3 py-2'
              value={statuteType}
              onChange={e => setStatuteType(e.target.value as StatuteType)}
            >
              <option value={StatuteType.LITIGATION}>诉讼时效</option>
              <option value={StatuteType.APPEAL}>上诉时效</option>
              <option value={StatuteType.ENFORCEMENT}>执行时效</option>
            </select>
          </div>

          {/* 案件类型 */}
          <div className='space-y-2'>
            <Label htmlFor='caseType'>案件类型 *</Label>
            <select
              id='caseType'
              className='w-full rounded border border-gray-300 px-3 py-2'
              value={caseType}
              onChange={e => setCaseType(e.target.value as CaseTypeForStatute)}
            >
              <option value={CaseTypeForStatute.CIVIL}>民事案件</option>
              <option value={CaseTypeForStatute.COMMERCIAL}>商事案件</option>
              <option value={CaseTypeForStatute.LABOR}>劳动案件</option>
              <option value={CaseTypeForStatute.INTELLECTUAL}>
                知识产权案件
              </option>
              <option value={CaseTypeForStatute.ADMINISTRATIVE}>
                行政案件
              </option>
              <option value={CaseTypeForStatute.CRIMINAL}>刑事案件</option>
              <option value={CaseTypeForStatute.OTHER}>其他案件</option>
            </select>
          </div>

          {/* 起始日期 */}
          <div className='space-y-2'>
            <Label htmlFor='startDate'>起始日期 *</Label>
            <Input
              id='startDate'
              type='date'
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
            />
          </div>

          {/* 结束日期（可选） */}
          <div className='space-y-2'>
            <Label htmlFor='endDate'>结束日期（可选）</Label>
            <Input
              id='endDate'
              type='date'
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
            />
            <p className='text-sm text-gray-500'>
              用于计算已过的期间，不填写则使用当前日期
            </p>
          </div>

          {/* 特殊情况 */}
          <div className='space-y-2'>
            <Label>特殊情况</Label>
            <div className='grid grid-cols-2 gap-2'>
              <div className='flex items-center space-x-2'>
                <input
                  type='checkbox'
                  id='interruption'
                  checked={specialCircumstances.includes(
                    SpecialCircumstances.INTERRUPTION
                  )}
                  onChange={e =>
                    handleSpecialCircumstanceChange(
                      SpecialCircumstances.INTERRUPTION,
                      e.target.checked
                    )
                  }
                />
                <label
                  htmlFor='interruption'
                  className='text-sm cursor-pointer'
                >
                  时效中断
                </label>
              </div>

              <div className='flex items-center space-x-2'>
                <input
                  type='checkbox'
                  id='suspension'
                  checked={specialCircumstances.includes(
                    SpecialCircumstances.SUSPENSION
                  )}
                  onChange={e =>
                    handleSpecialCircumstanceChange(
                      SpecialCircumstances.SUSPENSION,
                      e.target.checked
                    )
                  }
                />
                <label htmlFor='suspension' className='text-sm cursor-pointer'>
                  时效中止
                </label>
              </div>

              <div className='flex items-center space-x-2'>
                <input
                  type='checkbox'
                  id='minor'
                  checked={specialCircumstances.includes(
                    SpecialCircumstances.MINOR
                  )}
                  onChange={e =>
                    handleSpecialCircumstanceChange(
                      SpecialCircumstances.MINOR,
                      e.target.checked
                    )
                  }
                />
                <label htmlFor='minor' className='text-sm cursor-pointer'>
                  限制民事行为能力人
                </label>
              </div>

              <div className='flex items-center space-x-2'>
                <input
                  type='checkbox'
                  id='disability'
                  checked={specialCircumstances.includes(
                    SpecialCircumstances.DISABILITY
                  )}
                  onChange={e =>
                    handleSpecialCircumstanceChange(
                      SpecialCircumstances.DISABILITY,
                      e.target.checked
                    )
                  }
                />
                <label htmlFor='disability' className='text-sm cursor-pointer'>
                  无民事行为能力人
                </label>
              </div>

              <div className='flex items-center space-x-2'>
                <input
                  type='checkbox'
                  id='forceMajeure'
                  checked={specialCircumstances.includes(
                    SpecialCircumstances.FORCE_MAJEURE
                  )}
                  onChange={e =>
                    handleSpecialCircumstanceChange(
                      SpecialCircumstances.FORCE_MAJEURE,
                      e.target.checked
                    )
                  }
                />
                <label
                  htmlFor='forceMajeure'
                  className='text-sm cursor-pointer'
                >
                  不可抗力
                </label>
              </div>

              <div className='flex items-center space-x-2'>
                <input
                  type='checkbox'
                  id='claimDenial'
                  checked={specialCircumstances.includes(
                    SpecialCircumstances.CLAIM_DENIAL
                  )}
                  onChange={e =>
                    handleSpecialCircumstanceChange(
                      SpecialCircumstances.CLAIM_DENIAL,
                      e.target.checked
                    )
                  }
                />
                <label htmlFor='claimDenial' className='text-sm cursor-pointer'>
                  对方承认债务
                </label>
              </div>
            </div>
          </div>

          {/* 提醒配置 */}
          <div className='space-y-2'>
            <div className='flex items-center space-x-2'>
              <input
                type='checkbox'
                id='enableReminder'
                checked={enableReminder}
                onChange={e => setEnableReminder(e.target.checked)}
              />
              <label
                htmlFor='enableReminder'
                className='text-sm cursor-pointer'
              >
                启用提醒
              </label>
            </div>

            {enableReminder && (
              <div className='ml-6 space-y-2'>
                <Label>提前提醒天数</Label>
                <div className='flex flex-wrap gap-2'>
                  {[30, 15, 7, 1, 3, 5, 10, 14, 21, 60].map(days => (
                    <div
                      key={days}
                      className={`px-3 py-1 text-sm rounded border cursor-pointer ${
                        reminderDays.includes(days)
                          ? 'bg-blue-500 text-white border-blue-500'
                          : 'border-gray-300 hover:bg-gray-100'
                      }`}
                      onClick={() => {
                        if (reminderDays.includes(days)) {
                          setReminderDays(reminderDays.filter(d => d !== days));
                        } else {
                          setReminderDays([...reminderDays, days]);
                        }
                      }}
                    >
                      {days}天
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 错误提示 */}
          {error && (
            <div className='p-4 bg-red-50 border border-red-200 rounded'>
              <p className='font-semibold text-red-800'>错误</p>
              <p className='text-sm text-red-600'>{error}</p>
            </div>
          )}

          {/* 按钮 */}
          <div className='flex space-x-2'>
            <Button
              onClick={handleCalculate}
              disabled={isLoading}
              className='flex-1'
            >
              {isLoading ? '计算中...' : '计算时效'}
            </Button>
            <Button
              onClick={handleReset}
              variant='outline'
              disabled={isLoading}
            >
              重置
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 计算结果 */}
      {result && (
        <Card>
          <CardHeader>
            <CardTitle>计算结果</CardTitle>
          </CardHeader>
          <CardContent className='space-y-4'>
            {/* 风险等级 */}
            <div className='flex items-center space-x-3'>
              <div
                className={`w-4 h-4 rounded ${getRiskLevelColor(
                  result.remainingDays
                )}`}
              />
              <div>
                <p className='text-sm text-gray-500'>风险等级</p>
                <p className='text-lg font-semibold'>
                  {getRiskLevelLabel(
                    result.remainingDays <= 0
                      ? 'HIGH'
                      : result.remainingDays <= 30
                        ? 'MEDIUM'
                        : 'LOW'
                  )}
                </p>
              </div>
            </div>

            {/* 时效类型 */}
            <div>
              <p className='text-sm text-gray-500'>时效类型</p>
              <p className='text-lg font-semibold'>
                {getStatuteTypeLabel(result.statuteType)}
              </p>
            </div>

            {/* 起始日期 */}
            <div>
              <p className='text-sm text-gray-500'>起始日期</p>
              <p className='text-lg'>
                {result.startDate.toLocaleDateString('zh-CN')}
              </p>
            </div>

            {/* 截止日期 */}
            <div>
              <p className='text-sm text-gray-500'>截止日期</p>
              <p className='text-lg font-semibold'>
                {result.deadlineDate.toLocaleDateString('zh-CN')}
              </p>
            </div>

            {/* 剩余天数 */}
            <div>
              <p className='text-sm text-gray-500'>剩余天数</p>
              <p
                className={`text-2xl font-bold ${
                  result.isExpired
                    ? 'text-red-600'
                    : result.isApproaching
                      ? 'text-orange-600'
                      : 'text-green-600'
                }`}
              >
                {result.isExpired ? '已过期' : `${result.remainingDays} 天`}
              </p>
            </div>

            {/* 警告和建议 */}
            {result.calculationMetadata.warnings.length > 0 && (
              <div className='p-4 bg-yellow-50 border border-yellow-200 rounded'>
                <p className='font-semibold text-yellow-800 mb-2'>警告</p>
                {result.calculationMetadata.warnings.map((warning, index) => (
                  <p
                    key={index}
                    className='text-sm text-yellow-700 mb-1 last:mb-0'
                  >
                    • {warning}
                  </p>
                ))}
              </div>
            )}

            {result.calculationMetadata.recommendations.length > 0 && (
              <div className='p-4 bg-blue-50 border border-blue-200 rounded'>
                <p className='font-semibold text-blue-800 mb-2'>建议</p>
                {result.calculationMetadata.recommendations.map(
                  (recommendation, index) => (
                    <p
                      key={index}
                      className='text-sm text-blue-700 mb-1 last:mb-0'
                    >
                      • {recommendation}
                    </p>
                  )
                )}
              </div>
            )}

            {/* 适用规则 */}
            <div>
              <p className='text-sm text-gray-500 mb-2'>适用规则</p>
              <div className='space-y-2'>
                {result.applicableRules.map((rule, index) => (
                  <div key={index} className='p-3 border rounded bg-gray-50'>
                    <p className='font-medium'>{rule.description}</p>
                    <p className='text-sm text-gray-600'>
                      时效期间：{rule.statutePeriod}天
                    </p>
                    <p className='text-sm text-gray-600'>
                      法律依据：{rule.legalBasis}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* 置信度 */}
            <div>
              <p className='text-sm text-gray-500'>计算置信度</p>
              <div className='w-full bg-gray-200 rounded-full h-2.5'>
                <div
                  className='bg-blue-600 h-2.5 rounded-full'
                  style={{
                    width: `${result.calculationMetadata.confidence * 100}%`,
                  }}
                />
              </div>
              <p className='text-sm text-right mt-1'>
                {(result.calculationMetadata.confidence * 100).toFixed(0)}%
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
