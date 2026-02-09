/**
 * JWT 工具函数
 */

import type { JwtPayload, JwtVerifyResult } from '@/types/auth';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;

const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

// 生产环境必须检查JWT_SECRET是否设置
if (!JWT_SECRET && process.env.NODE_ENV === 'production') {
  throw new Error(
    '[JWT配置错误] JWT_SECRET环境变量未设置！\n' +
      '请在.env.production中设置JWT_SECRET。\n' +
      "生成强密钥命令：node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
  );
}

// 有效的JWT密钥（生产环境使用环境变量，测试环境使用固定密钥）
const EFFECTIVE_JWT_SECRET =
  JWT_SECRET || 'test-secret-key-do-not-use-in-production';

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
    console.log('[verifyToken] 开始验证token:', {
      tokenPreview: token.substring(0, 30) + '...',
      secretPreview: JWT_SECRET.substring(0, 10) + '...',
      secretLength: JWT_SECRET.length,
    });

    const decoded = jwt.verify(token, EFFECTIVE_JWT_SECRET) as JwtPayload;

    console.log('[verifyToken] Token验证成功:', {
      userId: decoded.userId,
      email: decoded.email,
      role: decoded.role,
    });

    return {
      valid: true,
      payload: decoded,
      error: null,
    };
  } catch (error) {
    console.error('[verifyToken] Token验证失败:', {
      errorType: error instanceof Error ? error.constructor.name : 'Unknown',
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
      tokenPreview: token.substring(0, 30) + '...',
    });

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
  // 添加jti确保每次生成的token都不同（避免并发冲突）
  const refreshTokenPayload: JwtPayload = {
    ...payload,
    jti: `${Date.now()}_${Math.random().toString(36).substring(2, 15)}`, // JWT ID，确保唯一性
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
    expiresIn: (expiresIn || '15m') as jwt.SignOptions['expiresIn'],
  };

  return jwt.sign(payload, EFFECTIVE_JWT_SECRET, options);
}
