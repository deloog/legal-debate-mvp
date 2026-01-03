/**
 * 脚本层函数（Script Layer - 复杂操作）
 * 基于核心原子函数和实用层函数实现复杂业务逻辑
 * 每个函数处理复杂场景，保持<200行
 */

import { PrismaClient } from "@prisma/client";
import { MemoryManager } from "../memory-agent/memory-manager";
import {
  log_action,
  handle_error,
  retry_operation,
  update_memory,
} from "./index";
import { generate_argument, search_laws } from "./utility";
import type {
  BatchQueryResult,
  ExternalAPIParams,
  ExternalAPIResult,
} from "./types";

/**
 * batch_query_laws - 批量法律检索（脚本层）
 * 使用实用层函数：search_laws，批量并行查询多个关键词
 */
export async function batch_query_laws(
  prisma: PrismaClient,
  memoryManager: MemoryManager,
  queries: Array<{ query: string; category?: string; limit?: number }>,
  userId: string,
): Promise<
  BatchQueryResult<{
    id: string;
    title: string;
    content: string;
    category: string;
    relevanceScore: number;
  }>
> {
  const startTime = Date.now();
  const maxConcurrency = queries.length > 5 ? 5 : queries.length;

  const results: Array<{
    query: Record<string, unknown>;
    data: Array<{
      id: string;
      title: string;
      content: string;
      category: string;
      relevanceScore: number;
    }>;
    error?: Error;
  }> = [];

  let successCount = 0;
  let failureCount = 0;

  // 分批并行查询
  for (let i = 0; i < queries.length; i += maxConcurrency) {
    const batch = queries.slice(i, i + maxConcurrency);
    const batchResults = await Promise.allSettled(
      batch.map((query) =>
        search_laws(prisma, memoryManager, query, userId).then((data) => ({
          query,
          data,
        })),
      ),
    );

    for (const result of batchResults) {
      if (result.status === "fulfilled") {
        results.push({
          query: result.value.query,
          data: result.value.data.articles,
        });
        successCount++;
      } else {
        results.push({
          query: result.reason.query,
          data: [],
          error: result.reason,
        });
        failureCount++;
      }
    }
  }

  await log_action(prisma, {
    actionType: "RETRIEVE",
    actionName: "batch_query_laws",
    agentName: "ScriptAction",
    input: { queries },
    output: results,
    status: failureCount === 0 ? "success" : "partial",
    executionTime: Date.now() - startTime,
  });

  return {
    results,
    successCount,
    failureCount,
    totalExecutionTime: Date.now() - startTime,
  };
}

/**
 * external_api_call - 外部API调用（脚本层）
 * 使用核心原子函数：retry_operation, handle_error
 */
