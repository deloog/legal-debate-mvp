/**
 * 启发式论点质量评分
 *
 * logicScore  — 逻辑清晰度，由推理文本长度和置信度决定
 * legalScore  — 法律准确性，由法条引用数量和相关度决定
 * overallScore — 综合评分（logicScore×0.4 + legalScore×0.6）
 */
export function computeArgumentScores(params: {
  reasoning: string | null | undefined;
  legalBasis: unknown;
  confidence: number;
}): { logicScore: number; legalScore: number; overallScore: number } {
  const reasoningLen = params.reasoning?.trim().length ?? 0;

  // 无推理文本时基于置信度给出保底分
  const logicScore =
    reasoningLen === 0
      ? Math.max(0.3, params.confidence * 0.5)
      : Math.min(
          0.95,
          0.55 + Math.min(reasoningLen / 800, 0.3) + params.confidence * 0.1
        );

  const bases = Array.isArray(params.legalBasis)
    ? (params.legalBasis as Array<{ relevance?: number }>)
    : [];
  const avgRelevance =
    bases.length > 0
      ? bases.reduce(
          (s, b) => s + (typeof b?.relevance === 'number' ? b.relevance : 0.75),
          0
        ) / bases.length
      : 0;
  const legalScore =
    bases.length === 0
      ? 0.2
      : Math.min(0.95, avgRelevance * 0.75 + Math.min(bases.length / 4, 0.2));

  const overallScore = +(logicScore * 0.4 + legalScore * 0.6).toFixed(3);
  return {
    logicScore: +logicScore.toFixed(3),
    legalScore: +legalScore.toFixed(3),
    overallScore,
  };
}
