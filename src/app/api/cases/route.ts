/**
 * GET/POST /api/cases
 *
 * 代理到 /api/v1/cases，保持 API 版本统一。
 * 完整实现见 src/app/api/v1/cases/route.ts
 */
export { GET, POST, OPTIONS } from '@/app/api/v1/cases/route';
