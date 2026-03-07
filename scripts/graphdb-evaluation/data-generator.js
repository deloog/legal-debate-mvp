'use strict';
/**
 * 测试数据生成器
 * 用于图数据库评估的基准测试
 */
Object.defineProperty(exports, '__esModule', { value: true });
exports.DataGenerator = void 0;
const crypto_1 = require('crypto');
/**
 * 法律名称模板
 */
const LAW_NAME_TEMPLATES = [
  '{name}法',
  '{name}条例',
  '{name}规定',
  '{name}规则',
  '{name}解释',
  '{name}办法',
];
/**
 * 法律名称前缀
 */
const LAW_NAME_PREFIXES = [
  '中华人民共和国民法典',
  '中华人民共和国刑法',
  '中华人民共和国合同法',
  '中华人民共和国劳动法',
  '中华人民共和国公司法',
  '中华人民共和国证券法',
  '中华人民共和国知识产权法',
  '中华人民共和国环境保护法',
  '中华人民共和国民事诉讼法',
  '中华人民共和国行政诉讼法',
];
/**
 * 法律类别
 */
const LAW_CATEGORIES = [
  'CIVIL',
  'CRIMINAL',
  'ADMINISTRATIVE',
  'COMMERCIAL',
  'ECONOMIC',
  'LABOR',
  'INTELLECTUAL_PROPERTY',
  'PROCEDURE',
  'OTHER',
];
/**
 * 关系类型
 */
const RELATION_TYPES = [
  'CITES',
  'CITED_BY',
  'CONFLICTS',
  'COMPLETES',
  'COMPLETED_BY',
  'SUPERSEDES',
  'SUPERSEDED_BY',
  'IMPLEMENTS',
  'IMPLEMENTED_BY',
  'RELATED',
];
/**
 * 法律术语
 */
const LEGAL_TERMS = [
  '应当',
  '不得',
  '可以',
  '必须',
  '禁止',
  '依照',
  '按照',
  '根据',
  '由',
  '予以',
  '构成',
  '适用',
  '具有',
  '承担',
  '享有',
  '履行',
];
/**
 * 条文模板
 */
const ARTICLE_TEMPLATES = [
  '{term}遵守本法规定，{term}违反法律。',
  '当事人{term}在法律规定的期限内{term}完成相关手续。',
  '对于{term}的情形，{term}依照相关法律法规处理。',
  '{term}保护当事人的合法权益，{term}维护社会公平正义。',
  '本法所称{term}，是指{term}符合法律规定的条件。',
  '{term}在符合法律规定的前提下，{term}享有相应的权利。',
  '违反本法规定的，{term}依法承担相应的法律责任。',
  '{term}按照法律规定的程序进行，{term}确保程序合法。',
];
/**
 * 数据生成器类
 */
