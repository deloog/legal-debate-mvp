/**
 * 实用层函数（Utility Layer - 组合函数）
 * 基于核心原子函数组合实现复杂功能
 * 每个函数复用核心原子函数，保持<200行
 */

import { PrismaClient } from "@prisma/client";
import { MemoryManager } from "../memory-agent/memory-manager";
import {
  analyze_text,
  extract_entities,
  classify_content,
  search_database,
  call_ai_service,
  validate_data,
  cache_result,
  log_action,
  verify_output,
  update_memory,
  rank_items,
  generate_summary,
  merge_results,
} from "./index";
import type {
  ParseDocumentParams,
  ParseDocumentResult,
  SearchLawsParams,
  SearchLawsResult,
  GenerateArgumentParams,
  GenerateArgumentResult,
  EntityExtractionResult,
  ClassificationResult,
} from "./types";

/**
 * parse_document - 文档解析（组合函数）
 * 使用核心原子函数：analyze_text, extract_entities, classify_content
 */
export async function parse_document(
  prisma: PrismaClient,
  memoryManager: MemoryManager,
  params: ParseDocumentParams,
): Promise<ParseDocumentResult> {
  const startTime = Date.now();

  // 1. 文本分析
  const analysis = await analyze_text(params.content);

  // 2. 实体提取
  let entities: EntityExtractionResult | undefined;
  if (params.options?.extractEntities) {
    entities = await extract_entities(params.content, [
      "PERSON",
      "DATE",
      "AMOUNT",
    ]);
  }

  // 3. 内容分类
  let classification: ClassificationResult | undefined;
  if (params.options?.classifyContent) {
    classification = await classify_content(params.content, "case_type");
  }

  const result: ParseDocumentResult = {
    analysis,
    entities,
    classification,
  };

  // 4. 记录行动
  await log_action(prisma, {
    actionType: "ANALYZE",
    actionName: "parse_document",
    agentName: "UtilityAction",
    input: params,
    output: result,
    status: "success",
    executionTime: Date.now() - startTime,
  });

  return result;
}

/**
 * search_laws - 法律检索（组合函数）
 * 使用核心原子函数：search_database, cache_result, rank_items
 */
export async function search_laws(
  prisma: PrismaClient,
  memoryManager: MemoryManager,
  params: SearchLawsParams,
  userId: string,
): Promise<SearchLawsResult> {
  const startTime = Date.now();
  const cacheKey = `law_search:${params.query}:${params.limit || 10}`;

  // 1. 尝试从缓存获取
  if (params.useCache !== false) {
    const cached = await memoryManager.getWorkingMemory(cacheKey);
    if (cached) {
      return cached as SearchLawsResult;
    }
  }

  // 2. 数据库检索
  const searchResult = await search_database(prisma, {
    table: "lawArticle",
    query: params.query,
    filters: params.category ? { category: params.category } : undefined,
    limit: params.limit || 10,
  });

  // 3. 结果排序（基于相关性）
  const { ranked } = await rank_items(
    searchResult.items as Array<{ id: string; relevanceScore?: number }>,
    (item) => item.relevanceScore || 0,
    "desc",
  );

  const result: SearchLawsResult = {
    articles: ranked as Array<{
      id: string;
      title: string;
      content: string;
      category: string;
      relevanceScore: number;
    }>,
    totalResults: searchResult.totalCount,
    cached: false,
  };

  // 4. 缓存结果
  if (params.useCache !== false) {
    await cache_result(memoryManager, cacheKey, result, 3600, userId);
  }

  // 5. 记录行动
  await log_action(prisma, {
    actionType: "RETRIEVE",
    actionName: "search_laws",
    agentName: "UtilityAction",
    input: params,
    output: result,
    status: "success",
    executionTime: Date.now() - startTime,
  });

  return result;
}

/**
 * generate_argument - 论点生成（组合函数）
 * 使用核心原子函数：call_ai_service, validate_data, log_action, verify_output
 */
