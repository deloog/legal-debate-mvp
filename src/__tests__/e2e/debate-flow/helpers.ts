/**
 * E2E测试辅助函数
 * 提供通用的测试辅助函数，减少重复代码
 */

import { prisma } from "@/lib/db/prisma";
import { APIRequestContext, Page } from "@playwright/test";

// 类型定义
interface DocumentAnalysisResult {
  claims: Array<{ text: string }>;
  parties: Array<{ name: string; role: string }>;
  [key: string]: unknown;
}

interface LawArticle {
  id: string;
  lawName: string;
  articleNumber: string;
  fullText: string;
  category: string;
  lawType: string;
  relevanceScore: number;
  matchedKeywords: string[];
  [key: string]: unknown;
}

interface ApplicabilityResult {
  results: Array<{ applicable: boolean; articleId: string; reason?: string }>;
  [key: string]: unknown;
}

interface DebateConfig {
  maxRounds: number;
  timePerRound: number;
  allowNewEvidence: boolean;
  debateMode: "standard" | "fast" | "detailed";
}

interface ArgumentsResult {
  plaintiff: {
    arguments: Array<{
      type?: string;
      content: string;
      references: Array<{ roundNumber: number }>;
      legalBasis: Array<{ articleId: string }>;
    }>;
  };
  defendant: {
    arguments: Array<{
      type?: string;
      content: string;
      references: Array<{ roundNumber: number }>;
      legalBasis: Array<{ articleId: string }>;
    }>;
  };
  [key: string]: unknown;
}

interface PerformanceStats {
  min: number;
  max: number;
  avg: number;
  count: number;
}

/**
 * 创建测试案件
 */
export async function createTestCase(
  apiContext: APIRequestContext,
  userId?: string,
): Promise<{ caseId: string; title: string }> {
  const title = `测试案件_${Date.now()}`;

  // 如果没有提供userId，使用默认的E2E测试用户ID（与init-e2e-test-data.ts脚本一致）
  const effectiveUserId = userId || "test-e2e-user-single-round";

  const response = await apiContext.post("/api/v1/cases", {
    data: {
      userId: effectiveUserId,
      title,
      description: "端到端测试案件",
      type: "civil",
      status: "active",
    },
  });

  if (!response.ok()) {
    const errorBody = await response
      .json()
      .catch(() => ({ error: "Unknown error" }));
    console.error("创建案件失败详情:", {
      status: response.status(),
      statusText: response.statusText(),
      body: errorBody,
      request: {
        userId: effectiveUserId,
        title,
      },
    });
    throw new Error(`创建案件失败: ${response.status()}`);
  }

  const result = await response.json();
  return {
    caseId: result.data.id,
    title,
  };
}

/**
 * 上传测试文档
 */
export async function uploadTestDocument(
  apiContext: APIRequestContext,
  caseId: string,
  fileContent: string,
): Promise<{ documentId: string; filename: string }> {
  const fileId = `test-file-${Date.now()}`;
  const fileBuffer = Buffer.from(fileContent, "utf-8");

  // Playwright API multipart格式
  const formData = {
    file: {
      name: "test-document.pdf",
      mimeType: "application/pdf",
      buffer: fileBuffer,
    },
    caseId,
    fileId,
  };

  const response = await apiContext.post("/api/v1/documents/upload", {
    multipart: formData,
  });

  if (!response.ok()) {
    throw new Error(`上传文档失败: ${response.status()}`);
  }

  const result = await response.json();
  return {
    documentId: result.data.id,
    filename: result.data.filename,
  };
}

/**
 * 等待文档解析完成
 * 使用指数退避轮询策略，优化等待时间
 */
