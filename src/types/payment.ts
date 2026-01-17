/**
 * 支付系统类型定义
 */

// =============================================================================
// 支付方式枚举
// =============================================================================

/**
 * 支付方式
 */
export enum PaymentMethod {
  WECHAT = 'WECHAT', // 微信支付
  ALIPAY = 'ALIPAY', // 支付宝
  BALANCE = 'BALANCE', // 余额支付（预留）
}

/**
 * 支付状态
 */
export enum PaymentStatus {
  PENDING = 'PENDING', // 待支付
  PROCESSING = 'PROCESSING', // 处理中
  SUCCESS = 'SUCCESS', // 支付成功
  FAILED = 'FAILED', // 支付失败
  REFUNDING = 'REFUNDING', // 退款中
  REFUNDED = 'REFUNDED', // 已退款
  CANCELLED = 'CANCELLED', // 已取消
  EXPIRED = 'EXPIRED', // 已过期
}

/**
 * 订单状态
 */
export enum OrderStatus {
  PENDING = 'PENDING', // 待支付
  PROCESSING = 'PROCESSING', // 处理中
  PAID = 'PAID', // 已支付
  FAILED = 'FAILED', // 支付失败
  CANCELLED = 'CANCELLED', // 已取消
  REFUNDED = 'REFUNDED', // 已退款
  EXPIRED = 'EXPIRED', // 已过期
}

/**
 * 退款状态
 */
export enum RefundStatus {
  PENDING = 'PENDING', // 待处理
  PROCESSING = 'PROCESSING', // 处理中
  SUCCESS = 'SUCCESS', // 退款成功
  FAILED = 'FAILED', // 退款失败
  CANCELLED = 'CANCELLED', // 已取消
}

/**
 * 退款原因
 */
export enum RefundReason {
  USER_REQUEST = 'USER_REQUEST', // 用户申请
  SYSTEM_ERROR = 'SYSTEM_ERROR', // 系统错误
  DUPLICATE_PAYMENT = 'DUPLICATE_PAYMENT', // 重复支付
  SERVICE_ISSUE = 'SERVICE_ISSUE', // 服务问题
  OTHER = 'OTHER', // 其他原因
}

/**
 * 发票状态
 */
export enum InvoiceStatus {
  PENDING = 'PENDING', // 待开具
  PROCESSING = 'PROCESSING', // 开具中
  COMPLETED = 'COMPLETED', // 已开具
  FAILED = 'FAILED', // 开具失败
  CANCELLED = 'CANCELLED', // 已取消
}

/**
 * 发票类型
 */
export enum InvoiceType {
  PERSONAL = 'PERSONAL', // 个人发票
  ENTERPRISE = 'ENTERPRISE', // 企业发票
}

// =============================================================================
// 微信支付专用类型
// =============================================================================

/**
 * 微信支付交易类型
 */
export enum WechatPayTransactionType {
  NATIVE = 'NATIVE', // 扫码支付
  JSAPI = 'JSAPI', // 公众号支付
  H5 = 'H5', // H5支付
  APP = 'APP', // APP支付
}

/**
 * 微信支付结果类型
 */
export enum WechatPayTradeState {
  SUCCESS = 'SUCCESS', // 支付成功
  REFUND = 'REFUND', // 转入退款
  NOTPAY = 'NOTPAY', // 未支付
  CLOSED = 'CLOSED', // 已关闭
  REVOKED = 'REVOKED', // 已撤销（付款码支付）
  USERPAYING = 'USERPAYING', // 用户支付中
  PAYERROR = 'PAYERROR', // 支付失败（其他原因，如银行返回失败）
}

/**
 * 微信支付通知类型
 */
export enum WechatPayNotifyType {
  TRANSACTION_SUCCESS = 'TRANSACTION.SUCCESS', // 支付成功通知
  REFUND_SUCCESS = 'REFUND.SUCCESS', // 退款成功通知
}

// =============================================================================
// 订单接口
// =============================================================================

/**
 * 订单信息
 */
export interface Order {
  id: string;
  orderNo: string;
  userId: string;
  membershipTierId: string;
  paymentMethod: PaymentMethod;
  status: OrderStatus;
  amount: number;
  currency: string;
  description: string;
  metadata?: Record<string, unknown>;
  expiredAt: Date;
  paidAt?: Date;
  failedReason?: string;
  createdAt: Date;
  updatedAt: Date;

