/**
 * 国家市场监督管理总局合同示范文本库采集器
 * 数据源:
 * - 主要: https://www.samr.gov.cn/ (国家市场监督管理总局官网)
 * - 备用: https://htsfwb.samr.gov.cn/ (合同服务网)
 *
 * URL规律:
 * - 合同示范文本库入口: samr.gov.cn 相关页面
 * - 详情页: samr.gov.cn/View?id=xxxxx
 *
 * 采集策略：
 * 1. 访问国家市场监督管理总局官网
 * 2. 获取合同文本列表及分类
 * 3. 采集合同模板内容、条款结构、风险提示
 *
 * 注意：由于网站API可能不稳定，本采集器支持：
 * - 真实API模式（当网站可用时）
 * - 模拟数据模式（用于开发和测试）
 *
 * 更新记录 (2026-02-18):
 * - cont.12315.cn 无法访问(DNS解析失败)
 * - 切换到 samr.gov.cn 作为主要数据源
 */

import type { Prisma } from '@prisma/client';
import * as path from 'path';
import { BaseCrawler, CrawlerResult, LawArticleData } from './base-crawler';
import type {
  ClauseType,
  ContractCategory,
  ContractTemplateData,
  ContractTemplateSource,
  RiskLevel,
  RiskWarning,
  TemplateClause,
  TemplatePriority,
  TemplateVariable,
} from './contract-template-types';
import { getLogger } from './crawler-logger';
import { SAMRPlaywrightCrawler } from './samr-playwright';

// 数据源配置
export const SAMR_CONFIG = {
  name: 'SAMRCrawler',
  // 主要数据源: 国家市场监督管理总局官网 (2026-02-18 更新)
  // 由于 cont.12315.cn 无法访问，切换到 samr.gov.cn
  baseUrl: 'https://www.samr.gov.cn',
  apiBaseUrl: 'https://www.samr.gov.cn',
  // 备用数据源: 合同服务网
  fallbackBaseUrl: 'https://htsfwb.samr.gov.cn',
  fallbackApiBase: 'https://htsfwb.samr.gov.cn',
  source: 'samr' as ContractTemplateSource,
  requestTimeout: 30000,
  maxRetries: 3,
  rateLimitDelay: 2000,
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
};

// 合同分类映射（基于SAMR公开分类）
export const CONTRACT_CATEGORIES: Record<string, string> = {
  劳动合同: 'LABOR',
  人事: 'LABOR',
  聘用: 'LABOR',
  房屋租赁: 'LEASE',
  场地租赁: 'LEASE',
  设备租赁: 'LEASE',
  买卖: 'CIVIL',
  零售: 'CIVIL',
  农副产品: 'CIVIL',
  借款: 'CIVIL',
  民间借贷: 'CIVIL',
  建设工程: 'CONSTRUCTION',
  施工: 'CONSTRUCTION',
  装饰装修: 'CONSTRUCTION',
  房屋买卖: 'REAL_ESTATE',
  房地产开发: 'REAL_ESTATE',
  物业服务: 'REAL_ESTATE',
  运输: 'TRANSPORTATION',
  物流: 'TRANSPORTATION',
  公路货物: 'TRANSPORTATION',
  知识产权: 'INTELLECTUAL_PROPERTY',
  专利: 'INTELLECTUAL_PROPERTY',
  商标: 'INTELLECTUAL_PROPERTY',
  版权: 'INTELLECTUAL_PROPERTY',
  技术: 'INTELLECTUAL_PROPERTY',
  保险: 'FINANCIAL',
  金融: 'FINANCIAL',
  证券: 'FINANCIAL',
  服务: 'SERVICE',
  委托: 'SERVICE',
  中介: 'SERVICE',
  旅游: 'SERVICE',
  餐饮: 'SERVICE',
  承揽: 'SERVICE',
  合伙: 'COMMERCIAL',
  公司: 'COMMERCIAL',
  投资: 'COMMERCIAL',
  合作: 'COMMERCIAL',
  联营: 'COMMERCIAL',
};

// 合同模板列表项（API响应类型）
interface SAMRContractListItem {
  id: string;
  title: string;
  category: string;
  subCategory?: string;
  publishDate: string;
  downloadCount: number;
  sourceUrl: string;
  docxUrl?: string;
}

// 采集选项
interface SAMRCrawlOptions {
  categories?: string[];
  maxItems?: number;
  outputDir?: string;
  useRealApi?: boolean; // 是否使用真实API
  usePlaywright?: boolean; // 是否使用 Playwright
}

// 解析选项
interface SAMRParseOptions {
  types?: string[];
  maxAttempts?: number;
  outputDir?: string;
}

// 统计信息
interface SAMRStats {
  total: number;
  success: number;
  failed: number;
  byCategory: Record<string, number>;
}

// 下载检查点 - 用于两阶段架构
interface SAMRDownloadCheckpoint {
  timestamp: string;
  templates: SAMRDownloadedItem[];
}

interface SAMRDownloadedItem {
  id: string;
  title: string;
  category: string;
  filePath: string;
  fileType: 'docx' | 'pdf' | 'html' | 'content';
  sourceUrl: string;
  downloadedAt: string;
  content?: string; // 直接从网页提取的内容
}

// 解析结果 - 用于两阶段架构
interface SAMRParseResults {
  timestamp: string;
  items: SAMRParseResultItem[];
}

interface SAMRParseResultItem {
  id: string;
  title: string;
  content: string;
  parseMethod: string;
  parsedAt: string;
  success: boolean;
  error?: string;
}

// 错误统计信息
interface SAMRErrorStats {
  totalErrors: number;
  errorsByType: Record<string, number>;
  errorsByItem: Record<string, string>;
  lastErrorAt: string;
  consecutiveFailures: number;
  recoveryAttempts: number;
}

// API响应数据类型
interface SAMRApiResponseItem {
  id?: string;
  htlbId?: string;
  contractId?: string;
  title?: string;
  htlbName?: string;
  contractName?: string;
  category?: string;
  htlbCategory?: string;
  publishDate?: string;
  gbrq?: string;
  downloadCount?: number;
  xzCount?: number;
  sourceUrl?: string;
  detailUrl?: string;
  docxUrl?: string;
  fileUrl?: string;
}

// API响应类型
interface SAMRApiResponse<T> {
  code: number;
  msg?: string;
  data?: T;
  total?: number;
  rows?: T[];
}

/**
 * ⚠️  种子数据（非真实 API 采集）
 *
 * 以下列表为人工整理的占位记录，用于开发/测试阶段填充数据库。
 * ID（如 HT-LD-001）和 downloadCount 均为虚构值，不代表 SAMR 官网真实数据。
 * 对接真实 API 后，应将此常量替换为动态采集逻辑，并清空已入库的种子记录。
 *
 * 数据来源参考: https://www.samr.gov.cn (2026-02-18)
 * 备用: https://htsfwb.samr.gov.cn
 */
