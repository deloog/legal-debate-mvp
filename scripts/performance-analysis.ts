/**
 * 性能监控和优化脚本
 * 用于分析系统性能并生成优化建议
 */

import { printQueryReport } from '../src/lib/utils/query-performance';
import { cacheManager } from '../src/lib/utils/cache-manager';
import { printApiReport } from '../src/lib/middleware/performance-monitoring';

async function main() {
  console.log('开始性能分析...\n');

  // 1. 数据库查询性能报告
  console.log('1. 数据库查询性能分析');
  printQueryReport();

  // 2. 缓存性能报告
  console.log('2. Redis缓存性能分析');
  cacheManager.printReport();

  // 3. API性能报告
  console.log('3. API响应时间分析');
  printApiReport();

  // 4. 生成优化建议
  console.log('4. 性能优化建议');
  generateOptimizationSuggestions();

  await cacheManager.close();
}

function generateOptimizationSuggestions() {
  console.log('\n=== 性能优化建议 ===\n');

  const suggestions = [
    {
      category: '数据库优化',
      items: [
        '为频繁查询的字段添加索引',
        '使用select减少查询字段',
        '使用include预加载关联数据，避免N+1查询',
        '对大数据量查询使用游标分页',
        '定期清理过期数据',
      ],
    },
    {
      category: '缓存优化',
      items: [
        '为热点数据添加Redis缓存',
        '合理设置缓存过期时间',
        '使用缓存预热策略',
        '监控缓存命中率，调整缓存策略',
        '使用缓存穿透保护',
      ],
    },
    {
      category: 'API优化',
      items: [
        '对慢接口进行性能分析和优化',
        '实施API限流保护',
        '使用CDN加速静态资源',
        '启用HTTP/2和压缩',
        '实施接口响应缓存',
      ],
    },
    {
      category: '前端优化',
      items: [
        '使用代码分割减少首屏加载时间',
        '图片懒加载和压缩',
        '使用Service Worker缓存',
        '优化打包体积',
        '使用虚拟滚动处理长列表',
      ],
    },
  ];

  suggestions.forEach((section) => {
    console.log(`\n${section.category}：`);
    section.items.forEach((item, index) => {
      console.log(`  ${index + 1}. ${item}`);
    });
  });

  console.log('\n=== 建议结束 ===\n');
}

// 运行脚本
main().catch(console.error);
