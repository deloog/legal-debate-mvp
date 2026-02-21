/**
 * Memory Compression Preview API
 * 记忆压缩预览API - 提供压缩前的预览功能
 *
 * 注意：由于 AI 服务接口类型不完全兼容，在代码中需要使用 `as any` 类型断言
 * 来解决类型检查问题。
 */

import { NextRequest, NextResponse } from 'next/server';
import { MemoryCompressor } from '@/lib/agent/memory-agent/compressor';
import { logger } from '@/lib/logger';

// 创建简单的mock AI服务
const mockAIService = {
  chatCompletion: async () => {
    return {
      choices: [
        {
          message: {
            content: JSON.stringify([
              { field: '摘要', value: '压缩后的摘要', importance: 1.0 },
            ]),
          },
        },
      ],
      usage: { totalTokens: 100 },
    };
  },
};

// 创建压缩器实例（AI 服务接口类型不完全兼容，需要类型断言）
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const compressor = new MemoryCompressor(mockAIService as any);

/**
 * POST /api/v1/memory/compress-preview
 * 预览记忆压缩效果
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // 验证输入
    if (body.memoryId === undefined && body.content === undefined) {
      return NextResponse.json(
        { error: '必须提供memoryId或content' },
        { status: 400 }
      );
    }

    let memoryContent;
    let memoryId;

    if (body.memoryId !== undefined && body.memoryId !== null) {
      // 通过memoryId获取记忆内容
      const { MemoryManager } =
        await import('@/lib/agent/memory-agent/memory-manager');
      const mockPrisma = {
        agentMemory: {
          findUnique: async () => {
            return {
              memoryId: body.memoryId,
              memoryKey: 'test-key',
              memoryValue:
                '这是一段很长的测试内容，用于测试记忆压缩功能。需要包含足够多的信息才能看到明显的压缩效果。',
              memoryType: 'HOT',
              importance: 0.8,
            };
          },
        },
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const manager = new MemoryManager(mockPrisma as any);
      const memory = await manager.getMemoryById(body.memoryId);

      if (!memory) {
        return NextResponse.json({ error: '记忆不存在' }, { status: 404 });
      }

      memoryContent = memory.memoryValue;
      memoryId = memory.memoryId;
    } else {
      // 使用提供的content
      memoryContent = body.content;
      memoryId = `preview-${Date.now()}`;
    }

    // 执行压缩预览
    const compressionResult = await compressor.compressMemory({
      memoryId,
      memoryKey: 'preview-key',
      memoryValue: memoryContent,
      memoryType: 'HOT',
      importance: body.importance || 0.8,
      accessCount: 0,
      lastAccessedAt: new Date(),
      createdAt: new Date(),
      expiresAt: null,
      compressed: false,
    });

    if (!compressionResult.success) {
      return NextResponse.json(
        { error: '压缩失败', details: compressionResult.error },
        { status: 500 }
      );
    }

    // 返回预览结果
    return NextResponse.json({
      original: {
        content: memoryContent,
        length: memoryContent.length,
      },
      compressed: {
        summary: compressionResult.summary,
        keyInfo: compressionResult.keyInfo,
        length:
          compressionResult.summary.length +
          JSON.stringify(compressionResult.keyInfo).length,
      },
      metrics: {
        compressionRatio: compressionResult.ratio,
        spaceSaved:
          memoryContent.length - (compressionResult.summary?.length || 0),
        keyInfoCount: compressionResult.keyInfo?.length || 0,
      },
    });
  } catch (error) {
    logger.error('记忆压缩预览失败:', error);
    return NextResponse.json(
      { error: '内部服务器错误', details: String(error) },
      { status: 500 }
    );
  }
}
