#!/usr/bin/env npx tsx

/**
 * AI提供商POC验证脚本
 * 
 * 测试智谱清言、DeepSeek和法律之星三个AI提供商的API功能
 * 记录响应时间、成本和性能指标
 */

import { config } from 'dotenv';
import { getUnifiedAIService } from '../src/lib/ai/unified-service';
import { validateAIConfig } from '../src/lib/ai/config';
import { validateLawStarConfig } from '../src/lib/ai/lawstar-config';
import { getAIConfig } from '../src/lib/ai/config';

// 加载环境变量
config();

// 确保使用开发环境配置
process.env.NODE_ENV = 'development';

// =============================================================================
// 测试数据定义
// =============================================================================

const TEST_CASES = {
  // 测试文档：房屋买卖合同纠纷
  contractDispute: `原告张三与被告李四于2023年1月1日签订房屋买卖合同，约定李四将位于北京市朝阳区的房屋以500万元价格出售给张三。
合同签订后，张三支付了100万元定金，但李四未按约定时间办理过户手续，构成违约。
张三要求解除合同，返还定金并赔偿损失。李四辩称房屋价格上涨，要求张三增加购房款。
双方协商未果，张三遂向法院提起诉讼。`,

  // 测试案件信息
  testCase: {
    title: '房屋买卖合同纠纷',
    description: '买方支付定金后卖方违约不办理过户，要求解除合同并赔偿损失',
    legalReferences: ['《民法典》第577条', '《民法典》第587条']
  },

  // 测试查询
  testQueries: {
    keyword: '合同违约',
    semanticQuery: '房屋买卖合同买方违约如何处理',
    lawType: '民法',
    topK: 5
  }
};

// =============================================================================
// 性能记录接口
// =============================================================================

interface PerformanceMetrics {
  provider: string;
  function: string;
  startTime: number;
  endTime: number;
  duration: number;
  success: boolean;
  error?: string;
  tokens?: number;
  cost?: number;
}

interface POCResults {
  configValidation: {
    ai: { valid: boolean; errors: string[] };
    lawstar: { valid: boolean; errors: string[] };
  };
  tests: PerformanceMetrics[];
  summary: {
    totalTests: number;
    successCount: number;
    failureCount: number;
    averageResponseTime: number;
    estimatedCosts: { [provider: string]: number };
  };
}

// =============================================================================
// 工具函数
// =============================================================================

