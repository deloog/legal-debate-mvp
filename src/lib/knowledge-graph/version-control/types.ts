/**
 * 知识图谱版本控制 - 类型定义
 *
 * 提供版本控制相关的数据类型和工具函数
 */

// 快照版本类型 - 使用const对象支持运行时值检查
export const SnapshotVersion = {
  DAILY: 'DAILY' as const,
  WEEKLY: 'WEEKLY' as const,
  MONTHLY: 'MONTHLY' as const,
  MANUAL: 'MANUAL' as const,
};

// 类型别名，用于TypeScript类型检查
export type SnapshotVersion =
  (typeof SnapshotVersion)[keyof typeof SnapshotVersion];

// 快照状态 - 使用const对象支持运行时值检查
export const SnapshotStatus = {
  COMPLETED: 'COMPLETED' as const,
  IN_PROGRESS: 'IN_PROGRESS' as const,
  FAILED: 'FAILED' as const,
};

// 类型别名，用于TypeScript类型检查
export type SnapshotStatus =
  (typeof SnapshotStatus)[keyof typeof SnapshotStatus];

// 快照数据
export interface SnapshotData {
  nodes?: Array<{
    id: string;
    label: string;
    [key: string]: unknown;
  }>;
  edges?: Array<{
    source: string;
    target: string;
    relationType: string;
    [key: string]: unknown;
  }>;
}

// 变更记录
export interface SnapshotChange {
  type: 'ADDED' | 'MODIFIED' | 'REMOVED';
  entityType: 'article' | 'relation';
  entityId: string;
  description: string;
  previousValue?: unknown;
  newValue?: unknown;
}

// 快照统计
export interface SnapshotStatistics {
  totalArticles: number;
  totalRelations: number;
  verifiedRelations?: number;
  pendingRelations?: number;
  averageConfidence?: number;
}

