/**
 * 报告格式化器
 * 将报告内容格式化为HTML或PDF
 */

import fs from 'fs/promises';
import path from 'path';
import type { ReportContent, ReportFormat } from '@/types/stats';
import { formatNumber, formatPercentage } from './report-content-builder';

/**
 * 格式化报告
 */
export async function formatReport(
  content: ReportContent,
  format: ReportFormat,
  fileName: string
): Promise<string> {
  const reportsDir = path.join(process.cwd(), 'public', 'reports');

  // 确保reports目录存在
  await fs.mkdir(reportsDir, { recursive: true });

  const filePath = path.join(process.cwd(), 'public', fileName);

  switch (format) {
    case 'HTML':
      await generateHtmlReport(content, filePath);
      break;
    case 'JSON':
      await generateJsonReport(content, filePath);
      break;
    case 'PDF':
      // PDF生成需要额外的库，暂时生成HTML
      await generateHtmlReport(content, filePath);
      break;
    default:
      throw new Error(`不支持的报告格式: ${format}`);
  }

  return filePath;
}

/**
 * 生成HTML报告
 */
async function generateHtmlReport(
  content: ReportContent,
  filePath: string
): Promise<void> {
  const html = buildHtmlContent(content);
  await fs.writeFile(filePath, html, 'utf-8');
}

/**
 * 生成JSON报告
 */
async function generateJsonReport(
  content: ReportContent,
  filePath: string
): Promise<void> {
  const json = JSON.stringify(content, null, 2);
  await fs.writeFile(filePath, json, 'utf-8');
}

/**
 * 构建HTML内容
 */
function buildHtmlContent(content: ReportContent): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>系统统计报告</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      background-color: #f5f5f5;
      padding: 20px;
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
      background-color: white;
      padding: 40px;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }
    h1 {
      font-size: 32px;
      color: #1a1a1a;
      margin-bottom: 20px;
      border-bottom: 3px solid #1890ff;
      padding-bottom: 10px;
    }
    h2 {
      font-size: 24px;
      color: #1a1a1a;
      margin-top: 40px;
      margin-bottom: 20px;
      border-left: 4px solid #1890ff;
      padding-left: 12px;
    }
    h3 {
      font-size: 18px;
      color: #1a1a1a;
      margin-top: 24px;
      margin-bottom: 12px;
    }
    .summary {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 24px;
      border-radius: 8px;
      margin-bottom: 30px;
    }
    .summary h2 {
      color: white;
      border-left-color: rgba(255, 255, 255, 0.5);
    }
    .metrics {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 16px;
      margin-top: 20px;
    }
    .metric-card {
      background-color: rgba(255, 255, 255, 0.1);
      border-radius: 6px;
      padding: 16px;
    }
    .metric-label {
      font-size: 14px;
      opacity: 0.9;
      margin-bottom: 8px;
    }
    .metric-value {
      font-size: 28px;
      font-weight: bold;
    }
    .metric-unit {
      font-size: 14px;
      opacity: 0.8;
      margin-left: 4px;
    }
    .metric-change {
      font-size: 12px;
      margin-top: 4px;
    }
    .metric-change.positive {
      color: #52c41a;
    }
    .metric-change.negative {
      color: #ff4d4f;
    }
    .section {
      background-color: #fafafa;
      border-radius: 6px;
      padding: 20px;
      margin-top: 20px;
    }
    .summary-stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 16px;
      margin-bottom: 20px;
    }
    .stat-card {
      background-color: white;
      border-radius: 6px;
      padding: 20px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    }
    .stat-label {
      font-size: 14px;
      color: #666;
      margin-bottom: 8px;
    }
    .stat-value {
      font-size: 24px;
      font-weight: bold;
      color: #1a1a1a;
    }
    .highlights,
    .issues,
    .recommendations {
      margin-top: 20px;
    }
    .highlights ul,
    .issues ul,
    .recommendations ul {
      list-style: none;
      padding: 0;
    }
    .highlights li,
    .issues li,
    .recommendations li {
      padding: 8px 12px;
      margin-bottom: 8px;
      border-radius: 4px;
    }
    .highlights li {
      background-color: #f6ffed;
      border-left: 3px solid #52c41a;
      color: #389e0d;
    }
    .issues li {
      background-color: #fff1f0;
      border-left: 3px solid #ff4d4f;
      color: #cf1322;
    }
    .recommendations li {
      background-color: #e6f7ff;
      border-left: 3px solid #1890ff;
      color: #0958d9;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 16px;
      background-color: white;
    }
    thead {
      background-color: #fafafa;
    }
    th,
    td {
      padding: 12px;
      text-align: left;
      border-bottom: 1px solid #f0f0f0;
    }
    th {
      font-weight: 600;
      color: #1a1a1a;
    }
    tr:hover {
      background-color: #fafafa;
    }
    .empty-state {
      text-align: center;
      padding: 40px;
      color: #999;
    }
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #f0f0f0;
      text-align: center;
      color: #999;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <div class="container">
    ${buildSummarySection(content)}
    ${buildUserStatsSection(content)}
    ${buildCaseStatsSection(content)}
    ${buildDebateStatsSection(content)}
    ${buildPerformanceStatsSection(content)}
    <div class="footer">
      <p>报告生成时间：${new Date().toLocaleString('zh-CN')}</p>
      <p>法律诉讼智能分析系统</p>
    </div>
  </div>
