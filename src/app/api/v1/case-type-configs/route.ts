/**
 * /api/v1/case-type-configs
 *
 * 转发至根级路由实现。
 * 根级路由为当前实现来源；未来如需破坏性升级，
 * 请将实现移至此文件并在根级路由中反向转发。
 *
 * @see src/app/api/case-type-configs/route.ts
 */
export * from '@/app/api/case-type-configs/route';
