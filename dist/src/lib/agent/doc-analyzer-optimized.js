"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DocAnalyzerAgent = exports.DocAnalyzerAgentOptimized = void 0;
const base_agent_1 = require("./base-agent");
const agent_1 = require("../../types/agent");
const errors_1 = require("./security/errors");
const file_utils_1 = require("./security/file-utils");
const concurrency_controller_1 = require("./security/concurrency-controller");
const logger_1 = require("./security/logger");
const dependency_injection_1 = require("./security/dependency-injection");
class DocAnalyzerAgentOptimized extends base_agent_1.BaseAgent {
  constructor() {
    super();
    this.documentParser = (0, dependency_injection_1.getDocumentParser)();
  }
  // 重写基类属性
  get name() {
    return "DocAnalyzerOptimized";
  }
  get type() {
    return agent_1.AgentType.DOC_ANALYZER;
  }
  get version() {
    return "2.0.0";
  }
  get description() {
    return "优化版文档分析智能体，采用思维链(CoT)增强、结构化约束和自我修正策略，目标当事人准确率≥98%，诉讼请求准确率≥95%";
  }
  // 重写基类方法
  getCapabilities() {
    return [
      "DOCUMENT_ANALYSIS",
      "TEXT_EXTRACTION",
      "STRUCTURED_DATA_EXTRACTION",
      "DEDUPLICATION",
      "CHAIN_OF_THOUGHT",
      "SELF_CORRECTION",
    ];
  }
  getSupportedTasks() {
    return [
      "DOCUMENT_PARSE",
      "DOCUMENT_ANALYZE",
      "INFO_EXTRACT",
      "DEDUPLICATE_PARTIES",
      "CHAIN_OF_THOUGHT_REASONING",
      "SELF_VERIFICATION",
    ];
  }
  getDependencies() {
    return [];
  }
  getRequiredConfig() {
    return [];
  }
  getOptionalConfig() {
    return ["timeout", "retryAttempts", "cacheEnabled", "fewShotExamples"];
  }
  getProcessingSteps() {
    return [
      "Input validation",
      "Document text extraction",
      "Chain of thought analysis",
      "Structured extraction",
      "Self-verification",
      "Result formatting",
    ];
  }
  async executeLogic(context) {
    const input = context.data;
    const startTime = Date.now();
    return await concurrency_controller_1.documentConcurrencyController.withConcurrency(
      "document-analysis",
      (0, dependency_injection_1.getConfig)().maxConcurrentDocuments,
      async () => {
        try {
          // 记录开始日志
          logger_1.logger.info("开始文档分析", {
            documentId: input.documentId,
            fileType: input.fileType,
            filePath: input.filePath,
          });
          // 验证输入参数
          this.validateInput(input);
          // 安全地解析文档
          let extractedText;
          // 检查是否直接提供了content（用于测试）
          if (input.content) {
            extractedText = input.content;
          } else {
            extractedText = await this.extractDocumentText(
              input.filePath,
              input.fileType,
            );
          }
          if (!extractedText || extractedText.trim().length === 0) {
            throw new errors_1.AnalysisError(
              "无法从文档中提取有效文本内容",
              new Error("文档内容为空"),
              { documentId: input.documentId },
            );
          }
          // 使用优化的AI分析提取的文本
          const analysisResult = await this.analyzeDocumentWithOptimizedAI(
            extractedText,
            input.options,
          );
          // 计算处理时间
          const processingTime = Date.now() - startTime;
          const result = {
            success: true,
            extractedData: analysisResult.extractedData,
            confidence: analysisResult.confidence,
            processingTime,
            metadata: {
              fileSize:
                input.filePath && input.fileType !== "IMAGE"
                  ? await this.getFileSizeSecurely(input.filePath)
                  : 0,
              wordCount: this.countWords(extractedText),
              analysisModel: "zhipu-glm-4.6-optimized",
              tokenUsed: analysisResult.tokenUsed,
              analysisProcess: analysisResult.analysisProcess,
            },
          };
          // 记录成功日志
          logger_1.logger.info("文档分析完成", {
            documentId: input.documentId,
            processingTime,
            confidence: result.confidence,
            partiesCount: result.extractedData.parties.length,
            claimsCount: result.extractedData.claims.length,
          });
          // 记录处理指标
          logger_1.logger.recordDocumentProcessing(
            true,
            processingTime,
            result.confidence,
          );
          return result;
        } catch (error) {
          const processingTime = Date.now() - startTime;
          // 包装错误并记录
          const wrappedError = new errors_1.AnalysisError(
            `文档分析失败 [id=${input.documentId}]: ${error instanceof Error ? error.message : String(error)}`,
            error instanceof Error ? error : new Error(String(error)),
            {
              documentId: input.documentId,
              processingTime,
              fileType: input.fileType,
            },
          );
          logger_1.logger.error("文档分析失败", wrappedError, {
            documentId: input.documentId,
            processingTime,
            fileType: input.fileType,
          });
          // 记录失败指标
          logger_1.logger.recordDocumentProcessing(false, processingTime, 0);
          throw wrappedError;
        }
      },
    );
  }
  // =============================================================================
  // 文档文本提取方法
  // =============================================================================
  async extractDocumentText(filePath, fileType) {
    try {
      switch (fileType) {
        case "PDF":
          return await this.extractPDFText(filePath);
        case "DOCX":
          return await this.extractDOCXText(filePath);
        case "DOC":
          return await this.extractDOCText(filePath);
        case "TXT":
          return await this.extractTXTText(filePath);
        case "IMAGE":
          return await this.extractImageText(filePath);
        default:
          throw new Error(`不支持的文档格式: ${fileType}`);
      }
    } catch (error) {
      throw new Error(
        `文档文本提取失败: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
  // =============================================================================
  // 具体格式提取方法
  // =============================================================================
  async extractPDFText(filePath) {
    try {
      // 安全验证
      file_utils_1.SecureFileUtils.validateFilePath(filePath);
      const pdfParse = require("pdf-parse");
      const buffer =
        await file_utils_1.SecureFileUtils.readFileSecurely(filePath);
      const data = await pdfParse(buffer);
      return data.text;
    } catch (error) {
      throw new errors_1.AnalysisError(
        `PDF文件解析失败`,
        error instanceof Error ? error : new Error(String(error)),
        { filePath },
      );
    }
  }
  async extractDOCXText(filePath) {
    try {
      // 安全验证
      file_utils_1.SecureFileUtils.validateFilePath(filePath);
      const mammoth = require("mammoth");
      const buffer =
        await file_utils_1.SecureFileUtils.readFileSecurely(filePath);
      const result = await mammoth.extractRawText({ buffer });
      return result.value;
    } catch (error) {
      throw new errors_1.AnalysisError(
        `DOCX文件解析失败`,
        error instanceof Error ? error : new Error(String(error)),
        { filePath },
      );
    }
  }
  async extractDOCText(filePath) {
    try {
      // 安全验证
      file_utils_1.SecureFileUtils.validateFilePath(filePath);
      // 首先尝试使用antiword（安全版本）
      try {
        return await file_utils_1.SecureFileUtils.executeCommandSecurely(
          "antiword",
          [filePath],
        );
      } catch (antiwordError) {
        logger_1.logger.warn("antiword不可用，尝试使用textract", {
          filePath,
          error: antiwordError,
        });
        return await this.extractDOCWithTextract(filePath);
      }
    } catch (error) {
      throw new errors_1.AnalysisError(
        `DOC文件解析失败`,
        error instanceof Error ? error : new Error(String(error)),
        { filePath },
      );
    }
  }
  async extractDOCWithTextract(filePath) {
    try {
      const textract = require("textract");
      return new Promise((resolve, reject) => {
        textract.fromFileWithPath(filePath, (error, text) => {
          if (error) {
            reject(
              new errors_1.AnalysisError(`Textract解析失败`, error, {
                filePath,
              }),
            );
          } else {
            resolve(text.trim());
          }
        });
      });
    } catch (error) {
      throw new errors_1.AnalysisError(
        `Textract不可用`,
        error instanceof Error ? error : new Error(String(error)),
        { filePath },
      );
    }
  }
  async extractTXTText(filePath) {
    try {
      // 安全验证和读取
      return await file_utils_1.SecureFileUtils.readTextFileSecurely(filePath);
    } catch (error) {
      throw new errors_1.AnalysisError(
        `TXT文件读取失败`,
        error instanceof Error ? error : new Error(String(error)),
        { filePath },
      );
    }
  }
  async extractImageText(filePath) {
    try {
      const Tesseract = require("tesseract.js");
      const {
        data: { text },
      } = await Tesseract.recognize(filePath, "chi_sim+eng");
      return text.trim();
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes("Cannot find module")
      ) {
        throw new Error(
          "OCR功能需要安装tesseract.js库，请运行: npm install tesseract.js",
        );
      }
      throw new Error(
        `图片OCR识别失败: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
  // =============================================================================
  // 优化的AI文档分析方法
  // =============================================================================
  async analyzeDocumentWithOptimizedAI(extractedText, options) {
    // 构建优化的分析提示词
    const prompt = this.buildOptimizedAnalysisPrompt(extractedText, options);
    // 调用AI服务进行分析
    const aiResponse = await this.documentParser.analyzeWithAI(prompt);
    // 解析AI返回结果
    return this.parseOptimizedAIResponse(aiResponse);
  }
  buildOptimizedAnalysisPrompt(text, options) {
    const analysisTasks = [];
    if (options?.extractParties !== false) {
      analysisTasks.push("当事人信息提取");
    }
    if (options?.extractClaims !== false) {
      analysisTasks.push("诉讼请求识别");
    }
    if (options?.extractTimeline !== false) {
      analysisTasks.push("时间线整理");
    }
    if (options?.generateSummary === true) {
      analysisTasks.push("案件摘要生成");
    }
    return `你是一个专业的法律文档分析专家。请对以下法律文档进行分析，完成以下任务：

分析任务：${analysisTasks.join("、")}

文档内容：
${text}

【思维链分析过程 - 严格遵守以下6个步骤】

**第1步：OCR修正检查**
请先阅读全文，指出可能存在的OCR错误：
- 数字识别错误（如"1"识别为"l"）
- 中文识别错误（如"张三"识别为"张二"）
- 格式混乱导致的理解困难
如果发现明显OCR错误，请在分析中加以说明。

**第2步：实体罗列**
列出文档中出现的所有人名、公司名、金额信息：
- 人名：[张三、李四、王五...]
- 公司名：[XX公司、YY企业...]
- 金额：[50000元、十万元、1,200.50元...]

**第3步：角色判定**
根据法律文书惯例和上下文线索，判定每个实体的确切角色：
- **原告识别标志**：明确出现"原告"、"申请人"、"起诉人"字样；"XXX诉XXX"中的前者；诉状开头的陈述主体
- **被告识别标志**：明确出现"被告"、"被申请人"、"被起诉人"字样；"XXX诉XXX"中的后者；诉讼请求中"判令XXX"的对象
- **第三人识别标志**：明确出现"第三人"字样；既非起诉方也非被诉方
- **关键约束**：
  * 法定代表人不是当事人，而是原告/被告的属性
  * 一个人只能有一个主要角色，不得重复
  * 如果角色不明确，标注为"待确认"而非猜测
  * 代理人、法官、书记员等非当事人角色需排除

**第4步：诉讼请求原子化拆解**
将复合长句拆解为原子化的短句：
- 示例："判令被告偿还本金100万元及利息" → 
  * 1. 偿还本金100万元
  * 2. 支付利息（具体计算方式）
- **分类映射**：
  * PAY_PRINCIPAL：偿还本金
  * PAY_INTEREST：支付利息
  * PAY_PENALTY：违约金
  * PAY_DAMAGES：赔偿损失
  * LITIGATION_COST：诉讼费用
  * PERFORMANCE：履行义务
  * TERMINATION：解除合同
  * OTHER：其他

**第5步：金额标准化处理**
将所有金额转换为统一格式：
- "十万元" → 100000.00
- "1,200.50" → 1200.50
- "人民币伍万元整" → 50000.00
- **格式要求**：所有金额必须转换为纯数字格式（Float），移除','分隔符，明确货币单位为CNY

**第6步：自我验证检查**
在输出前进行以下检查：
- ✓ 没有重复的当事人姓名
- ✓ 每个当事人的法律角色正确
- ✓ 法定代表人未错误识别为独立当事人
- ✓ 所有诉讼请求都被提取且分类正确
- ✓ 金额信息准确无误且格式统一
- ✓ 诉讼费承担通常是最后一项，确保不遗漏

【严格输出要求】
请按照以下JSON格式返回分析结果，确保数据结构化且准确：

{
  "extractedData": {
    "parties": [
      {
        "type": "plaintiff|defendant|other",
        "name": "当事人姓名（唯一，不重复）",
        "role": "职务或角色（可包含多重身份，如'原告，法定代表人'）",
        "contact": "联系方式",
        "address": "地址"
      }
    ],
    "claims": [
      {
        "type": "PAY_PRINCIPAL|PAY_INTEREST|PAY_PENALTY|PAY_DAMAGES|LITIGATION_COST|PERFORMANCE|TERMINATION|OTHER",
        "content": "请求内容描述（完整准确）",
        "amount": 金额(数字),
        "currency": "CNY",
        "evidence": ["证据描述"],
        "legalBasis": "法律依据"
      }
    ],
    "timeline": [
      {
        "date": "YYYY-MM-DD格式",
        "event": "事件描述",
        "description": "详细说明"
      }
    ],
    "summary": "案件简要总结",
    "caseType": "civil|criminal|administrative|commercial|labor|intellectual|other",
    "keyFacts": ["关键事实1", "关键事实2"]
  },
  "confidence": 0.95,
  "analysisProcess": {
    "ocrErrors": ["发现的OCR错误"],
    "entitiesListed": {
      "persons": ["人名列表"],
      "companies": ["公司名列表"],
      "amounts": ["金额列表"]
    },
    "roleReasoning": "角色判定推理过程",
    "claimDecomposition": "诉讼请求拆解过程",
    "amountNormalization": "金额标准化处理过程",
    "validationResults": {
      "duplicatesFound": [],
      "roleConflicts": [],
      "missingClaims": [],
      "amountInconsistencies": []
    }
  }
}

【最终检查清单】
在返回结果前，请再次确认：
- ✓ 当事人无重复且角色正确
- ✓ 诉讼请求完整且分类准确
- ✓ 金额标准化为数字格式
- ✓ 法定代表人处理正确
- ✓ 逻辑一致性检查通过

只返回JSON格式，不要包含其他说明文字。`;
  }
  parseOptimizedAIResponse(aiResponse) {
    try {
      // 清理AI响应中的代码块标记
      let cleanedResponse = aiResponse.trim();
      // 移除可能的代码块标记
      if (cleanedResponse.includes("```json")) {
        cleanedResponse = cleanedResponse
          .replace(/```json\s*/, "")
          .replace(/```\s*$/, "");
      }
      if (cleanedResponse.includes("```")) {
        cleanedResponse = cleanedResponse
          .replace(/```\s*/, "")
          .replace(/```\s*$/, "");
      }
      // 尝试解析JSON响应
      const parsed = JSON.parse(cleanedResponse);
      // 验证响应结构
      if (!parsed.extractedData) {
        throw new Error("AI响应格式不正确：缺少extractedData字段");
      }
      // 进行后处理：去重和清理
      const cleanedData = this.postProcessExtractedData(parsed.extractedData);
      return {
        extractedData: cleanedData,
        confidence: parsed.confidence || 0.8,
        tokenUsed: this.estimateTokenUsage(aiResponse),
        analysisProcess: parsed.analysisProcess,
      };
    } catch (error) {
      // JSON解析失败时的降级处理
      return {
        extractedData: {
          parties: [],
          claims: [],
          timeline: [],
          summary: "AI响应解析失败，请手动分析",
          keyFacts: [],
        },
        confidence: 0.3,
        tokenUsed: this.estimateTokenUsage(aiResponse),
        analysisProcess: {
          ocrErrors: ["JSON解析失败"],
          entitiesListed: { persons: [], companies: [], amounts: [] },
          roleReasoning: "解析失败",
          claimDecomposition: "无法进行",
          amountNormalization: "无法进行",
          validationResults: {
            duplicatesFound: [],
            roleConflicts: [],
            missingClaims: [],
            amountInconsistencies: [],
          },
        },
      };
    }
  }
  /**
   * 后处理：去重和数据清理
   */
  postProcessExtractedData(extractedData) {
    // 当事人去重
    const uniqueParties = this.deduplicateParties(extractedData.parties || []);
    // 诉讼请求标准化
    const normalizedClaims = this.normalizeClaims(extractedData.claims || []);
    // 金额标准化
    const processedClaims = this.processAmounts(normalizedClaims);
    return {
      parties: uniqueParties,
      claims: processedClaims,
      timeline: extractedData.timeline || [],
      summary: extractedData.summary,
      caseType: extractedData.caseType,
      keyFacts: extractedData.keyFacts || [],
    };
  }
  /**
   * 当事人去重逻辑
   */
  deduplicateParties(parties) {
    const nameMap = new Map();
    parties.forEach((party) => {
      const name = party.name?.trim();
      if (!name) return;
      const existing = nameMap.get(name);
      if (existing) {
        // 合并信息，保留最完整的角色信息
        if (party.role && !existing.role.includes(party.role)) {
          existing.role = existing.role
            ? `${existing.role}、${party.role}`
            : party.role;
        }
        if (party.contact && !existing.contact) {
          existing.contact = party.contact;
        }
        if (party.address && !existing.address) {
          existing.address = party.address;
        }
        // 优先使用最重要的法律角色
        if (
          party.type === "plaintiff" ||
          (party.type === "defendant" && existing.type !== "plaintiff")
        ) {
          existing.type = party.type;
        }
      } else {
        // 创建新条目
        nameMap.set(name, { ...party });
      }
    });
    return Array.from(nameMap.values());
  }
  /**
   * 诉讼请求标准化
   */
  normalizeClaims(claims) {
    return claims.map((claim) => {
      // 确保类型使用标准分类
      const standardType = this.standardizeClaimType(claim.type);
      return {
        ...claim,
        type: standardType,
        currency: claim.currency || "CNY",
      };
    });
  }
  /**
   * 标准化诉讼请求类型
   */
  standardizeClaimType(type) {
    const typeMap = {
      偿还本金: "PAY_PRINCIPAL",
      支付利息: "PAY_INTEREST",
      违约金: "PAY_PENALTY",
      赔偿损失: "PAY_DAMAGES",
      诉讼费用: "LITIGATION_COST",
      履行义务: "PERFORMANCE",
      解除合同: "TERMINATION",
      payment: "PAY_PRINCIPAL",
      penalty: "PAY_PENALTY",
      costs: "LITIGATION_COST",
      compensation: "PAY_DAMAGES",
    };
    return typeMap[type] || "OTHER";
  }
  /**
   * 金额处理
   */
  processAmounts(claims) {
    return claims.map((claim) => {
      if (claim.amount) {
        return {
          ...claim,
          amount: this.normalizeAmount(claim.amount),
        };
      }
      return claim;
    });
  }
  /**
   * 金额标准化
   */
  normalizeAmount(amount) {
    if (typeof amount === "number") {
      return amount;
    }
    if (typeof amount === "string") {
      // 移除逗号分隔符
      let normalized = amount.replace(/,/g, "");
      // 处理中文数字
      const chineseNumbers = {
        零: 0,
        一: 1,
        二: 2,
        三: 3,
        四: 4,
        五: 5,
        六: 6,
        七: 7,
        八: 8,
        九: 9,
        十: 10,
        百: 100,
        千: 1000,
        万: 10000,
        亿: 100000000,
        壹: 1,
        贰: 2,
        叁: 3,
        肆: 4,
        伍: 5,
        陆: 6,
        柒: 7,
        捌: 8,
        玖: 9,
        拾: 10,
        佰: 100,
        仟: 1000,
        圆: 1,
        元: 1,
      };
      // 简单的中文数字转换
      let result = 0;
      let temp = 0;
      for (const char of normalized) {
        if (chineseNumbers[char]) {
          if (chineseNumbers[char] >= 10) {
            result += temp * chineseNumbers[char];
            temp = 0;
          } else {
            temp = temp * 10 + chineseNumbers[char];
          }
        }
      }
      result += temp;
      // 如果没有中文数字，直接解析
      if (result === 0) {
        const match = normalized.match(/[\d.]+/);
        if (match) {
          result = parseFloat(match[0]);
        }
      }
      return result;
    }
    return 0;
  }
  // =============================================================================
  // 工具方法
  // =============================================================================
  validateInput(input) {
    if (!input.documentId || input.documentId.trim().length === 0) {
      throw new errors_1.ValidationError(
        "文档ID不能为空",
        "documentId",
        input.documentId,
      );
    }
    // 如果提供了filePath，则验证它；如果提供了content，则允许filePath为空
    if (input.filePath && input.filePath.trim().length > 0) {
      // 使用安全工具验证文件路径
      file_utils_1.SecureFileUtils.validateFilePath(input.filePath);
    } else if (!input.content) {
      throw new errors_1.ValidationError(
        "文件路径和内容不能都为空",
        "filePath",
        input.filePath,
      );
    }
    const supportedTypes = ["PDF", "DOCX", "DOC", "TXT", "IMAGE"];
    if (!supportedTypes.includes(input.fileType)) {
      throw new errors_1.ValidationError(
        `不支持的文档格式: ${input.fileType}，支持的格式: ${supportedTypes.join(", ")}`,
        "fileType",
        input.fileType,
      );
    }
  }
  async getFileSizeSecurely(filePath) {
    return await file_utils_1.SecureFileUtils.getFileSizeSecurely(filePath);
  }
  countWords(text) {
    // 优化词数统计，避免重复计算
    if (!text || text.trim().length === 0) return 0;
    // 中英文混合词数统计
    const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
    const englishWords = (text.match(/[a-zA-Z]+/g) || []).length;
    const numbers = (text.match(/\d+/g) || []).length;
    return chineseChars + englishWords + numbers;
  }
  estimateTokenUsage(text) {
    if (!text) return 0;
    const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
    const otherChars = text.length - chineseChars;
    return Math.ceil(chineseChars / 1.5 + otherChars / 4);
  }
}
exports.DocAnalyzerAgentOptimized = DocAnalyzerAgentOptimized;
exports.DocAnalyzerAgent = DocAnalyzerAgentOptimized;
