/**
 * DocAnalyzer监控模块测试脚本
 */

import {
  DocAnalyzerMonitor,
  getDocAnalyzerMonitor,
  recordDocAnalyzerMetric,
  getDocAnalyzerTrend,
  generateDocAnalyzerReport,
  type QualityMetrics
} from '../src/lib/monitoring/docanalyzer-monitor';

// =============================================================================
// 测试函数
// =============================================================================

async function testMonitorBasic(): Promise<void> {
  console.log('\n========================================');
  console.log('测试基本监控功能');
  console.log('========================================');

  const monitor = getDocAnalyzerMonitor();

  // 记录一些测试指标
  const testMetrics: QualityMetrics[] = [
    {
      timestamp: Date.now() - 3600000 * 2, // 2小时前
      documentId: 'doc001',
      documentType: 'civil',
      qualityScore: 0.85,
      processingTime: 45,
      reviewerCounts: {
        partiesExtracted: 2,
        claimsExtracted: 3,
        amountsExtracted: 1
      },
      validationResults: {
        isValid: true,
        issues: []
      }
    },
    {
      timestamp: Date.now() - 3600000, // 1小时前
      documentId: 'doc002',
      documentType: 'criminal',
      qualityScore: 0.72,
      processingTime: 68,
      reviewerCounts: {
        partiesExtracted: 3,
        claimsExtracted: 2,
        amountsExtracted: 0
      },
      validationResults: {
        isValid: true,
        issues: []
      }
    },
    {
      timestamp: Date.now() - 1800000, // 30分钟前
      documentId: 'doc003',
      documentType: 'civil',
      qualityScore: 0.91,
      processingTime: 35,
      reviewerCounts: {
        partiesExtracted: 4,
        claimsExtracted: 5,
        amountsExtracted: 2
      },
      validationResults: {
        isValid: true,
        issues: []
      }
    },
    {
      timestamp: Date.now() - 600000, // 10分钟前
      documentId: 'doc004',
      documentType: 'civil',
      qualityScore: 0.65, // 低于阈值，应触发告警
      processingTime: 120, // 超过阈值，应触发告警
      reviewerCounts: {
        partiesExtracted: 2,
        claimsExtracted: 2,
        amountsExtracted: 1
      },
      validationResults: {
        isValid: false,
        issues: ['缺少必要信息', '格式不符合要求']
      }
    },
    {
      timestamp: Date.now(), // 现在
      documentId: 'doc005',
      documentType: 'administrative',
      qualityScore: 0.88,
      processingTime: 42,
      reviewerCounts: {
        partiesExtracted: 2,
        claimsExtracted: 3,
        amountsExtracted: 0
      },
      validationResults: {
        isValid: true,
        issues: []
      }
    }
  ];

  for (const metric of testMetrics) {
    monitor.recordMetric(metric);
    console.log(`已记录文档 ${metric.documentId}: 质量评分 ${(metric.qualityScore * 100).toFixed(1)}%, 耗时 ${metric.processingTime}ms`);
  }

  console.log('\n获取告警:');
  const alerts = monitor.getAlerts();
  for (const alert of alerts) {
    console.log(`  [${alert.level.toUpperCase()}] ${alert.message}`);
  }

  console.log('\n获取最近指标:');
  const recentMetrics = monitor.getRecentMetrics(3);
  for (const metric of recentMetrics) {
    console.log(`  文档 ${metric.documentId}: 质量评分 ${(metric.qualityScore * 100).toFixed(1)}%, 耗时 ${metric.processingTime}ms`);
  }

  console.log('\n获取监控统计:');
  const stats = monitor.getStats();
  console.log(`  总指标数: ${stats.totalMetrics}`);
  console.log(`  总告警数: ${stats.totalAlerts}`);
  console.log(`  平均质量评分: ${(stats.averageQualityScore * 100).toFixed(1)}%`);
  console.log(`  平均处理时间: ${stats.averageProcessingTime.toFixed(2)}ms`);
}

