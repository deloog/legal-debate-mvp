'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, RefreshCw, AlertCircle } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';

interface AgentStats {
  agentName: string;
  totalCalls: number;
  successCount: number;
  failedCount: number;
  pendingCount: number;
  successRate: number;
  avgExecutionTime: number;
  minExecutionTime: number;
  maxExecutionTime: number;
}

interface SummaryStats {
  totalAgents: number;
  totalCalls: number;
  overallSuccessRate: number;
  avgExecutionTime: number;
}

interface ErrorCategory {
  category: string;
  count: number;
  percentage: number;
}

interface AgentError {
  agentName: string;
  errorCount: number;
  percentage: number;
}

interface RecentError {
  id: string;
  agentName: string;
  actionName: string;
  errorMessage: string;
  createdAt: string;
}

interface MonitorData {
  agents: AgentStats[];
  summary: SummaryStats;
}

interface ErrorData {
  errorDistribution: ErrorCategory[];
  agentErrors: AgentError[];
  recentErrors: RecentError[];
}

const COLORS = [
  '#0088FE',
  '#00C49F',
  '#FFBB28',
  '#FF8042',
  '#8884D8',
  '#82CA9D',
];

const ERROR_COLORS: Record<string, string> = {
  TIMEOUT: '#FF8042',
  DATABASE: '#FFBB28',
  AI_MODEL: '#0088FE',
  VALIDATION: '#00C49F',
  NETWORK: '#8884D8',
  UNKNOWN: '#82CA9D',
};

/** Badge variant 类型 - 映射到 UI 组件支持的类型 */
type BadgeVariant = 'default' | 'secondary' | 'outline';

/** Pie 图表标签渲染属性 - recharts 实际传递的属性 */
interface PieLabelProps {
  category?: string;
  percentage?: number;
  name?: string;
  value?: number;
  percent?: number;
}

