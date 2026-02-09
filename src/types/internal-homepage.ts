/**
 * 内部系统工作台首页类型定义
 */

/**
 * 系统概览统计数据
 */
export interface SystemOverview {
  totalLawArticles: number; // 法条总数
  totalRelations: number; // 关系总数
  relationCoverage: number; // 关系覆盖率 (0-100)
  lastSyncTime: Date | null; // 最后同步时间
}

/**
 * 快速操作按钮
 */
export interface QuickAction {
  id: string;
  label: string;
  icon: string;
  href: string;
  description: string;
}

/**
 * 最近活动项
 */
export interface RecentActivity {
  id: string;
  type: 'law_article' | 'debate' | 'contract' | 'case';
  title: string;
  description: string;
  timestamp: Date;
  link: string;
}

/**
 * 知识图谱统计
 */
export interface KnowledgeGraphStats {
  relationsByType: Record<string, number>; // 按类型统计的关系数量
  topArticles: TopArticle[]; // 关系最多的法条
  recommendationAccuracy: number; // 推荐准确率 (0-100)
}

/**
 * 关系最多的法条
 */
export interface TopArticle {
  id: string;
  lawName: string;
  articleNumber: string;
  relationCount: number;
}

/**
 * 内部首页数据
 */
export interface InternalHomepageData {
  overview: SystemOverview;
  quickActions: QuickAction[];
  recentActivities: RecentActivity[];
  graphStats: KnowledgeGraphStats;
}

/**
 * API响应类型
 */
export interface InternalHomepageResponse {
  success: boolean;
  data?: InternalHomepageData;
  error?: {
    code: string;
    message: string;
  };
}
