/**
 * OAuth 服务 - 处理用户登录、创建和账号管理
 */

import { prisma } from '@/lib/db/prisma';
import { generateToken } from './jwt';
import type { OAuthUserInfo } from '../../types/oauth';
import type { OAuthAccount } from '../../types/oauth';
import { logger } from '@/lib/logger';

/**
 * OAuth 登录结果
 */
interface OAuthLoginResult {
  user: {
    id: string;
    email: string;
    username: string | null;
    name: string | null;
    role: string;
    createdAt: Date;
  };
  token: string;
  refreshToken?: string;
  isNewUser: boolean;
}

/**
 * OAuth 服务
 */
export class OAuthService {
  /**
   * 处理 OAuth 登录
   */
  static async handleOAuthLogin(
    provider: string,
    providerAccountId: string,
    userInfo: OAuthUserInfo
  ): Promise<OAuthLoginResult> {
    try {
      // 查找已存在的 OAuth 账号
      const existingAccount = await prisma.account.findUnique({
        where: {
          provider_providerAccountId: {
            provider,
            providerAccountId,
          },
        },
        include: {
          user: true,
        },
      });

      // 如果已存在，直接登录
      if (existingAccount) {
        const user = existingAccount.user;
        const token = generateToken({
          userId: user.id,
          email: user.email,
          role: user.role,
        });

        return {
          user: {
            id: user.id,
            email: user.email,
            username: user.username,
            name: user.name,
            role: user.role,
            createdAt: user.createdAt,
          },
          token,
          refreshToken: '', // OAuth刷新令牌由OAuth提供商管理
          isNewUser: false,
        };
      }

      // 新用户，创建账号
      const newUser = await this.createOAuthUser(
        provider,
        providerAccountId,
        userInfo
      );

      const token = generateToken({
        userId: newUser.id,
        email: newUser.email,
        role: newUser.role,
      });

      return {
        user: {
          id: newUser.id,
          email: newUser.email,
          username: newUser.username,
          name: newUser.name,
          role: newUser.role,
          createdAt: newUser.createdAt,
        },
        token,
        refreshToken: '',
        isNewUser: true,
      };
    } catch (error) {
      logger.error('OAuth login error:', error);
      throw new Error(
        `Failed to handle OAuth login: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * 创建 OAuth 用户
   */
  private static async createOAuthUser(
    provider: string,
    providerAccountId: string,
    userInfo: OAuthUserInfo
  ) {
    // 生成唯一邮箱
    const email = userInfo.email || `${userInfo.id}@${provider}.oauth`;

    // 检查邮箱是否已存在
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new Error('Email already exists');
    }

    // 创建新用户
    const newUser = await prisma.user.create({
      data: {
        email,
        username: userInfo.nickname,
        name: userInfo.nickname,
        avatar: userInfo.avatar,
        role: 'USER',
        status: 'ACTIVE',
        lastLoginAt: new Date(),
        loginCount: 1,
        accounts: {
          create: {
            type: 'oauth',
            provider,
            providerAccountId,
          },
        },
      },
    });

    return newUser;
  }

  /**
   * 绑定 OAuth 账号
   */
  static async bindOAuthAccount(
    userId: string,
    provider: string,
    providerAccountId: string,
    userInfo: OAuthUserInfo
  ): Promise<OAuthAccount> {
    try {
      // 检查 OAuth 账号是否已存在
      const existingAccount = await prisma.account.findUnique({
        where: {
          provider_providerAccountId: {
            provider,
            providerAccountId,
          },
        },
      });

      if (existingAccount) {
        throw new Error('OAuth account already bound');
      }

      // 创建 OAuth 账号绑定
      const account = await prisma.account.create({
        data: {
          userId,
          type: 'oauth',
          provider,
          providerAccountId,
          access_token: '',
        },
      });

      return {
        id: account.id,
        provider: provider as never,
        providerAccountId: account.providerAccountId,
        userId: account.userId,
        nickname: userInfo.nickname,
        avatar: userInfo.avatar,
        createdAt: new Date(), // 使用当前时间作为占位符
      };
    } catch (error) {
      logger.error('Bind OAuth account error:', error);
      throw new Error(
        `Failed to bind OAuth account: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * 解绑 OAuth 账号
   */
  static async unbindOAuthAccount(
    userId: string,
    provider: string
  ): Promise<void> {
    try {
      // 检查用户是否还有其他登录方式
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          accounts: true,
        },
      });

      if (!user) {
        throw new Error('User not found');
      }

      // 检查是否至少保留一种登录方式
      if (user.accounts.length <= 1) {
        throw new Error('Cannot unbind the last login method');
      }

      // 解绑 OAuth 账号
      await prisma.account.deleteMany({
        where: {
          userId,
          provider,
          type: 'oauth',
        },
      });
    } catch (error) {
      logger.error('Unbind OAuth account error:', error);
      throw new Error(
        `Failed to unbind OAuth account: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * 获取用户的 OAuth 账号列表
   */
  static async getUserOAuthAccounts(userId: string): Promise<OAuthAccount[]> {
    try {
      const accounts = await prisma.account.findMany({
        where: {
          userId,
          type: 'oauth',
        },
        orderBy: {
          id: 'desc',
        },
      });

      return accounts.map(account => ({
        id: account.id,
        provider: account.provider as never,
        providerAccountId: account.providerAccountId,
        userId: account.userId,
        createdAt: new Date(), // 使用当前时间作为占位符
      }));
    } catch (error) {
      logger.error('Get user OAuth accounts error:', error);
      throw new Error(
        `Failed to get OAuth accounts: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * 检查用户是否可以解绑
   */
  static async canUnbindAccount(userId: string): Promise<boolean> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          accounts: true,
        },
      });

      if (!user) {
        return false;
      }

      // 检查是否有密码登录方式
      const hasPassword = !!user.password;
      // 检查是否有其他 OAuth 登录方式
      const hasOtherOAuth =
        user.accounts.filter(a => a.type === 'oauth').length > 1;

      return hasPassword || hasOtherOAuth;
    } catch (error) {
      logger.error('Check can unbind error:', error);
      return false;
    }
  }
}
