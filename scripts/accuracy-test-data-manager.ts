import { PrismaClient } from "@prisma/client";
import { writeFileSync, mkdirSync, existsSync, readFileSync } from "fs";
import { join } from "path";
import { getUnifiedAIService } from "../src/lib/ai/unified-service";

const prisma = new PrismaClient();

// =============================================================================
// 测试数据集管理工具
// 用于管理准确性测试的测试文档和黄金标准标注
// =============================================================================

interface TestDocument {
  id: string;
  filePath: string;
  fileName: string;
  fileType: string;
  caseType: string;
  goldStandard?: {
    parties: Array<{
      type: "plaintiff" | "defendant" | "other";
      name: string;
      role?: string;
      contact?: string;
      address?: string;
    }>;
    claims: Array<{
      type: string;
      content: string;
      amount?: number;
      evidence?: string[];
      legalBasis?: string;
    }>;
    amount?: number;
    caseType?: string;
  };
  description: string;
}

interface DatabaseDocument {
  id: string;
  filename: string;
  fileType: string;
  case?: {
    title?: string;
    type?: string;
    description?: string;
  };
  extractedData?: Record<string, unknown>;
}

interface DocumentTemplate {
  plaintiff?: string;
  defendant?: string;
  claimType?: string;
  amount?: number;
  charge?: string;
  victim?: string;
  description: string;
}

class AccuracyTestDataManager {
  private testDataDir: string;
  private testSetFile: string;

  constructor() {
    this.testDataDir = join(__dirname, "../test-data/accuracy-test-set");
    this.testSetFile = join(__dirname, "../test-data/accuracy-test-set.json");
    this.ensureDirectories();
  }

  /**
   * 确保目录存在
   */
  private ensureDirectories(): void {
    if (!existsSync(this.testDataDir)) {
      mkdirSync(this.testDataDir, { recursive: true });
      console.log(`✅ 创建测试数据目录: ${this.testDataDir}`);
    }
  }

  /**
   * 从数据库导出文档到测试数据集
   */
  async exportDocumentsFromDatabase(limit: number = 50): Promise<void> {
    console.log(`📥 开始从数据库导出文档（最多${limit}个）...`);

    const documents = await prisma.document.findMany({
      take: limit,
      include: {
        case: {
          select: {
            title: true,
            type: true,
            description: true,
          },
        },
      },
    });

    console.log(`📄 找到 ${documents.length} 个文档`);

    const testDocuments: TestDocument[] = [];

    for (const doc of documents) {
      const testId = `db-export-${doc.id.slice(0, 8)}`;
      const testFileName = `${testId}-${doc.filename}`;
      const testFilePath = join(this.testDataDir, testFileName);

      // 模拟文档内容（因为实际文件可能不存在）
      const content = this.generateSimulatedDocument(
        doc as unknown as DatabaseDocument,
      );

      writeFileSync(testFilePath, content, "utf-8");

      testDocuments.push({
        id: testId,
        filePath: testFilePath,
        fileName: testFileName,
        fileType: doc.fileType,
        caseType: doc.case?.type || "OTHER",
        description: `数据库导出: ${doc.case?.title || doc.filename}`,
        goldStandard: this.extractGoldStandardFromData(
          doc as unknown as DatabaseDocument,
        ),
      });

      console.log(`  ✅ 导出: ${testFileName}`);
    }

    this.saveTestSet(testDocuments);
    console.log(`\n✅ 导出完成，共 ${testDocuments.length} 个文档`);
  }

  /**
   * 生成模拟文档内容
   */
  private generateSimulatedDocument(doc: DatabaseDocument): string {
    const caseData = doc.case;
    const extractedData = doc.extractedData || {};

    const content = `民事起诉状

原告：${extractedData.parties?.[0] || "张三"}
性别：男
民族：汉族
出生日期：1980年5月10日
职业：软件工程师
住址：北京市朝阳区建国门外大街1号
联系电话：13800138000

被告：${extractedData.parties?.[1] || "某科技公司"}
住所地：北京市海淀区中关村大街2号
法定代表人：李四
联系电话：13900139000

诉讼请求：
1. 请求判令被告赔偿原告损失人民币500,000元；
2. 请求判令被告承担本案全部诉讼费用。

事实与理由：
${caseData?.description || "原告与被告之间存在纠纷，被告未履行相关义务，给原告造成重大损失。为维护原告合法权益，特向贵院提起诉讼。"}

此致
北京市朝阳区人民法院

附：起诉状副本1份
证据清单1份

具状人：${extractedData.parties?.[0] || "张三"}
日期：2024年1月1日
`;

    return content;
  }