const KNOWN_CONTRACT_TEMPLATES: SAMRContractListItem[] = [
  // 劳动合同类
  {
    id: 'HT-LD-001',
    title: '劳动合同书（示范文本）',
    category: '劳动合同',
    publishDate: '2024-01-01',
    downloadCount: 125680,
    sourceUrl: 'https://www.samr.gov.cn/View?id=HT-LD-001',
  },
  {
    id: 'HT-LD-002',
    title: '劳务派遣合同（示范文本）',
    category: '劳动合同',
    publishDate: '2024-01-01',
    downloadCount: 45670,
    sourceUrl: 'https://www.samr.gov.cn/View?id=HT-LD-002',
  },
  {
    id: 'HT-LD-003',
    title: '非全日制用工合同（示范文本）',
    category: '劳动合同',
    publishDate: '2024-01-01',
    downloadCount: 23450,
    sourceUrl: 'https://www.samr.gov.cn/View?id=HT-LD-003',
  },
  {
    id: 'HT-LD-004',
    title: '聘用协议（示范文本）',
    category: '人事',
    publishDate: '2024-01-01',
    downloadCount: 18900,
    sourceUrl: 'https://www.samr.gov.cn/View?id=HT-LD-004',
  },
  {
    id: 'HT-LD-005',
    title: '实习协议（示范文本）',
    category: '人事',
    publishDate: '2024-01-01',
    downloadCount: 15600,
    sourceUrl: 'https://www.samr.gov.cn/View?id=HT-LD-005',
  },
  // 房屋租赁类
  {
    id: 'HT-FW-001',
    title: '房屋租赁合同（示范文本）',
    category: '房屋租赁',
    publishDate: '2024-01-01',
    downloadCount: 98650,
    sourceUrl: 'https://www.samr.gov.cn/View?id=HT-FW-001',
  },
  {
    id: 'HT-FW-002',
    title: '店面租赁合同（示范文本）',
    category: '房屋租赁',
    publishDate: '2024-01-01',
    downloadCount: 34560,
    sourceUrl: 'https://www.samr.gov.cn/View?id=HT-FW-002',
  },
  {
    id: 'HT-FW-003',
    title: '场地租赁合同（示范文本）',
    category: '场地租赁',
    publishDate: '2024-01-01',
    downloadCount: 28760,
    sourceUrl: 'https://www.samr.gov.cn/View?id=HT-FW-003',
  },
  {
    id: 'HT-FW-004',
    title: '仓库租赁合同（示范文本）',
    category: '场地租赁',
    publishDate: '2024-01-01',
    downloadCount: 19800,
    sourceUrl: 'https://www.samr.gov.cn/View?id=HT-FW-004',
  },
  {
    id: 'HT-FW-005',
    title: '写字楼租赁合同（示范文本）',
    category: '房屋租赁',
    publishDate: '2024-01-01',
    downloadCount: 27500,
    sourceUrl: 'https://www.samr.gov.cn/View?id=HT-FW-005',
  },
  // 买卖合同类
  {
    id: 'HT-MM-001',
    title: '买卖合同（示范文本）',
    category: '买卖',
    publishDate: '2024-01-01',
    downloadCount: 87650,
    sourceUrl: 'https://www.samr.gov.cn/View?id=HT-MM-001',
  },
  {
    id: 'HT-MM-002',
    title: '工业品买卖合同（示范文本）',
    category: '买卖',
    publishDate: '2024-01-01',
    downloadCount: 34560,
    sourceUrl: 'https://www.samr.gov.cn/View?id=HT-MM-002',
  },
  {
    id: 'HT-MM-003',
    title: '农副产品买卖合同（示范文本）',
    category: '农副产品',
    publishDate: '2024-01-01',
    downloadCount: 23450,
    sourceUrl: 'https://www.samr.gov.cn/View?id=HT-MM-003',
  },
  {
    id: 'HT-MM-004',
    title: '汽车买卖合同（示范文本）',
    category: '买卖',
    publishDate: '2024-01-01',
    downloadCount: 45670,
    sourceUrl: 'https://www.samr.gov.cn/View?id=HT-MM-004',
  },
  {
    id: 'HT-MM-005',
    title: '二手房买卖合同（示范文本）',
    category: '房屋买卖',
    publishDate: '2024-01-01',
    downloadCount: 67890,
    sourceUrl: 'https://www.samr.gov.cn/View?id=HT-MM-005',
  },
  // 借款合同类
  {
    id: 'HT-JK-001',
    title: '借款合同（示范文本）',
    category: '借款',
    publishDate: '2024-01-01',
    downloadCount: 76540,
    sourceUrl: 'https://www.samr.gov.cn/View?id=HT-JK-001',
  },
  {
    id: 'HT-JK-002',
    title: '民间借款合同（示范文本）',
    category: '民间借贷',
    publishDate: '2024-01-01',
    downloadCount: 54320,
    sourceUrl: 'https://www.samr.gov.cn/View?id=HT-JK-002',
  },
  {
    id: 'HT-JK-003',
    title: '抵押借款合同（示范文本）',
    category: '借款',
    publishDate: '2024-01-01',
    downloadCount: 43210,
    sourceUrl: 'https://www.samr.gov.cn/View?id=HT-JK-003',
  },
  // 建设工程类
  {
    id: 'HT-JS-001',
    title: '建设工程施工合同（示范文本）',
    category: '建设工程',
    publishDate: '2024-01-01',
    downloadCount: 65430,
    sourceUrl: 'https://www.samr.gov.cn/View?id=HT-JS-001',
  },
  {
    id: 'HT-JS-002',
    title: '建设工程委托监理合同（示范文本）',
    category: '建设工程',
    publishDate: '2024-01-01',
    downloadCount: 23450,
    sourceUrl: 'https://www.samr.gov.cn/View?id=HT-JS-002',
  },
  {
    id: 'HT-JS-003',
    title: '装饰装修工程施工合同（示范文本）',
    category: '装饰装修',
    publishDate: '2024-01-01',
    downloadCount: 34560,
    sourceUrl: 'https://www.samr.gov.cn/View?id=HT-JS-003',
  },
  {
    id: 'HT-JS-004',
    title: '工程招标代理合同（示范文本）',
    category: '建设工程',
    publishDate: '2024-01-01',
    downloadCount: 18760,
    sourceUrl: 'https://www.samr.gov.cn/View?id=HT-JS-004',
  },
  {
    id: 'HT-JS-005',
    title: '工程建设项目合同（示范文本）',
    category: '建设工程',
    publishDate: '2024-01-01',
    downloadCount: 22340,
    sourceUrl: 'https://www.samr.gov.cn/View?id=HT-JS-005',
  },
  // 房屋买卖类
  {
    id: 'HT-FC-001',
    title: '房屋买卖合同（示范文本）',
    category: '房屋买卖',
    publishDate: '2024-01-01',
    downloadCount: 87650,
    sourceUrl: 'https://www.samr.gov.cn/View?id=HT-FC-001',
  },
  {
    id: 'HT-FC-002',
    title: '存量房买卖合同（示范文本）',
    category: '房屋买卖',
    publishDate: '2024-01-01',
    downloadCount: 54320,
    sourceUrl: 'https://www.samr.gov.cn/View?id=HT-FC-002',
  },
  {
    id: 'HT-FC-003',
    title: '商品房预售合同（示范文本）',
    category: '房屋买卖',
    publishDate: '2024-01-01',
    downloadCount: 67890,
    sourceUrl: 'https://www.samr.gov.cn/View?id=HT-FC-003',
  },
  {
    id: 'HT-FC-004',
    title: '房屋委托管理合同（示范文本）',
    category: '房屋买卖',
    publishDate: '2024-01-01',
    downloadCount: 34560,
    sourceUrl: 'https://www.samr.gov.cn/View?id=HT-FC-004',
  },
  // 运输物流类
  {
    id: 'HT-YS-001',
    title: '货物运输合同（示范文本）',
    category: '运输',
    publishDate: '2024-01-01',
    downloadCount: 45670,
    sourceUrl: 'https://www.samr.gov.cn/View?id=HT-YS-001',
  },
  {
    id: 'HT-YS-002',
    title: '物流服务合同（示范文本）',
    category: '物流',
    publishDate: '2024-01-01',
    downloadCount: 34560,
    sourceUrl: 'https://www.samr.gov.cn/View?id=HT-YS-002',
  },
  {
    id: 'HT-YS-003',
    title: '公路货物运输合同（示范文本）',
    category: '运输',
    publishDate: '2024-01-01',
    downloadCount: 28900,
    sourceUrl: 'https://www.samr.gov.cn/View?id=HT-YS-003',
  },
  {
    id: 'HT-YS-004',
    title: '航空货物运输合同（示范文本）',
    category: '运输',
    publishDate: '2024-01-01',
    downloadCount: 15670,
    sourceUrl: 'https://www.samr.gov.cn/View?id=HT-YS-004',
  },
  // 知识产权类
  {
    id: 'HT-ZL-001',
    title: '专利实施许可合同（示范文本）',
    category: '专利',
    publishDate: '2024-01-01',
    downloadCount: 23450,
    sourceUrl: 'https://www.samr.gov.cn/View?id=HT-ZL-001',
  },
  {
    id: 'HT-ZL-002',
    title: '商标使用许可合同（示范文本）',
    category: '商标',
    publishDate: '2024-01-01',
    downloadCount: 18900,
    sourceUrl: 'https://www.samr.gov.cn/View?id=HT-ZL-002',
  },
  {
    id: 'HT-ZL-003',
    title: '技术转让合同（示范文本）',
    category: '技术',
    publishDate: '2024-01-01',
    downloadCount: 28760,
    sourceUrl: 'https://www.samr.gov.cn/View?id=HT-ZL-003',
  },
  {
    id: 'HT-ZL-004',
    title: '著作权许可使用合同（示范文本）',
    category: '版权',
    publishDate: '2024-01-01',
    downloadCount: 21340,
    sourceUrl: 'https://www.samr.gov.cn/View?id=HT-ZL-004',
  },
  {
    id: 'HT-ZL-005',
    title: '技术开发合同（示范文本）',
    category: '技术',
    publishDate: '2024-01-01',
    downloadCount: 34210,
    sourceUrl: 'https://www.samr.gov.cn/View?id=HT-ZL-005',
  },
  // 服务类
  {
    id: 'HT-FW-001',
    title: '委托合同（示范文本）',
    category: '委托',
    publishDate: '2024-01-01',
    downloadCount: 54320,
    sourceUrl: 'https://www.samr.gov.cn/View?id=HT-FW-001',
  },
  {
    id: 'HT-FW-002',
    title: '旅游服务合同（示范文本）',
    category: '旅游',
    publishDate: '2024-01-01',
    downloadCount: 34560,
    sourceUrl: 'https://www.samr.gov.cn/View?id=HT-FW-002',
  },
  {
    id: 'HT-FW-003',
    title: '餐饮服务合同（示范文本）',
    category: '餐饮',
    publishDate: '2024-01-01',
    downloadCount: 23450,
    sourceUrl: 'https://www.samr.gov.cn/View?id=HT-FW-003',
  },
  {
    id: 'HT-FW-004',
    title: '家政服务合同（示范文本）',
    category: '服务',
    publishDate: '2024-01-01',
    downloadCount: 45670,
    sourceUrl: 'https://www.samr.gov.cn/View?id=HT-FW-004',
  },
  {
    id: 'HT-FW-005',
    title: '物业管理服务合同（示范文本）',
    category: '服务',
    publishDate: '2024-01-01',
    downloadCount: 38900,
    sourceUrl: 'https://www.samr.gov.cn/View?id=HT-FW-005',
  },
  // 承揽类
  {
    id: 'HT-CL-001',
    title: '承揽合同（示范文本）',
    category: '承揽',
    publishDate: '2024-01-01',
    downloadCount: 34560,
    sourceUrl: 'https://www.samr.gov.cn/View?id=HT-CL-001',
  },
  {
    id: 'HT-CL-002',
    title: '加工承揽合同（示范文本）',
    category: '承揽',
    publishDate: '2024-01-01',
    downloadCount: 28760,
    sourceUrl: 'https://www.samr.gov.cn/View?id=HT-CL-002',
  },
  {
    id: 'HT-CL-003',
    title: '定作合同（示范文本）',
    category: '承揽',
    publishDate: '2024-01-01',
    downloadCount: 19870,
    sourceUrl: 'https://www.samr.gov.cn/View?id=HT-CL-003',
  },
  // 合伙经营类
  {
    id: 'HT-HZ-001',
    title: '合伙合同（示范文本）',
    category: '合伙',
    publishDate: '2024-01-01',
    downloadCount: 45670,
    sourceUrl: 'https://www.samr.gov.cn/View?id=HT-HZ-001',
  },
  {
    id: 'HT-HZ-002',
    title: '公司设立协议（示范文本）',
    category: '公司',
    publishDate: '2024-01-01',
    downloadCount: 34560,
    sourceUrl: 'https://www.samr.gov.cn/View?id=HT-HZ-002',
  },
  {
    id: 'HT-HZ-003',
    title: '投资合作协议（示范文本）',
    category: '投资',
    publishDate: '2024-01-01',
    downloadCount: 28760,
    sourceUrl: 'https://www.samr.gov.cn/View?id=HT-HZ-003',
  },
  {
    id: 'HT-HZ-004',
    title: '联营合同（示范文本）',
    category: '合伙',
    publishDate: '2024-01-01',
    downloadCount: 21340,
    sourceUrl: 'https://www.samr.gov.cn/View?id=HT-HZ-004',
  },
  {
    id: 'HT-HZ-005',
    title: '合作协议（示范文本）',
    category: '合作',
    publishDate: '2024-01-01',
    downloadCount: 35670,
    sourceUrl: 'https://www.samr.gov.cn/View?id=HT-HZ-005',
  },
  // 保险金融类
  {
    id: 'HT-BX-001',
    title: '保险合同（示范文本）',
    category: '保险',
    publishDate: '2024-01-01',
    downloadCount: 56780,
    sourceUrl: 'https://www.samr.gov.cn/View?id=HT-BX-001',
  },
  {
    id: 'HT-BX-002',
    title: '财产保险合同（示范文本）',
    category: '保险',
    publishDate: '2024-01-01',
    downloadCount: 34560,
    sourceUrl: 'https://www.samr.gov.cn/View?id=HT-BX-002',
  },
  {
    id: 'HT-BX-003',
    title: '人身保险合同（示范文本）',
    category: '保险',
    publishDate: '2024-01-01',
    downloadCount: 42340,
    sourceUrl: 'https://www.samr.gov.cn/View?id=HT-BX-003',
  },
  // 其他类
  {
    id: 'HT-QT-001',
    title: '赠与合同（示范文本）',
    category: '赠与',
    publishDate: '2024-01-01',
    downloadCount: 23450,
    sourceUrl: 'https://www.samr.gov.cn/View?id=HT-QT-001',
  },
  {
    id: 'HT-QT-002',
    title: '借用合同（示范文本）',
    category: '借用',
    publishDate: '2024-01-01',
    downloadCount: 15670,
    sourceUrl: 'https://www.samr.gov.cn/View?id=HT-QT-002',
  },
  {
    id: 'HT-QT-003',
    title: '保管合同（示范文本）',
    category: '保管',
    publishDate: '2024-01-01',
    downloadCount: 18760,
    sourceUrl: 'https://www.samr.gov.cn/View?id=HT-QT-003',
  },
  {
    id: 'HT-QT-004',
    title: '仓储合同（示范文本）',
    category: '仓储',
    publishDate: '2024-01-01',
    downloadCount: 21340,
    sourceUrl: 'https://www.samr.gov.cn/View?id=HT-QT-004',
  },
  {
    id: 'HT-QT-005',
    title: '行纪合同（示范文本）',
    category: '行纪',
    publishDate: '2024-01-01',
    downloadCount: 13450,
    sourceUrl: 'https://www.samr.gov.cn/View?id=HT-QT-005',
  },
  {
    id: 'HT-QT-006',
    title: '居间合同（示范文本）',
    category: '居间',
    publishDate: '2024-01-01',
    downloadCount: 24560,
    sourceUrl: 'https://www.samr.gov.cn/View?id=HT-QT-006',
  },
];

/**
 * SAMR 合同模板采集器
 */
export class SAMRCrawler extends BaseCrawler {
  // 主要数据源: samr.gov.cn (2026-02-18 更新)
  private readonly PRIMARY_API_BASE = 'https://www.samr.gov.cn';
  // 备用数据源: 合同服务网
  private readonly FALLBACK_API_BASE = 'https://htsfwb.samr.gov.cn';
  private readonly __DEFAULT_OUTPUT_DIR = path.resolve('data/crawled/samr');

  /** 日志系统 */
  private logger = getLogger('SAMRCrawler');

  /** 错误统计 */
  private errorStats: SAMRErrorStats = {
    totalErrors: 0,
    errorsByType: {},
    errorsByItem: {},
    lastErrorAt: '',
    consecutiveFailures: 0,
    recoveryAttempts: 0,
  };

  /** 最大连续失败次数，超过则触发告警 */
  private readonly MAX_CONSECUTIVE_FAILURES = 5;

  /** 错误告警回调 */
  private errorAlertCallback?: (stats: SAMRErrorStats) => void;

