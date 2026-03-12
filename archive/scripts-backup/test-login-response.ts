/**
 * 测试登录API响应
 */

import { prisma } from '../src/lib/db/prisma';
import { hashPassword } from '../src/lib/auth/password';

async function testLoginResponse() {
  console.log('[TEST] 开始测试登录API响应...');

  try {
    // 1. 创建测试用户
    console.log('\n[TEST] 步骤1: 创建测试用户');
    const timestamp = Date.now();
    const shortId = String(timestamp).slice(-6);
    const email = `test-${timestamp}@login.com`;
    const password = 'TestPass123';

    const user = await prisma.user.create({
      data: {
        email,
        username: `test${shortId}`,
        name: `TestUser${shortId}`,
        password: await hashPassword(password),
        role: 'USER',
        status: 'ACTIVE',
      },
    });

    console.log(`[TEST] 用户创建成功: id=${user.id}, email=${email}`);

    // 2. 测试登录API
    console.log('\n[TEST] 步骤2: 调用登录API');
    const baseUrl = 'http://localhost:3000';
    const response = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        password,
      }),
    });

    console.log(`[TEST] 登录API响应状态: ${response.status}`);
    const data = await response.json();
    console.log(`[TEST] 登录API响应数据:`, JSON.stringify(data, null, 2));

    // 3. 检查响应结构
    if (data.success && data.data) {
      console.log(`[TEST] 响应中包含token: ${!!data.data.token}`);
      console.log(`[TEST] 响应中包含refreshToken: ${!!data.data.refreshToken}`);
      console.log(`[TEST] token长度: ${data.data.token?.length || 0}`);
      console.log(
        `[TEST] refreshToken长度: ${data.data.refreshToken?.length || 0}`
      );

      if (!data.data.refreshToken) {
        console.error('[TEST] 错误：登录API没有返回refreshToken！');
      }
    } else {
      console.error('[TEST] 错误：登录失败', data);
    }

    // 4. 清理测试数据
    console.log('\n[TEST] 清理测试数据');
    await prisma.session.deleteMany({ where: { userId: user.id } });
    await prisma.user.delete({ where: { id: user.id } });
    console.log('[TEST] 清理完成');
  } catch (error) {
    console.error('[TEST] 测试失败:', error);
    if (error instanceof Error) {
      console.error('[TEST] 错误消息:', error.message);
      console.error('[TEST] 错误堆栈:', error.stack);
    }
  } finally {
    await prisma.$disconnect();
  }
}

// 运行测试
testLoginResponse();
