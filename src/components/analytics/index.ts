/**
 * Analytics Components Index
 * 导出所有图表组件
 */

// 基础图表组件
export { PieChart } from './charts/PieChart';
export { BarChart } from './charts/BarChart';
export { LineChart } from './charts/LineChart';
export { FunnelChart } from './charts/FunnelChart';

// 客户分析图表组件
export { ClientConversionFunnelChart } from './client/ClientConversionFunnelChart';
export type { ClientConversionFunnelChartProps } from './client/ClientConversionFunnelChart';
export { ClientValueAnalysisChart } from './client/ClientValueAnalysisChart';
export type { ClientValueAnalysisChartProps } from './client/ClientValueAnalysisChart';
export { ClientGrowthTrendChart } from './client/ClientGrowthTrendChart';
export type { ClientGrowthTrendChartProps } from './client/ClientGrowthTrendChart';
export { ClientSourceAnalysisChart } from './client/ClientSourceAnalysisChart';
export type { ClientSourceAnalysisChartProps } from './client/ClientSourceAnalysisChart';
export { TopClientsChart } from './client/TopClientsChart';
export type { TopClientsChartProps } from './client/TopClientsChart';

// 类型导出
export type {
  PieChartProps,
  BarChartProps,
  LineChartProps,
  FunnelChartProps,
} from '@/types/chart';