export async function waitForDocumentParsing(
  apiContext: APIRequestContext,
  documentId: string,
  timeout: number = 120000,
): Promise<DocumentAnalysisResult> {
  const startTime = Date.now();
  let pollInterval = 1000; // 初始间隔1秒
  const maxPollInterval = 10000; // 最大间隔10秒

  while (Date.now() - startTime < timeout) {
    const response = await apiContext.get(`/api/v1/documents/${documentId}`);

    if (response.ok()) {
      const result = await response.json();

      if (result.data.analysisStatus === "COMPLETED") {
        const elapsed = Date.now() - startTime;
        console.log(`文档解析完成 [${documentId}]: ${elapsed}ms`);
        const rawResult = result.data.analysisResult as {
          extractedData?: {
            parties?: Array<{
              name?: string;
              role?: string;
              type?: string;
              description?: string;
            }>;
            claims?: Array<{
              content?: string;
              type?: string;
              amount?: number;
            }>;
            keyFacts?: string[];
          };
        } | null;

        // 转换数据结构以适配测试期望
        return {
          claims:
            rawResult?.extractedData?.claims?.map((c) => ({
              text:
                (c as { content?: string; text?: string }).content ||
                (c as { text?: string }).text ||
                "",
              type: c.type,
              amount: c.amount,
              description:
                (c as { content?: string; text?: string }).content || "",
            })) || [],
          parties:
            rawResult?.extractedData?.parties?.map((p) => ({
              name: p.name || "",
              role: p.role || "",
              type: p.type,
              description: p.description,
            })) || [],
          facts: rawResult?.extractedData?.keyFacts || [],
        } as DocumentAnalysisResult;
      } else if (result.data.analysisStatus === "FAILED") {
        const errorDetails = result.data.analysisError || "未知错误";
        console.error(`文档解析失败 [${documentId}]: ${errorDetails}`);
        throw new Error(`文档解析失败: ${errorDetails}`);
      } else if (result.data.analysisStatus === "PROCESSING") {
        const elapsed = Date.now() - startTime;
        console.log(
          `文档解析中 [${documentId}]: ${elapsed}ms, 状态: PROCESSING`,
        );
      } else {
        console.log(`文档状态 [${documentId}]: ${result.data.analysisStatus}`);
      }
    } else {
      console.warn(`查询文档失败 [${documentId}]: ${response.status()}`);
    }

    // 指数退避轮询
    await new Promise((resolve) => setTimeout(resolve, pollInterval));
    pollInterval = Math.min(pollInterval * 2, maxPollInterval);
  }

  const elapsed = Date.now() - startTime;
  throw new Error(
    `文档解析超时 [${documentId}]: ${elapsed}ms, 超过${timeout}ms`,
  );
}

/**
 * 触发法条检索
 */
export async function searchLawArticles(
  apiContext: APIRequestContext,
  keywords: string[],
  category?: string,
): Promise<LawArticle[]> {
  const response = await apiContext.post("/api/v1/law-articles/search", {
    data: {
      keywords,
      category,
      limit: 20,
    },
  });

  if (!response.ok()) {
    const errorBody = await response
      .json()
      .catch(() => ({ error: "Unknown error" }));
    console.error("法条检索失败详情:", {
      status: response.status(),
      statusText: response.statusText(),
      body: errorBody,
      request: {
        keywords,
        category,
        limit: 20,
      },
    });
    throw new Error(`法条检索失败: ${response.status()}`);
  }

  const result = await response.json();
  console.log("法条检索API响应:", JSON.stringify(result, null, 2));

  if (
    !result.data ||
    !result.data.articles ||
    result.data.articles.length === 0
  ) {
    console.warn("法条检索结果为空:", result);
    throw new Error("法条检索未返回结果");
  }

  return result.data.articles;
}

/**
 * 执行法条适用性分析
 */
export async function analyzeApplicability(
  apiContext: APIRequestContext,
  caseId: string,
  articleIds: string[],
): Promise<ApplicabilityResult> {
  const response = await apiContext.post(
    "/api/v1/legal-analysis/applicability",
    {
      data: {
        caseId,
        articleIds,
      },
    },
  );

  if (!response.ok()) {
    throw new Error(`适用性分析失败: ${response.status()}`);
  }

  const result = await response.json();
  return result.data;
}

/**
 * 创建辩论
 */
export async function createDebate(
  apiContext: APIRequestContext,
  caseId: string,
  config: Partial<DebateConfig> = {},
): Promise<{ debateId: string; roundId: string }> {
  const response = await apiContext.post("/api/v1/debates", {
    data: {
      caseId,
      title: "测试辩论",
      status: "IN_PROGRESS",
      config: {
        debateMode: "standard",
        maxRounds: 3,
        timePerRound: 30,
        allowNewEvidence: true,
        ...config,
      },
    },
  });

  if (!response.ok()) {
    const errorBody = await response
      .json()
      .catch(() => ({ error: "Unknown error" }));
    console.error("创建辩论失败详情:", {
      status: response.status(),
      statusText: response.statusText(),
      body: errorBody,
      request: {
        caseId,
        title: "测试辩论",
        status: "IN_PROGRESS",
        config: {
          debateMode: "standard",
          maxRounds: 3,
          timePerRound: 30,
          allowNewEvidence: true,
          ...config,
        },
      },
    });
    throw new Error(`创建辩论失败: ${response.status()}`);
  }

  const result = await response.json();
  return {
    debateId: result.data.id,
    roundId: result.data.rounds[0].id,
  };
}