export async function external_api_call<T>(
  prisma: PrismaClient,
  params: ExternalAPIParams,
): Promise<ExternalAPIResult<T>> {
  const startTime = Date.now();

  const operation = async () => {
    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      params.timeout || 10000,
    );

    try {
      const response = await fetch(params.url, {
        method: params.method,
        headers: params.headers,
        body: params.body ? JSON.stringify(params.body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = (await response.json()) as T;

      return {
        success: true,
        data,
        statusCode: response.status,
        executionTime: Date.now() - startTime,
      };
    } catch (error) {
      clearTimeout(timeoutId);

      await handle_error(prisma, {
        error: error as Error,
        actionName: "external_api_call",
        context: { url: params.url },
      });

      throw error;
    }
  };

  const retryResult = await retry_operation({
    operation,
    maxAttempts: params.retryConfig?.maxAttempts || 3,
    baseDelay: params.retryConfig?.baseDelay || 1000,
    maxDelay: params.retryConfig?.maxDelay || 5000,
  });

  if (retryResult.success) {
    return retryResult.result as ExternalAPIResult<T>;
  }

  return {
    success: false,
    executionTime: Date.now() - startTime,
    error: retryResult.error?.message,
  };
}

/**
 * generate_debate_arguments - 生成辩论论点（脚本层）
 * 使用实用层函数：generate_argument, search_laws，完整的辩论准备流程
 */
export async function generate_debate_arguments(
  prisma: PrismaClient,
  memoryManager: MemoryManager,
  aiService: { call: (args: unknown) => Promise<unknown> },
  params: {
    caseInfo: unknown;
    side: "plaintiff" | "defendant";
    userId: string;
  },
) {
  const startTime = Date.now();

  try {
    // 1. 检索相关法律
    const relevantLaws = await search_laws(
      prisma,
      memoryManager,
      {
        query: `${params.caseInfo}`,
        limit: 5,
        useCache: true,
      },
      params.userId,
    );

    // 2. 生成论点
    const argumentResult = await generate_argument(prisma, aiService, {
      caseInfo: params.caseInfo,
      side: params.side,
      legalBasis: relevantLaws.articles.map((law) => law.content),
    });

    const result = {
      arguments: argumentResult,
      relevantLaws: relevantLaws.articles,
      totalLawsFound: relevantLaws.totalResults,
      confidence: argumentResult.confidence,
    };

    // 3. 更新记忆
    await update_memory(
      memoryManager,
      {
        memoryType: "WORKING",
        memoryKey: `debate_arguments:${params.userId}:${Date.now()}`,
        memoryValue: result,
        importance: 0.95,
      },
      params.userId,
    );

    // 4. 记录行动
    await log_action(prisma, {
      actionType: "GENERATE",
      actionName: "generate_debate_arguments",
      agentName: "ScriptAction",
      input: params,
      output: result,
      status: "success",
      executionTime: Date.now() - startTime,
    });

    return result;
  } catch (error) {
    await handle_error(prisma, {
      error: error as Error,
      actionName: "generate_debate_arguments",
      context: params,
    });

    throw error;
  }
}

/**
 * analyze_document_batch - 批量文档分析（脚本层）
 * 使用核心原子函数：update_memory
 */
export async function analyze_document_batch(
  prisma: PrismaClient,
  memoryManager: MemoryManager,
  documentIds: string[],
  userId: string,
) {
  const startTime = Date.now();

  const results: Array<{
    documentId: string;
    analysis?: unknown;
    error?: Error;
  }> = [];

  for (const documentId of documentIds) {
    try {
      const document = await (
        prisma.document as {
          findUnique: (args: unknown) => Promise<unknown>;
        }
      ).findUnique({
        where: { id: documentId },
      });

      if (!document) {
        results.push({
          documentId,
          error: new Error("Document not found"),
        });
        continue;
      }

      // 分析文档
      const analysis = {
        documentId,
        fileName: (document as { filename: string }).filename,
        fileSize: (document as { fileSize: number }).fileSize,
        fileType: (document as { fileType: string }).fileType,
      };

      results.push({ documentId, analysis });

      // 更新记忆
      await update_memory(
        memoryManager,
        {
          memoryType: "HOT",
          memoryKey: `document_analysis:${documentId}`,
          memoryValue: analysis,
          importance: 0.8,
        },
        userId,
      );
    } catch (error) {
      results.push({
        documentId,
        error: error as Error,
      });
    }
  }

  await log_action(prisma, {
    actionType: "ANALYZE",
    actionName: "analyze_document_batch",
    agentName: "ScriptAction",
    input: { documentIds },
    output: results,
    status: "success",
    executionTime: Date.now() - startTime,
  });

  return {
    results,
    totalDocuments: documentIds.length,
    successful: results.filter((r) => !r.error).length,
    failed: results.filter((r) => r.error).length,
  };
}

/**
 * sync_with_external - 与外部系统同步（脚本层）
 * 使用外部API调用和数据库更新
 */
export async function sync_with_external(
  prisma: PrismaClient,
  params: {
    externalUrl: string;
    dataToSync: unknown;
    syncType: "push" | "pull";
  },
): Promise<{
  success: boolean;
  syncedItems: number;
  failedItems: number;
  executionTime: number;
}> {
  const startTime = Date.now();

  const apiCall = await external_api_call(prisma, {
    url: params.externalUrl,
    method: "POST",
    body: {
      type: params.syncType,
      data: params.dataToSync,
    },
    timeout: 30000,
  });

  if (apiCall.success) {
    await log_action(prisma, {
      actionType: "COMMUNICATE",
      actionName: "sync_with_external",
      agentName: "ScriptAction",
      input: params,
      output: apiCall,
      status: "success",
      executionTime: Date.now() - startTime,
    });

    return {
      success: true,
      syncedItems: Array.isArray(params.dataToSync)
        ? params.dataToSync.length
        : 1,
      failedItems: 0,
      executionTime: Date.now() - startTime,
    };
  }

  return {
    success: false,
    syncedItems: 0,
    failedItems: Array.isArray(params.dataToSync)
      ? params.dataToSync.length
      : 1,
    executionTime: Date.now() - startTime,
  };
}

/**
 * execute_workflow - 执行工作流（脚本层）
 * 组合多个操作完成复杂业务流程
 */
export async function execute_workflow(
  prisma: PrismaClient,
  memoryManager: MemoryManager,
  aiService: { call: (args: unknown) => Promise<unknown> },
  workflow: {
    name: string;
    steps: Array<{
      name: string;
      action: string;
      params: unknown;
    }>;
  },
  userId: string,
) {
  const startTime = Date.now();
  const results: Array<{
    stepName: string;
    success: boolean;
    result?: unknown;
    error?: Error;
  }> = [];

  for (const step of workflow.steps) {
    try {
      let result;
      switch (step.action) {
        case "search_laws":
          result = await search_laws(
            prisma,
            memoryManager,
            step.params as {
              query: string;
              category?: string;
              limit?: number;
              useCache?: boolean;
            },
            userId,
          );
          break;
        case "generate_argument":
          result = await generate_argument(
            prisma,
            aiService,
            step.params as {
              caseInfo: unknown;
              side: "plaintiff" | "defendant";
              legalBasis?: unknown;
            },
          );
          break;
        default:
          throw new Error(`Unknown action: ${step.action}`);
      }

      results.push({
        stepName: step.name,
        success: true,
        result,
      });
    } catch (error) {
      results.push({
        stepName: step.name,
        success: false,
        error: error as Error,
      });

      // 记录错误但继续执行
      await handle_error(prisma, {
        error: error as Error,
        actionName: `workflow_step:${step.name}`,
        context: { workflowName: workflow.name, step: step.name },
      });
    }
  }

  const successCount = results.filter((r) => r.success).length;
  const failureCount = results.filter((r) => !r.success).length;

  await log_action(prisma, {
    actionType: "COMMUNICATE",
    actionName: "execute_workflow",
    agentName: "ScriptAction",
    input: workflow,
    output: results,
    status: failureCount === 0 ? "success" : "partial",
    executionTime: Date.now() - startTime,
  });

  return {
    workflowName: workflow.name,
    results,
    totalSteps: workflow.steps.length,
    successCount,
    failureCount,
    executionTime: Date.now() - startTime,
  };
}