  // 关联信息
  user?: {
    id: string;
    email: string;
    username: string | null;
    name: string | null;
  };
  membershipTier?: {
    id: string;
    name: string;
    displayName: string;
    tier: string;
  };
  paymentRecords?: PaymentRecord[];
}

/**
 * 订单创建请求
 */
export interface CreateOrderRequest {
  membershipTierId: string;
  paymentMethod: PaymentMethod;
  billingCycle?: 'MONTHLY' | 'QUARTERLY' | 'YEARLY' | 'LIFETIME';
  autoRenew?: boolean;
  description?: string;
  metadata?: Record<string, unknown>;
}

/**
 * 订单创建响应
 */
export interface CreateOrderResponse {
  success: boolean;
  message: string;
  data?: {
    orderId: string;
    orderNo: string;
    amount: number;
    currency: string;
    status: OrderStatus;
    expiredAt: Date;
    paymentUrl?: string; // 支付链接（扫码支付时返回）
    codeUrl?: string; // 二维码链接（扫码支付时返回）
    prepayId?: string; // 预支付ID（JSAPI支付时返回）
  };
  error?: string;
}

// =============================================================================
// 支付记录接口
// =============================================================================

/**
 * 支付记录
 */
export interface PaymentRecord {
  id: string;
  orderId: string;
  userId: string;
  paymentMethod: PaymentMethod;
  status: PaymentStatus;
  amount: number;
  currency: string;
  transactionId?: string; // 第三方支付平台的交易ID
  thirdPartyOrderNo?: string; // 第三方平台的订单号
  errorCode?: string;
  errorMessage?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;

  // 关联信息
  order?: Order;
  user?: {
    id: string;
    email: string;
  };
}

// =============================================================================
// 退款记录接口
// =============================================================================

/**
 * 退款记录
 */
export interface RefundRecord {
  id: string;
  orderId: string;
  paymentRecordId: string;
  userId: string;
  paymentMethod: PaymentMethod;
  status: RefundStatus;
  reason: RefundReason;
  amount: number;
  refundAmount: number; // 实际退款金额（可能因手续费等原因小于申请金额）
  currency: string;
  transactionId?: string; // 第三方支付平台的退款交易ID
  thirdPartyRefundNo?: string; // 第三方平台的退款单号
  rejectedReason?: string;
  metadata?: Record<string, unknown>;
  appliedAt: Date;
  processedAt?: Date;
  createdAt: Date;
  updatedAt: Date;

  // 关联信息
  order?: Order;
  paymentRecord?: PaymentRecord;
  user?: {
    id: string;
    email: string;
  };
}

/**
 * 退款申请请求
 */
export interface ApplyRefundRequest {
  orderId: string;
  reason: RefundReason;
  description?: string;
}

/**
 * 退款申请响应
 */
export interface ApplyRefundResponse {
  success: boolean;
  message: string;
  data?: {
    refundId: string;
    orderId: string;
    amount: number;
    currency: string;
    status: RefundStatus;
  };
  error?: string;
}

// =============================================================================
// 发票接口
// =============================================================================

/**
 * 发票信息
 */
export interface Invoice {
  id: string;
  orderId: string;
  userId: string;
  type: InvoiceType;
  status: InvoiceStatus;
  amount: number;
  currency: string;
  title?: string; // 发票抬头
  taxNumber?: string; // 税号
  email?: string; // 接收邮箱
  filePath?: string;
  issuedAt?: Date;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;

  // 关联信息
  order?: Order;
  user?: {
    id: string;
    email: string;
  };
}

/**
 * 发票申请请求
 */
export interface ApplyInvoiceRequest {
  orderId: string;
  type: InvoiceType;
  title?: string;
  taxNumber?: string;
  email?: string;
}

/**
 * 发票申请响应
 */
export interface ApplyInvoiceResponse {
  success: boolean;
  message: string;
  data?: {
    invoiceId: string;
    orderId: string;
    amount: number;
    currency: string;
    status: InvoiceStatus;
  };
  error?: string;
}

// =============================================================================
// 微信支付接口
// =============================================================================

/**
 * 微信支付配置
 */
export interface WechatPayConfig {
  appId: string;
  mchId: string;
  apiKeyV3: string;
  certSerialNo: string;
  privateKeyPath: string;
  certPath: string;
  notifyUrl: string;
  refundNotifyUrl: string;
}

/**
 * 微信统一下单请求
 */
