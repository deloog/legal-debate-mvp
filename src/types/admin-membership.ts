/**
 * 管理员会员类型定义
 * 集中定义管理员会员相关的类型
 */

/**
 * 会员详情响应
 */
export interface MembershipDetailResponse {
  id: string;
  userId: string;
  userEmail: string;
  userName: string | null;
  tierName: string;
  tierDisplayName: string;
  status: string;
  startDate: Date;
  endDate: Date;
  autoRenew: boolean;
  cancelledAt: Date | null;
  cancelledReason: string | null;
  pausedAt: Date | null;
  pausedReason: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 更新会员请求
 */
export interface UpdateMembershipRequest {
  tierId?: string;
  status?: string;
  endDate?: string;
  autoRenew?: boolean;
  notes?: string;
  pausedReason?: string;
}

/**
 * 会员列表查询参数
 */
export interface MembershipListQueryParams {
  page?: string;
  pageSize?: string;
  tierId?: string;
  tier?: string; // 兼容旧参数名
  status?: string;
  keyword?: string;
  search?: string; // 兼容旧参数名
  sortBy?: string;
  sortOrder?: string;
}

/**
 * 会员列表响应
 */
export interface MembershipListResponse {
  memberships: Array<{
    id: string;
    userId: string;
    userEmail: string;
    userName: string | null;
    tierName: string;
    tierDisplayName: string;
    status: string;
    startDate: Date;
    endDate: Date;
    autoRenew: boolean;
    createdAt: Date;
  }>;
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

/**
 * 导出查询参数
 */
export interface ExportQueryParams {
  tier?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
}

/**
 * 导出会员数据
 */
export interface ExportMembershipData {
  userId: string;
  userName: string;
  userEmail: string;
  tierName: string;
  tierDisplayName: string;
  status: string;
  startDate: Date;
  endDate: Date;
  autoRenew: boolean;
  cancelledAt: Date | null;
  cancelledReason: string | null;
  pausedAt: Date | null;
  pausedReason: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 升级请求体
 */
export interface UpgradeRequestBody {
  tierId: string;
  paymentMethod?: string;
  billingCycle?: string; // 兼容路由使用的计费周期参数
  autoRenew?: boolean;
  orderId?: string; // 付费升级时必须提供已完成支付的订单ID
}

/**
 * 降级请求体
 */
export interface DowngradeRequestBody {
  tierId: string;
  reason?: string;
  effectiveDate?: string;
}

/**
 * 取消请求体
 */
export interface CancelRequestBody {
  reason?: string;
  immediate?: boolean;
}
