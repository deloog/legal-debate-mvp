/**
 * 兼容旧入口：统一转发到 /api/payments/create
 * 新的支付创建主入口为 POST /api/payments/create
 */

export { POST } from '@/app/api/payments/create/route';
