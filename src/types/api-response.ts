/**
 * 通用 API 响应类型定义
 * 集中定义所有 API 路由使用的通用响应类型
 */

/**
 * 通用成功响应格式
 */
export interface SuccessResponse<T> {
  success: true;
  data: T;
}

/**
 * 通用错误响应格式
 */
export interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
  };
}

/**
 * 分页查询参数
 */
export interface PaginationParams {
  page?: string | number;
  pageSize?: string | number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * 分页响应数据
 */
export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

/**
 * 带分页的列表响应
 */
export interface PaginatedResponse<T> {
  items: T[];
  pagination: PaginationMeta;
}

/**
 * 操作结果响应
 */
export interface ActionResult<T = void> {
  success: boolean;
  message?: string;
  data?: T;
}

/**
 * 批量操作结果
 */
export interface BatchOperationResult {
  success: boolean;
  total: number;
  succeeded: number;
  failed: number;
  errors?: Array<{
    id: string;
    error: string;
  }>;
}
