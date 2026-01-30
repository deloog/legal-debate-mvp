/**
 * 合同审查相关类型定义
 */

// 风险等级
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

// 风险类型
export type RiskType =
  | 'LEGAL_COMPLIANCE' // 法律合规
  | 'FINANCIAL' // 财务风险
  | 'LIABILITY' // 责任风险
  | 'TERMINATION' // 终止条款
  | 'DISPUTE_RESOLUTION' // 争议解决
  | 'INTELLECTUAL_PROPERTY' // 知识产权
  | 'CONFIDENTIALITY' // 保密条款
  | 'OTHER'; // 其他

// 风险项
export interface RiskItem {
  id: string;
  type: RiskType;
  level: RiskLevel;
  title: string;
  description: string;
  location: {
    page?: number;
    paragraph?: number;
    startIndex?: number;
    endIndex?: number;
  };
  originalText: string;
  impact: string; // 影响说明
  probability: number; // 发生概率 0-1
}

// 修改建议
export interface Suggestion {
  id: string;
  riskId: string;
  type: 'ADD' | 'MODIFY' | 'DELETE' | 'CLARIFY';
  title: string;
  description: string;
  originalText?: string;
  suggestedText?: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  reason: string;
}

// 审查报告
export interface ReviewReport {
  id: string;
  contractId: string;
  fileName: string;
  fileSize: number;
  uploadedAt: Date;
  reviewedAt: Date;

  // 审查结果
  overallScore: number; // 总体评分 0-100
  riskScore: number; // 风险评分 0-100
  complianceScore: number; // 合规评分 0-100

  // 统计信息
  totalRisks: number;
  criticalRisks: number;
  highRisks: number;
  mediumRisks: number;
  lowRisks: number;

  // 详细内容
  risks: RiskItem[];
  suggestions: Suggestion[];

  // 审查时间
  reviewTime: number; // 毫秒

  // 审查状态
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  error?: string;
}

// 合同上传响应
export interface ContractUploadResponse {
  success: boolean;
  data?: {
    contractId: string;
    fileName: string;
    fileSize: number;
    uploadedAt: Date;
  };
  error?: {
    code: string;
    message: string;
  };
}

// 合同审查响应
export interface ContractReviewResponse {
  success: boolean;
  data?: ReviewReport;
  error?: {
    code: string;
    message: string;
  };
}

// 审查历史项
export interface ReviewHistoryItem {
  id: string;
  contractId: string;
  fileName: string;
  reviewedAt: Date;
  overallScore: number;
  totalRisks: number;
  criticalRisks: number;
  status: 'COMPLETED' | 'FAILED';
}

// 审查历史响应
export interface ReviewHistoryResponse {
  success: boolean;
  data?: {
    items: ReviewHistoryItem[];
    total: number;
    page: number;
    pageSize: number;
  };
  error?: {
    code: string;
    message: string;
  };
}
