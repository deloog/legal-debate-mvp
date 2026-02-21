/**
 * /api/v1/consultations
 *
 * 转发至根级路由实现。
 * 根级路由为当前实现来源；未来如需破坏性升级，
 * 请将实现移至此文件并在根级路由中反向转发。
 *
 * @see src/app/api/consultations/route.ts
 */
export * from '@/app/api/consultations/route';
