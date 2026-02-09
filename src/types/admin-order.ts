/**
 * 管理员订单类型定义
 * 集中定义管理员订单相关的类型
 */

/**
 * 订单详情响应
 */
export interface OrderDetailResponse {
  id: string;
  orderNo: string;
  userId: string;
  userEmail: string;
  userName: string | null;
  userPhone: string | null;
  membershipTierId: string;
  membershipTierName: string;
  membershipTierPrice: number;
  paymentMethod: string;
  status: string;
  amount: number;
  currency: string;
  description: string;
  expiredAt: Date;
  paidAt: Date | null;
  failedReason: string | null;
  createdAt: Date;
  updatedAt: Date;
  metadata: Record<string, unknown>;
  userMemberships: Array<{
    id: string;
    status: string;
    startDate: Date;
    endDate: Date;
    tierName: string;
  }>;
  paymentRecords: Array<{
    id: string;
    paymentMethod: string;
    amount: number;
    status: string;
    transactionId: string | null;
    thirdPartyOrderNo: string | null;
    createdAt: Date;
  }>;
  refundRecords: Array<{
    id: string;
    amount: number;
    status: string;
    reason: string | null;
    createdAt: Date;
  }>;
  invoices: Array<{
    id: string;
    title: string | null;
    status: string;
    amount: number;
    issuedAt: Date | null;
    createdAt: Date;
  }>;
}

/**
 * 更新订单状态请求
 */
export interface UpdateOrderStatusRequest {
  status: string;
  paidAt?: string;
  failedReason?: string;
}

/**
 * 订单列表查询参数
 */
export interface OrderListQueryParams {
  page?: string;
  pageSize?: string;
  limit?: string; // 兼容旧参数名
  status?: string;
  paymentMethod?: string;
  userId?: string;
  membershipTierId?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
  keyword?: string;
  sortBy?: string;
  sortOrder?: string;
}

/**
 * 订单列表响应
 */
export interface OrderListResponse {
  orders: Array<{
    id: string;
    orderNo: string;
    orderNumber?: string;
    userId: string;
    userEmail: string;
    userName: string | null;
    membershipTierId: string;
    membershipTierName: string;
    paymentMethod: string;
    status: string;
    amount: number;
    total?: number;
    currency: string;
    description: string;
    expiredAt: Date;
    paidAt: Date | null;
    failedReason: string | null;
    createdAt: Date;
    updatedAt: Date;
  }>;
  summary?: {
    total: number;
    paidCount: number;
    paidAmount: number;
    pendingCount: number;
    pendingAmount: number;
    failedCount: number;
    failedAmount: number;
  };
  pagination: {
    page: number;
    pageSize: number;
    limit?: number; // 兼容旧参数名
    total: number;
    totalPages: number;
  };
}

/**
 * 订单统计响应
 */
export interface OrderStatsResponse {
  totalOrders: number;
  paidOrders: number;
  paidAmount: number;
  pendingOrders: number;
  pendingAmount: number;
  failedOrders: number;
  failedAmount: number;
  cancelledOrders: number;
  refundedOrders: number;
}
