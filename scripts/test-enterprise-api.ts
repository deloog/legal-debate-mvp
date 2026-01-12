/**
 * 测试企业注册API
 */

import { prisma } from "../src/lib/db/prisma";
import { hashPassword } from "../src/lib/auth/password";

async function testEnterpriseAPI() {
  console.log("[TEST] 开始测试企业注册API...");

  try {
    // 1. 创建测试用户
    console.log("\n[TEST] 步骤1: 创建测试用户");
    const timestamp = Date.now();
    const shortId = String(timestamp).slice(-6);
    const email = `test-${timestamp}@enterprise.com`;
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
    const { generateAccessToken } = await import("../src/lib/auth/jwt");

    const accessToken = generateAccessToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    console.log("[TEST] Token生成成功");

    // 3. 测试企业注册API
    console.log("\n[TEST] 步骤3: 调用企业注册API");
    const baseUrl = "http://localhost:3000";
    const response = await fetch(`${baseUrl}/api/enterprise/register`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        enterpriseName: "测试企业有限公司",
        creditCode: "91110000123456789X",
        legalPerson: "张三",
        industryType: "制造业",
      }),
    });

    console.log(`[TEST] 企业注册API响应状态: ${response.status}`);
    const data = await response.json();
    console.log(`[TEST] 企业注册API响应数据:`, JSON.stringify(data, null, 2));

    // 4. 清理测试数据
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
testEnterpriseAPI();