</body>
</html>`;
}

/**
 * 构建摘要部分
 */
function buildSummarySection(content: ReportContent): string {
  const summary = content.summary;

  const metricsHtml = summary.keyMetrics
    .map(
      metric => `
    <div class="metric-card">
      <div class="metric-label">${metric.label}</div>
      <div>
        <span class="metric-value">${metric.value}</span>
        <span class="metric-unit">${metric.unit}</span>
      </div>
      <div class="metric-change ${metric.change >= 0 ? 'positive' : 'negative'}">
        ${metric.change >= 0 ? '↑' : '↓'} ${formatPercentage(metric.change)}
      </div>
    </div>
  `
    )
    .join('');

  return `
    <div class="summary">
      <h2>📊 报告摘要</h2>
      <div class="metrics">
        ${metricsHtml}
      </div>
      ${buildHighlightsSection(summary)}
      ${buildIssuesSection(summary)}
      ${buildRecommendationsSection(summary)}
    </div>
  `;
}

/**
 * 构建亮点部分
 */
function buildHighlightsSection(summary: ReportContent['summary']): string {
  if (!summary.highlights || summary.highlights.length === 0) {
    return '';
  }

  const highlightsHtml = summary.highlights
    .map(highlight => `<li>${highlight}</li>`)
    .join('');

  return `
    <div class="highlights">
      <h3>✨ 关键亮点</h3>
      <ul>${highlightsHtml}</ul>
    </div>
  `;
}

/**
 * 构建问题部分
 */
function buildIssuesSection(summary: ReportContent['summary']): string {
  if (!summary.issues || summary.issues.length === 0) {
    return '';
  }

  const issuesHtml = summary.issues.map(issue => `<li>${issue}</li>`).join('');

  return `
    <div class="issues">
      <h3>⚠️ 需要关注的问题</h3>
      <ul>${issuesHtml}</ul>
    </div>
  `;
}

/**
 * 构建建议部分
 */
function buildRecommendationsSection(
  summary: ReportContent['summary']
): string {
  if (!summary.recommendations || summary.recommendations.length === 0) {
    return '';
  }

  const recommendationsHtml = summary.recommendations
    .map(recommendation => `<li>${recommendation}</li>`)
    .join('');

  return `
    <div class="recommendations">
      <h3>💡 改进建议</h3>
      <ul>${recommendationsHtml}</ul>
    </div>
  `;
}

/**
 * 构建用户统计部分
 */
function buildUserStatsSection(content: ReportContent): string {
  if (!content.userStats) {
    return '';
  }

  const stats = content.userStats.summary;
  const distributionHtml = `
    <table>
      <thead>
        <tr>
          <th>活跃度分类</th>
          <th>用户数</th>
          <th>占比</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>非常活跃</td>
          <td>${content.userStats.distribution.veryActive}</td>
          <td>${formatPercentage(
            (content.userStats.distribution.veryActive /
              (stats.totalUsers || 1)) *
              100
          )}</td>
        </tr>
        <tr>
          <td>活跃</td>
          <td>${content.userStats.distribution.active}</td>
          <td>${formatPercentage(
            (content.userStats.distribution.active / (stats.totalUsers || 1)) *
              100
          )}</td>
        </tr>
        <tr>
          <td>不活跃</td>
          <td>${content.userStats.distribution.inactive}</td>
          <td>${formatPercentage(
            (content.userStats.distribution.inactive /
              (stats.totalUsers || 1)) *
              100
          )}</td>
        </tr>
        <tr>
          <td>沉默</td>
          <td>${content.userStats.distribution.dormant}</td>
          <td>${formatPercentage(
            (content.userStats.distribution.dormant / (stats.totalUsers || 1)) *
              100
          )}</td>
        </tr>
      </tbody>
    </table>
  `;

  return `
    <div class="section">
      <h2>👥 用户统计</h2>
      <div class="summary-stats">
        <div class="stat-card">
          <div class="stat-label">总用户数</div>
          <div class="stat-value">${stats.totalUsers}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">新增用户</div>
          <div class="stat-value">${stats.newUsers}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">活跃用户</div>
          <div class="stat-value">${stats.activeUsers}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">增长率</div>
          <div class="stat-value">${formatPercentage(stats.growthRate)}</div>
        </div>
      </div>
      <h3>用户活跃度分布</h3>
      ${distributionHtml}
    </div>
  `;
}

/**
 * 构建案件统计部分
 */
function buildCaseStatsSection(content: ReportContent): string {
  if (!content.caseStats) {
    return '';
  }

  const stats = content.caseStats.summary;

  return `
    <div class="section">
      <h2>📁 案件统计</h2>
      <div class="summary-stats">
        <div class="stat-card">
          <div class="stat-label">总案件数</div>
          <div class="stat-value">${stats.totalCases}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">已完成</div>
          <div class="stat-value">${stats.completedCases}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">进行中</div>
          <div class="stat-value">${stats.activeCases}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">平均处理时间</div>
          <div class="stat-value">${formatNumber(stats.averageCompletionTime)}</div>
        </div>
      </div>
      <h3>案件类型分布</h3>
      <table>
        <thead>
          <tr>
            <th>案件类型</th>
            <th>数量</th>
            <th>占比</th>
          </tr>
        </thead>
        <tbody>
          ${content.caseStats.distribution
            .map(
              item => `
            <tr>
              <td>${item.type}</td>
              <td>${item.count}</td>
              <td>${formatPercentage(item.percentage)}</td>
            </tr>
          `
            )
            .join('')}
        </tbody>
      </table>
    </div>
  `;
}

/**
 * 构建辩论统计部分
 */
function buildDebateStatsSection(content: ReportContent): string {
  if (!content.debateStats) {
    return '';
  }

  const stats = content.debateStats.summary;

  return `
    <div class="section">
      <h2>💬 辩论统计</h2>
      <div class="summary-stats">
        <div class="stat-card">
          <div class="stat-label">总辩论数</div>
          <div class="stat-value">${stats.totalDebates}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">总论点数</div>
          <div class="stat-value">${stats.totalArguments}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">平均论点数</div>
          <div class="stat-value">${formatNumber(stats.averageArgumentsPerDebate)}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">平均质量评分</div>
          <div class="stat-value">${formatNumber(stats.averageQualityScore, 4)}</div>
        </div>
      </div>
    </div>
  `;
}

/**
 * 构建性能统计部分
 */
function buildPerformanceStatsSection(content: ReportContent): string {
  if (!content.performanceStats) {
    return '';
  }

  const stats = content.performanceStats.summary;

  return `
    <div class="section">
      <h2>⚡ 性能统计</h2>
      <div class="summary-stats">
        <div class="stat-card">
          <div class="stat-label">总请求数</div>
          <div class="stat-value">${stats.totalRequests}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">平均响应时间</div>
          <div class="stat-value">${formatNumber(stats.averageResponseTime)}ms</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">P95响应时间</div>
          <div class="stat-value">${formatNumber(stats.p95ResponseTime)}ms</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">错误率</div>
          <div class="stat-value">${formatPercentage(stats.errorRate)}</div>
        </div>
      </div>
    </div>
  `;
}
