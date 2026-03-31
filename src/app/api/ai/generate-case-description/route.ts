/**
 * AI 生成案情描述 API
 *
 * POST /api/ai/generate-case-description
 *
 * 根据案件基本信息（当事人、案由、类型、金额）生成案情描述文本。
 */

import { NextRequest, NextResponse } from 'next/server';
import { AIServiceFactory } from '@/lib/ai/service-refactored';
import { getAuthUser } from '@/lib/middleware/auth';
import { logger } from '@/lib/logger';

const CASE_TYPE_LABELS: Record<string, string> = {
  CIVIL: '民事',
  CRIMINAL: '刑事',
  ADMINISTRATIVE: '行政',
  COMMERCIAL: '商事',
  LABOR: '劳动',
  INTELLECTUAL_PROPERTY: '知识产权',
};

export async function POST(request: NextRequest) {
  const authUser = await getAuthUser(request);
  if (!authUser) {
    return NextResponse.json(
      { success: false, error: '未授权' },
      { status: 401 }
    );
  }

  try {
    const body = (await request.json()) as {
      plaintiffName?: string;
      defendantName?: string;
      cause?: string;
      caseType?: string;
      amount?: string;
    };

    const { plaintiffName, defendantName, cause, caseType, amount } = body;

    const typeLabel = CASE_TYPE_LABELS[caseType ?? ''] ?? '民事';
    const plaintiff = plaintiffName || '原告';
    const defendant = defendantName || '被告';
    const causeText = cause || '相关';
    const amountText = amount ? `，涉案金额人民币${amount}元` : '';

    const prompt = `请为以下${typeLabel}案件生成一段专业的案情描述（200字以内）：
原告：${plaintiff}
被告：${defendant}
案由：${causeText}${amountText}

要求：
1. 语言简洁、专业，符合法律文书风格
2. 包含基本案情经过
3. 说明原告的诉讼请求
4. 直接输出描述文字，不要加任何前缀或说明`;

    const aiService = await AIServiceFactory.getInstance();
    const response = await aiService.chatCompletion({
      model: 'glm-4-flash',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      maxTokens: 500,
    });

    const description = response.choices[0]?.message?.content?.trim() ?? '';

    if (!description) {
      return NextResponse.json(
        { success: false, error: 'AI 生成内容为空' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data: { description } });
  } catch (error) {
    logger.error('[generate-case-description] 生成失败:', error);
    return NextResponse.json(
      { success: false, error: '生成失败，请稍后重试' },
      { status: 500 }
    );
  }
}
