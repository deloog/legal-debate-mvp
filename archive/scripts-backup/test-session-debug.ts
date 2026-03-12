/**
 * 调试session API的脚本
 */

import { prisma } from '../src/lib/db/prisma';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

async function main() {
  console.log('=== Session Debug Script ===\n');

  // 1. 清理测试数据
  console.log('1. 清理测试数据...');
  await prisma.user.deleteMany({
    where: {
      email: {
        contains: 'session-debug',
      },
    },
  });
  console.log('✓ 测试数据已清理\n');

  // 2. 注册新用户
  console.log('2. 注册新用户...');
  const registerResponse = await fetch(`${BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: `session-debug-${Date.now()}@example.com`,
      password: 'TestPass123',
      username: 'sessiondebug',
      name: 'Session Debug',
    }),
  });
  const registerData = await registerResponse.json();
  console.log('注册响应:', {
    status: registerResponse.status,
    success: registerData.success,
    hasToken: !!registerData.data?.token,
    hasRefreshToken: !!registerData.data?.refreshToken,
    hasExpiresIn: !!registerData.data?.expiresIn,
    userId: registerData.data?.user?.id,
    refreshTokenLength: registerData.data?.refreshToken?.length || 0,
  });

  const accessToken = registerData.data?.token || '';
  const refreshTokenValue = registerData.data?.refreshToken || '';
  const userId = registerData.data?.user?.id;

  console.log();

  // 3. 检查数据库中的session
  console.log('3. 检查数据库中的session...');
  const sessions = await prisma.session.findMany({
    where: { userId },
  });
  console.log('Session记录:', {
    count: sessions.length,
    sessions: sessions.map(s => ({
      id: s.id,
      tokenLength: s.sessionToken.length,
      expires: s.expires,
    })),
  });
  console.log();

  // 4. 测试refresh API
  console.log('4. 测试refresh API...');
  const refreshResponse = await fetch(`${BASE_URL}/api/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: refreshTokenValue }),
  });
  const refreshData = await refreshResponse.json();
  console.log('Refresh响应:', {
    status: refreshResponse.status,
    success: refreshData.success,
    message: refreshData.message,
    error: refreshData.error,
    hasNewToken: !!refreshData.data?.token,
    hasNewRefreshToken: !!refreshData.data?.refreshToken,
  });
  console.log();

  // 5. 测试logout API
  console.log('5. 测试logout API...');
  const logoutResponse = await fetch(`${BASE_URL}/api/auth/logout`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
      Cookie: `refreshToken=${refreshTokenValue}`,
    },
    body: JSON.stringify({ allDevices: false }),
  });
  const logoutData = await logoutResponse.json();
  console.log('Logout响应:', {
    status: logoutResponse.status,
    success: logoutData.success,
    message: logoutData.message,
  });
  console.log();

  // 6. 再次检查session
  console.log('6. 登出后检查session...');
  const sessionsAfterLogout = await prisma.session.findMany({
    where: { userId },
  });
  console.log('Session记录:', {
    count: sessionsAfterLogout.length,
  });
  console.log();

  console.log('=== Debug Complete ===');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