export async function generate_argument(
  prisma: PrismaClient,
  aiService: { call: (args: unknown) => Promise<unknown> },
  params: GenerateArgumentParams,
): Promise<GenerateArgumentResult> {
  const startTime = Date.now();

  // 1. 构建提示词
  const prompt = `基于以下案件信息，生成${params.side === "plaintiff" ? "原告" : "被告"}的论点：

案件信息：${JSON.stringify(params.caseInfo)}
${params.legalBasis ? `法律依据：${JSON.stringify(params.legalBasis)}` : ""}

请生成包含主要论点、支持论据、法律引用的完整论点。`;

  // 2. AI服务调用
  const aiResult = await call_ai_service(
    {
      prompt,
      provider: "deepseek",
      model: "deepseek-chat",
      temperature: 0.7,
      maxTokens: 2000,
    },
    aiService,
  );

  if (!aiResult.success) {
    throw new Error(`AI服务调用失败: ${aiResult.error}`);
  }

  // 3. 解析AI响应
  const parsed = JSON.parse(aiResult.response);

  // 4. 数据验证
  const validationRules = [
    {
      field: "argument",
      type: "string",
      required: true,
      minLength: 10,
    },
    {
      field: "supportingPoints",
      type: "object",
      required: true,
    },
    {
      field: "legalReferences",
      type: "object",
      required: true,
    },
  ];

  const validationResult = await validate_data(parsed, validationRules);
  if (!validationResult.valid) {
    throw new Error(`数据验证失败: ${JSON.stringify(validationResult.errors)}`);
  }

  // 5. 输出验证
  const verifyResult = await verify_output(parsed, {
    minArgumentLength: 50,
    minSupportingPoints: 1,
  });

  const result: GenerateArgumentResult = {
    argument: parsed.argument,
    supportingPoints: parsed.supportingPoints,
    legalReferences: parsed.legalReferences,
    confidence: verifyResult.score,
  };

  // 6. 记录行动
  await log_action(prisma, {
    actionType: "GENERATE",
    actionName: "generate_argument",
    agentName: "UtilityAction",
    input: params,
    output: result,
    status: verifyResult.passed ? "success" : "partial",
    executionTime: Date.now() - startTime,
  });

  return result;
}

/**
 * analyze_case - 案件分析（组合函数）
 * 使用核心原子函数：analyze_text, extract_entities, classify_content, update_memory
 */
export async function analyze_case(
  prisma: PrismaClient,
  memoryManager: MemoryManager,
  caseInfo: {
    title: string;
    description: string;
    type: string;
  },
  userId: string,
  caseId: string,
) {
  const startTime = Date.now();

  // 1. 分析标题
  const titleAnalysis = await analyze_text(caseInfo.title);

  // 2. 分析描述
  const descAnalysis = await analyze_text(caseInfo.description);

  // 3. 提取实体
  const entities = await extract_entities(
    `${caseInfo.title}\n${caseInfo.description}`,
    ["PERSON", "DATE", "AMOUNT"],
  );

  // 4. 验证案件类型
  const classification = await classify_content(
    `${caseInfo.title}\n${caseInfo.description}`,
    "case_type",
  );

  const result = {
    titleAnalysis,
    descAnalysis,
    entities,
    classification,
    caseType: classification.category,
    confidence: classification.confidence,
  };

  // 5. 记录行动
  await log_action(prisma, {
    actionType: "ANALYZE",
    actionName: "analyze_case",
    agentName: "UtilityAction",
    input: caseInfo,
    output: result,
    status: "success",
    executionTime: Date.now() - startTime,
  });

  // 6. 更新记忆
  await update_memory(
    memoryManager,
    {
      memoryType: "HOT",
      memoryKey: `case_analysis:${caseId}`,
      memoryValue: result,
      importance: 0.9,
    },
    userId,
  );

  return result;
}

/**
 * extract_timeline - 时间线提取（组合函数）
 * 使用核心原子函数：extract_entities
 */
export async function extract_timeline(
  content: string,
): Promise<Array<{ date: string; event: string }>> {
  // 提取日期实体
  const entityResult = await extract_entities(content, ["DATE"]);

  // 构建时间线
  const timeline: Array<{ date: string; event: string }> = [];

  for (const entity of entityResult.entities) {
    const date = entity.text;
    const contextStart = Math.max(0, entity.startIndex - 50);
    const contextEnd = Math.min(content.length, entity.endIndex + 50);
    const event = content.slice(contextStart, contextEnd).trim();

    timeline.push({ date, event });
  }

  return timeline;
}

