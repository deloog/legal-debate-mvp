import NextAuth, { type NextAuthOptions } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { compare } from 'bcryptjs';
import { prisma } from '@/lib/db/prisma';
import { authOptions } from '@/lib/auth/auth-options';

/**
 * NextAuth API 路由处理器
 *
 * 处理所有 NextAuth 认证请求
 */
const options: NextAuthOptions = {
  ...authOptions,
  providers: [
    Credentials({
      name: 'Credentials',
      credentials: {
        email: { label: '邮箱', type: 'email' },
        password: { label: '密码', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const { email, password } = credentials;

        // 查找用户
        const user = await prisma.user.findUnique({
          where: { email },
          select: {
            id: true,
            email: true,
            username: true,
            name: true,
            role: true,
            status: true,
            password: true,
          },
        });

        if (!user) {
          return null;
        }

        // 检查用户状态
        if (user.status !== 'ACTIVE') {
          return null;
        }

        // 验证密码
        if (!user.password) {
          return null;
        }

        const isPasswordValid = await compare(password, user.password);
        if (!isPasswordValid) {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name || user.username || '',
        };
      },
    }),
  ],
};

const handler = NextAuth(options);

export { handler as GET, handler as POST };
