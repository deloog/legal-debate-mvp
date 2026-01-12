/**
 * 调试律师资格验证API认证问题
 */

import { prisma } from "../src/lib/db/prisma";
import { hashPassword } from "../src/lib/auth/password";

async function testQualificationAPI() {
  console.log("[TEST] 开始测试律师资格验证API...");

  try {
    // 1. 创建测试用户
    console.log("\n[TEST] 步骤1: 创建测试用户");
    const timestamp = Date.now();
    const shortId = String(timestamp).slice(-6);
    const email = `test-${timestamp}@debug.com`;
    const password = "TestPass123";

    const user = await prisma.user.create({
      data: {
        email,
        username: `test${shortId}`,
        name: `TestUser${shortId}`,
        password: await hashPassword(password),
        role: "USER",
        status: "ACTIVE",
      },
    });

    console.log(`[TEST] 用户创建成功: id=${user.id}, email=${email}`);

    // 2. 登录获取token
    console.log("\n[TEST] 步骤2: 模拟登录");
    const { generateAccessToken, generateRefreshToken } =
      await import("../src/lib/auth/jwt");

    const accessToken = generateAccessToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    const refreshToken = generateRefreshToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    console.log("[TEST] Token生成成功:");
    console.log(`  - accessToken长度: ${accessToken.length}`);
    console.log(`  - refreshToken长度: ${refreshToken.length}`);

    // 3. 创建session
    console.log("\n[TEST] 步骤3: 创建session");
    await prisma.session.create({
      data: {
        userId: user.id,
        sessionToken: refreshToken,
        expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });
    console.log("[TEST] Session创建成功");

    // 4. 测试API调用（使用fetch）
    console.log("\n[TEST] 步骤4: 调用律师资格上传API");
    const baseUrl = "http://localhost:3000";
    const response = await fetch(`${baseUrl}/api/qualifications/upload`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        licenseNumber: "11021999000000000",
        fullName: "张三",
        idCardNumber: "110101199001011231",
        lawFirm: "某某律师事务所",
      }),
    });

    console.log(`[TEST] API响应状态: ${response.status}`);
    const data = await response.json();
    console.log(`[TEST] API响应数据:`, JSON.stringify(data, null, 2));

    // 5. 清理测试数据
    console.log("\n[TEST] 清理测试数据");
    await prisma.session.deleteMany({ where: { userId: user.id } });
    await prisma.user.delete({ where: { id: user.id } });
    console.log("[TEST] 清理完成");
  } catch (error) {
    console.error("[TEST] 测试失败:", error);
    if (error instanceof Error) {
      console.error("[TEST] 错误消息:", error.message);
      console.error("[TEST] 错误堆栈:", error.stack);
    }
  } finally {
    await prisma.$disconnect();
  }
}

// 运行测试
testQualificationAPI();
