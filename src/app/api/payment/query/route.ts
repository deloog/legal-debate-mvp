/**
 * 兼容旧入口：统一转发到 /api/payments/query
 * 新的支付查询主入口为 GET /api/payments/query
 */

export { GET } from '@/app/api/payments/query/route';