function recordMetric(
  provider: string,
  func: string,
  startTime: number,
  endTime: number,
  success: boolean,
  error?: string,
  tokens?: number,
  cost?: number
): PerformanceMetrics {
  return {
    provider,
    function: func,
    startTime,
    endTime,
    duration: endTime - startTime,
    success,
    error,
    tokens,
    cost
  };
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function estimateTokens(text: string): number {
  // 简单估算：中文字符数 + 英文单词数 * 1.3
  const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length;
  const englishWords = (text.match(/[a-zA-Z]+/g) || []).length;
  return Math.ceil(chineseChars + englishWords * 1.3);
}

// =============================================================================
// 测试函数
// =============================================================================

async function testConfigValidation(): Promise<POCResults['configValidation']> {
  console.log('🔧 验证配置文件...');
  
  // 调试：输出环境变量
  console.log('环境变量调试:');
  console.log('ZHIPU_API_KEY:', process.env.ZHIPU_API_KEY ? '已设置' : '未设置');
  console.log('DEEPSEEK_API_KEY:', process.env.DEEPSEEK_API_KEY ? '已设置' : '未设置');
  console.log('NODE_ENV:', process.env.NODE_ENV);
  
  // 调试：输出实际配置
  const config = getAIConfig();
  console.log('\n实际配置信息:');
  console.log('客户端数量:', config.clients.length);
  config.clients.forEach((client, index) => {
    console.log(`客户端 ${index + 1}:`);
    console.log(`  提供商: ${client.provider}`);
    console.log(`  API密钥: ${client.apiKey ? '已设置' : '未设置'}`);
    console.log(`  API密钥长度: ${client.apiKey?.length || 0}`);
  });
  
  const aiValidation = validateAIConfig();
  const lawstarValidation = validateLawStarConfig();
  
  console.log('\n验证结果:');
  console.log('AI配置验证:', aiValidation.valid ? '✅ 通过' : '❌ 失败');
  if (!aiValidation.valid) {
    console.log('AI配置错误:', aiValidation.errors);
  }
  
  console.log('法律之星配置验证:', lawstarValidation.valid ? '✅ 通过' : '❌ 失败');
  if (!lawstarValidation.valid) {
    console.log('法律之星配置错误:', lawstarValidation.errors);
  }
  
  return {
    ai: aiValidation,
    lawstar: lawstarValidation
  };
}

async function testZhipuDocumentParsing(aiService: any): Promise<PerformanceMetrics[]> {
  console.log('📝 测试智谱清言文档解析API...');
  const metrics: PerformanceMetrics[] = [];
  const startTime = Date.now();
  
  try {
    const response = await aiService.parseDocument(TEST_CASES.contractDispute, {
      extractKeyInfo: true,
      identifyLegalIssues: true
    });
    
    const endTime = Date.now();
    const tokens = estimateTokens(TEST_CASES.contractDispute + JSON.stringify(response));
    
    metrics.push(recordMetric(
      '智谱清言',
      '文档解析',
      startTime,
      endTime,
      true,
      undefined,
      tokens,
      tokens * 0.00001 // 简单成本估算
    ));
    
    console.log(`✅ 文档解析成功，响应时间: ${formatDuration(endTime - startTime)}`);
    console.log(`   提取内容长度: ${response.choices[0].message.content.length} 字符`);
    
  } catch (error) {
    const endTime = Date.now();
    const errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
    metrics.push(recordMetric(
      '智谱清言',
      '文档解析',
      startTime,
      endTime,
      false,
      errorMessage
    ));
    
    console.log(`❌ 文档解析失败: ${errorMessage}`);
  }
  
  return metrics;
}

async function testDeepSeekDebateGeneration(aiService: any): Promise<PerformanceMetrics[]> {
  console.log('🗣️ 测试DeepSeek辩论生成API...');
  const metrics: PerformanceMetrics[] = [];
  const startTime = Date.now();
  
  try {
    const response = await aiService.generateDebate(TEST_CASES.testCase);
    
    const endTime = Date.now();
    const tokens = estimateTokens(
      JSON.stringify(TEST_CASES.testCase) + 
      JSON.stringify(response.choices[0].message.content)
    );
    
    metrics.push(recordMetric(
      'DeepSeek',
      '辩论生成',
      startTime,
      endTime,
      true,
      undefined,
      tokens,
      tokens * 0.00001 // 简单成本估算
    ));
    
    console.log(`✅ 辩论生成成功，响应时间: ${formatDuration(endTime - startTime)}`);
    console.log(`   生成内容长度: ${response.choices[0].message.content.length} 字符`);
    
  } catch (error) {
    const endTime = Date.now();
    const errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
    metrics.push(recordMetric(
      'DeepSeek',
      '辩论生成',
      startTime,
      endTime,
      false,
      errorMessage
    ));
    
    console.log(`❌ 辩论生成失败: ${errorMessage}`);
  }
  
  return metrics;
}

async function testLawStarRegulationSearch(aiService: any): Promise<PerformanceMetrics[]> {
  console.log('⚖️ 测试法律之星法规查询API...');
  const metrics: PerformanceMetrics[] = [];
  const startTime = Date.now();
  
  try {
    const response = await aiService.searchLegalRegulations({
      keyword: TEST_CASES.testQueries.keyword,
      lawType: TEST_CASES.testQueries.lawType,
      pageSize: TEST_CASES.testQueries.topK
    });
    
    const endTime = Date.now();
    
    metrics.push(recordMetric(
      '法律之星',
      '法规查询',
      startTime,
      endTime,
      true,
      undefined,
      undefined,
      0.01 // 假设每次调用0.01元
    ));
    
    console.log(`✅ 法规查询成功，响应时间: ${formatDuration(endTime - startTime)}`);
    console.log(`   返回结果数量: ${response.data.lawdata.length} 条`);
    
  } catch (error) {
    const endTime = Date.now();
    const errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
    metrics.push(recordMetric(
      '法律之星',
      '法规查询',
      startTime,
      endTime,
      false,
      errorMessage
    ));
    
    console.log(`❌ 法规查询失败: ${errorMessage}`);
  }
  
  return metrics;
}

async function testLawStarVectorSearch(aiService: any): Promise<PerformanceMetrics[]> {
  console.log('🔍 测试法律之星向量查询API...');
  const metrics: PerformanceMetrics[] = [];
  const startTime = Date.now();
  
  try {
    const response = await aiService.searchLegalByVector({
      query: TEST_CASES.testQueries.semanticQuery,
      lawType: TEST_CASES.testQueries.lawType,
      topK: TEST_CASES.testQueries.topK
    });
    
    const endTime = Date.now();
    
    metrics.push(recordMetric(
      '法律之星',
      '向量查询',
      startTime,
      endTime,
      true,
      undefined,
      undefined,
      0.01 // 假设每次调用0.01元
    ));
    
    console.log(`✅ 向量查询成功，响应时间: ${formatDuration(endTime - startTime)}`);
    console.log(`   返回匹配数量: ${response.data.result.length} 条`);
    
  } catch (error) {
    const endTime = Date.now();
    const errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
    metrics.push(recordMetric(
      '法律之星',
      '向量查询',
      startTime,
      endTime,
      false,
      errorMessage
    ));
    
    console.log(`❌ 向量查询失败: ${errorMessage}`);
  }
  
  return metrics;
}

async function testSmartLegalSearch(aiService: any): Promise<PerformanceMetrics[]> {
  console.log('🧠 测试智能法律检索（关键词+语义）...');
  const metrics: PerformanceMetrics[] = [];
  const startTime = Date.now();
  
  try {
    const response = await aiService.smartLegalSearch({
      keyword: TEST_CASES.testQueries.keyword,
      semanticQuery: TEST_CASES.testQueries.semanticQuery,
      lawType: TEST_CASES.testQueries.lawType,
      topK: TEST_CASES.testQueries.topK
    });
    
    const endTime = Date.now();
    
    metrics.push(recordMetric(
      '法律之星',
      '智能检索',
      startTime,
      endTime,
      true,
      undefined,
      undefined,
      0.02 // 假设每次调用0.02元（两个查询）
    ));
    
    console.log(`✅ 智能检索成功，响应时间: ${formatDuration(endTime - startTime)}`);
    console.log(`   关键词结果: ${response.keywordResults?.data.lawdata.length || 0} 条`);
    console.log(`   语义结果: ${response.semanticResults?.data.result.length || 0} 条`);
    console.log(`   合并去重后: ${response.combined.length} 条`);
    
  } catch (error) {
    const endTime = Date.now();
    const errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
    metrics.push(recordMetric(
      '法律之星',
      '智能检索',
      startTime,
      endTime,
      false,
      errorMessage
    ));
    
    console.log(`❌ 智能检索失败: ${errorMessage}`);
  }
  
  return metrics;
}

async function testCompleteCaseAnalysis(aiService: any): Promise<PerformanceMetrics[]> {
  console.log('🎯 测试完整案件分析流程...');
  const metrics: PerformanceMetrics[] = [];
  const startTime = Date.now();
  
  try {
    const response = await aiService.analyzeCaseComplete({
      content: TEST_CASES.contractDispute,
      title: TEST_CASES.testCase.title
    });
    
    const endTime = Date.now();
    
    metrics.push(recordMetric(
      '统一AI服务',
      '完整分析',
      startTime,
      endTime,
      true,
      undefined,
      undefined,
      0.1 // 假设每次完整分析0.1元
    ));
    
    console.log(`✅ 完整分析成功，响应时间: ${formatDuration(endTime - startTime)}`);
    console.log(`   文档分析: ${response.documentAnalysis.choices[0].message.content.length} 字符`);
    console.log(`   法律依据: ${response.legalReferences.combined.length} 条`);
    console.log(`   辩论论点: ${response.debatePoints.choices[0].message.content.length} 字符`);
    
  } catch (error) {
    const endTime = Date.now();
    const errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
    metrics.push(recordMetric(
      '统一AI服务',
      '完整分析',
      startTime,
      endTime,
      false,
      errorMessage
    ));
    
    console.log(`❌ 完整分析失败: ${errorMessage}`);
  }
  
  return metrics;
}

// =============================================================================
// 主函数
// =============================================================================

async function main(): Promise<void> {
  console.log('🚀 开始AI提供商POC验证测试\n');
  console.log('='.repeat(60));
  
  const startTime = Date.now();
  const results: POCResults = {
    configValidation: { ai: { valid: false, errors: [] }, lawstar: { valid: false, errors: [] } },
    tests: [],
    summary: {
      totalTests: 0,
      successCount: 0,
      failureCount: 0,
      averageResponseTime: 0,
      estimatedCosts: {}
    }
  };
  
  try {
    // 1. 配置验证
    results.configValidation = await testConfigValidation();
    
    if (!results.configValidation.ai.valid || !results.configValidation.lawstar.valid) {
      console.log('\n❌ 配置验证失败，请检查环境变量配置');
      process.exit(1);
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('🔧 初始化统一AI服务...');
    
    // 2. 初始化AI服务
    const aiService = await getUnifiedAIService();
    
    console.log('✅ AI服务初始化成功\n');
    console.log('='.repeat(60));
    
    // 3. 执行测试
    console.log('🧪 开始功能测试...\n');
    
    // 3.1 智谱清言文档解析
    const zhipuMetrics = await testZhipuDocumentParsing(aiService);
    results.tests.push(...zhipuMetrics);
    console.log('');
    
    // 3.2 DeepSeek辩论生成
    const deepseekMetrics = await testDeepSeekDebateGeneration(aiService);
    results.tests.push(...deepseekMetrics);
    console.log('');
    
    // 3.3 法律之星法规查询
    const regulationMetrics = await testLawStarRegulationSearch(aiService);
    results.tests.push(...regulationMetrics);
    console.log('');
    
    // 3.4 法律之星向量查询
    const vectorMetrics = await testLawStarVectorSearch(aiService);
    results.tests.push(...vectorMetrics);
    console.log('');
    
    // 3.5 智能法律检索
    const smartSearchMetrics = await testSmartLegalSearch(aiService);
    results.tests.push(...smartSearchMetrics);
    console.log('');
    
    // 3.6 完整案件分析
    const completeAnalysisMetrics = await testCompleteCaseAnalysis(aiService);
    results.tests.push(...completeAnalysisMetrics);
    
  } catch (error) {
    console.log(`❌ 测试过程中发生严重错误: ${error instanceof Error ? error.message : JSON.stringify(error)}`);
    process.exit(1);
  }
  
  // 4. 生成总结报告
  const endTime = Date.now();
  
  results.summary.totalTests = results.tests.length;
  results.summary.successCount = results.tests.filter(t => t.success).length;
  results.summary.failureCount = results.tests.filter(t => !t.success).length;
  results.summary.averageResponseTime = results.tests.reduce((sum, t) => sum + t.duration, 0) / results.tests.length;
  
  // 按提供商统计成本
  results.tests.forEach(test => {
    if (test.cost) {
      results.summary.estimatedCosts[test.provider] = 
        (results.summary.estimatedCosts[test.provider] || 0) + test.cost;
    }
  });
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 POC验证测试总结报告');
  console.log('='.repeat(60));
  
  console.log(`\n📈 总体统计:`);
  console.log(`   总测试数: ${results.summary.totalTests}`);
  console.log(`   成功数: ${results.summary.successCount}`);
  console.log(`   失败数: ${results.summary.failureCount}`);
  console.log(`   成功率: ${((results.summary.successCount / results.summary.totalTests) * 100).toFixed(1)}%`);
  console.log(`   平均响应时间: ${formatDuration(results.summary.averageResponseTime)}`);
  console.log(`   总耗时: ${formatDuration(endTime - startTime)}`);
  
  console.log(`\n💰 成本估算:`);
  Object.entries(results.summary.estimatedCosts).forEach(([provider, cost]) => {
    console.log(`   ${provider}: ¥${cost.toFixed(4)}`);
  });
  const totalCost = Object.values(results.summary.estimatedCosts).reduce((sum, cost) => sum + cost, 0);
  console.log(`   总计: ¥${totalCost.toFixed(4)}`);
  
  console.log(`\n📋 详细测试结果:`);
  results.tests.forEach((test, index) => {
    const status = test.success ? '✅' : '❌';
    console.log(`   ${index + 1}. ${status} ${test.provider} - ${test.function} - ${formatDuration(test.duration)}`);
    if (test.error) {
      console.log(`      错误: ${test.error}`);
    }
    if (test.tokens) {
      console.log(`      Tokens: ${test.tokens}`);
    }
    if (test.cost) {
      console.log(`      成本: ¥${test.cost.toFixed(4)}`);
    }
  });
  
  // 5. 保存结果到文件
  const reportPath = './ai-poc-validation-report.json';
  const fs = require('fs');
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
  console.log(`\n📄 详细报告已保存到: ${reportPath}`);
  
  console.log('\n🎉 AI提供商POC验证测试完成！');
  
  // 6. 退出码
  if (results.summary.failureCount > 0) {
    console.log(`⚠️  有 ${results.summary.failureCount} 个测试失败，请检查配置和网络连接`);
    process.exit(1);
  } else {
    console.log('✅ 所有测试通过，AI服务可以正常使用');
    process.exit(0);
  }
}

// =============================================================================
// 执行主函数
// =============================================================================

if (require.main === module) {
  main().catch(error => {
    console.error('脚本执行失败:', error);
    process.exit(1);
  });
}

export { main as testAIPoc, type POCResults, type PerformanceMetrics };
