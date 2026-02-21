/**
 * NextAuth API 路由处理器
 *
 * 所有 provider 和配置统一在 src/lib/auth/auth-options.ts 维护。
 */
import NextAuth from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