export default function AgentMonitorPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [monitorData, setMonitorData] = useState<MonitorData | null>(null);
  const [errorData, setErrorData] = useState<ErrorData | null>(null);
  const [activeTab, setActiveTab] = useState('overview');

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // 并行获取统计数据和错误数据
      const [statsRes, errorsRes] = await Promise.all([
        fetch('/api/admin/agent-monitor'),
        fetch('/api/admin/agent-monitor/errors'),
      ]);

      const statsResult = await statsRes.json();
      const errorsResult = await errorsRes.json();

      if (!statsResult.success) {
        throw new Error(statsResult.error || '加载统计数据失败');
      }

      if (!errorsResult.success) {
        throw new Error(errorsResult.error || '加载错误数据失败');
      }

      setMonitorData(statsResult.data);
      setErrorData(errorsResult.data);
    } catch (err) {
      const message = err instanceof Error ? err.message : '加载监控数据失败';
      setError(message);
      toast.error('加载失败', { description: message });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className='container mx-auto py-6'>
        <div className='flex items-center justify-center h-64'>
          <Loader2 className='h-8 w-8 animate-spin text-muted-foreground' />
          <span className='ml-2 text-muted-foreground'>加载中...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className='container mx-auto py-6'>
        <div className='flex flex-col items-center justify-center h-64 space-y-4'>
          <AlertCircle className='h-12 w-12 text-red-500' />
          <p className='text-red-500'>{error}</p>
          <Button onClick={fetchData} variant='outline'>
            重试
          </Button>
        </div>
      </div>
    );
  }

  if (!monitorData || monitorData.agents.length === 0) {
    return (
      <div className='container mx-auto py-6'>
        <div className='flex flex-col items-center justify-center h-64 space-y-4'>
          <p className='text-muted-foreground'>暂无 Agent 数据</p>
          <Button onClick={fetchData} variant='outline'>
            <RefreshCw className='h-4 w-4 mr-2' />
            刷新
          </Button>
        </div>
      </div>
    );
  }

  const { summary, agents } = monitorData;

  return (
    <div className='container mx-auto py-6 space-y-6'>
      {/* 页面标题 */}
      <div className='flex items-center justify-between'>
        <div>
          <h1 className='text-3xl font-bold'>Agent 性能监控</h1>
          <p className='text-muted-foreground mt-1'>
            实时监控各 Agent 的运行状态和性能指标
          </p>
        </div>
        <Button onClick={fetchData} variant='outline' disabled={loading}>
          {loading ? (
            <Loader2 className='h-4 w-4 animate-spin' />
          ) : (
            <RefreshCw className='h-4 w-4' />
          )}
          <span className='ml-2'>刷新</span>
        </Button>
      </div>

      {/* 汇总统计卡片 */}
      <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4'>
        <Card>
          <CardHeader className='pb-2'>
            <CardTitle className='text-sm font-medium text-muted-foreground'>
              Agent 总数
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>{summary.totalAgents}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='pb-2'>
            <CardTitle className='text-sm font-medium text-muted-foreground'>
              总调用次数
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>{summary.totalCalls}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='pb-2'>
            <CardTitle className='text-sm font-medium text-muted-foreground'>
              整体成功率
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold text-green-600'>
              {summary.overallSuccessRate}%
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='pb-2'>
            <CardTitle className='text-sm font-medium text-muted-foreground'>
              平均响应时间
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>
              {summary.avgExecutionTime}ms
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 标签页内容 */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value='overview'>概览</TabsTrigger>
          <TabsTrigger value='errors'>错误分析</TabsTrigger>
        </TabsList>

        <TabsContent value='overview' className='space-y-6'>
          {/* 图表区域 */}
          <div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
            <Card>
              <CardHeader>
                <CardTitle>各 Agent 成功率</CardTitle>
              </CardHeader>
              <CardContent>
                <div className='h-64'>
                  <ResponsiveContainer width='100%' height='100%'>
                    <BarChart data={agents}>
                      <CartesianGrid strokeDasharray='3 3' />
                      <XAxis
                        dataKey='agentName'
                        tick={{ fontSize: 12 }}
                        interval={0}
                        angle={-15}
                        textAnchor='end'
                      />
                      <YAxis domain={[0, 100]} />
                      <Tooltip
                        formatter={value => `${Number(value).toFixed(2)}%`}
                      />
                      <Bar
                        dataKey='successRate'
                        fill='#00C49F'
                        name='成功率 (%)'
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>平均响应时间 (ms)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className='h-64'>
                  <ResponsiveContainer width='100%' height='100%'>
                    <BarChart data={agents}>
                      <CartesianGrid strokeDasharray='3 3' />
                      <XAxis
                        dataKey='agentName'
                        tick={{ fontSize: 12 }}
                        interval={0}
                        angle={-15}
                        textAnchor='end'
                      />
                      <YAxis />
                      <Tooltip formatter={value => `${value}ms`} />
                      <Bar
                        dataKey='avgExecutionTime'
                        fill='#0088FE'
                        name='平均响应时间 (ms)'
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Agent 详细列表 */}
          <Card>
            <CardHeader>
              <CardTitle>Agent 详细统计</CardTitle>
            </CardHeader>
            <CardContent>
              <div className='overflow-x-auto'>
                <table className='w-full text-sm'>
                  <thead>
                    <tr className='border-b'>
                      <th className='text-left py-3 px-4'>Agent 名称</th>
                      <th className='text-right py-3 px-4'>总调用</th>
                      <th className='text-right py-3 px-4'>成功</th>
                      <th className='text-right py-3 px-4'>失败</th>
                      <th className='text-right py-3 px-4'>成功率</th>
                      <th className='text-right py-3 px-4'>平均响应</th>
                      <th className='text-right py-3 px-4'>最小响应</th>
                      <th className='text-right py-3 px-4'>最大响应</th>
                    </tr>
                  </thead>
                  <tbody>
                    {agents.map(agent => (
                      <tr key={agent.agentName} className='border-b'>
                        <td className='py-3 px-4 font-medium'>
                          {agent.agentName}
                        </td>
                        <td className='text-right py-3 px-4'>
                          {agent.totalCalls}
                        </td>
                        <td className='text-right py-3 px-4 text-green-600'>
                          {agent.successCount}
                        </td>
                        <td className='text-right py-3 px-4 text-red-600'>
                          {agent.failedCount}
                        </td>
                        <td className='text-right py-3 px-4'>
                          <Badge
                            variant={
                              (agent.successRate >= 95
                                ? 'default'
                                : 'secondary') as BadgeVariant
                            }
                            className={
                              agent.successRate < 80
                                ? 'bg-red-100 text-red-800'
                                : ''
                            }
                          >
                            {agent.successRate.toFixed(2)}%
                          </Badge>
                        </td>
                        <td className='text-right py-3 px-4'>
                          {agent.avgExecutionTime}ms
                        </td>
                        <td className='text-right py-3 px-4 text-muted-foreground'>
                          {agent.minExecutionTime}ms
                        </td>
                        <td className='text-right py-3 px-4 text-muted-foreground'>
                          {agent.maxExecutionTime}ms
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value='errors' className='space-y-6'>
          {errorData && (
            <>
              <div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
                {/* 错误类型分布 */}
                <Card>
                  <CardHeader>
                    <CardTitle>错误类型分布</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className='h-64'>
                      <ResponsiveContainer width='100%' height='100%'>
                        <PieChart>
                          <Pie
                            data={errorData.errorDistribution}
                            cx='50%'
                            cy='50%'
                            labelLine={false}
                            label={(props: PieLabelProps) => {
                              const name =
                                props.category ?? props.name ?? 'Unknown';
                              const pct =
                                props.percentage ??
                                Math.round((props.percent ?? 0) * 100);
                              return `${name}: ${pct}%`;
                            }}
                            outerRadius={80}
                            fill='#8884d8'
                            dataKey='count'
                            nameKey='category'
                          >
                            {errorData.errorDistribution.map(entry => (
                              <Cell
                                key={entry.category}
                                fill={ERROR_COLORS[entry.category] || COLORS[0]}
                              />
                            ))}
                          </Pie>
                          <Tooltip />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                {/* Agent 错误统计 */}
                <Card>
                  <CardHeader>
                    <CardTitle>Agent 错误统计</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className='h-64'>
                      <ResponsiveContainer width='100%' height='100%'>
                        <BarChart data={errorData.agentErrors}>
                          <CartesianGrid strokeDasharray='3 3' />
                          <XAxis
                            dataKey='agentName'
                            tick={{ fontSize: 12 }}
                            interval={0}
                            angle={-15}
                            textAnchor='end'
                          />
                          <YAxis />
                          <Tooltip />
                          <Bar
                            dataKey='errorCount'
                            fill='#FF8042'
                            name='错误数'
                            radius={[4, 4, 0, 0]}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* 最近错误列表 */}
              <Card>
                <CardHeader>
                  <CardTitle>最近错误</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className='overflow-x-auto'>
                    <table className='w-full text-sm'>
                      <thead>
                        <tr className='border-b'>
                          <th className='text-left py-3 px-4'>时间</th>
                          <th className='text-left py-3 px-4'>Agent</th>
                          <th className='text-left py-3 px-4'>操作</th>
                          <th className='text-left py-3 px-4'>错误信息</th>
                        </tr>
                      </thead>
                      <tbody>
                        {errorData.recentErrors.map(err => (
                          <tr key={err.id} className='border-b'>
                            <td className='py-3 px-4 text-muted-foreground'>
                              {new Date(err.createdAt).toLocaleString()}
                            </td>
                            <td className='py-3 px-4'>
                              <Badge variant='outline'>{err.agentName}</Badge>
                            </td>
                            <td className='py-3 px-4'>{err.actionName}</td>
                            <td className='py-3 px-4 text-red-600 truncate max-w-md'>
                              {err.errorMessage}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {errorData.recentErrors.length === 0 && (
                      <div className='text-center py-8 text-muted-foreground'>
                        暂无错误记录
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
