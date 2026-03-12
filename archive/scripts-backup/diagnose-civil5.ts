import { DocAnalyzerAgent } from '../src/lib/agent/doc-analyzer';
import { AIProcessor } from '../src/lib/agent/doc-analyzer/processors/ai-processor';
import { DEFAULT_CONFIG } from '../src/lib/agent/doc-analyzer/core/constants';
import {
  DocumentAnalysisOutput,
  Party,
} from '../src/lib/agent/doc-analyzer/core/types';
import { AgentContext, TaskPriority } from '../src/types/agent';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

async function main() {
  console.log('🔍 诊断civil-5文档的当事人识别问题\n');

  // 从accuracy-test-set.json加载测试数据
  const testSetFile = join(__dirname, '../test-data/accuracy-test-set.json');
  if (!existsSync(testSetFile)) {
    console.error('❌ 测试数据集不存在');
    return;
  }

  const testSet = JSON.parse(readFileSync(testSetFile, 'utf-8'));
  const testDocs = [
    { id: 'civil-1', filePath: testSet.documents[0]?.filePath },
    { id: 'civil-5', filePath: testSet.documents[4]?.filePath },
  ].filter(doc => doc.filePath && existsSync(doc.filePath));

  if (testDocs.length === 0) {
    console.error('❌ 未找到可用的测试文档');
    return;
  }

  for (const testDoc of testDocs) {
    console.log('\n' + '='.repeat(70));
    console.log(`📄 测试文档: ${testDoc.id}`);
    console.log('='.repeat(70));

    const originalText = readFileSync(testDoc.filePath, 'utf-8');
    console.log('\n📄 文档内容预览（前500字）：');
    console.log(originalText.substring(0, 500));

    // 测试1：直接AI提取
    console.log('\n【测试1】直接AI提取（跳过所有后续处理）');
    const aiProcessor = new AIProcessor(DEFAULT_CONFIG, false);
    aiProcessor.forceUseRealAI();
    const aiResult = await aiProcessor.process(originalText);

    console.log('  当事人数量:', aiResult.extractedData.parties?.length || 0);
    console.log('  诉讼请求数量:', aiResult.extractedData.claims?.length || 0);
    if (aiResult.extractedData.parties?.length > 0) {
      console.log('  提取的当事人：');
      aiResult.extractedData.parties.forEach((p: Party, i: number) => {
        console.log(`    ${i + 1}. ${p.name} (${p.type})`);
      });
    }

    // 测试2：完整流程
    console.log('\n【测试2】完整DocAnalyzerAgent流程');
    const agent = new DocAnalyzerAgent();
    await agent.initialize();
    agent.disableCache();

    const context: AgentContext = {
      task: 'document_analysis',
      taskType: 'document_parse',
      priority: TaskPriority.HIGH,
      data: {
        documentId: testDoc.id,
        filePath: testDoc.filePath,
        fileType: 'txt',
        options: {
          extractParties: true,
          extractClaims: true,
        },
      },
      metadata: {
        documentId: testDoc.id,
        fileType: 'txt',
        timestamp: new Date().toISOString(),
      },
    };

    const agentResult = await agent.execute(context);

    if (agentResult.success) {
      const extractedData = (agentResult.data as DocumentAnalysisOutput)
        .extractedData;
      console.log('  当事人数量:', extractedData.parties?.length || 0);
      console.log('  诉讼请求数量:', extractedData.claims?.length || 0);
      if (extractedData.parties?.length > 0) {
        console.log('  提取的当事人：');
        extractedData.parties.forEach((p: Party, i: number) => {
          console.log(`    ${i + 1}. ${p.name} (${p.type})`);
        });
      }

      // 对比
      console.log('\n【对比分析】');
      const aiCount = aiResult.extractedData.parties?.length || 0;
      const agentCount = extractedData.parties?.length || 0;

      if (aiCount === agentCount && aiCount > 0) {
        console.log('  ✅ 完整流程与直接AI提取结果一致');
      } else if (aiCount > agentCount) {
        console.log(`  ⚠️ 完整流程丢失了${aiCount - agentCount}个当事人`);
      } else if (agentCount > aiCount) {
        console.log(
          `  ℹ️ 完整流程比直接AI提取多了${agentCount - aiCount}个当事人（算法兜底补充）`
        );
      } else {
        console.log('  ❌ 两者都未提取到当事人');
      }
    } else {
      console.log('  ❌ 分析失败:', agentResult.error?.message);
    }

    await agent.cleanup();
  }

  console.log('\n' + '='.repeat(70));
  console.log('✅ 诊断完成');
}

main().catch(console.error);