/**
 * 生成辩论论点
 */
export async function generateArguments(
  apiContext: APIRequestContext,
  roundId: string,
  applicableArticles: string[],
): Promise<ArgumentsResult> {
  const response = await apiContext.post(
    `/api/v1/debate-rounds/${roundId}/generate`,
    {
      data: {
        applicableArticles,
      },
    },
  );

  if (!response.ok()) {
    const errorBody = await response
      .json()
      .catch(() => ({ error: "Unknown error" }));
    console.error("生成论点失败详情:", {
      status: response.status(),
      statusText: response.statusText(),
      body: errorBody,
      request: {
        roundId,
        applicableArticles,
      },
    });
    throw new Error(`生成论点失败: ${response.status()}`);
  }

  const result = await response.json();
  return result.data;
}

/**
 * 测试SSE流式输出
 */
export async function testSSEStream(
  page: Page,
  url: string,
  expectedChunks: number = 3,
): Promise<string[]> {
  const chunks: string[] = [];

  await page.route(url, async (route) => {
    const streamData: string[] = [];

    for (let i = 0; i < expectedChunks; i++) {
      const data = {
        type: "argument",
        content: "这是测试论点内容...",
        side: "PLAINTIFF",
      };

      streamData.push(`data: ${JSON.stringify(data)}\n\n`);
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    route.fulfill({
      status: 200,
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
      },
      body: streamData.join(""),
    });
  });

  return chunks;
}

/**
 * 清理测试数据
 */
export async function cleanupTestData(caseId: string): Promise<void> {
  try {
    await prisma.case.delete({
      where: { id: caseId },
    });
  } catch {
    // 案件不存在，忽略错误
    console.warn(`清理案件时找不到记录: ${caseId}`);
  }
}

/**
 * 验证数据库中的数据
 */
export async function verifyDatabaseData(
  caseId: string,
  expectedDocuments: number,
  expectedDebates: number,
  expectedRounds: number,
): Promise<boolean> {
  const caseData = await prisma.case.findUnique({
    where: { id: caseId },
    include: {
      documents: true,
      debates: {
        include: {
          rounds: true,
        },
      },
    },
  });

  if (!caseData) {
    throw new Error(`案件不存在: ${caseId}`);
  }

  if (caseData.documents.length !== expectedDocuments) {
    throw new Error(
      `文档数量不匹配: 期望${expectedDocuments}, 实际${caseData.documents.length}`,
    );
  }

  if (caseData.debates.length !== expectedDebates) {
    throw new Error(
      `辩论数量不匹配: 期望${expectedDebates}, 实际${caseData.debates.length}`,
    );
  }

  const totalRounds = caseData.debates.reduce(
    (sum, debate) => sum + debate.rounds.length,
    0,
  );

  if (totalRounds !== expectedRounds) {
    throw new Error(
      `轮次数量不匹配: 期望${expectedRounds}, 实际${totalRounds}`,
    );
  }

  return true;
}

/**
 * 记录性能指标
 */
export class PerformanceRecorder {
  private records: Map<string, number[]> = new Map();

  record(name: string, duration: number): void {
    if (!this.records.has(name)) {
      this.records.set(name, []);
    }
    this.records.get(name)!.push(duration);
  }

  getAverage(name: string): number {
    const records = this.records.get(name) || [];
    if (records.length === 0) {
      return 0;
    }
    return records.reduce((sum, val) => sum + val, 0) / records.length;
  }

  getStats(name: string): PerformanceStats {
    const records = this.records.get(name) || [];

    if (records.length === 0) {
      return { min: 0, max: 0, avg: 0, count: 0 };
    }

    return {
      min: Math.min(...records),
      max: Math.max(...records),
      avg: records.reduce((sum, val) => sum + val, 0) / records.length,
      count: records.length,
    };
  }

  getAllStats(): Record<string, PerformanceStats> {
    const stats: Record<string, PerformanceStats> = {};

    this.records.forEach((_, name) => {
      stats[name] = this.getStats(name);
    });

    return stats;
  }
}

/**
 * 断言性能指标
 */
export function assertPerformance(
  actual: number,
  target: number,
  metricName: string,
  tolerance: number = 1.2,
): void {
  const threshold = target * tolerance;

  if (actual > threshold) {
    throw new Error(
      `性能指标不达标: ${metricName} = ${actual}ms, 期望<${target}ms (容忍度${tolerance}x)`,
    );
  }
}
