/**
 * GET /api/v1/chat/conversations/[conversationId]/assess
 *
 * 基于当前对话的案情晶体，用 AI 生成三项核心评估指标：
 *   - winRate    胜诉率（0-1）
 *   - difficulty 案件难度（EASY / MEDIUM / HARD）
 *   - riskLevel  风险等级（LOW / MEDIUM / HIGH）
 *
 * 仅 LAWYER 角色可访问；晶体 version < 2 时返回 404（信息不足）。
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { getAuthUser } from '@/lib/middleware/auth';
import { AIServiceFactory } from '@/lib/ai/service-refactored';

const CHAT_MODEL = process.env.CHAT_AI_MODEL ?? 'deepseek-chat';
const CHAT_PROVIDER = (process.env.CHAT_AI_PROVIDER ?? 'deepseek') as
  | 'zhipu'
  | 'deepseek'
  | 'openai';

type Params = { params: Promise<{ conversationId: string }> };

interface CrystalSnapshot {
  version?: number;
  case_type?: string | null;
  core_dispute?: string | null;
  parties?: { plaintiff?: string | null; defendant?: string | null };
  established_facts?: { fact: string }[];
  applicable_law_areas?: string[];
  current_position?: string | null;
}

interface AssessmentResult {
  winRate: number;
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  keyLegalPoints: string[];
}

const ASSESS_PROMPT = `你是一位资深律师，请基于以下案情摘要，给出三项专业评估。
严格返回 JSON，不要任何解释：

{
  "winRate": <0到1的小数，如0.65>,
  "difficulty": <"EASY"|"MEDIUM"|"HARD">,
  "riskLevel": <"LOW"|"MEDIUM"|"HIGH">,
  "keyLegalPoints": [<最多3条关键法律要点，每条不超过20字>]
}

评估依据：
- winRate：基于事实完整度、法律支持强度、对方论据预判
- difficulty：证据获取难度、法律适用复杂度、程序周期
- riskLevel：败诉风险、执行风险、名誉影响`;

export async function GET(request: NextRequest, { params }: Params) {
  const authUser = await getAuthUser(request);
  if (!authUser) {
    return NextResponse.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: '请先登录' } },
      { status: 401 }
    );
  }

  // 仅律师可访问案件评估
  if (authUser.role !== 'LAWYER') {
    return NextResponse.json(
      {
        success: false,
        error: { code: 'FORBIDDEN', message: '仅律师可使用案件评估功能' },
      },
      { status: 403 }
    );
  }

  try {
    const { conversationId } = await params;

    const conv = await prisma.conversation.findFirst({
      where: { id: conversationId, userId: authUser.userId },
      select: { caseContext: true },
    });

    if (!conv) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: '对话不存在' } },
        { status: 404 }
      );
    }

    const crystal = conv.caseContext as CrystalSnapshot | null;
    if (!crystal || (crystal.version ?? 0) < 2) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'NOT_READY', message: '案情信息不足，请继续对话' },
        },
        { status: 422 }
      );
    }

    // 将晶体格式化为评估输入
    const crystalText = [
      crystal.case_type ? `案件类型：${crystal.case_type}` : '',
      crystal.core_dispute ? `核心争议：${crystal.core_dispute}` : '',
      crystal.parties?.plaintiff ? `原告：${crystal.parties.plaintiff}` : '',
      crystal.parties?.defendant ? `被告：${crystal.parties.defendant}` : '',
      crystal.current_position ? `当前立场：${crystal.current_position}` : '',
      crystal.established_facts?.length
        ? `已确认事实：${crystal.established_facts.map(f => f.fact).join('；')}`
        : '',
      crystal.applicable_law_areas?.length
        ? `涉及法律领域：${crystal.applicable_law_areas.join('、')}`
        : '',
    ]
      .filter(Boolean)
      .join('\n');

    const aiService = await AIServiceFactory.getInstance();
    const response = await aiService.chatCompletion({
      model: CHAT_MODEL,
      provider: CHAT_PROVIDER,
      messages: [
        {
          role: 'user',
          content: `${ASSESS_PROMPT}\n\n案情摘要：\n${crystalText}`,
        },
      ],
      temperature: 0.2,
      maxTokens: 300,
    });

    const raw = response.choices[0]?.message?.content ?? '';
    const jsonMatch =
      raw.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/) ??
      raw.match(/(\{[\s\S]*\})/);

    if (!jsonMatch) {
      throw new Error('AI 返回格式异常');
    }

    const parsed = JSON.parse(
      jsonMatch[1] ?? jsonMatch[0]
    ) as Partial<AssessmentResult>;

    const result: AssessmentResult = {
      winRate:
        typeof parsed.winRate === 'number'
          ? Math.max(0, Math.min(1, parsed.winRate))
          : 0.5,
      difficulty: (['EASY', 'MEDIUM', 'HARD'] as const).includes(
        parsed.difficulty as 'EASY' | 'MEDIUM' | 'HARD'
      )
        ? (parsed.difficulty as 'EASY' | 'MEDIUM' | 'HARD')
        : 'MEDIUM',
      riskLevel: (['LOW', 'MEDIUM', 'HIGH'] as const).includes(
        parsed.riskLevel as 'LOW' | 'MEDIUM' | 'HIGH'
      )
        ? (parsed.riskLevel as 'LOW' | 'MEDIUM' | 'HIGH')
        : 'MEDIUM',
      keyLegalPoints: Array.isArray(parsed.keyLegalPoints)
        ? parsed.keyLegalPoints.slice(0, 3)
        : [],
    };

    logger.info('案件评估完成', { conversationId, winRate: result.winRate });

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    logger.error('案件评估失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: '评估服务暂时不可用' },
      },
      { status: 500 }
    );
  }
}