// 图谱快照
export interface GraphSnapshot {
  id: string;
  version: SnapshotVersion;
  snapshotDate: Date;
  versionLabel: string;
  statistics: SnapshotStatistics;
  snapshotData?: SnapshotData;
  changes?: SnapshotChange[];
  status: SnapshotStatus;
  description?: string;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

// 创建快照输入
export interface CreateSnapshotInput {
  version: SnapshotVersion;
  includeFullData?: boolean;
  includeChanges?: boolean;
  description?: string;
}

// 快照比较差异
export interface SnapshotDifferences {
  articlesAdded: number;
  articlesRemoved: number;
  articlesModified: number;
  relationsAdded: number;
  relationsRemoved: number;
  relationsModified: number;
}

// 快照比较趋势
export interface SnapshotTrends {
  articlesGrowthRate: number;
  relationsGrowthRate: number;
  verificationRate: number;
}

// 快照比较结果
export interface SnapshotComparisonResult {
  snapshot1Id: string;
  snapshot2Id: string;
  comparisonDate: Date;
  differences: SnapshotDifferences;
  statistics: SnapshotStatistics;
  trends: SnapshotTrends;
}

// 版本信息
export interface SnapshotVersionInfo {
  type: SnapshotVersion | undefined;
  date?: Date;
  label: string;
}

// 快照配置
export interface SnapshotConfig {
  maxSnapshots: number;
  autoCleanup: boolean;
  retentionDays: number;
  includeFullDataByDefault: boolean;
  compressionEnabled: boolean;
}

// 默认快照配置
export const DEFAULT_SNAPSHOT_CONFIG: SnapshotConfig = {
  maxSnapshots: 100,
  autoCleanup: true,
  retentionDays: 90,
  includeFullDataByDefault: false,
  compressionEnabled: true,
};

/**
 * 验证快照输入是否有效
 */
export function validateSnapshotInput(input: CreateSnapshotInput): boolean {
  if (!input || !input.version) {
    return false;
  }

  const validVersions = ['DAILY', 'WEEKLY', 'MONTHLY', 'MANUAL'] as const;
  if (
    !validVersions.includes(input.version as (typeof validVersions)[number])
  ) {
    return false;
  }

  return true;
}

/**
 * 根据版本类型和日期生成版本标签
 */
export function calculateSnapshotVersion(version: string, date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');

  switch (version) {
    case SnapshotVersion.DAILY:
      return `v${year}.${month}.${day}`;
    case SnapshotVersion.WEEKLY: {
      // 计算周数
      const startOfYear = new Date(year, 0, 1);
      const days = Math.floor(
        (date.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000)
      );
      const week = Math.ceil((days + startOfYear.getDay() + 1) / 7);
      return `v${year}.${String(week).padStart(2, '0')}`;
    }
    case SnapshotVersion.MONTHLY:
      return `v${year}.${month}`;
    case SnapshotVersion.MANUAL:
      return `v${year}.${month}.${day}.${hours}${minutes}.manual`;
    default:
      return `v${year}.${month}.${day}`;
  }
}

/**
 * 比较两个快照并返回差异
 */
export function compareSnapshots(
  snapshot1: GraphSnapshot,
  snapshot2: GraphSnapshot
): SnapshotComparisonResult {
  const stats1 = snapshot1.statistics;
  const stats2 = snapshot2.statistics;

  const articlesDiff = stats2.totalArticles - stats1.totalArticles;
  const relationsDiff = stats2.totalRelations - stats1.totalRelations;

  const differences: SnapshotDifferences = {
    articlesAdded: Math.max(0, articlesDiff),
    articlesRemoved: Math.max(0, -articlesDiff),
    articlesModified: 0, // 需要详细比较
    relationsAdded: Math.max(0, relationsDiff),
    relationsRemoved: Math.max(0, -relationsDiff),
    relationsModified: 0, // 需要详细比较
  };

  const articlesGrowthRate =
    stats1.totalArticles > 0 ? stats2.totalArticles / stats1.totalArticles : 1;
  const relationsGrowthRate =
    stats1.totalRelations > 0
      ? stats2.totalRelations / stats1.totalRelations
      : 1;
  const verificationRate =
    stats2.verifiedRelations !== undefined && stats2.totalRelations > 0
      ? stats2.verifiedRelations / stats2.totalRelations
      : 0;

  return {
    snapshot1Id: snapshot1.id,
    snapshot2Id: snapshot2.id,
    comparisonDate: new Date(),
    differences,
    statistics: stats2,
    trends: {
      articlesGrowthRate,
      relationsGrowthRate,
      verificationRate,
    },
  };
}

/**
 * 格式化快照日期
 */
export function formatSnapshotDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

/**
 * 解析版本标签
 */
export function parseSnapshotVersion(
  versionLabel: string
): SnapshotVersionInfo {
  // Daily: v2026.02.25
  const dailyMatch = versionLabel.match(/^v(\d{4})\.(\d{2})\.(\d{2})$/);
  if (dailyMatch) {
    return {
      type: SnapshotVersion.DAILY,
      date: new Date(
        parseInt(dailyMatch[1]),
        parseInt(dailyMatch[2]) - 1,
        parseInt(dailyMatch[3])
      ),
      label: versionLabel,
    };
  }

  // Weekly/Monthly: v2026.02 or v2026.08
  const monthlyWeeklyMatch = versionLabel.match(/^v(\d{4})\.(\d{2})$/);
  if (monthlyWeeklyMatch && versionLabel.split('.').length === 2) {
    const monthOrWeek = parseInt(monthlyWeeklyMatch[2]);
    const year = parseInt(monthlyWeeklyMatch[1]);

    // 1-12 解析为月份 (MONTHLY)
    if (monthOrWeek >= 1 && monthOrWeek <= 12) {
      return {
        type: SnapshotVersion.MONTHLY,
        date: new Date(year, monthOrWeek - 1, 1),
        label: versionLabel,
      };
    }

    // 13-53 解析为周 (WEEKLY)
    if (monthOrWeek >= 13 && monthOrWeek <= 53) {
      return {
        type: SnapshotVersion.WEEKLY,
        date: new Date(year, monthOrWeek % 12, 1),
        label: versionLabel,
      };
    }
  }

  // Manual: v2026.02.25.manual
  if (versionLabel.includes('manual')) {
    const manualMatch = versionLabel.match(
      /^v(\d{4})\.(\d{2})\.(\d{2})\..*manual$/
    );
    if (manualMatch) {
      return {
        type: SnapshotVersion.MANUAL,
        date: new Date(
          parseInt(manualMatch[1]),
          parseInt(manualMatch[2]) - 1,
          parseInt(manualMatch[3])
        ),
        label: versionLabel,
      };
    }
  }

  return { type: undefined, label: versionLabel };
}
