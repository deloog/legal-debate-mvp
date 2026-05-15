/**
 * JWT 工具函数
 */

import type { JwtPayload, JwtVerifyResult } from '@/types/auth';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { logError } from '../utils/safe-logger';
import { logger } from '@/lib/logger';

const JWT_SECRET = process.env.JWT_SECRET;

const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

// JWT_SECRET 安全检查（白名单原则：只有明确安全的环境才允许省略密钥）
// 允许省略的场景：本地开发（development）、自动化测试（test）、Next.js 构建阶段
// 其余所有环境（staging、preview、production 等）一律拒绝启动，无需额外标志位
if (!JWT_SECRET) {
  const isBuildPhase =
    process.env.NEXT_PHASE === 'phase-production-build' ||
    process.env.SKIP_ENV_VALIDATION === 'true';
  const isLocalDev = process.env.NODE_ENV === 'development';
  const isTest = process.env.NODE_ENV === 'test';
  const isFallbackAllowed = isBuildPhase || isLocalDev || isTest;

  if (!isFallbackAllowed) {
    throw new Error(
      '[JWT配置错误] JWT_SECRET环境变量未设置！\n' +
        '请在环境变量中设置 JWT_SECRET（至少32位随机字符串）。\n' +
        "生成命令：node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
    );
  }

  if (isLocalDev) {
    logger.warn(
      '[JWT警告] JWT_SECRET 未设置，使用临时开发密钥。\n' +
        '⚠️  此密钥仅限本地开发，任何部署环境必须设置 JWT_SECRET。'
    );
  }
}

// 有效的JWT密钥（仅 development/test/build 阶段会走到 fallback）
const EFFECTIVE_JWT_SECRET =
  JWT_SECRET ?? 'dev-only-jwt-secret-not-for-production';

/**
 * 生成 JWT Token
 */
export function generateToken(payload: JwtPayload, expiresIn?: string): string {
  const options: jwt.SignOptions = {
    expiresIn: (expiresIn || JWT_EXPIRES_IN) as jwt.SignOptions['expiresIn'],
  };

  return jwt.sign(payload, EFFECTIVE_JWT_SECRET, options);
}

/**
 * 验证 JWT Token
 */
export function verifyToken(token: string): JwtVerifyResult {
  try {
    // 仅在开发环境记录（不包含敏感信息）
    if (process.env.NODE_ENV === 'development') {
      logger.debug('[verifyToken] 开始验证token');
    }

    const decoded = jwt.verify(token, EFFECTIVE_JWT_SECRET, {
      algorithms: ['HS256'],
    }) as JwtPayload;

    if (process.env.NODE_ENV === 'development') {
      logger.debug('[verifyToken] Token验证成功:', {
        userId: decoded.userId,
        email: decoded.email,
        role: decoded.role,
      });
    }

    return {
      valid: true,
      payload: decoded,
      error: null,
    };
  } catch (error) {
    // 使用安全日志记录错误
    logError('[verifyToken] Token验证失败', error);

    if (error instanceof jwt.TokenExpiredError) {
      return {
        valid: false,
        payload: null,
        error: 'TOKEN_EXPIRED',
      };
    }
    if (error instanceof jwt.JsonWebTokenError) {
      return {
        valid: false,
        payload: null,
        error: 'INVALID_TOKEN',
      };
    }
    return {
      valid: false,
      payload: null,
      error: 'UNKNOWN_ERROR',
    };
  }
}

/**
 * 解码 JWT Token（不验证签名）
 */
export function decodeToken(token: string): JwtPayload | null {
  try {
    const decoded = jwt.decode(token) as JwtPayload;
    return decoded;
  } catch {
    return null;
  }
}

/**
 * 从 Authorization Header 中提取 Token
 */
export function extractTokenFromHeader(
  authHeader: string | null
): string | null {
  if (!authHeader) {
    return null;
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null;
  }

  return parts[1];
}

/**
 * 生成刷新令牌
 */
export function generateRefreshToken(
  payload: JwtPayload,
  expiresIn?: string
): string {
  // 若调用方已传入 jti（例如 session.id），则保留用于会话绑定；
  // 否则退回到随机 UUID，确保刷新令牌唯一。
  const refreshTokenPayload: JwtPayload = {
    ...payload,
    jti: payload.jti ?? randomUUID(),
  };

  const options: jwt.SignOptions = {
    expiresIn: (expiresIn || '7d') as jwt.SignOptions['expiresIn'],
  };

  return jwt.sign(refreshTokenPayload, EFFECTIVE_JWT_SECRET, options);
}

/**
 * 检查令牌是否即将过期（剩余时间少于5分钟）
 */
export function isTokenExpiringSoon(token: string): boolean {
  const decoded = decodeToken(token);
  if (!decoded || !decoded.exp) {
    return false;
  }

  const now = Math.floor(Date.now() / 1000);
  const timeLeft = decoded.exp - now;

  // 5分钟 = 300秒
  return timeLeft < 300;
}

/**
 * 生成访问令牌（短期）
 */
export function generateAccessToken(
  payload: JwtPayload,
  expiresIn?: string
): string {
  const options: jwt.SignOptions = {
    expiresIn: (expiresIn || '7d') as jwt.SignOptions['expiresIn'],
  };

  return jwt.sign(payload, EFFECTIVE_JWT_SECRET, options);
}
