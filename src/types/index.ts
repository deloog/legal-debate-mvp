/**
 * 集中式类型导出索引
 * 提供便捷的批量导入
 */

// API 响应类型
export type {
  ActionResult,
  BatchOperationResult,
  ErrorResponse,
  PaginatedResponse,
  PaginationMeta,
  PaginationParams,
  SuccessResponse,
} from './api-response';

// 管理员用户类型
export type {
  AssignRoleRequest,
  BatchAssignDetailResult,
  BatchAssignResult,
  BatchAssignRoleRequest,
  SearchResponse,
  UpdateUserRequest,
  UserAssignResult,
  UserDetailResponse,
  UserListQueryParams,
  UserListResponse,
  UserRoleResponse,
  UserSearchResult,
  UserStatistics,
} from './admin-user';

// 管理员角色类型
export type {
  CreateRoleRequest,
  PermissionListResponse,
  PermissionsListResponse,
  RoleDetailResponse,
  RoleListQueryParams,
  RoleListResponse,
} from './admin-role';

// 管理员会员类型
export type {
  CancelRequestBody,
  DowngradeRequestBody,
  ExportMembershipData,
  ExportQueryParams,
  MembershipDetailResponse,
  MembershipListQueryParams,
  MembershipListResponse,
  UpdateMembershipRequest,
  UpgradeRequestBody,
} from './admin-membership';

// 管理员订单类型
export type {
  OrderDetailResponse,
  OrderListQueryParams,
  OrderListResponse,
  OrderStatsResponse,
  UpdateOrderStatusRequest,
} from './admin-order';

// 管理员企业类型
export type {
  EnterpriseDetail,
  EnterpriseListData,
  EnterpriseListItem,
  Pagination,
} from './admin-enterprise';

// 案件类型配置类型
export type {
  calculateBaseFee,
  calculateHourlyFee,
  calculateRiskFee,
  CASE_TYPE_CATEGORY_LABELS,
  CaseTypeCategory,
  CaseTypeConfig,
  CaseTypeConfigListResponse,
  CaseTypeConfigQueryParams,
  CreateCaseTypeConfigInput,
  estimateCaseDuration,
  generateCaseTypeCode,
  getCaseTypeCategoryLabel,
  getComplexityLevelLabel,
  getRecommendedLawyerCount,
  isValidCaseTypeCategory,
  isValidCaseTypeCode,
  isValidMaterialList,
  MaterialItem,
  MaterialList,
  UpdateCaseTypeConfigInput,
} from './case-type-config';

// 团队类型
export type {
  AddTeamMemberInput,
  CreateTeamInput,
  MemberStatus,
  TeamDetail,
  TeamListResponse,
  TeamQueryParams,
  TeamRole,
  TeamStatus,
  TeamType,
  UpdateTeamInput,
  UpdateTeamMemberInput,
} from './team';

// 通知类型
export type {
  BatchActionRequest,
  CreateReminderInput,
  MarkReadRequest,
  NotificationChannel,
  NotificationDetail,
  NotificationListResponse,
  NotificationQueryParams,
  NotificationType,
  Reminder,
  ReminderListResponse,
  ReminderPreferences,
  ReminderQueryParams,
  ReminderStatus,
  ReminderType,
  SMSProvider,
  SMSSendOptions,
  SMSSendResult,
  UpdateReminderInput,
} from './notification';

// 合同类型
export type {
  ContractDetail,
  ContractListResponse,
  ContractQueryParams,
  ContractStatus,
  CreateContractInput,
  FeeType,
  UpdateContractInput,
} from './contract';

// 会员类型
export type {
  MembershipChangeType,
  MembershipStatistics,
  MembershipStatus,
  MembershipTier,
  UsageStats,
  UsageType,
} from './membership';
