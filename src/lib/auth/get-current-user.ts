/**
 * 获取当前用户工具函数
 * 用于在服务端API路由中获取当前登录用户信息
 */

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';

/**
 * 获取当前用户ID
 * @throws {Error} 如果用户未登录
 * @returns {Promise<string>} 当前用户ID
 */
export async function getCurrentUserId(): Promise<string> {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    throw new Error('Unauthorized: User not authenticated');
  }

  return session.user.id;
}

/**
 * 获取当前用户ID（可选）
 * @returns {Promise<string | null>} 当前用户ID，如果未登录则返回null
 */
export async function getCurrentUserIdOptional(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  return session?.user?.id || null;
}

/**
 * 获取当前用户完整session
 * @throws {Error} 如果用户未登录
 * @returns {Promise<Session>} 当前用户session
 */
export async function getCurrentSession() {
  const session = await getServerSession(authOptions);

  if (!session) {
    throw new Error('Unauthorized: User not authenticated');
  }

  return session;
}

/**
 * 获取当前用户完整session（可选）
 * @returns {Promise<Session | null>} 当前用户session，如果未登录则返回null
 */
export async function getCurrentSessionOptional() {
  const session = await getServerSession(authOptions);
  return session || null;
}