class DataGenerator {
  /**
   * 生成法条
   */
  static generateArticles(count) {
    const articles = [];
    const usedCombinations = new Set();
    for (let i = 0; i < count; i++) {
      let article;
      let attempts = 0;
      do {
        article = this.generateSingleArticle();
        attempts++;
      } while (
        usedCombinations.has(`${article.lawName}-${article.articleNumber}`) &&
        attempts < 10
      );
      articles.push(article);
      usedCombinations.add(`${article.lawName}-${article.articleNumber}`);
    }
    return articles;
  }
  /**
   * 生成单个法条
   */
  static generateSingleArticle() {
    const lawName = this.generateLegalName();
    const articleNumber = this.generateArticleNumber();
    return {
      id: (0, crypto_1.randomUUID)(),
      lawName,
      articleNumber,
      category: this.randomChoice(LAW_CATEGORIES),
      lawType: 'LAW',
      fullText: this.generateFullText(),
      effectiveDate: this.generateEffectiveDate(),
    };
  }
  /**
   * 生成法律名称
   */
  static generateLegalNames(count) {
    const names = new Set();
    while (names.size < count) {
      const prefix = this.randomChoice(LAW_NAME_PREFIXES);
      const template = this.randomChoice(LAW_NAME_TEMPLATES);
      const name = template.replace(
        '{name}',
        prefix.replace('中华人民共和国', '')
      );
      names.add(name);
    }
    return Array.from(names);
  }
  /**
   * 生成单个法律名称
   */
  static generateLegalName() {
    const prefix = this.randomChoice(LAW_NAME_PREFIXES);
    const template = this.randomChoice(LAW_NAME_TEMPLATES);
    return template.replace('{name}', prefix.replace('中华人民共和国', ''));
  }
  /**
   * 生成条文号
   */
  static generateArticleNumber() {
    const chapter = Math.floor(Math.random() * 10) + 1;
    const section = Math.floor(Math.random() * 5) + 1;
    const article = Math.floor(Math.random() * 50) + 1;
    return `第${chapter}章第${section}节第${article}条`;
  }
  /**
   * 生成法条全文
   */
  static generateFullText() {
    const template = this.randomChoice(ARTICLE_TEMPLATES);
    let text = template;
    // 替换所有term占位符
    let termCount = 0;
    while (text.includes('{term}') && termCount < 3) {
      const term = this.randomChoice(LEGAL_TERMS);
      text = text.replace('{term}', term);
      termCount++;
    }
    // 添加补充说明
    const extraLength = Math.floor(Math.random() * 200) + 50;
    const extraWords = this.generateExtraWords(extraLength);
    text += extraWords;
    return text;
  }
  /**
   * 生成额外的法律文本
   */
  static generateExtraWords(length) {
    const words = [];
    let currentLength = 0;
    while (currentLength < length) {
      const word = this.randomChoice(LEGAL_TERMS);
      const punctuation = Math.random() > 0.7 ? '，' : '。';
      words.push(word + punctuation);
      currentLength += word.length + 1;
    }
    return words.join('');
  }
  /**
   * 生成生效日期
   */
  static generateEffectiveDate() {
    const startYear = 2000;
    const endYear = new Date().getFullYear();
    const year = Math.floor(Math.random() * (endYear - startYear)) + startYear;
    const month = Math.floor(Math.random() * 12) + 1;
    const day = Math.floor(Math.random() * 28) + 1;
    return new Date(year, month - 1, day);
  }
  /**
   * 生成关系
   */
  static generateRelations(count, articles) {
    const relations = [];
    const articleIds = articles.map(art => art.id);
    for (let i = 0; i < count; i++) {
      const relation = this.generateSingleRelation(articleIds);
      relations.push(relation);
    }
    return relations;
  }
  /**
   * 生成单个关系
   */
  static generateSingleRelation(articleIds) {
    const sourceId = this.randomChoice(articleIds);
    let targetId = this.randomChoice(articleIds);
    // 避免自引用
    while (targetId === sourceId) {
      targetId = this.randomChoice(articleIds);
    }
    return {
      id: (0, crypto_1.randomUUID)(),
      sourceId,
      targetId,
      relationType: this.randomChoice(RELATION_TYPES),
      strength: this.randomFloat(0.3, 1.0),
      confidence: this.randomFloat(0.5, 1.0),
      verificationStatus: Math.random() > 0.3 ? 'VERIFIED' : 'PENDING',
    };
  }
  /**
   * 生成测试数据集
   */
  static generateTestDataset(scale) {
    const articles = this.generateArticles(scale.articleCount);
    const relations = this.generateRelations(scale.relationCount, articles);
    return {
      articles,
      relations,
    };
  }
  /**
   * 从数组中随机选择
   */
  static randomChoice(array) {
    return array[Math.floor(Math.random() * array.length)];
  }
  /**
   * 生成随机浮点数
   */
  static randomFloat(min, max) {
    return Math.random() * (max - min) + min;
  }
}
exports.DataGenerator = DataGenerator;
