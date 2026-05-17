/**
 * NextAuth 统一配置
 *
 * 支持两种登录方式：
 *   1. 邮箱密码（Credentials provider）
 *   2. 微信 OAuth（需配置 WECHAT_APP_ID / WECHAT_APP_SECRET）
 *
 * 配置要点：
 *   - session 策略：JWT（无状态，适合多实例部署）
 *   - jwt/session callbacks：将 userId 和 role 注入 token/session
 *   - 微信 provider 仅在环境变量齐全时启用，缺失时静默跳过
 */

import type { NextAuthOptions } from 'next-auth';
import { type DefaultSession } from 'next-auth';
import { type DefaultJWT } from 'next-auth/jwt';
import CredentialsProvider from 'next-auth/providers/credentials';
import { compare } from 'bcryptjs';
import { prisma } from '@/lib/db/prisma';
import { getEffectiveUserRole } from '@/lib/auth/role-onboarding';

// ---------------------------------------------------------------------------
// 类型扩展：在 session/token 中携带 id 和 role
// ---------------------------------------------------------------------------

declare module 'next-auth' {
  interface User {
    id: string;
    role?: string;
  }
  interface Session extends DefaultSession {
    user: {
      id: string;
      role?: string;
    } & DefaultSession['user'];
  }
}

declare module 'next-auth/jwt' {
  interface JWT extends DefaultJWT {
    id: string;
    role?: string;
  }
}

// ---------------------------------------------------------------------------
// 动态 provider 列表
// ---------------------------------------------------------------------------

function buildProviders(): NextAuthOptions['providers'] {
  const providers: NextAuthOptions['providers'] = [];

  // 1. 邮箱密码登录（始终启用）
  providers.push(
    CredentialsProvider({
      id: 'credentials',
      name: '邮箱登录',
      credentials: {
        email: { label: '邮箱', type: 'email' },
        password: { label: '密码', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
          select: {
            id: true,
            email: true,
            name: true,
            username: true,
            role: true,
            status: true,
            password: true,
            preferences: true,
          },
        });

        if (!user || user.status !== 'ACTIVE' || !user.password) return null;

        const isValid = await compare(credentials.password, user.password);
        if (!isValid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name || user.username || '',
          role: getEffectiveUserRole(user.role, user.preferences),
        };
      },
    })
  );

  // 2. 微信 OAuth 登录（仅在环境变量存在时启用）
  // 微信使用自定义 OAuth 流程（/api/auth/oauth/wechat），
  // 此处提供一个 Credentials provider 供 OAuth 回调后建立 NextAuth session。
  if (process.env.WECHAT_APP_ID && process.env.WECHAT_APP_SECRET) {
    providers.push(
      CredentialsProvider({
        id: 'wechat',
        name: '微信登录',
        credentials: {
          userId: { label: 'userId', type: 'text' },
        },
        async authorize(credentials) {
          if (!credentials?.userId) return null;

          const user = await prisma.user.findUnique({
            where: { id: credentials.userId },
            select: {
              id: true,
              email: true,
              name: true,
              username: true,
              role: true,
              status: true,
              preferences: true,
            },
          });

          if (!user || user.status !== 'ACTIVE') return null;

          return {
            id: user.id,
            email: user.email ?? '',
            name: user.name || user.username || '',
            role: getEffectiveUserRole(user.role, user.preferences),
          };
        },
      })
    );
  }

  return providers;
}

// ---------------------------------------------------------------------------
// 主配置
// ---------------------------------------------------------------------------

export const authOptions: NextAuthOptions = {
  providers: buildProviders(),

  session: {
    strategy: 'jwt',
    maxAge: 7 * 24 * 60 * 60, // 7 天
  },

  pages: {
    signIn: '/login',
    signOut: '/login',
    error: '/login',
  },

  callbacks: {
    async jwt({ token, user }) {
      // 首次登录时，将 id / role 写入 token
      if (user) {
        token.id = user.id;
        token.role = (user as { role?: string }).role;
      }
      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.role = token.role;
      }
      return session;
    },
  },
};