  /**
   * 从提取数据中提取黄金标准
   */
  private extractGoldStandardFromData(
    doc: DatabaseDocument,
  ): TestDocument["goldStandard"] {
    const extractedData = (doc.extractedData || {}) as Record<string, unknown>;
    const parties = (extractedData.parties as string[]) || [];

    return {
      parties: parties.slice(0, 2).map((name: string, index: number) => ({
        type: index === 0 ? "plaintiff" : "defendant",
        name,
      })),
      claims: [
        {
          type: "赔偿",
          content: "请求判令被告赔偿原告损失人民币500,000元",
          amount: 500000,
          evidence: ["合同原件", "银行转账记录"],
          legalBasis: "民法典相关规定",
        },
      ],
      amount: 500000,
      caseType: doc.case?.type,
    };
  }

  /**
   * 创建多样化测试文档
   */
  async createDiverseTestDocuments(): Promise<void> {
    console.log("📝 开始创建多样化测试文档...");

    const templates = this.getDocumentTemplates();
    const testDocuments: TestDocument[] = [];

    // 民事案件（15个）
    for (let i = 1; i <= 15; i++) {
      const template = templates.civil[i % templates.civil.length];
      const doc = this.createDocumentFromTemplate(
        template,
        `civil-${i}`,
        "CIVIL",
      );
      testDocuments.push(doc);
    }

    // 刑事案件（10个）
    for (let i = 1; i <= 10; i++) {
      const template = templates.criminal[i % templates.criminal.length];
      const doc = this.createDocumentFromTemplate(
        template,
        `criminal-${i}`,
        "CRIMINAL",
      );
      testDocuments.push(doc);
    }

    // 行政诉讼（10个）
    for (let i = 1; i <= 10; i++) {
      const template =
        templates.administrative[i % templates.administrative.length];
      const doc = this.createDocumentFromTemplate(
        template,
        `admin-${i}`,
        "ADMINISTRATIVE",
      );
      testDocuments.push(doc);
    }

    // 商事纠纷（10个）
    for (let i = 1; i <= 10; i++) {
      const template = templates.commercial[i % templates.commercial.length];
      const doc = this.createDocumentFromTemplate(
        template,
        `commercial-${i}`,
        "COMMERCIAL",
      );
      testDocuments.push(doc);
    }

    // 其他类型（5个）
    for (let i = 1; i <= 5; i++) {
      const template = templates.other[i % templates.other.length];
      const doc = this.createDocumentFromTemplate(
        template,
        `other-${i}`,
        "OTHER",
      );
      testDocuments.push(doc);
    }

    // 保存文档
    for (const doc of testDocuments) {
      writeFileSync(doc.filePath, this.generateDocumentContent(doc), "utf-8");
    }

    this.saveTestSet(testDocuments);
    console.log(`✅ 创建完成，共 ${testDocuments.length} 个测试文档`);
  }

  /**
   * 获取文档模板
   */
  private getDocumentTemplates(): Record<string, DocumentTemplate[]> {
    return {
      civil: [
        {
          plaintiff: "王小红",
          defendant: "张大伟",
          claimType: "payment",
          amount: 800000,
          description: "货款纠纷",
        },
        {
          plaintiff: "刘明",
          defendant: "北京某科技公司",
          claimType: "compensation",
          amount: 1200000,
          description: "违约金纠纷",
        },
        {
          plaintiff: "陈芳",
          defendant: "李强",
          claimType: "restitution",
          amount: 350000,
          description: "不当得利纠纷",
        },
      ],
      criminal: [
        {
          defendant: "王某",
          charge: "盗窃罪",
          victim: "张某",
          description: "盗窃罪案件",
        },
        {
          defendant: "李某",
          charge: "诈骗罪",
          victim: "某公司",
          description: "诈骗罪案件",
        },
        {
          defendant: "赵某",
          charge: "故意伤害罪",
          victim: "孙某",
          description: "故意伤害罪案件",
        },
      ],
      administrative: [
        {
          plaintiff: "某公司",
          defendant: "某政府部门",
          claimType: "revoke",
          description: "行政处罚纠纷",
        },
        {
          plaintiff: "张某",
          defendant: "某行政机关",
          claimType: "disclosure",
          description: "政府信息公开",
        },
      ],
      commercial: [
        {
          plaintiff: "A公司",
          defendant: "B公司",
          claimType: "breach",
          amount: 5000000,
          description: "商业合同纠纷",
        },
        {
          plaintiff: "C公司",
          defendant: "D公司",
          claimType: "infringement",
          amount: 2000000,
          description: "知识产权纠纷",
        },
      ],
      other: [
        {
          plaintiff: "原告",
          defendant: "被告",
          claimType: "general",
          description: "其他纠纷",
        },
      ],
    };
  }

