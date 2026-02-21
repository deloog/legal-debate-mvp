/**
 * 法律法规采集模块入口
 */

// 类型定义
export * from './types';
export * from './contract-template-types';

// 基础类
export { BaseCrawler } from './base-crawler';
export { CrawlTaskManager, crawlTaskManager } from './crawl-task-manager';
export { LawSyncScheduler, lawSyncScheduler } from './law-sync-scheduler';

// 具体爬虫实现（NPCCrawler 和 CourtCrawler 已废弃，移至 archive/）
export { FLKCrawler, flkCrawler } from './flk-crawler';

// 合同模板采集器
export { SAMRCrawler, samrCrawler } from './samr-crawler';

// DOCX 解析器
export {
  DOCXParser,
  docxParser,
  DocumentType,
  LawCategory,
  ParseError,
  RetryableError,
} from './docx-parser';