export interface WechatCreateOrderRequest {
  outTradeNo: string;
  description: string;
  amount: {
    total: number; // 单位：分
    currency: string;
  };
  payer?: {
    openid: string;
  };
  attach?: string; // 附加数据，在查询API和支付通知中原样返回
  detail?: string; // 商品详情
  scene_info?: {
    payer_client_ip: string;
    device_id?: string;
  };
  settle_info?: {
    profit_sharing?: boolean;
  };
  time_expire?: number; // 订单失效时间（Unix时间戳）
}

/**
 * 微信统一下单响应
 */
export interface WechatCreateOrderResponse {
  prepay_id?: string;
  code_url?: string;
}

/**
 * 微信支付回调通知
 */
export interface WechatPayNotification {
  id: string;
  event_type: WechatPayNotifyType;
  resource_type: string;
  resource: {
    algorithm: string;
    ciphertext: string;
    nonce: string;
    associated_data: string;
  };
  create_time: string;
  summary: string;
}

/**
 * 解密后的支付结果
 */
export interface WechatPayResult {
  sp_mchid: string;
  out_trade_no: string;
  transaction_id: string;
  trade_type: string;
  trade_state: WechatPayTradeState;
  trade_state_desc: string;
  bank_type: string;
  attach: string;
  success_time: string;
  payer: {
    openid: string;
  };
  amount: {
    total: number;
    payer_total: number;
    currency: string;
    payer_currency: string;
  };
  scene_info: {
    device_id: string;
    payer_client_ip: string;
  };
}

/**
 * 微信支付查询请求
 */
export interface WechatQueryOrderRequest {
  out_trade_no?: string;
  transaction_id?: string;
  mchid: string;
}

/**
 * 微信支付查询响应
 */
export interface WechatQueryOrderResponse {
  appid: string;
  mchid: string;
  out_trade_no: string;
  transaction_id: string;
  trade_type: string;
  trade_state: WechatPayTradeState;
  trade_state_desc: string;
  bank_type: string;
  attach: string;
  success_time: string;
  payer: {
    openid: string;
  };
  amount: {
    total: number;
    payer_total: number;
    currency: string;
    payer_currency: string;
  };
}

/**
 * 微信退款请求
 */
export interface WechatRefundRequest {
  out_trade_no: string;
  out_refund_no: string;
  reason: string;
  amount: {
    refund: number;
    total: number;
    currency: string;
  };
  notify_url?: string;
}

/**
 * 微信退款响应
 */
export interface WechatRefundResponse {
  refund_id: string;
  out_refund_no: string;
  transaction_id: string;
  out_trade_no: string;
  channel: string;
  user_received_account: string;
  success_time: string;
  amount: {
    total: number;
    refund: number;
    payer_refund?: number;
    settlement_refund?: number;
    settlement_total?: number;
    currency: string;
    payer_refund_currency?: string;
  };
}

// =============================================================================
// API请求/响应类型
// =============================================================================

/**
 * 支付查询请求
 */
export interface QueryPaymentRequest {
  orderId?: string;
  orderNo?: string;
}

/**
 * 支付查询响应
 */
export interface QueryPaymentResponse {
  success: boolean;
  message: string;
  data?: {
    order: Order;
    paymentRecord?: PaymentRecord;
    paymentStatus: PaymentStatus;
  };
  error?: string;
}

// =============================================================================
// 统计和报表类型
// =============================================================================

/**
 * 支付统计信息
 */
export interface PaymentStats {
  totalOrders: number;
  paidOrders: number;
  failedOrders: number;
  refundedOrders: number;
  totalAmount: number;
  paidAmount: number;
  refundedAmount: number;
  successRate: number;
  periodStart: Date;
  periodEnd: Date;
}

/**
 * 支付统计请求
 */
export interface PaymentStatsRequest {
  periodStart?: Date;
  periodEnd?: Date;
  userId?: string;
}

/**
 * 支付统计响应
 */
export interface PaymentStatsResponse {
  success: boolean;
  message: string;
  data?: PaymentStats;
  error?: string;
}

// =============================================================================
// 支付宝支付专用类型
// =============================================================================

/**
 * 支付宝支付交易类型
 */
export enum AlipayTransactionType {
  QR_CODE = 'QR_CODE', // 当面付（扫码支付）
  WAP = 'WAP', // 手机网站支付
  PC = 'PC', // 电脑网站支付
  APP = 'APP', // APP支付
}

/**
 * 支付宝支付状态
 */