  /**
   * 从模板创建文档
   */
  private createDocumentFromTemplate(
    template: DocumentTemplate,
    id: string,
    caseType: string,
  ): TestDocument {
    const fileName = `${id}.txt`;
    const filePath = join(this.testDataDir, fileName);

    const goldStandard: TestDocument["goldStandard"] = {
      parties: [],
      claims: [],
      caseType,
    };

    if (template.plaintiff) {
      goldStandard.parties.push({
        type: "plaintiff",
        name: template.plaintiff,
      });
    }

    if (template.defendant) {
      goldStandard.parties.push({
        type: "defendant",
        name: template.defendant,
      });
    }

    if (template.amount) {
      goldStandard.amount = template.amount;
      goldStandard.claims.push({
        type: template.claimType || "赔偿",
        content: `请求判令被告${template.claimType || "赔偿"}人民币${template.amount.toLocaleString()}元`,
        amount: template.amount,
      });
    } else if (template.charge) {
      goldStandard.claims.push({
        type: template.charge,
        content: `指控${template.defendant}犯${template.charge}`,
      });
    }

    return {
      id,
      filePath,
      fileName,
      fileType: "TXT",
      caseType,
      description: template.description,
      goldStandard,
    };
  }

  /**
   * 生成文档内容
   */
  private generateDocumentContent(doc: TestDocument): string {
    const gs = doc.goldStandard;
    if (!gs) return "测试文档内容";

    let content = "";

    if (doc.caseType === "CRIMINAL") {
      const defendant = gs.parties.find((p) => p.type === "defendant");
      content += `起诉书

被告人：${defendant?.name || "被告人"}
性别：男
民族：汉族
出生日期：1985年3月15日
职业：无业
住址：北京市朝阳区某某街道

案由：${gs.claims[0]?.type || "涉嫌犯罪"}

犯罪事实：
被告人${defendant?.name || "被告人"}于2023年期间，
${gs.claims[0]?.content || "实施犯罪行为"}。

此致
北京市朝阳区人民法院

北京市人民检察院第二分院
日期：2024年1月1日
`;
    } else {
      const plaintiff = gs.parties.find((p) => p.type === "plaintiff");
      const defendant = gs.parties.find((p) => p.type === "defendant");

      content += `${
        doc.caseType === "ADMINISTRATIVE" ? "行政起诉状" : "民事起诉状"
      }

${
  plaintiff
    ? `原告：${plaintiff.name}
性别：${plaintiff.role || "男"}
民族：汉族
职业：${plaintiff.contact || "职员"}
住址：${plaintiff.address || "北京市朝阳区某某街道"}
联系电话：${plaintiff.contact || "13800138000"}

`
    : ""
}${
        defendant
          ? `被告：${defendant.name}
住所地：${defendant.address || "北京市海淀区某某街道"}
法定代表人：${defendant.role || "李四"}
联系电话：${defendant.contact || "13900139000"}

`
          : ""
      }诉讼请求：\n`;
      gs.claims.forEach((claim, index) => {
        content += `${index + 1}. ${claim.content};\n`;
      });
      content += `\n事实与理由：\n${doc.description}\n\n此致\n北京市${doc.caseType === "ADMINISTRATIVE" ? "海淀区" : "朝阳区"}人民法院\n\n具状人：${plaintiff?.name || "原告"}\n日期：2024年1月1日\n`;
    }

    return content;
  }