async function testTrendAnalysis(): Promise<void> {
  console.log('\n========================================');
  console.log('测试趋势分析');
  console.log('========================================');

  const monitor = getDocAnalyzerMonitor();

  const hourTrend = monitor.getQualityTrend('hour');
  console.log('\n最近1小时趋势:');
  console.log(`  平均质量评分: ${(hourTrend.averageQualityScore * 100).toFixed(1)}%`);
  console.log(`  平均处理时间: ${hourTrend.averageProcessingTime.toFixed(2)}ms`);
  console.log(`  成功率: ${(hourTrend.successRate * 100).toFixed(1)}%`);
  console.log(`  趋势: ${hourTrend.qualityTrend}`);
  console.log(`  问题分布:`);
  Object.entries(hourTrend.issueDistribution).forEach(([issue, count]) => {
    console.log(`    ${issue}: ${count}次`);
  });

  const dayTrend = monitor.getQualityTrend('day');
  console.log('\n最近24小时趋势:');
  console.log(`  平均质量评分: ${(dayTrend.averageQualityScore * 100).toFixed(1)}%`);
  console.log(`  平均处理时间: ${dayTrend.averageProcessingTime.toFixed(2)}ms`);
  console.log(`  成功率: ${(dayTrend.successRate * 100).toFixed(1)}%`);
  console.log(`  趋势: ${dayTrend.qualityTrend}`);
}

async function testReportGeneration(): Promise<void> {
  console.log('\n========================================');
  console.log('生成监控报告');
  console.log('========================================\n');

  const report = generateDocAnalyzerReport();
  console.log(report);
}

async function testConfigManagement(): Promise<void> {
  console.log('\n========================================');
  console.log('测试配置管理');
  console.log('========================================');

  const monitor = getDocAnalyzerMonitor();

  console.log('\n当前配置:');
  console.log(`  最小质量评分: ${monitor.getConfig().minQualityScore}`);
  console.log(`  最大处理时间: ${monitor.getConfig().maxProcessingTime}ms`);
  console.log(`  告警启用: ${monitor.getConfig().enableAlerts}`);
  console.log(`  告警渠道: ${monitor.getConfig().alertChannels.join(', ')}`);

  // 更新配置
  monitor.updateConfig({
    minQualityScore: 0.8,
    maxProcessingTime: 80
  });

  console.log('\n更新后配置:');
  console.log(`  最小质量评分: ${monitor.getConfig().minQualityScore}`);
  console.log(`  最大处理时间: ${monitor.getConfig().maxProcessingTime}ms`);

  // 恢复默认配置
  monitor.updateConfig({
    minQualityScore: 0.7,
    maxProcessingTime: 100
  });

  console.log('\n已恢复默认配置');
}

async function testConvenienceFunctions(): Promise<void> {
  console.log('\n========================================');
  console.log('测试便捷函数');
  console.log('========================================');

  const monitor = getDocAnalyzerMonitor();

  // 记录新指标
  recordDocAnalyzerMetric({
    timestamp: Date.now(),
    documentId: 'doc006',
    documentType: 'civil',
    qualityScore: 0.95,
    processingTime: 38,
    reviewerCounts: {
      partiesExtracted: 3,
      claimsExtracted: 4,
      amountsExtracted: 1
    },
    validationResults: {
      isValid: true,
      issues: []
    }
  });

  console.log('\n已使用便捷函数记录指标');

  // 使用便捷函数获取趋势
  const trend = getDocAnalyzerTrend('day');
  console.log(`\n使用便捷函数获取趋势: 平均质量评分 ${(trend.averageQualityScore * 100).toFixed(1)}%`);

  // 使用便捷函数生成报告
  console.log('\n使用便捷函数生成报告:');
  const report = generateDocAnalyzerReport();
  console.log(report);
}

// =============================================================================
// 运行所有测试
// =============================================================================

async function runAllTests(): Promise<void> {
  console.log('========================================');
  console.log('DocAnalyzer监控模块测试');
  console.log('========================================');

  await testMonitorBasic();
  await testTrendAnalysis();
  await testConfigManagement();
  await testReportGeneration();
  await testConvenienceFunctions();

  console.log('\n========================================');
  console.log('测试完成');
  console.log('========================================');
}

// 运行测试
runAllTests().catch(console.error);