export enum AlipayTradeStatus {
  TRADE_SUCCESS = 'TRADE_SUCCESS', // 交易支付成功
  TRADE_FINISHED = 'TRADE_FINISHED', // 交易结束，不可退款
  TRADE_CLOSED = 'TRADE_CLOSED', // 未付款交易超时关闭
  WAIT_BUYER_PAY = 'WAIT_BUYER_PAY', // 交易创建，等待买家付款
}

/**
 * 支付宝产品码
 */
export enum AlipayProductCode {
  FAST_INSTANT_TRADE_PAY = 'FAST_INSTANT_TRADE_PAY', // 当面付
  WAP_FAST_PAY = 'WAP_FAST_PAY', // 手机网站支付
  PC_FAST_PAY = 'PC_FAST_PAY', // 电脑网站支付
  APP_FAST_PAY = 'APP_FAST_PAY', // APP支付
}

/**
 * 支付宝回调通知类型
 */
export enum AlipayNotifyType {
  TRADE_STATUS_SYNC = 'trade_status_sync', // 交易状态同步通知
}

/**
 * 支付宝环境类型
 */
export enum AlipayEnvironment {
  SANDBOX = 'sandbox', // 沙箱环境
  PRODUCTION = 'production', // 生产环境
}

/**
 * 支付宝支付配置
 */
export interface AlipayConfig {
  appId: string;
  merchantId: string;
  privateKey: string;
  publicKey: string;
  notifyUrl: string;
  returnUrl: string;
  environment: AlipayEnvironment;
}

/**
 * 支付宝统一下单请求
 */
export interface AlipayCreateOrderRequest {
  outTradeNo: string;
  totalAmount: number; // 单位：元，保留两位小数
  subject: string;
  body?: string;
  productCode: AlipayProductCode;
  qrPayMode?: '2' | '3' | '4'; // 二维码支付模式：2-订单码，3-前置码，4-前置码
  timeExpire?: number; // 订单失效时间（相对时间，单位：分钟）
  goodsType?: '0' | '1'; // 商品类型：0-实物，1-虚拟商品
  returnUrl?: string; // 同步回调地址
  notifyUrl?: string; // 异步通知地址
}

/**
 * 支付宝统一下单响应
 */
export interface AlipayCreateOrderResponse {
  code: string;
  msg: string;
  outTradeNo: string;
  tradeNo?: string;
  qrCode?: string; // 二维码支付时返回
}

/**
 * 支付宝交易查询请求
 */
export interface AlipayQueryOrderRequest {
  outTradeNo?: string;
  tradeNo?: string;
}

/**
 * 支付宝交易查询响应
 */
export interface AlipayQueryOrderResponse {
  code: string;
  msg: string;
  tradeNo: string;
  outTradeNo: string;
  totalAmount: string;
  tradeStatus: AlipayTradeStatus;
  buyerId?: string;
  buyerLogonId?: string;
  fundBillList?: Array<{
    fundChannel: string;
    amount: string;
  }>;
}

/**
 * 支付宝退款请求
 */
export interface AlipayRefundRequest {
  outTradeNo: string;
  refundAmount: number; // 单位：元，保留两位小数
  refundReason?: string;
  outRequestNo?: string; // 退款请求号
  refundAmountType?: 'ORIGINAL' | 'DECIMAL'; // 退款金额类型
}

/**
 * 支付宝退款响应
 */
export interface AlipayRefundResponse {
  code: string;
  msg: string;
  refundFee: string; // 退款金额
  gmtRefundPay: string; // 退款时间
  outRequestNo?: string; // 退款请求号
  tradeNo?: string; // 原交易号
}

/**
 * 支付宝异步通知（回调）
 */
export interface AlipayNotifyRequest {
  trade_status: string;
  trade_no: string;
  out_trade_no: string;
  total_amount: string;
  buyer_id?: string;
  buyer_logon_id?: string;
  notify_time: string;
  subject: string;
  body?: string;
  gmt_create: string;
  gmt_payment: string;
  fund_bill_list?: string;
  notify_type?: string;
  notify_id?: string;
  app_id: string;
  sign?: string; // 签名字符串，用于验签
}

/**
 * 支付宝同步返回参数
 */
export interface AlipayReturnParams {
  trade_no?: string;
  out_trade_no?: string;
  total_amount?: string;
  buyer_id?: string;
  timestamp?: string;
  sign?: string; // 签名字符串，用于验签
}
