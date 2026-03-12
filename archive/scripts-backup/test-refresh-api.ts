/**
 * Refresh API 直接测试脚本
 */

import { prisma } from '../src/lib/db/prisma';

const BASE_URL = 'http://localhost:3000';

async function testRefresh() {
  const timestamp = Date.now();
  const email = `direct-test-${timestamp}@example.com`;
  const password = 'TestPass123';

  console.log('=== 开始测试Refresh API ===');

  // 1. 注册
  console.log('\n1. 注册用户...');
  const registerResponse = await fetch(`${BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      password,
      username: `test${timestamp}`,
      name: `Test${timestamp}`,
    }),
  });
  const registerData = await registerResponse.json();
  console.log('注册响应:', {
    status: registerResponse.status,
    success: registerData.success,
  });

  if (!registerData.success) {
    console.error('注册失败:', registerData);
    return;
  }

  const registerRefreshToken = registerData.data?.refreshToken;
  console.log(
    'RefreshToken (register):',
    registerRefreshToken?.substring(0, 50) + '...'
  );

  // 2. 登录
  console.log('\n2. 登录用户...');
  const loginResponse = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const loginData = await loginResponse.json();
  console.log('登录响应:', {
    status: loginResponse.status,
    success: loginData.success,
  });

  if (!loginData.success) {
    console.error('登录失败:', loginData);
    return;
  }

  const loginRefreshToken = loginData.data?.refreshToken;
  console.log(
    'RefreshToken (login):',
    loginRefreshToken?.substring(0, 50) + '...'
  );
  console.log('RefreshToken相同?', registerRefreshToken === loginRefreshToken);

  // 3. 检查数据库中的session
  console.log('\n3. 检查数据库session...');
  const user = await prisma.user.findUnique({
    where: { email },
    include: { sessions: true },
  });

  console.log('用户ID:', user?.id);
  console.log('Session数量:', user?.sessions.length);

  if (user?.sessions) {
    user.sessions.forEach((s, i) => {
      console.log(`Session ${i + 1}:`, {
        id: s.id,
        tokenLength: s.sessionToken.length,
        tokenStart: s.sessionToken.substring(0, 50) + '...',
        expires: s.expires,
        expired: s.expires < new Date(),
      });
    });

    // 检查loginRefreshToken是否匹配任何session
    const matchingSession = user.sessions.find(
      s => s.sessionToken === loginRefreshToken
    );
    console.log('LoginRefreshToken匹配session?', !!matchingSession);
    if (matchingSession) {
      console.log('匹配session详情:', {
        id: matchingSession.id,
        expires: matchingSession.expires,
        expired: matchingSession.expires < new Date(),
      });
    }
  }

  // 4. 尝试refresh
  console.log('\n4. 尝试refresh...');
  try {
    const refreshResponse = await fetch(`${BASE_URL}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: loginRefreshToken }),
    });
    const refreshData = await refreshResponse.json();
    console.log('Refresh响应:', {
      status: refreshResponse.status,
      ok: refreshResponse.ok,
      success: refreshData.success,
      message: refreshData.message,
      error: refreshData.error,
    });

    if (!refreshData.success) {
      console.error('Refresh失败:', refreshData);
    }
  } catch (error) {
    console.error('Refresh请求异常:', error);
  }

  // 5. 再次检查数据库中的session
  console.log('\n5. 检查数据库session (refresh后)...');
  const userAfter = await prisma.user.findUnique({
    where: { email },
    include: { sessions: true },
  });
  console.log('Session数量:', userAfter?.sessions.length);

  console.log('\n=== 测试完成 ===');
}

testRefresh().catch(console.error);
