/**
 * 管理员企业类型定义
 * 集中定义管理员企业相关的类型
 */

/**
 * 分页参数
 */
export interface Pagination {
  page: number;
  pageSize: number;
  limit?: number;
  total: number;
  totalPages: number;
}

/**
 * 企业列表项
 */
export interface EnterpriseListItem {
  id: string;
  userId: string;
  enterpriseName: string;
  creditCode: string;
  legalPerson: string;
  industryType: string;
  status: string;
  submittedAt: Date;
  reviewedAt: Date | null;
  reviewerId: string | null;
  reviewNotes: string | null;
  expiresAt: Date | null;
  user: {
    email: string;
    username: string | null;
    name: string | null;
  };
}

/**
 * 企业列表数据
 */
export interface EnterpriseListData {
  enterprises: EnterpriseListItem[];
  pagination: Pagination;
}

/**
 * 企业详情
 */
export interface EnterpriseDetail {
  id: string;
  enterpriseName: string;
  creditCode: string;
  legalPerson: string;
  legalPersonPhone: string | null;
  industryType: string;
  businessLicense: string | null;
  address: string | null;
  registeredCapital: number | null;
  establishmentDate: Date | null;
  status: string;
  reviewNotes: string | null;
  submittedAt: Date;
  reviewedAt: Date | null;
  user: {
    id: string;
    name: string | null;
    email: string;
    phone: string | null;
  };
}