  /** User-Agent 池 */
  private static readonly UA_POOL = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:122.0) Gecko/20100101 Firefox/122.0',
  ];

  constructor() {
    super({
      name: SAMR_CONFIG.name,
      baseUrl: SAMR_CONFIG.baseUrl,
      requestTimeout: SAMR_CONFIG.requestTimeout,
      maxRetries: SAMR_CONFIG.maxRetries,
      rateLimitDelay: SAMR_CONFIG.rateLimitDelay,
      userAgent: SAMR_CONFIG.userAgent,
    });
  }

  getDataSourceName(): string {
    return 'samr';
  }

  /**
   * 获取当前使用的API基础URL
   * 优先使用主要数据源(12315.cn)，失败时回退到备用数据源
   */
  private __getApiBaseUrl(): string {
    return this.PRIMARY_API_BASE;
  }

  /**
   * 检查主要数据源是否可用
   */
  async; /**
   * 检查主要数据源是否可用
   * 2026-02-18 更新: 检查 samr.gov.cn
   */
  async isPrimaryAvailable(): Promise<boolean> {
    try {
      const response = await fetch(this.PRIMARY_API_BASE, {
        method: 'HEAD',
        signal: AbortSignal.timeout(5000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * 采集合同模板
   */
  async crawl(options?: SAMRCrawlOptions): Promise<CrawlerResult> {
    const startTime = Date.now();
    const allErrors: string[] = [];

    this.updateProgress({
      status: 'running',
      startedAt: new Date(),
      errors: [],
    });

    try {
      // 获取合同模板列表
      const templates = await this.fetchContractList(options);

      this.updateProgress({
        totalItems: templates.length,
        currentItem: '开始采集合同模板',
      });

      let successCount = 0;
      let failCount = 0;
      const byCategory: Record<string, number> = {};

      for (const template of templates) {
        try {
          const result = await this.crawlTemplate(template);

          if (result) {
            successCount++;
            byCategory[result.category] =
              (byCategory[result.category] || 0) + 1;
          } else {
            failCount++;
          }
        } catch (error) {
          const errorMsg = `采集失败 [${template.title}]: ${error}`;
          allErrors.push(errorMsg);
          this.logger.error(errorMsg, error);
          failCount++;
        }

        this.updateProgress({
          processedItems: this.progress.processedItems + 1,
          currentItem: `处理 ${template.title}`,
        });

        await this.randomDelay();
      }

      const duration = Date.now() - startTime;
      this.updateProgress({ status: 'completed', completedAt: new Date() });

      const result: CrawlerResult = {
        success: failCount === 0,
        itemsCrawled: templates.length,
        itemsCreated: successCount,
        itemsUpdated: 0,
        errors: allErrors,
        duration,
      };

      await this.logCrawlOperation('full_crawl', result);

      this.logger.info('SAMR采集完成', {
        total: templates.length,
        success: successCount,
        failed: failCount,
        byCategory,
      });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      this.updateProgress({
        status: 'failed',
        completedAt: new Date(),
        lastError: errorMessage,
      });

      return {
        success: false,
        itemsCrawled: 0,
        itemsCreated: 0,
        itemsUpdated: 0,
        errors: [errorMessage],
        duration,
      };
    }
  }

  /**
   * 两阶段架构 - Phase 1: 下载阶段
   * 从 API/Playwright 获取数据并下载到磁盘
   */
  async downloadAll(options?: SAMRCrawlOptions): Promise<CrawlerResult> {
    const startTime = Date.now();
    const outputDir = options?.outputDir || this.__DEFAULT_OUTPUT_DIR;
    const allErrors: string[] = [];
    const downloadedItems: SAMRDownloadedItem[] = [];

    this.updateProgress({
      status: 'running',
      startedAt: new Date(),
      errors: [],
    });

    try {
      let templates: SAMRContractListItem[] = [];

      // 根据配置选择采集方式
      if (options?.usePlaywright) {
        // 使用 Playwright 采集（真实网站数据）
        const playwright = new SAMRPlaywrightCrawler({
          downloadDir: path.join(outputDir, 'downloads'),
          rateLimitDelay: this.config.rateLimitDelay,
        });

        try {
          // 获取列表
          const nationalResult = await playwright.gotoNationalList(1);
          const localResult = await playwright.gotoLocalList(1);
          templates = [...nationalResult.items, ...localResult.items];

          this.logger.info(`下载阶段: 获取 ${templates.length} 个模板`);
          this.updateProgress({
            totalItems: templates.length,
            currentItem: '开始下载文件',
          });

          // 下载每个模板的文件
          for (let i = 0; i < templates.length; i++) {
            const template = templates[i];
            this.updateProgress({
              processedItems: i,
              currentItem: `下载 ${template.title}`,
            });

            try {
              // 访问详情页获取内容
              if (template.sourceUrl) {
                const detailResult = await playwright.gotoDetail(
                  template.sourceUrl
                );

                // 新版网站直接将内容渲染在HTML中，提取内容
                if (detailResult.content) {
                  // 保存内容到文件
                  const fs = await import('fs');
                  const contentDir = path.join(outputDir, 'content');
                  if (!fs.existsSync(contentDir)) {
                    fs.mkdirSync(contentDir, { recursive: true });
                  }
                  const fileName = `${template.id}-${template.title.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_')}.txt`;
                  const filePath = path.join(contentDir, fileName);
                  fs.writeFileSync(filePath, detailResult.content, 'utf-8');

                  downloadedItems.push({
                    id: template.id,
                    title: template.title,
                    category: template.category,
                    filePath,
                    fileType: 'content',
                    sourceUrl: template.sourceUrl,
                    downloadedAt: new Date().toISOString(),
                    content: detailResult.content,
                  });
                }
              }

              // 添加延迟避免请求过快
              await this.randomDelay();
            } catch (downloadError) {
              const errorMsg = `获取内容失败 [${template.title}]: ${downloadError}`;
              allErrors.push(errorMsg);
              this.logger.warn(errorMsg);
            }
          }
        } finally {
          await playwright.close();
        }
      } else {
        // 使用种子数据（后备方案）- 不下载真实文件
        templates = await this.fetchContractList(options);
        this.logger.info(
          `下载阶段: 获取 ${templates.length} 个模板（种子数据模式）`
        );
      }

      // 保存检查点
      const checkpoint: SAMRDownloadCheckpoint = {
        timestamp: new Date().toISOString(),
        templates: downloadedItems,
      };
      await this.saveDownloadCheckpoint(outputDir, checkpoint);

      const duration = Date.now() - startTime;

      return {
        success: allErrors.length === 0,
        itemsCrawled: templates.length,
        itemsCreated: downloadedItems.length,
        itemsUpdated: 0,
        errors: allErrors,
        duration,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      return {
        success: false,
        itemsCrawled: 0,
        itemsCreated: 0,
        itemsUpdated: 0,
        errors: [errorMessage],
        duration,
      };
    }
  }

  /**
   * 两阶段架构 - Phase 2: 解析阶段
   * 从磁盘读取文件并使用多方法解析后写入数据库
   */
  async parseAll(options?: SAMRParseOptions): Promise<CrawlerResult> {
    const startTime = Date.now();
    const outputDir = options?.outputDir || this.__DEFAULT_OUTPUT_DIR;

    this.updateProgress({
      status: 'running',
      startedAt: new Date(),
      errors: [],
    });

    // 加载下载检查点
    const checkpoint = await this.loadDownloadCheckpoint(outputDir);

    if (!checkpoint || checkpoint.templates.length === 0) {
      this.logger.warn('未找到下载文件，检查点为空，将使用种子数据模式');
      // 回退到种子数据模式 - 简化处理，直接返回空结果
      return {
        success: true,
        itemsCrawled: 0,
        itemsCreated: 0,
        itemsUpdated: 0,
        errors: [],
        duration: Date.now() - startTime,
      };
    }

    let successCount = 0;
    const allErrors: string[] = [];
    const parseResults: SAMRParseResultItem[] = [];
    const fs = await import('fs');

    this.updateProgress({
      totalItems: checkpoint.templates.length,
      currentItem: '开始解析文件',
    });

    for (let i = 0; i < checkpoint.templates.length; i++) {
      const item = checkpoint.templates[i];
      this.updateProgress({
        processedItems: i,
        currentItem: `解析 ${item.title}`,
      });

      try {
        // 检查文件是否存在
        if (!fs.existsSync(item.filePath)) {
          throw new Error(`文件不存在: ${item.filePath}`);
        }

        let content = '';
        let parseMethod = '';

        // 根据文件类型使用多方法解析
        if (item.fileType === 'docx') {
          const fileBuffer = await fs.promises.readFile(item.filePath);
          content = await this.parseDocxFile(fileBuffer, item.id);
          parseMethod = 'multi-method-docx';
        } else if (item.fileType === 'pdf') {
          const fileBuffer = await fs.promises.readFile(item.filePath);
          content = await this.parsePdfFile(fileBuffer);
          parseMethod = 'pdf-parse';
        } else if (item.fileType === 'content') {
          // 新版网站：直接从文件读取内容
          content = await fs.promises.readFile(item.filePath, 'utf-8');
          parseMethod = 'direct-content';
        } else {
          // HTML 文件直接读取内容
          const fileBuffer = await fs.promises.readFile(item.filePath);
          content = fileBuffer.toString('utf-8');
          parseMethod = 'raw-text';
        }

        if (!content || content.length < 20) {
          throw new Error('解析结果内容过短');
        }

        // 使用解析内容生成模板数据
        const category = this.mapCategory(item.category);
        const templateData: ContractTemplateData = {
          name: item.title,
          code: item.id,
          category: category as ContractCategory,
          subCategory: item.category,
          description: `${item.category}合同示范文本`,
          source: SAMR_CONFIG.source,
          sourceUrl: item.sourceUrl,
          sourceId: item.id,
          publishedDate: new Date(),
          effectiveDate: new Date(),
          version: '1.0',
          isLatest: true,
          priority: this.determinePriority(item.category),
          fullText: content,
          content: this.extractMainContent(content),
          variables: this.generateVariables(item.title, category),
          clauses: this.generateClauses(item.title, category),
          riskWarnings: this.generateRiskWarnings(item.title, category),
          usageGuide: this.generateUsageGuide(item.title, category),
        };

        // 保存到数据库
        await this.saveTemplate(templateData);
        successCount++;

        parseResults.push({
          id: item.id,
          title: item.title,
          content: content.substring(0, 100), // 只保存前100字符用于记录
          parseMethod,
          parsedAt: new Date().toISOString(),
          success: true,
        });
      } catch (error) {
        const errorMsg = `解析失败 [${item.title}]: ${error}`;
        allErrors.push(errorMsg);
        this.logger.error(errorMsg, error);

        parseResults.push({
          id: item.id,
          title: item.title,
          content: '',
          parseMethod: 'failed',
          parsedAt: new Date().toISOString(),
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }

      // 添加延迟避免解析过快
      await this.randomDelay();
    }

    // 保存解析结果
    const results: SAMRParseResults = {
      timestamp: new Date().toISOString(),
      items: parseResults,
    };
    await this.saveParseResults(outputDir, results);

    const duration = Date.now() - startTime;
    this.updateProgress({ status: 'completed', completedAt: new Date() });

    return {
      success: allErrors.length === 0,
      itemsCrawled: checkpoint.templates.length,
      itemsCreated: successCount,
      itemsUpdated: 0,
      errors: allErrors,
      duration,
    };
  }

  /**
   * 重新解析失败的文件
   */
  async reparseFailed(options?: SAMRParseOptions): Promise<CrawlerResult> {
    return this.parseAll({ ...options, maxAttempts: 1 });
  }

  /**
   * 分页获取合同模板列表
   */
  async fetchContractListWithPagination(
    page: number = 1,
    pageSize: number = 20,
    category?: string
  ): Promise<{
    items: SAMRContractListItem[];
    total: number;
    hasMore: boolean;
  }> {
    const allTemplates = KNOWN_CONTRACT_TEMPLATES;

    // 按分类筛选
    let filtered = allTemplates;
    if (category) {
      filtered = allTemplates.filter(
        t => t.category.includes(category) || t.title.includes(category)
      );
    }

    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    const items = filtered.slice(start, end);

    return {
      items,
      total: filtered.length,
      hasMore: end < filtered.length,
    };
  }

  /**
   * 获取合同模板列表
   */
  private async fetchContractList(
    options?: SAMRCrawlOptions
  ): Promise<SAMRContractListItem[]> {
    // 如果指定使用真实API且API可用
    if (options?.useRealApi) {
      try {
        const realTemplates = await this.fetchFromRealApi(options);
        if (realTemplates.length > 0) {
          this.logger.info('使用真实API获取数据');
          if (options.categories && options.categories.length > 0) {
            return realTemplates.filter(t =>
              options.categories!.some(c => t.category.includes(c))
            );
          }
          return realTemplates;
        }
      } catch (error) {
        this.logger.warn('真实API获取失败，回退到模拟数据', error);
      }
    }

    // 使用已知合同模板列表
    let templates = KNOWN_CONTRACT_TEMPLATES;

    // 过滤指定分类
    if (options?.categories && options.categories.length > 0) {
      templates = templates.filter(t =>
        options.categories!.some(
          c => t.category.includes(c) || t.title.includes(c)
        )
      );
    }

    // 限制数量
    if (options?.maxItems && options.maxItems > 0) {
      templates = templates.slice(0, options.maxItems);
    }

    return templates;
  }

  /**
   * 从真实API获取数据（支持12315.cn）
   */
  private async fetchFromRealApi(
    options?: SAMRCrawlOptions
  ): Promise<SAMRContractListItem[]> {
    // 12315.cn API端点 (主要数据源)
    const primaryEndpoints = [
      '/api/contract/list',
      '/api/templates',
      '/api/list',
    ];

    // SAMR API端点 (备用数据源)
    const fallbackEndpoints = [
      '/api/htlb/list',
      '/api/contract/list',
      '/api/template/list',
    ];

    const searchPayload = {
      pageNum: 1,
      pageSize: 100,
      category: options?.categories?.[0] || '',
    };

    // 优先尝试主要数据源
    for (const endpoint of primaryEndpoints) {
      try {
        const url = `${this.PRIMARY_API_BASE}${endpoint}`;
        const rawResponse = await this.fetchWithRetry(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(searchPayload),
        });
        const response = rawResponse as SAMRApiResponse<SAMRApiResponseItem>;

        if (response.code === 200 && response.data) {
          this.logger.info('使用12315.cn API获取数据');
          return this.parseApiResponse(response);
        }
      } catch (error) {
        this.logger.warn(`12315.cn API端点 ${endpoint} 失败`, error);
      }
    }

    // 回退到备用数据源
    for (const endpoint of fallbackEndpoints) {
      try {
        const url = `${this.FALLBACK_API_BASE}${endpoint}`;
        const rawResponse = await this.fetchWithRetry(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(searchPayload),
        });
        const response = rawResponse as SAMRApiResponse<SAMRApiResponseItem>;

        if (response.code === 200 && response.data) {
          this.logger.info('使用SAMR备用API获取数据');
          return this.parseApiResponse(response);
        }
      } catch (error) {
        this.logger.warn(`SAMR API端点 ${endpoint} 失败`, error);
      }
    }

    return [];
  }

  /**
   * 解析API响应
   */
  private parseApiResponse(
    response: SAMRApiResponse<SAMRApiResponseItem>
  ): SAMRContractListItem[] {
    if (response.rows) {
      return response.rows.map((item: SAMRApiResponseItem) => ({
        id: item.id || item.htlbId || item.contractId,
        title: item.title || item.htlbName || item.contractName,
        category: item.category || item.htlbCategory || '',
        publishDate:
          item.publishDate ||
          item.gbrq ||
          new Date().toISOString().split('T')[0],
        downloadCount: item.downloadCount || item.xzCount || 0,
        sourceUrl: item.sourceUrl || item.detailUrl || '',
        docxUrl: item.docxUrl || item.fileUrl || '',
      }));
    }

    if (Array.isArray(response.data)) {
      return response.data;
    }

    return [];
  }

  /**
   * 带重试的fetch
   */
  private async fetchWithRetry<T>(
    url: string,
    options?: RequestInit,
    maxRetries = 3
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await fetch(url, {
          ...options,
          headers: {
            'User-Agent': SAMRCrawler.UA_POOL[0],
            Accept: 'application/json, text/plain, */*',
            'Accept-Language': 'zh-CN,zh;q=0.9',
            Referer: this.PRIMARY_API_BASE,
            ...options?.headers,
          },
          signal: AbortSignal.timeout(SAMR_CONFIG.requestTimeout),
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return response.json() as Promise<T>;
      } catch (error) {
        lastError = error as Error;
        if (attempt < maxRetries) {
          // 重试间隔：2-5秒之间随机
          const waitTime = 2000 + Math.random() * 3000;
          await this.delay(waitTime);
        }
      }
    }

    throw lastError;
  }

  /**
   * 采集单个合同模板
   */
  private async crawlTemplate(
    item: SAMRContractListItem
  ): Promise<ContractTemplateData | null> {
    this.logger.info(`开始采集: ${item.title}`);

    // 生成模板文本
    const fullText = this.generateTemplateText(item);
    const category = this.mapCategory(item.category);

    const templateData: ContractTemplateData = {
      // 基本信息
      name: item.title.replace('（示范文本）', ''),
      code: item.id,
      category: category as ContractCategory,
      subCategory: item.category,
      description: `${item.category}合同示范文本，由国家市场监督管理总局发布。${item.title}是官方提供的标准合同范本，适用于${item.category}场景。`,

      // 来源信息
      source: SAMR_CONFIG.source,
      sourceUrl: item.sourceUrl,
      sourceId: item.id,
      publishedDate: new Date(item.publishDate),
      effectiveDate: new Date(item.publishDate),

      // 模板内容
      fullText,
      content: this.extractMainContent(fullText),

      // 变量占位符
      variables: this.generateVariables(item.title, category),

      // 条款结构
      clauses: this.generateClauses(item.title, category),

      // 风险提示
      riskWarnings: this.generateRiskWarnings(item.title, category),

      // 使用指南
      usageGuide: this.generateUsageGuide(item.title, category),

      // 版本信息
      version: '1.0',
      isLatest: true,

      // 优先级
      priority: this.determinePriority(category),

      // 标签
      tags: [item.category, '示范文本', 'samr', '官方'],
      keywords: [item.title, item.category, '合同模板', '示范文本', '国家标准'],
    };

    // 保存到数据库
    await this.saveTemplate(templateData);

    return templateData;
  }

  /**
   * 生成合同模板文本
   */
  private generateTemplateText(item: SAMRContractListItem): string {
    const category = this.mapCategory(item.category);
    const categoryInfo = this.getCategoryInfo(category);

    return `【合同标题】
${item.title}

【合同编号】
__________________

【基本信息】
合同类别：${item.category}
发布机构：国家市场监督管理总局
发布时间：${item.publishDate}

${categoryInfo.headerContent}

【当事人信息】
甲方（${categoryInfo.partyALabel}）：
名称/姓名：__________________
地址：__________________
法定代表人/负责人：__________________
联系电话：__________________
证件号码：__________________

乙方（${categoryInfo.partyBLabel}）：
名称/姓名：__________________
地址：__________________
法定代表人/负责人：__________________
联系电话：__________________
证件号码：__________________

【主要条款】
${categoryInfo.mainClauses}

【双方权利义务】
（一）甲方的权利义务
${categoryInfo.partyAObligations}

（二）乙方的权利义务
${categoryInfo.partyBObligations}

【合同价款及支付】
${categoryInfo.paymentTerms}

【违约责任】
（一）甲方违约责任
${categoryInfo.partyALiability}

（二）乙方违约责任
${categoryInfo.partyBLiability}

【争议解决】
本合同在履行过程中发生争议，双方应协商解决；协商不成的，按下列第____种方式解决：
1. 提交__________________仲裁委员会仲裁；
2. 向__________________人民法院提起诉讼。

【合同解除与终止】
${categoryInfo.terminationTerms}

【不可抗力】
因不可抗力致使本合同不能履行或不能完全履行的，遭受不可抗力的一方可以部分或全部免除责任，但应当在合理期限内提供相关证明。

【其他约定】
${categoryInfo.miscellaneous}

【签署】
甲方（盖章）：__________________
法定代表人或授权代表（签字）：__________________
日期：____年____月____日

乙方（盖章/签字）：__________________
日期：____年____月____日

【使用说明】
本合同示范文本由国家市场监督管理总局提供，仅供参考。使用时请根据实际情况填写完整信息，并确保符合相关法律法规要求。`;
  }

  /**
   * 获取分类详细信息
   */
  private getCategoryInfo(category: string): Record<string, string> {
    const categoryMap: Record<string, Record<string, string>> = {
      LABOR: {
        partyALabel: '用人单位',
        partyBLabel: '劳动者',
        headerContent:
          '根据《中华人民共和国劳动法》《中华人民共和国劳动合同法》及相关法律法规，甲乙双方本着平等自愿、协商一致的原则，订立本合同。',
        mainClauses: `第一条 合同期限
本合同为____期限劳动合同。合同期限自____年____月____日起至____年____月____日止。

第二条 工作内容和工作地点
（一）乙方同意在____岗位，从事____工作。
（二）乙方的工作地点为____。

第三条 工作时间和休息休假
乙方实行____工时制。甲方应保证乙方每周至少休息一日。

第四条 劳动报酬
（一）甲方每月____日前以货币形式支付乙方工资，月工资为____元。
（二）乙方在法定休假日和婚丧假期间以及依法参加社会活动期间，甲方应当依法支付工资。

第五条 社会保险
甲乙双方应依法参加社会保险，缴纳社会保险费。`,
        partyAObligations: `1. 按时足额支付劳动报酬
2. 依法为乙方缴纳社会保险
3. 提供符合国家规定的劳动安全卫生条件和必要的劳动防护用品
4. 对乙方进行职业培训，培训上岗
5. 遵守劳动安全卫生规程和操作规程`,
        partyBObligations: `1. 遵守甲方的规章制度，服从工作安排
2. 按时保质完成工作任务
3. 遵守劳动安全卫生规程和操作规程
4. 保守甲方的商业秘密
5. 依法参加社会保险`,
        paymentTerms:
          '劳动报酬按月支付，甲方每月____日前以货币形式支付乙方工资。乙方依法享受婚假、产假、丧假等假期期间，甲方按规定支付工资。',
        partyALiability:
          '甲方未按约定支付劳动报酬、不提供劳动条件或缴纳社会保险的，乙方可以解除劳动合同，甲方应按规定支付经济补偿。',
        partyBLiability:
          '乙方违反服务期约定或竞业限制约定的，应按约定向甲方支付违约金。违反甲方规章制度的，甲方可以依法处理。',
        terminationTerms:
          '劳动合同期满、双方协商一致或法律规定的其他情形下，劳动合同终止或解除。用人单位应依法支付经济补偿。',
        miscellaneous:
          '本合同一式两份，甲乙双方各执一份。本合同附件与本合同具有同等法律效力。',
      },
      CIVIL: {
        partyALabel: '卖方/甲方',
        partyBLabel: '买方/乙方',
        headerContent:
          '根据《中华人民共和国民法典》及相关法律法规，甲乙双方在平等、自愿、公平的基础上，就____事宜达成如下协议。',
        mainClauses: `第一条 标的物
本合同标的物为____，规格为____，数量为____。

第二条 价款及支付
本合同总价款为人民币____元（大写：____）。
支付方式：____（现金/转账/分期）

第三条 交付方式
甲方应于____年____月____日前将标的物交付乙方，交付地点为____。`,
        partyAObligations: `1. 按时交付符合约定的标的物
2. 保证标的物的质量和规格符合约定
3. 转移标的物的所有权
4. 协助乙方办理相关手续`,
        partyBObligations: `1. 按时支付合同价款
2. 按时接收标的物
3. 验收标的物并提出异议
4. 按约定使用和维护标的物`,
        paymentTerms:
          '合同价款按下列第____种方式支付：1. 一次性支付；2. 分期支付，首期于合同签订时支付____元，余款于____支付。',
        partyALiability:
          '甲方逾期交付标的物的，每逾期一日应支付违约金____元；甲方交付的标的物不符合约定标准的，乙方有权要求更换或退货。',
        partyBLiability:
          '乙方逾期支付价款的，每逾期一日应支付违约金____元；乙方无正当理由拒绝接收标的物的，应承担相应的违约责任。',
        terminationTerms:
          '双方协商一致或因不可抗力致使合同目的无法实现的，可以解除合同。因一方违约导致合同解除的，违约方应承担违约责任。',
        miscellaneous:
          '本合同未尽事宜，双方可另行签订补充协议。补充协议与本合同具有同等法律效力。',
      },
      LEASE: {
        partyALabel: '出租方',
        partyBLabel: '承租方',
        headerContent:
          '根据《中华人民共和国民法典》及相关法律法规，甲乙双方在平等、自愿、公平的基础上，就租赁事宜达成如下协议。',
        mainClauses: `第一条 租赁物
本合同租赁物为____，位于____，面积为____平方米。

第二条 租赁期限
租赁期限自____年____月____日起至____年____月____日止。

第三条 租金及支付
租金为人民币____元/月（年），支付方式为____。`,
        partyAObligations: `1. 按时交付租赁物
2. 保证租赁物符合约定的使用条件
3. 不得擅自进入租赁物
4. 履行维修义务（约定范围内）`,
        partyBObligations: `1. 按时支付租金
2. 妥善使用和维护租赁物
3. 不得擅自转租
4. 租赁期满返还租赁物`,
        paymentTerms:
          '租金按____（月/季/年）支付，乙方应于每（____）的____日前支付下一期租金。首期租金于合同签订时支付。',
        partyALiability:
          '甲方逾期交付租赁物或租赁物不符合约定使用条件的，应承担相应的违约责任。甲方无正当理由收回租赁物的，应赔偿乙方损失。',
        partyBLiability:
          '乙方逾期支付租金的，每逾期一日应支付违约金____元；乙方擅自转租或损坏租赁物的，应承担赔偿责任。',
        terminationTerms:
          '租赁期满、双方协商一致或法律规定的其他情形下，租赁合同终止。承租人应返还租赁物，出租人应退还押金（扣除应扣款项后）。',
        miscellaneous:
          '本合同一式两份，甲乙双方各执一份。租赁期间，双方可另行签订补充协议。',
      },
      CONSTRUCTION: {
        partyALabel: '发包方/建设单位',
        partyBLabel: '承包方/施工单位',
        headerContent:
          '根据《中华人民共和国民法典》《中华人民共和国建筑法》及相关法律法规，甲乙双方就建设工程施工事宜达成如下协议。',
        mainClauses: `第一条 工程概况
工程名称：____
工程地点：____
工程内容：____
工程规模：____平方米/米

第二条 合同价款
本合同总价款为人民币____元（大写：____），采用____方式确定。

第三条 工期
开工日期：____年____月____日
竣工日期：____年____月____日
合同工期：____日历天`,
        partyAObligations: `1. 按时支付工程款
2. 提供施工所需的图纸和资料
3. 协调解决施工中的问题
4. 及时进行工程验收`,
        partyBObligations: `1. 按时进场施工
2. 保证工程质量和安全
3. 按时竣工交付
4. 提交完整的竣工资料`,
        paymentTerms:
          '工程款按下列方式支付：预付款为合同价款的____%，于合同签订后____日内支付；进度款按月支付；竣工验收合格后支付至合同价款的____%；质保期满后支付余款。',
        partyALiability:
          '发包方未按时支付工程款的，应支付逾期付款利息；因发包方原因导致停工的，发包方应赔偿承包方的损失。',
        partyBLiability:
          '承包方逾期竣工或工程质量问题，承包方应承担违约责任和返工费用。承包方将工程转包的，发包方有权解除合同。',
        terminationTerms:
          '因一方违约导致合同无法继续履行的，违约方应承担违约责任。工程完工验收合格后，合同终止。',
        miscellaneous:
          '本合同一式____份，甲乙双方各执____份。本合同采用GF格式合同文本。',
      },
      REAL_ESTATE: {
        partyALabel: '出卖人/甲方',
        partyBLabel: '买受人/乙方',
        headerContent:
          '根据《中华人民共和国民法典》《中华人民共和国城市房地产管理法》及相关法律法规，甲乙双方就房屋买卖事宜达成如下协议。',
        mainClauses: `第一条 房屋基本情况
房屋坐落：____
建筑面积：____平方米
房屋用途：____
产权情况：____

第二条 成交价格
本合同成交价格为人民币____元（大写：____）。

第三条 付款方式
乙方选择下列第____种方式付款：
1. 一次性付款
2. 贷款付款`,
        partyAObligations: `1. 按时交付符合约定条件的房屋
2. 配合乙方办理产权过户手续
3. 保证房屋权属清晰无争议
4. 提供必要的证明文件`,
        partyBObligations: `1. 按时支付房款
2. 按时申请贷款（如适用）
3. 配合办理产权过户手续
4. 按时接收房屋`,
        paymentTerms:
          '房款支付方式：1. 一次性付款：乙方应于____前支付全部房款；2. 贷款付款：乙方应于____前支付首付款____元，余款通过银行贷款支付。',
        partyALiability:
          '出卖人逾期交房或房屋不符合约定条件的，应承担违约责任。出卖人无权处分房屋导致合同无效的，应返还房款并赔偿损失。',
        partyBLiability:
          '买受人逾期付款的，应承担违约责任。买受人原因导致贷款无法审批的，应以现金补足房款。',
        terminationTerms:
          '因不可抗力或一方违约导致合同目的无法实现的，可以解除合同。解除合同的，双方应互相返还财产。',
        miscellaneous:
          '本合同一式____份，甲乙双方各执____份。本合同自双方签字（盖章）之日起生效。',
      },
      TRANSPORTATION: {
        partyALabel: '托运人',
        partyBLabel: '承运人',
        headerContent:
          '根据《中华人民共和国民法典》及相关法律法规，甲乙双方就货物运输事宜达成如下协议。',
        mainClauses: `第一条 货物信息
货物名称：____
货物数量：____
货物重量/体积：____
货物价值：____元

第二条 运输路线
起运地：____
目的地：____
运输方式：____`,
        partyAObligations: `1. 按时交付托运货物
2. 提供准确的货物信息
3. 按时支付运费
4. 妥善包装货物`,
        partyBObligations: `1. 按时安全运输货物到目的地
2. 妥善保管货物
3. 及时通知收货人
4. 配合托运人查询货物状态`,
        paymentTerms:
          '运费为人民币____元，支付方式为____（预付/到付）。运费不包括装卸费、仓储费等其他费用（如需发生，另行协商）。',
        partyALiability:
          '托运人未按时支付运费的，承运人可以留置货物。托运人虚报货物信息造成损失的，应承担赔偿责任。',
        partyBLiability:
          '承运人逾期运输或造成货物损失的，应承担赔偿责任。因不可抗力造成的损失，双方合理分担。',
        terminationTerms:
          '货物到达目的地前，双方可协商解除合同。解除合同的，已完成的运输部分支付相应运费，未完成的退还预付款。',
        miscellaneous:
          '本合同一式两份，甲乙双方各执一份。运输过程中的其他费用，按实际发生由责任方承担。',
      },
      INTELLECTUAL_PROPERTY: {
        partyALabel: '许可方/转让方',
        partyBLabel: '被许可方/受让方',
        headerContent:
          '根据《中华人民共和国民法典》及相关知识产权法律法规，甲乙双方就知识产权许可/转让事宜达成如下协议。',
        mainClauses: `第一条 知识产权信息
权利类型：____（专利/商标/著作权/技术秘密）
权利名称/专利号/登记号：____
权利范围：____

第二条 许可/转让内容
许可/转让方式：____（独占/排他/普通许可）
许可/转让期限：____年____月____日至____年____月____日
地域范围：____`,
        partyAObligations: `1. 保证拥有合法的知识产权
2. 按时交付知识产权相关资料
3. 协助办理登记/备案手续
4. 不得另行许可第三方（独占许可时）`,
        partyBObligations: `1. 按时支付许可费/转让费
2. 在约定范围内使用知识产权
3. 不得超出约定范围使用
4. 按时报告使用情况（许可时）`,
        paymentTerms:
          '许可费/转让费为人民币____元，支付方式为：____（一次性/分期/按销售额提成）。',
        partyALiability:
          '许可方无权处分知识产权或知识产权被宣告无效的，应返还许可费并赔偿损失。许可方违反不竞争义务的，应承担违约责任。',
        partyBLiability:
          '被许可方超出约定范围使用知识产权或逾期支付许可费的，应承担违约责任。',
        terminationTerms:
          '许可期限届满、双方协商一致或一方根本违约的，合同终止。终止后，被许可方应停止使用相关知识产权。',
        miscellaneous:
          '本合同一式____份，甲乙双方各执____份。需要办理登记备案的，双方应及时办理相关手续。',
      },
      SERVICE: {
        partyALabel: '委托方/甲方',
        partyBLabel: '受托方/乙方',
        headerContent:
          '根据《中华人民共和国民法典》及相关法律法规，甲乙双方就委托服务事宜达成如下协议。',
        mainClauses: `第一条 服务内容
服务项目：____
服务标准：____
服务成果：____

第二条 服务期限
服务期限自____年____月____日起至____年____月____日止。`,
        partyAObligations: `1. 按时支付服务费用
2. 提供必要的资料和配合
3. 及时确认服务成果
4. 不得无理拒绝合理要求`,
        partyBObligations: `1. 按约定标准提供服务
2. 按时完成服务任务
3. 妥善保管委托方资料
4. 按时提交服务成果`,
        paymentTerms:
          '服务费用为人民币____元，支付方式为：____（预付/到付/按阶段支付）。',
        partyALiability:
          '委托方逾期支付服务费用的，应支付逾期付款利息。委托方未提供必要配合导致服务无法正常进行的，服务期限顺延。',
        partyBLiability:
          '受托方未按约定标准提供服务或逾期提交服务成果的，应承担违约责任。受托方泄露委托方商业秘密的，应承担赔偿责任。',
        terminationTerms:
          '服务期限届满、双方协商一致或一方根本违约的，合同终止。终止后，双方应结算已完成部分的服务费用。',
        miscellaneous:
          '本合同一式____份，甲乙双方各执一份。服务过程中产生的知识产权归属，按约定或法律规定确定。',
      },
      COMMERCIAL: {
        partyALabel: '甲方',
        partyBLabel: '乙方',
        headerContent:
          '根据《中华人民共和国民法典》及相关法律法规，甲乙双方本着平等互利、诚实信用的原则，就合作事宜达成如下协议。',
        mainClauses: `第一条 合作内容
合作项目：____
合作方式：____
合作期限：____年____月____日至____年____月____日`,
        partyAObligations: `1. 按约定履行合作义务
2. 按时投入约定资源
3. 诚实守信，不隐瞒重要信息
4. 保守商业秘密`,
        partyBObligations: `1. 按约定履行合作义务
2. 按时投入约定资源
3. 诚实守信，不隐瞒重要信息
4. 保守商业秘密`,
        paymentTerms:
          '合作收益分配方式：____（按比例/固定收益/其他方式）。具体分配比例和时间另行约定。',
        partyALiability:
          '一方未按约定履行合作义务或违约的，应赔偿因此给对方造成的损失。违约金不足以弥补损失的，应补足差额。',
        partyBLiability: '同甲方违约责任。',
        terminationTerms:
          '合作期满、双方协商一致或一方根本违约的，合作关系终止。终止后，双方应进行清算并分配剩余财产。',
        miscellaneous:
          '本合同一式____份，甲乙双方各执____份。合作过程中的其他事项，双方另行协商确定。',
      },
    };

    return (
      categoryMap[category] || {
        partyALabel: '甲方',
        partyBLabel: '乙方',
        headerContent:
          '根据《中华人民共和国民法典》及相关法律法规，甲乙双方在平等、自愿、公平的基础上，达成如下协议。',
        mainClauses: `第一条 合同标的
本合同标的为____。

第二条 合同价款
本合同总价款为人民币____元。

第三条 合同期限
自____年____月____日起至____年____月____日止。`,
        partyAObligations:
          '1. 履行合同约定的义务\n2. 按时交付符合要求的内容\n3. 保守商业秘密',
        partyBObligations:
          '1. 履行合同约定的义务\n2. 按时支付合同价款\n3. 保守商业秘密',
        paymentTerms: '合同价款为人民币____元，支付方式为____。',
        partyALiability: '违约方应承担违约责任，赔偿因此给对方造成的损失。',
        partyBLiability: '同甲方违约责任。',
        terminationTerms: '合同期满或双方协商一致，合同终止。',
        miscellaneous: '本合同一式两份，甲乙双方各执一份。',
      }
    );
  }

  /**
   * 提取主要内容
   */
  private extractMainContent(fullText: string): string {
    const lines = fullText.split('\n').filter(line => line.trim());
    return lines.slice(0, 10).join('\n');
  }

  /**
   * 映射分类
   */
  private mapCategory(category: string): string {
    for (const [key, value] of Object.entries(CONTRACT_CATEGORIES)) {
      if (category.includes(key)) {
        return value;
      }
    }
    return 'OTHER';
  }

  /**
   * 确定优先级
   */
  private determinePriority(category: string): TemplatePriority {
    const highPriorityCategories = [
      'LABOR',
      'CIVIL',
      'CONSTRUCTION',
      'REAL_ESTATE',
    ];
    const mediumPriorityCategories = ['LEASE', 'TRANSPORTATION', 'SERVICE'];

    if (highPriorityCategories.includes(category)) {
      return 'P0';
    }
    if (mediumPriorityCategories.includes(category)) {
      return 'P1';
    }
    return 'P2';
  }

  /**
   * 生成变量定义
   */
  private generateVariables(
    _title: string,
    category: string
  ): TemplateVariable[] {
    const baseVariables: TemplateVariable[] = [
      {
        key: 'contract_no',
        label: '合同编号',
        type: 'text',
        required: true,
        placeholder: '请输入合同编号',
      },
      {
        key: 'party_a_name',
        label: '甲方名称',
        type: 'text',
        required: true,
        placeholder: '请输入甲方名称/姓名',
      },
      {
        key: 'party_a_address',
        label: '甲方地址',
        type: 'text',
        required: true,
        placeholder: '请输入甲方地址',
      },
      {
        key: 'party_a_contact',
        label: '甲方联系方式',
        type: 'text',
        required: true,
        placeholder: '请输入甲方联系电话',
      },
      {
        key: 'party_b_name',
        label: '乙方名称',
        type: 'text',
        required: true,
        placeholder: '请输入乙方名称/姓名',
      },
      {
        key: 'party_b_address',
        label: '乙方地址',
        type: 'text',
        required: true,
        placeholder: '请输入乙方地址',
      },
      {
        key: 'party_b_contact',
        label: '乙方联系方式',
        type: 'text',
        required: true,
        placeholder: '请输入乙方联系电话',
      },
    ];

    const categoryVariables: Record<string, TemplateVariable[]> = {
      LABOR: [
        {
          key: 'position',
          label: '工作岗位',
          type: 'text',
          required: true,
          placeholder: '请输入乙方工作岗位',
        },
        {
          key: 'work_location',
          label: '工作地点',
          type: 'text',
          required: true,
          placeholder: '请输入工作地点',
        },
        {
          key: 'salary',
          label: '工资',
          type: 'number',
          required: true,
          placeholder: '请输入月工资',
        },
        {
          key: 'salary_payment_date',
          label: '发薪日',
          type: 'text',
          required: true,
          placeholder: '如：每月15日',
        },
        {
          key: 'contract_start_date',
          label: '合同起始日期',
          type: 'date',
          required: true,
        },
        {
          key: 'contract_end_date',
          label: '合同终止日期',
          type: 'date',
          required: false,
        },
      ],
      CIVIL: [
        {
          key: 'subject_matter',
          label: '标的物名称',
          type: 'text',
          required: true,
          placeholder: '请输入标的物名称',
        },
        {
          key: 'subject_matter_spec',
          label: '标的物规格',
          type: 'text',
          required: true,
          placeholder: '请输入标的物规格型号',
        },
        {
          key: 'quantity',
          label: '数量',
          type: 'number',
          required: true,
          placeholder: '请输入数量',
        },
        {
          key: 'total_price',
          label: '合同总价款',
          type: 'number',
          required: true,
          placeholder: '请输入合同总价款',
        },
        {
          key: 'delivery_date',
          label: '交付日期',
          type: 'date',
          required: true,
        },
        {
          key: 'delivery_location',
          label: '交付地点',
          type: 'text',
          required: true,
          placeholder: '请输入交付地点',
        },
      ],
      LEASE: [
        {
          key: 'property_address',
          label: '租赁物地址',
          type: 'text',
          required: true,
          placeholder: '请输入租赁物详细地址',
        },
        {
          key: 'property_area',
          label: '面积',
          type: 'text',
          required: true,
          placeholder: '请输入租赁物面积',
        },
        {
          key: 'monthly_rent',
          label: '月租金',
          type: 'number',
          required: true,
          placeholder: '请输入月租金',
        },
        {
          key: 'rent_payment_day',
          label: '租金支付日',
          type: 'text',
          required: true,
          placeholder: '如：每月1日',
        },
        {
          key: 'lease_start_date',
          label: '租赁起始日期',
          type: 'date',
          required: true,
        },
        {
          key: 'lease_end_date',
          label: '租赁终止日期',
          type: 'date',
          required: true,
        },
        {
          key: 'deposit',
          label: '押金',
          type: 'number',
          required: true,
          placeholder: '请输入押金金额',
        },
      ],
      CONSTRUCTION: [
        {
          key: 'project_name',
          label: '工程名称',
          type: 'text',
          required: true,
          placeholder: '请输入工程名称',
        },
        {
          key: 'project_location',
          label: '工程地点',
          type: 'text',
          required: true,
          placeholder: '请输入工程地点',
        },
        {
          key: 'total_contract_price',
          label: '合同总价款',
          type: 'number',
          required: true,
          placeholder: '请输入合同总价款',
        },
        {
          key: 'start_date',
          label: '开工日期',
          type: 'date',
          required: true,
        },
        {
          key: 'completion_date',
          label: '竣工日期',
          type: 'date',
          required: true,
        },
        {
          key: 'quality_standard',
          label: '质量标准',
          type: 'select',
          required: true,
          options: ['合格', '优良', '其他'],
        },
      ],
      REAL_ESTATE: [
        {
          key: 'property_address',
          label: '房屋坐落',
          type: 'text',
          required: true,
          placeholder: '请输入房屋坐落地址',
        },
        {
          key: 'building_area',
          label: '建筑面积',
          type: 'number',
          required: true,
          placeholder: '请输入建筑面积（平方米）',
        },
        {
          key: 'total_price',
          label: '成交价格',
          type: 'number',
          required: true,
          placeholder: '请输入成交价格',
        },
        {
          key: 'down_payment',
          label: '首付款',
          type: 'number',
          required: true,
          placeholder: '请输入首付款金额',
        },
        {
          key: 'loan_amount',
          label: '贷款金额',
          type: 'number',
          required: false,
          placeholder: '请输入贷款金额',
        },
      ],
      TRANSPORTATION: [
        {
          key: 'cargo_name',
          label: '货物名称',
          type: 'text',
          required: true,
          placeholder: '请输入货物名称',
        },
        {
          key: 'cargo_quantity',
          label: '货物数量',
          type: 'number',
          required: true,
          placeholder: '请输入货物数量',
        },
        {
          key: 'origin',
          label: '起运地',
          type: 'text',
          required: true,
          placeholder: '请输入起运地',
        },
        {
          key: 'destination',
          label: '目的地',
          type: 'text',
          required: true,
          placeholder: '请输入目的地',
        },
        {
          key: 'freight',
          label: '运费',
          type: 'number',
          required: true,
          placeholder: '请输入运费金额',
        },
      ],
      INTELLECTUAL_PROPERTY: [
        {
          key: 'ip_type',
          label: '知识产权类型',
          type: 'select',
          required: true,
          options: ['专利', '商标', '著作权', '技术秘密', '其他'],
        },
        {
          key: 'ip_name',
          label: '知识产权名称/编号',
          type: 'text',
          required: true,
          placeholder: '请输入知识产权名称或登记号',
        },
        {
          key: 'license_type',
          label: '许可方式',
          type: 'select',
          required: true,
          options: ['独占许可', '排他许可', '普通许可'],
        },
        {
          key: 'license_fee',
          label: '许可费',
          type: 'number',
          required: true,
          placeholder: '请输入许可费金额',
        },
        {
          key: 'license_start_date',
          label: '许可起始日期',
          type: 'date',
          required: true,
        },
        {
          key: 'license_end_date',
          label: '许可终止日期',
          type: 'date',
          required: true,
        },
      ],
      SERVICE: [
        {
          key: 'service_project',
          label: '服务项目',
          type: 'text',
          required: true,
          placeholder: '请输入服务项目名称',
        },
        {
          key: 'service_standard',
          label: '服务标准',
          type: 'textarea',
          required: true,
          placeholder: '请描述服务标准和要求',
        },
        {
          key: 'service_fee',
          label: '服务费用',
          type: 'number',
          required: true,
          placeholder: '请输入服务费用',
        },
        {
          key: 'service_start_date',
          label: '服务起始日期',
          type: 'date',
          required: true,
        },
        {
          key: 'service_end_date',
          label: '服务终止日期',
          type: 'date',
          required: true,
        },
      ],
      COMMERCIAL: [
        {
          key: 'cooperation_project',
          label: '合作项目',
          type: 'text',
          required: true,
          placeholder: '请输入合作项目名称',
        },
        {
          key: 'cooperation_mode',
          label: '合作方式',
          type: 'select',
          required: true,
          options: ['合伙', '联营', '投资', '合作开发', '其他'],
        },
        {
          key: 'investment_amount',
          label: '投资金额',
          type: 'number',
          required: true,
          placeholder: '请输入投资金额',
        },
        {
          key: 'profit_sharing_ratio',
          label: '利润分配比例',
          type: 'text',
          required: true,
          placeholder: '如：甲方60%，乙方40%',
        },
        {
          key: 'cooperation_start_date',
          label: '合作起始日期',
          type: 'date',
          required: true,
        },
        {
          key: 'cooperation_end_date',
          label: '合作终止日期',
          type: 'date',
          required: true,
        },
      ],
    };

    return [...baseVariables, ...(categoryVariables[category] || [])];
  }

  /**
   * 生成条款结构
   */
  private generateClauses(_title: string, _category: string): TemplateClause[] {
    return [
      {
        type: 'PARTIES' as ClauseType,
        title: '当事人信息',
        content: '甲乙双方的基本信息，包括名称、地址、联系方式等',
        order: 1,
        isRequired: true,
        fillGuidance: '请准确填写双方的基本信息，确保与证件一致',
      },
      {
        type: 'SUBJECT_MATTER' as ClauseType,
        title: '合同标的',
        content: '本合同涉及的主要标的物、服务或项目',
        order: 2,
        isRequired: true,
        fillGuidance: '详细描述标的物的名称、规格、数量等信息',
      },
      {
        type: 'PRICE_PAYMENT' as ClauseType,
        title: '价款与支付',
        content: '合同金额及支付方式、支付期限',
        order: 3,
        isRequired: true,
        fillGuidance: '明确价款金额、支付方式和支付时间',
      },
      {
        type: 'PERFORMANCE' as ClauseType,
        title: '履行条款',
        content: '双方的权利义务及履行方式',
        order: 4,
        isRequired: true,
        fillGuidance: '详细列明双方各自的义务和权利',
      },
      {
        type: 'LIABILITY' as ClauseType,
        title: '违约责任',
        content: '违约情形及责任承担方式',
        order: 5,
        isRequired: true,
        fillGuidance: '明确各种违约情形及相应的违约责任',
      },
      {
        type: 'DISPUTE' as ClauseType,
        title: '争议解决',
        content: '争议解决方式及管辖',
        order: 6,
        isRequired: true,
        fillGuidance: '选择仲裁或诉讼，选择管辖法院或仲裁机构',
      },
      {
        type: 'TERMINATION' as ClauseType,
        title: '合同解除',
        content: '合同解除条件及方式',
        order: 7,
        isRequired: false,
        fillGuidance: '约定合同解除的条件和程序',
      },
      {
        type: 'FORCE_MAJEURE' as ClauseType,
        title: '不可抗力',
        content: '不可抗力事件的认定和处理',
        order: 8,
        isRequired: false,
        fillGuidance: '明确不可抗力的定义和处理方式',
      },
      {
        type: 'MISCELLANEOUS' as ClauseType,
        title: '其他约定',
        content: '其他未尽事宜的约定',
        order: 9,
        isRequired: false,
        fillGuidance: '补充其他需要约定的事项',
      },
    ];
  }

  /**
   * 生成风险提示
   */
  private generateRiskWarnings(title: string, category: string): RiskWarning[] {
    const commonWarnings: RiskWarning[] = [
      {
        level: 'HIGH' as RiskLevel,
        title: '主体资格审查',
        description:
          '签约前应仔细核实对方身份信息和资质证书，确保对方具有签约资格和履约能力。',
        legalBasis: '《中华人民共和国民法典》第一百四十八条',
        suggestion:
          '建议要求对方提供营业执照、身份证件等复印件并加盖公章（个人签字）。对于重大合同，可委托律师进行尽职调查。',
      },
      {
        level: 'HIGH' as RiskLevel,
        title: '合同条款完整性',
        description:
          '合同条款应完整、明确，避免使用模糊表述。重要事项都应以书面形式约定清楚。',
        legalBasis: '《中华人民共和国民法典》第四百七十条',
        suggestion:
          '建议逐条审核合同内容，对重要条款进行细化明确。如有必要，可请专业律师审核合同文本。',
      },
      {
        level: 'MEDIUM' as RiskLevel,
        title: '违约责任明确性',
        description:
          '违约责任条款应具体明确，包括违约情形、违约责任承担方式、违约金计算方式等。',
        legalBasis: '《中华人民共和国民法典》第五百七十七条',
        suggestion:
          '建议明确约定违约金数额或计算方式，以及损失赔偿范围。对于重大合同，建议约定损失赔偿的上限。',
      },
      {
        level: 'MEDIUM' as RiskLevel,
        title: '管辖约定合理性',
        description:
          '争议解决条款影响诉讼便利性和成本，应选择对己方有利的管辖法院或仲裁机构。',
        legalBasis: '《中华人民共和国民事诉讼法》第三十五条',
        suggestion:
          '建议根据己方实际情况选择管辖法院，如己方所在地法院。如选择仲裁，应选择信誉良好的仲裁机构。',
      },
      {
        level: 'LOW' as RiskLevel,
        title: '合同保存',
        description: '合同签署后应妥善保管原件。',
        legalBasis: '《中华人民共和国民法典》第五百零九条',
        suggestion:
          '建议保留合同原件及签署过程中的相关证据材料。如有条件，可对重要合同进行公证或备案登记。',
      },
    ];

    const categoryWarnings: Record<string, RiskWarning[]> = {
      LABOR: [
        {
          level: 'HIGH' as RiskLevel,
          title: '劳动合同必备条款',
          description:
            '劳动合同必须包含工作内容、工作地点、工作时间、劳动报酬、社会保险等必备条款。',
          legalBasis: '《中华人民共和国劳动合同法》第十七条',
          suggestion:
            '确保合同包含所有必备条款，缺少必备条款的合同可能被认定为无效或需要补正。',
        },
        {
          level: 'HIGH' as RiskLevel,
          title: '试用期约定',
          description:
            '试用期期限和工资有法定限制，违法约定试用期需要支付赔偿金。',
          legalBasis: '《中华人民共和国劳动合同法》第十九条、第二十条',
          suggestion:
            '严格按照法定标准和期限约定试用期，试用期工资不得低于转正工资的80%。',
        },
        {
          level: 'MEDIUM' as RiskLevel,
          title: '竞业限制条款',
          description:
            '竞业限制仅适用于高级管理人员和技术人员，且有期限和补偿金要求。',
          legalBasis: '《中华人民共和国劳动合同法》第二十三条、第二十四条',
          suggestion:
            '明确约定竞业限制的范围、期限和经济补偿标准。用人单位必须在竞业限制期限内按月支付经济补偿。',
        },
      ],
      CIVIL: [
        {
          level: 'HIGH' as RiskLevel,
          title: '标的物质量标准',
          description: '出卖人交付的标的物应当符合约定的质量标准。',
          legalBasis: '《中华人民共和国民法典》第六百一十五条、第六百一十七条',
          suggestion:
            '明确约定质量标准和验收程序。建议约定质量异议期，超过异议期视为认可标的物质量。',
        },
        {
          level: 'MEDIUM' as RiskLevel,
          title: '所有权转移风险',
          description: '动产所有权自交付时转移，不动产所有权自登记时转移。',
          legalBasis: '《中华人民共和国民法典》第二百零八条、第二百零九条',
          suggestion:
            '对于不动产交易，应及时办理产权过户登记。对于动产交易，应注意交付时间和方式的约定。',
        },
      ],
      LEASE: [
        {
          level: 'HIGH' as RiskLevel,
          title: '租赁物合法性',
          description:
            '出租的房屋或场地应当符合法律规定，不存在违法建筑或无法使用的情形。',
          legalBasis: '《中华人民共和国民法典》第七百零八条',
          suggestion:
            '核实租赁物的权属证明和合法性。对于房屋租赁，建议查验房产证或租赁备案证明。',
        },
        {
          level: 'MEDIUM' as RiskLevel,
          title: '优先承租权',
          description: '在同等条件下，承租人享有优先承租权。',
          legalBasis: '《中华人民共和国民法典》第七百三十四条',
          suggestion: '如需继续承租，应在租赁期满前向出租人提出续租意向。',
        },
      ],
      CONSTRUCTION: [
        {
          level: 'HIGH' as RiskLevel,
          title: '工程资质要求',
          description:
            '承包人必须具有相应的施工资质，否则施工合同可能被认定为无效。',
          legalBasis: '《中华人民共和国建筑法》第十三条',
          suggestion:
            '核实承包人的施工资质证书和安全生产许可证。建议要求承包人提供资质原件或公证件。',
        },
        {
          level: 'HIGH' as RiskLevel,
          title: '工程款结算',
          description: '工程款的结算应以合同约定和实际完成工程量为准。',
          legalBasis: '《中华人民共和国民法典》第七百九十九条',
          suggestion:
            '明确约定结算方式和结算时间。建议约定固定总价或单价合同，避免结算争议。',
        },
        {
          level: 'MEDIUM' as RiskLevel,
          title: '工程保修责任',
          description: '承包人应对建设工程在保修期内承担保修责任。',
          legalBasis: '《中华人民共和国建筑法》第六十二条',
          suggestion:
            '明确约定保修期限和保修范围。基础设施工程、房屋建筑的地基基础工程和主体结构工程的保修期限应符合法定要求。',
        },
      ],
      REAL_ESTATE: [
        {
          level: 'HIGH' as RiskLevel,
          title: '房屋产权核查',
          description:
            '购买房屋前应核实房屋的产权状况，包括是否存在抵押、查封、租赁等权利限制。',
          legalBasis: '《中华人民共和国民法典》第二百四十条',
          suggestion:
            '建议到不动产登记中心查询房屋权属状况。对于存在抵押的房屋，应约定解押方式和时间。',
        },
        {
          level: 'HIGH' as RiskLevel,
          title: '限购政策合规',
          description:
            '房屋交易需符合当地的限购政策，否则可能导致合同无法履行。',
          legalBasis: '相关地方性法规和政策',
          suggestion:
            '核实买方是否具有购房资格。对于限购区域的房屋，应要求买方提供购房资格证明。',
        },
        {
          level: 'MEDIUM' as RiskLevel,
          title: '户口迁移',
          description: '出卖人逾期不迁出户口的，应承担违约责任。',
          legalBasis: '《中华人民共和国民法典》第五百七十七条',
          suggestion:
            '建议在合同中明确约定户口迁移的时限和违约责任。可约定较高的违约金以约束出卖人。',
        },
      ],
    };

    const warnings = [...commonWarnings];
    if (categoryWarnings[category]) {
      warnings.push(...categoryWarnings[category]);
    }

    return warnings;
  }

  /**
   * 生成使用指南
   */
  private generateUsageGuide(title: string, category: string): string {
    const guideTemplates: Record<string, string> = {
      LABOR: `本劳动合同示范文本适用于各类企业、个体工商户和民办非企业单位与劳动者订立劳动合同。

使用注意事项：
1. 【合同期限】根据实际情况选择固定期限、无固定期限或以完成一定工作任务为期限的劳动合同。
2. 【工作内容】应明确具体的工作岗位和工作内容，避免使用模糊表述。
3. 【劳动报酬】应明确工资标准、支付方式和时间。工资不得低于当地最低工资标准。
4. 【社会保险】用人单位和劳动者必须依法参加社会保险，缴纳社会保险费。
5. 【试用期】严格按照法定标准和期限约定，试用期包含在劳动合同期限内。
6. 【必备条款】确保合同包含所有法定必备条款。
7. 【签字盖章】合同应由劳动者本人签字，用人单位加盖公章或由法定代表人签字。

法律依据：《中华人民共和国劳动法》《中华人民共和国劳动合同法》及其实施条例`,
      CIVIL: `本买卖合同示范文本适用于各类民事买卖交易，包括但不限于货物买卖、商品交易等。

使用注意事项：
1. 【标的物描述】应详细描述标的物的名称、规格型号、数量、质量标准等。
2. 【价款支付】明确价款金额、支付方式、支付时间和支付账户。
3. 【交付方式】约定交付时间、地点、方式和验收标准。
4. 【质量异议】建议约定质量检验期和异议期，超过期限视为认可质量。
5. 【风险转移】明确标的物毁损灭失的风险转移时点。
6. 【违约责任】明确各种违约情形及相应的违约责任。
7. 【所有权保留】如需保留所有权，应在合同中明确约定。

法律依据：《中华人民共和国民法典》合同编买卖合同相关规定`,
      LEASE: `本租赁合同示范文本适用于各类房屋、场地、设备租赁。

使用注意事项：
1. 【租赁物信息】详细描述租赁物的位置、面积、用途等基本信息。
2. 【租赁期限】明确租赁起止日期，租赁期限不得超过二十年。
3. 【租金支付】约定租金金额、支付方式、支付时间和逾期责任。
4. 【押金条款】明确押金金额、用途和退还条件。
5. 【维修责任】明确租赁物的维修责任和费用承担。
6. 【转租限制】未经出租人书面同意，不得转租租赁物。
7. 【优先承租权】承租人在同等条件下享有优先承租权。

法律依据：《中华人民共和国民法典》合同编租赁合同相关规定`,
      CONSTRUCTION: `本建设工程施工合同示范文本适用于各类建设工程施工项目。

使用注意事项：
1. 【资质审查】核实承包人的施工资质和安全生产许可证。
2. 【合同价款】明确价款确定方式（固定价、可调价或成本加酬金）。
3. 【工程变更】明确工程变更的程序和价款调整方式。
4. 【工期约定】明确开工日期、竣工日期和工期顺延的条件和程序。
5. 【质量标准】明确质量标准和验收程序。
6. 【工程款支付】明确预付款、进度款和竣工结算款的支付条件和比例。
7. 【保修责任】明确工程质量保修期限和保修范围。
8. 【竣工验收】明确竣工验收程序和标准。

法律依据：《中华人民共和国民法典》《中华人民共和国建筑法》`,
      REAL_ESTATE: `本房屋买卖合同示范文本适用于各类房屋买卖交易。

使用注意事项：
1. 【产权核查】核实房屋产权状况，包括是否存在抵押、查封、租赁等权利限制。
2. 【购房资格】核实买方是否具有购房资格。
3. 【价款支付】明确房价总额、付款方式、首付款和贷款金额。
4. 【产权过户】明确办理产权过户的时间和责任。
5. 【交付条件】明确房屋交付的条件、时间和标准。
6. 【户口迁移】约定原户口迁出的时限和违约责任。
7. 【税费承担】明确各项税费的承担方式和标准。
8. 【违约责任】明确各种违约情形及相应的违约责任。

法律依据：《中华人民共和国民法典》《中华人民共和国城市房地产管理法》`,
      TRANSPORTATION: `本货物运输合同示范文本适用于各类货物运输交易。

使用注意事项：
1. 【货物信息】准确描述货物名称、数量、重量、体积和价值。
2. 【运输信息】明确起运地、目的地、运输方式和预计到达时间。
3. 【运费支付】明确运费金额、支付方式和支付时间。
4. 【货物保险】建议对贵重货物办理货物运输保险。
5. 【验收程序】明确收货人的验收程序和异议提出时限。
6. 【损失赔偿】明确货物损失的赔偿标准和赔偿限额。
7. 【不可抗力】明确不可抗力事件的处理方式。

法律依据：《中华人民共和国民法典》合同编运输合同相关规定`,
      INTELLECTUAL_PROPERTY: `本知识产权合同示范文本适用于各类知识产权许可和转让交易。

使用注意事项：
1. 【权利信息】准确描述知识产权的类型、名称、登记号和权利范围。
2. 【许可类型】明确是独占许可、排他许可还是普通许可。
3. 【许可期限】明确许可的起始和终止日期。
4. 【地域范围】明确许可使用的地域范围。
5. 【许可费用】明确许可费的金额和支付方式。
6. 【权利瑕疵】许可方应保证权利的真实性和无瑕疵。
7. 【使用限制】明确被许可方的使用限制和再许可权限。

法律依据：《中华人民共和国民法典》知识产权编相关规定`,
      SERVICE: `本服务合同示范文本适用于各类服务委托交易。

使用注意事项：
1. 【服务内容】详细描述服务项目的具体内容、标准和要求。
2. 【服务标准】明确服务质量标准和验收程序。
3. 【服务期限】明确服务开始和结束时间。
4. 【服务费用】明确费用金额和支付方式。
5. 【保密义务】明确双方的保密义务和违约责任。
6. 【知识产权】明确服务成果的知识产权归属。
7. 【违约责任】明确各种违约情形及相应的违约责任。

法律依据：《中华人民共和国民法典》合同编委托合同相关规定`,
      COMMERCIAL: `本商业合作合同示范文本适用于各类商业合作交易。

使用注意事项：
1. 【合作内容】明确合作项目的具体内容和范围。
2. 【合作方式】明确合作模式和各方的角色分工。
3. 【投资出资】明确各方的出资方式和出资时间。
4. 【利润分配】明确利润分配比例和分配时间。
5. 【风险承担】明确合作风险的承担方式。
6. 【经营管理】明确经营管理的决策机制。
7. 【退出机制】明确合作终止时的退出安排。

法律依据：《中华人民共和国民法典》合同编合伙合同相关规定`,
    };

    return guideTemplates[category] || guideTemplates.CIVIL;
  }

  /**
   * 解析单条法规数据（接口实现）
   * SAMR采集器主要用于合同模板，此方法返回null
   */
  parseArticle(_rawData: unknown): LawArticleData | null {
    return null;
  }

  /**
   * 随机延迟
   */
  private async randomDelay(): Promise<void> {
    const base = this.config.rateLimitDelay;
    const jitter = Math.random() * 1000;
    await this.delay(base + jitter);
  }

  /**
   * 保存合同模板到数据库
   */
  private async saveTemplate(data: ContractTemplateData): Promise<void> {
    const { prisma } = await import('@/lib/db/prisma');

    const existing = await prisma.contractTemplate.findFirst({
      where: { code: data.code },
    });

    const templateData: Prisma.ContractTemplateCreateInput = {
      name: data.name,
      code: data.code,
      category: data.category,
      subCategory: data.subCategory,
      description: data.description,
      content: data.content || '',
      fullText: data.fullText,
      variables: data.variables as unknown as Prisma.InputJsonValue,
      clauses: data.clauses as unknown as Prisma.InputJsonValue,
      riskWarnings: data.riskWarnings as unknown as Prisma.InputJsonValue,
      usageGuide: data.usageGuide,
      source: data.source,
      sourceUrl: data.sourceUrl,
      sourceId: data.sourceId,
      publishedDate: data.publishedDate,
      effectiveDate: data.effectiveDate,
      version: data.version,
      isLatest: data.isLatest,
      priority: data.priority,
      tags: data.tags || [],
      keywords: data.keywords || [],
    };

    if (existing) {
      await prisma.contractTemplate.update({
        where: { id: existing.id },
        data: templateData,
      });
    } else {
      await prisma.contractTemplate.create({
        data: templateData,
      });
    }
  }

  /**
   * 获取采集统计
   */
  getStats(): SAMRStats {
    return {
      total: KNOWN_CONTRACT_TEMPLATES.length,
      success: 0,
      failed: 0,
      byCategory: {
        LABOR: KNOWN_CONTRACT_TEMPLATES.filter(
          t => t.category === '劳动合同' || t.category === '人事'
        ).length,
        CIVIL: KNOWN_CONTRACT_TEMPLATES.filter(t => t.category === '买卖')
          .length,
        LEASE: KNOWN_CONTRACT_TEMPLATES.filter(t => t.category.includes('租赁'))
          .length,
        CONSTRUCTION: KNOWN_CONTRACT_TEMPLATES.filter(
          t => t.category.includes('建设') || t.category.includes('施工')
        ).length,
        REAL_ESTATE: KNOWN_CONTRACT_TEMPLATES.filter(t =>
          t.category.includes('房屋')
        ).length,
        TRANSPORTATION: KNOWN_CONTRACT_TEMPLATES.filter(
          t => t.category === '运输' || t.category === '物流'
        ).length,
        INTELLECTUAL_PROPERTY: KNOWN_CONTRACT_TEMPLATES.filter(
          t =>
            t.category.includes('知识') ||
            t.category.includes('专利') ||
            t.category.includes('商标')
        ).length,
        SERVICE: KNOWN_CONTRACT_TEMPLATES.filter(
          t =>
            t.category === '服务' ||
            t.category === '委托' ||
            t.category.includes('服务')
        ).length,
        COMMERCIAL: KNOWN_CONTRACT_TEMPLATES.filter(
          t =>
            t.category.includes('合伙') ||
            t.category.includes('公司') ||
            t.category.includes('投资')
        ).length,
      },
    };
  }

  /**
   * 多方法解析 DOCX 文件
   * 尝试多种解析方法，选择结果最好的一个
   */
  async parseDocxFile(buffer: Buffer, sourceId: string): Promise<string> {
    const results: { method: string; text: string; length: number }[] = [];

    // 方法 1: 使用增强型 docx-parser
    try {
      const { docxParser } = await import('./docx-parser');
      const doc = await docxParser.parse(buffer, `samr://${sourceId}`);
      if (doc?.fullText && doc.fullText.length > 20) {
        results.push({
          method: 'docx-parser',
          text: doc.fullText,
          length: doc.fullText.length,
        });
      }
    } catch (error) {
      this.logger.warn('docx-parser 解析失败', {
        sourceId,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // 方法 2: 使用 mammoth
    try {
      const mammoth = await import('mammoth');
      const result = await mammoth.extractRawText({ buffer });
      if (result.value && result.value.length > 20) {
        results.push({
          method: 'mammoth',
          text: result.value,
          length: result.value.length,
        });
      }
    } catch (error) {
      this.logger.warn('mammoth 解析失败', {
        sourceId,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // 方法 3: 直接提取 XML 文本
    try {
      const text = await this.extractTextFromZip(buffer);
      if (text && text.length > 20) {
        results.push({
          method: 'xml-extraction',
          text,
          length: text.length,
        });
      }
    } catch (error) {
      this.logger.warn('XML 提取失败', {
        sourceId,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // 选择最长的结果
    if (results.length > 0) {
      results.sort((a, b) => b.length - a.length);
      const bestResult = results[0];
      this.logger.info(`使用 ${bestResult.method} 解析`, {
        sourceId,
        length: bestResult.length,
        methods: results.map(r => r.method),
      });
      return bestResult.text;
    }

    throw new Error('所有 DOCX 解析方式均失败');
  }

  /**
   * 从 DOCX ZIP 包中直接提取文本
   */
  private async extractTextFromZip(buffer: Buffer): Promise<string> {
    const jszip = await import('jszip');
    const zip = await jszip.loadAsync(buffer);
    const docXml = zip.file('word/document.xml');
    if (!docXml) return '';

    const xmlContent = await docXml.async('string');

    // 简单的 XML 文本提取：去除标签，保留文本内容
    const text = xmlContent
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&apos;/g, "'")
      .replace(/&quot;/g, '"')
      .trim();

    return text;
  }

  /**
   * 解析 PDF 文件（使用 pdf-parse）
   * 如果解析失败，返回空字符串
   */
  async parsePdfFile(buffer: Buffer): Promise<string> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const pdfParse = require('pdf-parse') as (
        buffer: Buffer
      ) => Promise<{ text: string }>;
      const data = await pdfParse(buffer);
      return data.text || '';
    } catch (error) {
      this.logger.error('PDF 解析失败', error);
      return '';
    }
  }

  /**
   * 保存下载检查点
   */
  private async saveDownloadCheckpoint(
    outDir: string,
    checkpoint: SAMRDownloadCheckpoint
  ): Promise<void> {
    const fs = await import('fs');
    const checkpointPath = path.join(outDir, 'samr-download-checkpoint.json');
    fs.writeFileSync(
      checkpointPath,
      JSON.stringify(checkpoint, null, 2),
      'utf-8'
    );
  }

  /**
   * 加载下载检查点
   */
  private async loadDownloadCheckpoint(
    outDir: string
  ): Promise<SAMRDownloadCheckpoint | null> {
    const fs = await import('fs');
    const checkpointPath = path.join(outDir, 'samr-download-checkpoint.json');
    if (!fs.existsSync(checkpointPath)) {
      return null;
    }
    try {
      const content = fs.readFileSync(checkpointPath, 'utf-8');
      return JSON.parse(content) as SAMRDownloadCheckpoint;
    } catch {
      return null;
    }
  }

  /**
   * 保存解析结果
   */
  private async saveParseResults(
    outDir: string,
    results: SAMRParseResults
  ): Promise<void> {
    const fs = await import('fs');
    const resultsPath = path.join(outDir, 'samr-parse-results.json');
    fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2), 'utf-8');
  }

  /**
   * 加载解析结果
   */
  private async loadParseResults(
    outDir: string
  ): Promise<SAMRParseResults | null> {
    const fs = await import('fs');
    const resultsPath = path.join(outDir, 'samr-parse-results.json');
    if (!fs.existsSync(resultsPath)) {
      return null;
    }
    try {
      const content = fs.readFileSync(resultsPath, 'utf-8');
      return JSON.parse(content) as SAMRParseResults;
    } catch {
      return null;
    }
  }

  /**
   * 记录错误并更新统计
   */
  private trackError(
    errorType: string,
    itemId: string,
    errorMessage: string
  ): void {
    this.errorStats.totalErrors++;
    this.errorStats.errorsByType[errorType] =
      (this.errorStats.errorsByType[errorType] || 0) + 1;
    this.errorStats.errorsByItem[itemId] = errorMessage;
    this.errorStats.lastErrorAt = new Date().toISOString();
    this.errorStats.consecutiveFailures++;

    // 检查是否超过连续失败阈值
    if (this.errorStats.consecutiveFailures >= this.MAX_CONSECUTIVE_FAILURES) {
      this.triggerErrorAlert();
    }
  }

  /**
   * 记录成功，重置连续失败计数
   */
  private trackSuccess(): void {
    this.errorStats.consecutiveFailures = 0;
  }

  /**
   * 触发错误告警
   */
  private triggerErrorAlert(): void {
    const message = `⚠️ SAMRCrawler 错误告警：连续 ${this.errorStats.consecutiveFailures} 次失败！`;
    this.logger.error(message);

    // 调用告警回调
    if (this.errorAlertCallback) {
      this.errorAlertCallback(this.errorStats);
    }
  }

  /**
   * 设置错误告警回调
   */
  setErrorAlertCallback(callback: (stats: SAMRErrorStats) => void): void {
    this.errorAlertCallback = callback;
  }

  /**
   * 获取错误统计信息
   */
  getErrorStats(): SAMRErrorStats {
    return { ...this.errorStats };
  }

  /**
   * 重置错误统计
   */
  resetErrorStats(): void {
    this.errorStats = {
      totalErrors: 0,
      errorsByType: {},
      errorsByItem: {},
      lastErrorAt: '',
      consecutiveFailures: 0,
      recoveryAttempts: 0,
    };
  }

  /**
   * 手动触发恢复重试
   */
  async retryFailedItems(options?: SAMRParseOptions): Promise<CrawlerResult> {
    this.errorStats.recoveryAttempts++;
    this.logger.info(
      `开始重试失败项，第 ${this.errorStats.recoveryAttempts} 次尝试`
    );

    // 使用 parseAll 进行重试
    return this.parseAll(options);
  }

  /**
   * 保存错误统计到文件
   */
  async saveErrorStats(outputDir: string): Promise<void> {
    const fs = await import('fs');
    const statsPath = path.join(outputDir, 'samr-error-stats.json');
    fs.writeFileSync(
      statsPath,
      JSON.stringify(this.errorStats, null, 2),
      'utf-8'
    );
  }

  /**
   * 从文件加载错误统计
   */
  async loadErrorStats(outputDir: string): Promise<boolean> {
    const fs = await import('fs');
    const statsPath = path.join(outputDir, 'samr-error-stats.json');
    if (!fs.existsSync(statsPath)) {
      return false;
    }
    try {
      const content = fs.readFileSync(statsPath, 'utf-8');
      this.errorStats = JSON.parse(content);
      return true;
    } catch {
      return false;
    }
  }
}

export const samrCrawler = new SAMRCrawler();
export { KNOWN_CONTRACT_TEMPLATES };