/**
 * compress_content - 内容压缩（组合函数）
 * 使用核心原子函数：generate_summary
 */
export async function compress_content(
  content: string,
  maxLength: number,
): Promise<{
  compressed: string;
  originalLength: number;
  compressedLength: number;
  ratio: number;
}> {
  // 生成摘要
  const summaryResult = await generate_summary(content, maxLength, true);

  return {
    compressed: summaryResult.summary,
    originalLength: summaryResult.originalLength,
    compressedLength: summaryResult.summaryLength,
    ratio: summaryResult.compressionRatio,
  };
}

/**
 * validate_case_data - 案件数据验证（组合函数）
 * 使用核心原子函数：validate_data, log_action
 */
export async function validate_case_data(
  prisma: PrismaClient,
  caseData: Record<string, unknown>,
): Promise<{
  valid: boolean;
  errors: string[];
  warnings: string[];
}> {
  const rules = [
    {
      field: "title",
      type: "string",
      required: true,
      minLength: 5,
      maxLength: 200,
    },
    {
      field: "description",
      type: "string",
      required: true,
      minLength: 20,
    },
    {
      field: "type",
      type: "string",
      required: true,
    },
    {
      field: "amount",
      type: "number",
      required: false,
      customValidator: (value: unknown) =>
        typeof value === "number" && value > 0,
    },
  ];

  const result = await validate_data(caseData, rules);

  await log_action(prisma, {
    actionType: "VERIFY",
    actionName: "validate_case_data",
    agentName: "UtilityAction",
    input: caseData,
    output: result,
    status: result.valid ? "success" : "failure",
  });

  return {
    valid: result.valid,
    errors: result.errors.map((e) => e.message),
    warnings: result.warnings,
  };
}

/**
 * search_and_rank - 检索并排序（组合函数）
 * 使用核心原子函数：search_database, rank_items, cache_result
 */
export async function search_and_rank<T>(
  prisma: PrismaClient,
  memoryManager: MemoryManager,
  params: {
    table: string;
    query: string;
    scoreFn: (item: T) => number;
    limit?: number;
    useCache?: boolean;
  },
  userId: string,
): Promise<{
  results: T[];
  scores: number[];
  cached: boolean;
}> {
  const cacheKey = `search:${params.table}:${params.query}`;

  // 尝试从缓存获取
  if (params.useCache !== false) {
    const cached = await memoryManager.getWorkingMemory(cacheKey);
    if (cached) {
      return cached as typeof results;
    }
  }

  // 数据库检索
  const searchResult = await search_database<T>(prisma, {
    table: params.table,
    query: params.query,
    limit: params.limit,
  });

  // 排序
  const { ranked, scores } = await rank_items(
    searchResult.items,
    params.scoreFn,
    "desc",
  );

  const results = { results: ranked, scores, cached: false };

  // 缓存
  if (params.useCache !== false) {
    await cache_result(memoryManager, cacheKey, results, 300, userId);
  }

  return results;
}

/**
 * merge_and_deduplicate - 合并并去重（组合函数）
 * 使用核心原子函数：merge_results, log_action
 */
export async function merge_and_deduplicate<T>(
  prisma: PrismaClient,
  resultSets: T[][],
  keySelector: (item: T) => string,
): Promise<{
  merged: T[];
  originalCount: number;
  duplicatesRemoved: number;
}> {
  const mergeResult = await merge_results(resultSets, true, keySelector);

  await log_action(prisma, {
    actionType: "TRANSFORM",
    actionName: "merge_and_deduplicate",
    agentName: "UtilityAction",
    input: { setCount: resultSets.length },
    output: mergeResult,
    status: "success",
  });

  return {
    merged: mergeResult.merged,
    originalCount: mergeResult.totalItems + mergeResult.duplicatesRemoved,
    duplicatesRemoved: mergeResult.duplicatesRemoved,
  };
}
