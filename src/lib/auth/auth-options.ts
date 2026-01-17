/**
 * NextAuth 配置
 * 临时配置文件，用于解决导入错误
 * TODO: 集成完整的 NextAuth 认证系统
 */

import type { NextAuthOptions, DefaultSession } from 'next-auth';
import { DefaultJWT } from 'next-auth/jwt';

// 扩展类型定义
declare module 'next-auth' {
  interface User {
    id: string;
  }

  interface Session extends DefaultSession {
    user: {
      id: string;
    } & DefaultSession['user'];
  }
}

declare module 'next-auth/jwt' {
  interface JWT extends DefaultJWT {
    id: string;
  }
}

/**
 * NextAuth 配置选项
 */
export const authOptions: NextAuthOptions = {
  providers: [],
  session: {
    strategy: 'jwt',
  },
  pages: {
    signIn: '/auth/signin',
    signOut: '/auth/signout',
    error: '/auth/error',
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id;
      }
      return session;
    },
  },
};
