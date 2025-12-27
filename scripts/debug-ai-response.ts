import { DocumentParser } from '../src/lib/ai/document-parser';
import { readFileSync } from 'fs';
import { join } from 'path';

async function debugAIResponse() {
  console.log('🔍 开始调试AI响应...\n');

  // 读取测试文档
  const testDocumentPath = join(__dirname, '../test-data/legal-documents/sample-civil-case.txt');
  const testDocumentContent = readFileSync(testDocumentPath, 'utf-8');
  
  console.log('📄 测试文档内容:');
  console.log(testDocumentContent);
  console.log('\n---\n');

  // 创建文档解析器
  const documentParser = new DocumentParser();

  try {
    // 测试完整的文档解析流程
    console.log('🔗 发送文档解析请求...');
    const parseResult = await documentParser.parseDocument({
      documentId: 'test-doc-001',
      textContent: testDocumentContent,
      extractOptions: {
        extractParties: true,
        extractClaims: true,
        extractTimeline: false,
        generateSummary: false
      }
    });
    
    console.log('📤 文档解析结果:');
    console.log('成功:', parseResult.success);
    console.log('置信度:', parseResult.data?.confidence);
    console.log('当事人数量:', parseResult.data?.extractedData.parties.length);
    console.log('诉讼请求数量:', parseResult.data?.extractedData.claims.length);
    console.log('\n---\n');
    
    if (parseResult.success && parseResult.data) {
      console.log('✅ 解析成功! 详细数据:');
      console.log('当事人信息:');
      parseResult.data.extractedData.parties.forEach((party, index) => {
        console.log(`  ${index + 1}. ${party.type}: ${party.name} (${party.role})`);
      });
      
      console.log('\n诉讼请求:');
      parseResult.data.extractedData.claims.forEach((claim, index) => {
        console.log(`  ${index + 1}. ${claim.type}: ${claim.content.substring(0, 50)}...`);
      });
    } else {
      console.log('❌ 解析失败:', parseResult.error);
    }

  } catch (error) {
    console.error('❌ 文档解析失败:', error);
  }
}

// 执行调试
debugAIResponse().catch(console.error);
