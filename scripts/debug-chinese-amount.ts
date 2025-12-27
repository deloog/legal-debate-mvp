/**
 * 调试中文大写金额解析
 */

import { PrecisionAmountExtractor } from '../src/lib/extraction/amount-extractor-precision';

async function main(): Promise<void> {
  console.log('========================================');
  console.log('中文大写金额解析调试');
  console.log('========================================\n');

  const extractor = new PrecisionAmountExtractor();
  
  const testCases = [
    '伍拾万元整',
    '壹佰万元整',
    '拾万元整',
    '壹拾万元整',
    '伍万元',
    '贰万元',
    '玖万捌仟元整',
    '壹佰万',
    '伍拾万'
  ];

  for (const testCase of testCases) {
    console.log(`测试文本: "${testCase}"`);
    const results = await extractor.extractWithPrecision(testCase);
    
    if (results.length > 0) {
      console.log(`  解析结果:`);
      for (const result of results) {
        console.log(`    - 原文: ${result.originalText}`);
        console.log(`    - 金额: ${result.normalizedAmount}`);
        console.log(`    - 置信度: ${result.confidence}`);
        console.log(`    - 方法: ${result.extractionMethod}`);
        if (result.processingNotes.length > 0) {
          console.log(`    - 说明: ${result.processingNotes.join(', ')}`);
        }
      }
    } else {
      console.log(`  未解析到金额`);
    }
    console.log('');
  }
}

main().catch(console.error);