  /**
   * 使用AI辅助标注黄金标准
   */
  async aiAssistLabeling(testDocuments: TestDocument[]): Promise<void> {
    console.log("🤖 开始AI辅助标注...");

    const unifiedService = await getUnifiedAIService();

    for (const doc of testDocuments) {
      if (doc.goldStandard) continue; // 已有标注的跳过

      console.log(`  正在标注: ${doc.fileName}`);

      try {
        const content = readFileSync(doc.filePath, "utf-8");

        const response = await unifiedService.chatCompletion({
          model: "glm-4-flash",
          provider: "zhipu",
          messages: [
            {
              role: "system",
              content: `你是一个专业的法律文档标注专家。请仔细阅读文档，提取关键信息，并以JSON格式返回。

返回格式：
{
  "parties": [
    {
      "type": "plaintiff" | "defendant" | "other",
      "name": "当事人姓名",
      "role": "角色（可选）",
      "contact": "联系方式（可选）",
      "address": "地址（可选）"
    }
  ],
  "claims": [
    {
      "type": "请求类型",
      "content": "请求内容",
      "amount": 金额数字（如果有）,
      "evidence": ["证据1", "证据2"],
      "legalBasis": "法律依据"
    }
  ],
  "amount": 总金额数字（如果有）,
  "caseType": "案件类型"
}

请严格按照JSON格式返回，不要包含任何说明文字。`,
            },
            {
              role: "user",
              content: `请标注以下法律文档：

${content}`,
            },
          ],
          temperature: 0.1,
          maxTokens: 2000,
        });

        const aiResponse = response.choices[0].message.content;
        const goldStandard = this.parseAILabelingResponse(aiResponse);

        if (goldStandard) {
          doc.goldStandard = goldStandard;
          console.log(`    ✅ 标注完成`);
        }
      } catch (error) {
        console.error(`    ❌ 标注失败: ${error}`);
      }
    }

    this.saveTestSet(testDocuments);
    console.log("✅ AI辅助标注完成");
  }

  /**
   * 解析AI标注响应
   */
  private parseAILabelingResponse(
    response: string,
  ): TestDocument["goldStandard"] | null {
    try {
      let cleanedResponse = response.trim();

      // 移除代码块标记
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

      const parsed = JSON.parse(cleanedResponse);
      return parsed as TestDocument["goldStandard"];
    } catch (error) {
      console.error("解析AI标注响应失败:", error);
      return null;
    }
  }

  /**
   * 保存测试集
   */
  private saveTestSet(testDocuments: TestDocument[]): void {
    const testSet = {
      version: "1.0",
      createdAt: new Date().toISOString(),
      totalDocuments: testDocuments.length,
      documents: testDocuments,
    };

    writeFileSync(this.testSetFile, JSON.stringify(testSet, null, 2));
    console.log(`💾 测试集已保存至: ${this.testSetFile}`);
  }

  /**
   * 加载测试集
   */
  loadTestSet(): TestDocument[] {
    if (!existsSync(this.testSetFile)) {
      return [];
    }

    const content = JSON.parse(readFileSync(this.testSetFile, "utf-8"));
    return content.documents || [];
  }

  /**
   * 统计测试集
   */
  async showStatistics(): Promise<void> {
    const testDocuments = this.loadTestSet();

    if (testDocuments.length === 0) {
      console.log("❌ 测试集为空，请先创建测试文档");
      return;
    }

    console.log("\n📊 测试集统计:\n");
    console.log(`总文档数: ${testDocuments.length}`);

    const caseTypeStats: Record<string, number> = {};
    testDocuments.forEach((doc) => {
      caseTypeStats[doc.caseType] = (caseTypeStats[doc.caseType] || 0) + 1;
    });

    console.log("\n按案件类型分布:");
    Object.entries(caseTypeStats).forEach(([type, count]) => {
      console.log(`  ${type}: ${count}个`);
    });

    const labeledCount = testDocuments.filter((doc) => doc.goldStandard).length;
    console.log(`\n已标注文档: ${labeledCount}/${testDocuments.length}`);
  }
}

// =============================================================================
// 主函数
// =============================================================================

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const manager = new AccuracyTestDataManager();

  try {
    switch (command) {
      case "export":
        const limit = args[1] ? parseInt(args[1]) : 50;
        await manager.exportDocumentsFromDatabase(limit);
        break;

      case "create":
        await manager.createDiverseTestDocuments();
        break;

      case "label":
        const testDocs = manager.loadTestSet();
        await manager.aiAssistLabeling(testDocs);
        break;

      case "stats":
        await manager.showStatistics();
        break;

      default:
        console.log(`
📚 测试数据集管理工具

使用方法:
  npm run test-data-manager -- export [limit]    从数据库导出文档
  npm run test-data-manager -- create           创建多样化测试文档
  npm run test-data-manager -- label            AI辅助标注
  npm run test-data-manager -- stats            显示统计信息

示例:
  npm run test-data-manager -- export 50
  npm run test-data-manager -- create
  npm run test-data-manager -- label
        `);
    }
  } catch (error) {
    console.error("❌ 执行失败:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main();
}

export type { TestDocument };
export { AccuracyTestDataManager };
