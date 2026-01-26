/**
 * 图表类型定义
 */

/**
 * 基础图表数据点接口
 */
export interface ChartDataPoint {
  label: string;
  value: number;
}

/**
 * 饼图数据接口
 */
export interface PieChartData extends ChartDataPoint {
  color?: string;
  percentage?: number;
}

/**
 * 柱状图数据接口
 */
export interface BarChartData extends ChartDataPoint {
  color?: string;
}

/**
 * 折线图数据点接口
 */
export interface LineChartDataPoint {
  label: string;
  value: number;
  timestamp?: Date;
}

/**
 * 折线图数据接口
 */
export interface LineChartData {
  title: string;
  data: LineChartDataPoint[];
  color?: string;
}

/**
 * 漏斗图数据接口
 */
export interface FunnelChartData {
  label: string;
  count: number;
  percentage: number;
  color?: string;
}

/**
 * 图表颜色配置接口
 */
export interface ChartColorPalette {
  primary: string;
  secondary: string;
  success: string;
  warning: string;
  danger: string;
  info: string;
}

/**
 * 默认图表颜色配置
 */
export const DEFAULT_CHART_COLORS: ChartColorPalette = {
  primary: '#3b82f6',
  secondary: '#8b5cf6',
  success: '#22c55e',
  warning: '#f59e0b',
  danger: '#ef4444',
  info: '#06b6d4',
};

/**
 * 客户分析图表颜色配置
 */
export const CLIENT_ANALYTICS_COLORS = {
  active: '#22c55e',
  inactive: '#6b7280',
  lost: '#ef4444',
  blacklisted: '#991b1b',
  highValue: '#22c55e',
  mediumValue: '#f59e0b',
  lowValue: '#6b7280',
  referral: '#3b82f6',
  online: '#8b5cf6',
  event: '#ec4899',
  advertising: '#06b6d4',
  other: '#6b7280',
};

/**
 * 图表尺寸配置接口
 */
export interface ChartDimensions {
  width: number;
  height: number;
  padding: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
}

/**
 * 默认图表尺寸
 */
export const DEFAULT_CHART_DIMENSIONS: ChartDimensions = {
  width: 400,
  height: 300,
  padding: {
    top: 20,
    right: 20,
    bottom: 40,
    left: 50,
  },
};

/**
 * 图表标签配置接口
 */
export interface ChartLabelConfig {
  showLabels?: boolean;
  showValues?: boolean;
  showPercentage?: boolean;
  fontSize?: number;
  fontColor?: string;
}

/**
 * 图表交互配置接口
 */
export interface ChartInteractionConfig {
  showTooltip?: boolean;
  enableHover?: boolean;
  enableClick?: boolean;
  onHover?: (data: unknown) => void;
  onClick?: (data: unknown) => void;
}

/**
 * 图表组件基础Props接口
 */
export interface BaseChartProps {
  data?: unknown;
  dimensions?: Partial<ChartDimensions>;
  labelConfig?: Partial<ChartLabelConfig>;
  interactionConfig?: Partial<ChartInteractionConfig>;
  className?: string;
}

/**
 * 饼图Props接口
 */
export interface PieChartProps extends BaseChartProps {
  data: PieChartData[];
}

/**
 * 柱状图Props接口
 */
export interface BarChartProps extends BaseChartProps {
  data: BarChartData[];
}

/**
 * 折线图Props接口
 */
export interface LineChartProps extends BaseChartProps {
  data: LineChartData[];
}

/**
 * 漏斗图Props接口
 */
export interface FunnelChartProps extends BaseChartProps {
  data: FunnelChartData[];
}
