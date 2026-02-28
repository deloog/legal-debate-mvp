/**
 * 简单测试脚本 - 验证数据生成器
 */

// 使用require方式导入，避免ES模块问题
const { DataGenerator } = require('./data-generator');

console.log('开始测试数据生成器...\n');

// 测试1: 生成法条
console.log('测试1: 生成100个法条...');
const articles = DataGenerator.generateArticles(100);
console.log(`✓ 生成了 ${articles.length} 个法条`);
console.log(`✓ 第一个法条ID: ${articles[0].id}`);
console.log(`✓ 第一个法条名称: ${articles[0].lawName}`);
console.log(`✓ 第一个法条类别: ${articles[0].category}\n`);

// 测试2: 生成关系
console.log('测试2: 生成500个关系...');
const relations = DataGenerator.generateRelations(500, articles);
console.log(`✓ 生成了 ${relations.length} 个关系`);
console.log(`✓ 第一个关系ID: ${relations[0].id}`);
console.log(`✓ 第一个关系类型: ${relations[0].relationType}`);
console.log(`✓ 第一个关系置信度: ${relations[0].confidence}\n`);

// 测试3: 生成完整数据集
console.log('测试3: 生成完整数据集...');
const scale = {
  articleCount: 1000,
  relationCount: 10000,
  avgRelationsPerArticle: 10,
  averageDegree: 20,
};
const dataset = DataGenerator.generateTestDataset(scale);
console.log(`✓ 生成了 ${dataset.articles.length} 个法条`);
console.log(`✓ 生成了 ${dataset.relations.length} 个关系\n`);

// 测试4: 生成法律名称
console.log('测试4: 生成10个法律名称...');
const names = DataGenerator.generateLegalNames(10);
console.log(`✓ 生成了 ${names.length} 个法律名称`);
names.forEach((name, i) => {
  console.log(`  ${i + 1}. ${name}`);
});
console.log('');

// 测试5: 生成法条全文
console.log('测试5: 生成法条全文...');
const fullText = DataGenerator.generateFullText();
console.log(`✓ 生成了 ${fullText.length} 个字符的全文`);
console.log(`✓ 全文内容: ${fullText.substring(0, 100)}...\n`);

console.log('所有测试通过! ✓');
