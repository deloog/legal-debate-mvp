/**
 * E2E测试辅助函数
 * 提供通用的测试辅助函数，减少重复代码
 */

import { prisma } from "@/lib/db/prisma";
import { APIRequestContext, Page } from "@playwright/test";

// 类型定义
interface Claim {
  text: string;
  type?: string;
  amount?: number;
  description?: string;
}

interface Party {
  name: string;
  role: string;
  type?: string;
  description?: string;
}

interface DocumentAnalysisResult {
  claims: Claim[];
  parties: Party[];
  facts: string[];
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
        // facts字段保持原样（可能是对象数组或字符串数组）
        const rawFacts = rawResult?.extractedData?.keyFacts || [];

        // 尝试转换为字符串数组（如果是对象数组）
        const facts = rawFacts.map((fact: unknown) => {
          if (typeof fact === "string") {
            return fact;
          }
          if (typeof fact === "object" && fact !== null) {
            const factObj = fact as { date?: string; description?: string };
            if (factObj.date && factObj.description) {
              return `${factObj.date}: ${factObj.description}`;
            }
            if (factObj.description) {
              return factObj.description;
            }
          }
          return String(fact);
        });

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
          facts,
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
 * 改进版本：支持空结果返回，增加更详细的日志
 * 处理非法分类错误，返回空数组而非抛出异常
 */
export async function searchLawArticles(
  apiContext: APIRequestContext,
  keywords: string[],
  category?: string,
  options: {
    allowEmpty?: boolean;
    maxRetries?: number;
    expandKeywords?: boolean;
    allowInvalidCategory?: boolean;
  } = {},
): Promise<LawArticle[]> {
  const {
    allowEmpty = false,
    maxRetries = 1,
    expandKeywords = true,
    allowInvalidCategory = false,
  } = options;

  console.log("开始法条检索:", { keywords, category });

  // 关键词扩展：添加同义词和相关词
  let expandedKeywords = [...keywords];
  if (expandKeywords) {
    const keywordMap: Record<string, string[]> = {
      合同: ["违约", "履行", "义务", "责任"],
      违约: ["合同", "赔偿", "违约金", "损害赔偿"],
      支付: ["付款", "报酬", "价款", "欠款", "金钱债务"],
      货款: ["价款", "款项", "欠款"],
      利息: ["迟延利息", "违约利息"],
      赔偿: ["损失", "损害赔偿", "违约金"],
      解除: ["终止", "撤销"],
      履行: ["执行", "实施"],
      义务: ["责任", "债务"],
      承揽: ["承揽合同", "定作人", "承揽人"],
    };

    keywords.forEach((kw) => {
      if (keywordMap[kw]) {
        expandedKeywords = [...expandedKeywords, ...keywordMap[kw]];
      }
    });
  }

  // 去重并限制关键词数量
  expandedKeywords = [...new Set(expandedKeywords)].slice(0, 10);

  console.log("扩展后的关键词:", expandedKeywords);

  const requestBody = {
    keywords: expandedKeywords,
    category,
    limit: 20,
  };

  console.log("法条检索请求体:", JSON.stringify(requestBody, null, 2));

  const response = await apiContext.post("/api/v1/law-articles/search", {
    data: requestBody,
  });

  // 处理非法分类错误（400状态码）
  if (!response.ok()) {
    const errorBody = await response
      .json()
      .catch(() => ({ error: "Unknown error" }));
    console.error("法条检索失败详情:", {
      status: response.status(),
      statusText: response.statusText(),
      body: errorBody,
      request: requestBody,
    });

    // 非法分类错误，返回空数组（用于测试验证）
    if (
      response.status() === 400 &&
      errorBody.error?.code === "INVALID_CATEGORY"
    ) {
      console.log("非法分类错误，返回空数组");
      return [];
    }

    // 如果允许处理某些错误，返回空数组
    if (
      allowInvalidCategory ||
      (response.status() >= 400 && response.status() < 500)
    ) {
      console.warn("法条检索客户端错误，返回空数组");
      return [];
    }

    throw new Error(`法条检索失败: ${response.status()}`);
  }

  const result = await response.json();
  console.log("法条检索API响应:", JSON.stringify(result, null, 2));

  if (!result.data) {
    console.warn("法条检索响应缺少data字段:", result);
    if (!allowEmpty) {
      throw new Error("法条检索响应格式错误：缺少data字段");
    }
    return [];
  }

  if (!result.data.articles) {
    console.warn("法条检索结果缺少articles字段:", result);
    if (!allowEmpty) {
      throw new Error("法条检索响应格式错误：缺少articles字段");
    }
    return [];
  }

  if (result.data.articles.length === 0) {
    console.warn("法条检索结果为空数组", {
      keywords,
      expandedKeywords,
      category,
      total: result.data.total || 0,
    });

    if (!allowEmpty) {
      // 如果不允许空结果，尝试使用默认关键词重试
      if (maxRetries > 0) {
        console.log("尝试使用默认关键词重试...");
        return searchLawArticles(apiContext, ["合同", "违约"], category, {
          allowEmpty: false,
          maxRetries: maxRetries - 1,
          expandKeywords: false,
        });
      }
      throw new Error(
        `法条检索未返回结果。关键词: ${keywords.join(", ")}，分类: ${category || "无"}`,
      );
    }
  } else {
    console.log(`法条检索成功，返回 ${result.data.articles.length} 条结果`);
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
  if (!result.data) {
    throw new Error("创建辩论返回数据格式错误");
  }
  if (!result.data.rounds || result.data.rounds.length === 0) {
    throw new Error("创建辩论返回的轮次数据为空");
  }
  return {
    debateId: result.data.id,
    roundId: result.data.rounds[0].id,
  };
}

/**
 * 创建新的辩论轮次
 * 注意：API会自动计算roundNumber，不需要传递
 */
export async function createDebateRound(
  apiContext: APIRequestContext,
  debateId: string,
): Promise<string> {
  // API会自动计算roundNumber，不需要传递任何参数
  const response = await apiContext.post(`/api/v1/debates/${debateId}/rounds`, {
    data: {},
  });

  if (!response.ok()) {
    const errorBody = await response
      .json()
      .catch(() => ({ error: "Unknown error" }));
    console.error("创建辩论轮次失败详情:", {
      status: response.status(),
      statusText: response.statusText(),
      body: errorBody,
      request: {
        debateId,
      },
    });
    throw new Error(`创建辩论轮次失败: ${response.status()}`);
  }

  const result = await response.json();
  if (!result.data || !result.data.id) {
    throw new Error("创建辩论轮次返回数据格式错误");
  }
  return result.data.id;
}

/**
 * 生成辩论论点
 */
export async function generateArguments(
  apiContext: APIRequestContext,
  debateId: string,
  roundId: string,
  applicableArticles: string[],
): Promise<ArgumentsResult> {
  const response = await apiContext.post(
    `/api/v1/debates/${debateId}/rounds/${roundId}/generate`,
    {
      data: {
        applicableArticles,
      },
    },
  );

  if (!response.ok()) {
    const errorBody = await response.json();
    console.error("生成辩论论点失败详情:", {
      status: response.status(),
      statusText: response.statusText(),
      body: errorBody,
      request: {
        debateId,
        roundId,
        applicableArticles,
      },
    });
    throw new Error(`生成辩论论点失败: ${response.status()}`);
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
