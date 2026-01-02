import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface FeedbackRequest {
  action: "CONFIRMED" | "REMOVED" | "MANUALLY_ADDED";
  removedReason?: "NOT_RELEVANT" | "REPEALED" | "OTHER";
  otherReason?: string;
}

/**
 * 更新法条律师反馈
 * 功能：记录律师对AI推荐法条的确认、移除或手动添加操作
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    // 获取当前用户（简化版，实际应从session获取）
    const userId = request.headers.get("x-user-id") || "default-user";

    // 解析请求体
    const body: FeedbackRequest = await request.json();

    // 验证必填字段
    if (!body.action) {
      return NextResponse.json({ error: "缺少action参数" }, { status: 400 });
    }

    if (!["CONFIRMED", "REMOVED", "MANUALLY_ADDED"].includes(body.action)) {
      return NextResponse.json({ error: "无效的action参数" }, { status: 400 });
    }

    // 验证移除原因
    if (body.action === "REMOVED" && !body.removedReason) {
      return NextResponse.json(
        { error: "移除操作需要提供removedReason参数" },
        { status: 400 },
      );
    }

    // 验证otherReason
    if (body.removedReason === "OTHER" && !body.otherReason?.trim()) {
      return NextResponse.json(
        { error: '选择"其他"原因时需要提供otherReason参数' },
        { status: 400 },
      );
    }

    // 查询法条是否存在
    const legalReference = await prisma.legalReference.findUnique({
      where: { id: params.id },
    });

    if (!legalReference) {
      return NextResponse.json({ error: "法条不存在" }, { status: 404 });
    }

    // 获取现有metadata
    const existingMetadata =
      (legalReference.metadata as Record<string, unknown>) || {};

    // 更新律师反馈
    const updatedLegalReference = await prisma.legalReference.update({
      where: { id: params.id },
      data: {
        metadata: {
          ...existingMetadata,
          lawyerFeedback: {
            action: body.action,
            removedReason: body.removedReason,
            otherReason: body.otherReason,
            timestamp: new Date().toISOString(),
            lawyerId: userId,
          },
        },
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      data: updatedLegalReference,
    });
  } catch (error) {
    console.error("更新法条反馈失败：", error);

    return NextResponse.json(
      {
        error: "服务器错误",
        details: error instanceof Error ? error.message : "未知错误",
      },
      { status: 500 },
    );
  } finally {
    await prisma.$disconnect();
  }
}
