/**
 * Next.js Middleware 入口
 * Next.js 只识别 src/middleware.ts 或根目录 middleware.ts 作为中间件文件。
 * 实际的路由保护和 CORS 逻辑在 src/proxy.ts 中实现。
 */
export { middleware, config } from './proxy';
