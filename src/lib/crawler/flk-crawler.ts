/**
 * 国家法律法规数据库采集爬虫 (适配新 API 架构)
 * 数据源: https://flk.npc.gov.cn
 *
 * 两阶段架构:
 *   Phase 1 (downloadAll): API 列表 → 详情 → 下载 DOCX 到磁盘 + 断点续采
 *   Phase 2 (parseAll):    读取磁盘 DOCX → docx-parser 解析 → 写入数据库
 *
 * 新 API 接口:
 *   列表: POST https://flk.npc.gov.cn/law-search/search/list
 *   详情: GET  https://flk.npc.gov.cn/law-search/search/flfgDetails?bbbs={bbbs}
 *   下载: GET  https://flk.npc.gov.cn/law-search/download/pc?bbbs={bbbs}&ossFilePath={path}
 */

import * as fs from 'fs';
import * as path from 'path';
import { BaseCrawler, CrawlerResult, LawArticleData } from './base-crawler';
import { LawCategory, LawType, LawStatus } from '@prisma/client';

// ─── 新版 FLK API 类型定义 ───────────────────────────────────────────

/** 法规分类代码 (新版 flfgCodeId) */
export type FLKTypeCode =
  | 100
  | 101
  | 102
  | 110
  | 120
  | 130
  | 140
  | 150
  | 160
  | 170
  | 180
  | 190
  | 195
  | 200
  | 201
  | 210
  | 215
  | 220
  | 221
  | 222
  | 230
  | 260
  | 270
  | 290
  | 295
  | 300
  | 305
  | 310
  | 311
  | 320
  | 330
  | 340
  | 350;

/** FLK 分类配置 (新版) */
export interface FLKTypeConfig {
  code: FLKTypeCode;
  label: string;
  flfgFl: string; // 分类标识: flfg(法律), xzfg(行政法规), jcfg(监察法规), sfjs(司法解释), dfxfg(地方性法规)
  lawType: LawType;
  category: LawCategory;
}

/** 列表 API 请求体 */
interface FLKListRequest {
  searchRange: number; // 1=标题, 2=全文
  sxrq: string[]; // 生效日期范围
  gbrq: string[]; // 公布日期范围
  searchType: number; // 2=模糊搜索
  sxx: number[]; // 时效性: 1=已废止, 2=已修改, 3=有效, 4=尚未生效
  gbrqYear: number[]; // 公布年份
  flfgCodeId: FLKTypeCode[]; // 法律法规分类
  zdjgCodeId: number[]; // 制定机关分类
  searchContent: string; // 搜索关键词
  pageNum: number;
  pageSize: number;
}

/** 列表 API 响应 */
interface FLKListResponse {
  total: number;
  rows: FLKListItem[];
  code: number;
  msg: string;
  searchType: number;
  searchContent: string | null;
}

/** 列表项 */
interface FLKListItem {
  bbbs: string; // 业务标识符 (主键)
  title: string; // 标题
  gbrq: string; // 公布日期
  sxrq: string; // 生效日期
  sxx: number; // 时效性: 1=已废止, 2=已修改, 3=有效, 4=尚未生效
  zdjgName: string; // 制定机关名称
  xgzlHighLight: string | null;
  flxz: string; // 法律性质
  zdjgCodeId: number; // 制定机关代码
  flfgCodeId: number; // 法律法规分类代码
  titleHightLightList: Array<{ value: string; highLight: boolean }>;
  score: number;
}

/** 详情 API 响应 */
interface FLKDetailResponse {
  code: number;
  msg: string;
  data: FLKDetailData;
}

/** 详情数据 */
interface FLKDetailData {
  bbbs: string;
  ossFile: {
    ossWordPath: string; // DOCX 文件路径
    ossWordOfdPath: string;
    ossWordOfdSize: number;
    ossPdfPath: string | null;
    ossPdfOfdPath: string | null;
    ossPdfOfdSize: number | null;
  };
  xgwj: unknown[];
  lsyg: unknown;
  xgzl: unknown[];
  flfg: unknown | null;
  flxz: string;
  zdjgName: string;
  gbrq: string;
  sxrq: string;
  title: string;
  sxx: number;
  content: string | null;
  xfFlag: number;
}

// ─── 断点/状态 JSON 结构 ─────────────────────────────────────────────

/** 单个已下载项的元数据 */
interface DownloadedItem {
  bbbs: string; // 主键
  title: string;
  flfgCodeId: number;
  zdjgCodeId: number;
  flxz: string;
  gbrq: string;
  sxrq: string;
  sxx: number;
  zdjgName: string;
  filePath: string; // 下载的文件路径
  downloadedAt: string;
  error?: string;
}

/** checkpoint.json */
interface DownloadCheckpoint {
  version: string;
  startedAt: string;
  lastUpdatedAt: string;
  status: 'in_progress' | 'completed' | 'failed';
  types: Record<
    string,
    { page: number; totalPages: number; downloaded: number; completed: boolean }
  >;
  items: DownloadedItem[];
}

/** 单个文件的解析状态 */
interface ParseFileStatus {
  status: 'success' | 'failed' | 'pending';
  attempts: number;
  lastAttemptAt: string;
  error?: string;
  docFormat?: string;
}

/** parse-results.json */
interface ParseResults {
  version: string;
  lastRunAt: string;
  stats: { total: number; success: number; failed: number; pending: number };
  files: Record<string, ParseFileStatus>;
}

// ─── 分类配置 (新版) ────────────────────────────────────────────────

/**
 * 分类代码映射 (基于 enumData API 返回)
 * flfgCodeId 分类:
 *   100 = 宪法
 *   101-195 = 法律 (包含子分类)
 *   201-215 = 行政法规
 *   220 = 监察法规
 *   221-310 = 地方法规 (包含子分类)
 *   311-350 = 司法解释 (包含子分类)
 */
const FLK_TYPE_CONFIGS: FLKTypeConfig[] = [
  // 宪法相关 (100)
  {
    code: 100,
    label: '宪法',
    flfgFl: 'flfg',
    lawType: LawType.CONSTITUTION,
    category: LawCategory.OTHER,
  },

  // 法律 (101-195)
  {
    code: 101,
    label: '法律',
    flfgFl: 'flfg',
    lawType: LawType.LAW,
    category: LawCategory.OTHER,
  },
  {
    code: 102,
    label: '法律',
    flfgFl: 'flfg',
    lawType: LawType.LAW,
    category: LawCategory.OTHER,
  },
  {
    code: 110,
    label: '宪法相关法',
    flfgFl: 'flfg',
    lawType: LawType.LAW,
    category: LawCategory.OTHER,
  },
  {
    code: 120,
    label: '民法商法',
    flfgFl: 'flfg',
    lawType: LawType.LAW,
    category: LawCategory.CIVIL,
  },
  {
    code: 130,
    label: '行政法',
    flfgFl: 'flfg',
    lawType: LawType.LAW,
    category: LawCategory.ADMINISTRATIVE,
  },
  {
    code: 140,
    label: '经济法',
    flfgFl: 'flfg',
    lawType: LawType.LAW,
    category: LawCategory.ECONOMIC,
  },
  {
    code: 150,
    label: '社会法',
    flfgFl: 'flfg',
    lawType: LawType.LAW,
    category: LawCategory.OTHER,
  },
  {
    code: 160,
    label: '刑法',
    flfgFl: 'flfg',
    lawType: LawType.LAW,
    category: LawCategory.CRIMINAL,
  },
  {
    code: 170,
    label: '诉讼与非诉讼程序法',
    flfgFl: 'flfg',
    lawType: LawType.LAW,
    category: LawCategory.PROCEDURE,
  },
  {
    code: 180,
    label: '法律解释',
    flfgFl: 'flfg',
    lawType: LawType.LAW,
    category: LawCategory.OTHER,
  },
  {
    code: 190,
    label: '有关法律问题的决定',
    flfgFl: 'flfg',
    lawType: LawType.LAW,
    category: LawCategory.OTHER,
  },
  {
    code: 195,
    label: '修正案',
    flfgFl: 'flfg',
    lawType: LawType.LAW,
    category: LawCategory.OTHER,
  },
  {
    code: 200,
    label: '修改、废止的决定',
    flfgFl: 'flfg',
    lawType: LawType.LAW,
    category: LawCategory.OTHER,
  },

  // 行政法规 (201-215)
  {
    code: 201,
    label: '行政法规',
    flfgFl: 'xzfg',
    lawType: LawType.ADMINISTRATIVE_REGULATION,
    category: LawCategory.ADMINISTRATIVE,
  },
  {
    code: 210,
    label: '行政法规',
    flfgFl: 'xzfg',
    lawType: LawType.ADMINISTRATIVE_REGULATION,
    category: LawCategory.ADMINISTRATIVE,
  },
  {
    code: 215,
    label: '修改、废止的决定',
    flfgFl: 'xzfg',
    lawType: LawType.ADMINISTRATIVE_REGULATION,
    category: LawCategory.ADMINISTRATIVE,
  },

  // 监察法规 (220)
  {
    code: 220,
    label: '监察法规',
    flfgFl: 'jcfg',
    lawType: LawType.LAW,
    category: LawCategory.ADMINISTRATIVE,
  },

  // 地方法规 (221-310)
  {
    code: 221,
    label: '地方法规',
    flfgFl: 'dfxfg',
    lawType: LawType.LOCAL_REGULATION,
    category: LawCategory.OTHER,
  },
  {
    code: 222,
    label: '地方法规',
    flfgFl: 'dfxfg',
    lawType: LawType.LOCAL_REGULATION,
    category: LawCategory.OTHER,
  },
  {
    code: 230,
    label: '地方性法规',
    flfgFl: 'dfxfg',
    lawType: LawType.LOCAL_REGULATION,
    category: LawCategory.OTHER,
  },
  {
    code: 260,
    label: '自治条例',
    flfgFl: 'dfxfg',
    lawType: LawType.LOCAL_REGULATION,
    category: LawCategory.OTHER,
  },
  {
    code: 270,
    label: '单行条例',
    flfgFl: 'dfxfg',
    lawType: LawType.LOCAL_REGULATION,
    category: LawCategory.OTHER,
  },
  {
    code: 290,
    label: '经济特区法规',
    flfgFl: 'dfxfg',
    lawType: LawType.LOCAL_REGULATION,
    category: LawCategory.OTHER,
  },
  {
    code: 295,
    label: '浦东新区法规',
    flfgFl: 'dfxfg',
    lawType: LawType.LOCAL_REGULATION,
    category: LawCategory.OTHER,
  },
  {
    code: 300,
    label: '海南自由贸易港法规',
    flfgFl: 'dfxfg',
    lawType: LawType.LOCAL_REGULATION,
    category: LawCategory.OTHER,
  },
  {
    code: 305,
    label: '法规性决定',
    flfgFl: 'dfxfg',
    lawType: LawType.LOCAL_REGULATION,
    category: LawCategory.OTHER,
  },
  {
    code: 310,
    label: '修改、废止的决定',
    flfgFl: 'dfxfg',
    lawType: LawType.LOCAL_REGULATION,
    category: LawCategory.OTHER,
  },

  // 司法解释 (311-350)
  {
    code: 311,
    label: '司法解释',
    flfgFl: 'sfjs',
    lawType: LawType.JUDICIAL_INTERPRETATION,
    category: LawCategory.PROCEDURE,
  },
  {
    code: 320,
    label: '高法司法解释',
    flfgFl: 'sfjs',
    lawType: LawType.JUDICIAL_INTERPRETATION,
    category: LawCategory.PROCEDURE,
  },
  {
    code: 330,
    label: '高检司法解释',
    flfgFl: 'sfjs',
    lawType: LawType.JUDICIAL_INTERPRETATION,
    category: LawCategory.PROCEDURE,
  },
  {
    code: 340,
    label: '联合发布司法解释',
    flfgFl: 'sfjs',
    lawType: LawType.JUDICIAL_INTERPRETATION,
    category: LawCategory.PROCEDURE,
  },
  {
    code: 350,
    label: '修改、废止的决定',
    flfgFl: 'sfjs',
    lawType: LawType.JUDICIAL_INTERPRETATION,
    category: LawCategory.PROCEDURE,
  },
];

/** 采集选项 */
export interface FLKCrawlOptions {
  types?: FLKTypeCode[]; // 要采集的分类代码
  maxPages?: number; // 最大页数 (0=不限)
  pageSize?: number; // 每页大小 (默认20)
  sinceDate?: string; // 开始日期 (YYYY-MM-DD)
  outputDir?: string;
}

/** 解析选项 */
export interface FLKParseOptions {
  types?: FLKTypeCode[];
  outputDir?: string;
  maxAttempts?: number;
  onlyFailed?: boolean;
}

/** 统计信息 */
export interface FLKStats {
  download: {
    total: number;
    byType: Record<string, number>;
    status: string;
    lastUpdated: string;
  };
  parse: {
    total: number;
    success: number;
    failed: number;
    pending: number;
    failRate: string;
    lastRun: string;
  };
}

// ─── FLK 爬虫实现 (新版 API) ───────────────────────────────────────────

export class FLKCrawler extends BaseCrawler {
  private readonly API_BASE = 'https://flk.npc.gov.cn';
  private readonly API_LIST: string;
  private readonly API_DETAIL: string;
  private readonly API_DOWNLOAD: string;
  private readonly DEFAULT_OUTPUT_DIR = path.resolve('data/crawled/flk');

  /** 连续失败计数, 用于自适应限速 */
  private consecutiveErrors = 0;

  /** User-Agent 池 */
  private static readonly UA_POOL = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:122.0) Gecko/20100101 Firefox/122.0',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
  ];

  constructor() {
    super({
      name: 'FLKCrawler',
      baseUrl: 'https://flk.npc.gov.cn',
      requestTimeout: 45000,
      maxRetries: 5,
      rateLimitDelay: 2000,
      userAgent: FLKCrawler.UA_POOL[0],
    });
    this.API_LIST = `${this.config.baseUrl}/law-search/search/list`;
    this.API_DETAIL = `${this.config.baseUrl}/law-search/search/flfgDetails`;
    this.API_DOWNLOAD = `${this.config.baseUrl}/law-search/download/pc`;
  }

  getDataSourceName(): string {
    return 'flk';
  }

  // ════════════════════════════════════════════════════════════════════
  //  公共接口
  // ════════════════════════════════════════════════════════════════════

  /**
   * 全量采集 (两阶段: 下载 + 解析)
   */
  async crawl(options?: FLKCrawlOptions): Promise<CrawlerResult> {
    const downloadResult = await this.downloadAll(options);
    const parseResult = await this.parseAll({
      types: options?.types,
      outputDir: options?.outputDir,
    });

    return {
      success: downloadResult.success && parseResult.success,
      itemsCrawled: downloadResult.itemsCrawled,
      itemsCreated: parseResult.itemsCreated,
      itemsUpdated: parseResult.itemsUpdated,
      errors: [...downloadResult.errors, ...parseResult.errors],
      duration: downloadResult.duration + parseResult.duration,
    };
  }

  /**
   * 增量采集 (两阶段)
   */
  async incrementalCrawl(since: Date): Promise<CrawlerResult> {
    const sinceDate = since.toISOString().split('T')[0];
    return this.crawl({ sinceDate });
  }

  /**
   * 解析单条法规数据
   */
  parseArticle(rawData: any): LawArticleData | null {
    if (!rawData || !rawData.title) return null;

    const typeConfig = FLK_TYPE_CONFIGS.find(
      c => c.code === rawData.flfgCodeId
    );

    return {
      sourceId: rawData.bbbs || '',
      sourceUrl: `${this.API_BASE}/detail2.html?${rawData.bbbs}`,
      lawName: rawData.title,
      articleNumber: rawData.bbbs || '',
      fullText: rawData.content || '',
      lawType: typeConfig?.lawType || LawType.LAW,
      category: typeConfig?.category || LawCategory.OTHER,
      issuingAuthority: rawData.zdjgName || '未知',
      effectiveDate: rawData.sxrq
        ? new Date(rawData.sxrq)
        : new Date(rawData.gbrq),
      searchableText: `${rawData.title} ${rawData.zdjgName || ''} ${rawData.flxz || ''}`,
      status: this.determineStatus(rawData.sxx),
      version: '1.0',
      tags: [rawData.flxz, typeConfig?.label].filter(Boolean) as string[],
    };
  }

  // ════════════════════════════════════════════════════════════════════
  //  Phase 1: 下载阶段 (新版 API)
  // ════════════════════════════════════════════════════════════════════

  /**
   * 仅执行下载阶段
   * - 调用新版列表 API (POST /law-search/search/list)
   * - 获取详情 (GET /law-search/search/flfgDetails)
   * - 下载 DOCX 到磁盘
   */
  async downloadAll(options?: FLKCrawlOptions): Promise<CrawlerResult> {
    const {
      types = FLK_TYPE_CONFIGS.map(c => c.code),
      maxPages = 0,
      pageSize = 20,
      sinceDate,
      outputDir,
    } = options || {};

    const outDir = outputDir || this.DEFAULT_OUTPUT_DIR;
    const startTime = Date.now();
    let totalDownloaded = 0;
    const allErrors: string[] = [];

    this.updateProgress({
      status: 'running',
      startedAt: new Date(),
      errors: [],
    });

    // 加载或创建断点
    const checkpoint = this.loadCheckpoint(outDir);
    checkpoint.status = 'in_progress';
    checkpoint.startedAt = checkpoint.startedAt || new Date().toISOString();

    try {
      for (const typeCode of types) {
        const typeConfig = FLK_TYPE_CONFIGS.find(c => c.code === typeCode);
        if (!typeConfig) continue;

        // 跳过已完成的分类
        const typeProgress = checkpoint.types[typeCode.toString()];
        if (typeProgress?.completed) {
          console.log(`[FLKCrawler] 跳过已完成的分类: ${typeConfig.label}`);
          totalDownloaded += typeProgress.downloaded;
          continue;
        }

        console.log(
          `[FLKCrawler] 下载阶段 - ${typeConfig.label} (code: ${typeCode})`
        );

        const result = await this.downloadType(typeCode, typeConfig, {
          maxPages,
          pageSize,
          sinceDate,
          outDir,
          checkpoint,
        });

        totalDownloaded += result.downloaded;
        allErrors.push(...result.errors);
        this.saveCheckpoint(outDir, checkpoint);

        console.log(
          `[FLKCrawler] ${typeConfig.label} 下载完成: ${result.downloaded} 个文件`
        );
      }

      checkpoint.status = 'completed';
      checkpoint.lastUpdatedAt = new Date().toISOString();
      this.saveCheckpoint(outDir, checkpoint);

      const duration = Date.now() - startTime;
      this.updateProgress({ status: 'completed', completedAt: new Date() });

      const crawlerResult: CrawlerResult = {
        success: true,
        itemsCrawled: totalDownloaded,
        itemsCreated: 0,
        itemsUpdated: 0,
        errors: allErrors,
        duration,
      };

      await this.logCrawlOperation(
        sinceDate ? 'incremental_download' : 'full_download',
        crawlerResult
      );
      return crawlerResult;
    } catch (error) {
      checkpoint.status = 'failed';
      checkpoint.lastUpdatedAt = new Date().toISOString();
      this.saveCheckpoint(outDir, checkpoint);

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
        itemsCrawled: totalDownloaded,
        itemsCreated: 0,
        itemsUpdated: 0,
        errors: [...allErrors, errorMessage],
        duration,
      };
    }
  }

  /**
   * 下载单个分类 (带断点续采)
   */
  private async downloadType(
    typeCode: FLKTypeCode,
    typeConfig: FLKTypeConfig,
    opts: {
      maxPages: number;
      pageSize: number;
      sinceDate?: string;
      outDir: string;
      checkpoint: DownloadCheckpoint;
    }
  ): Promise<{ downloaded: number; errors: string[] }> {
    let downloaded = 0;
    const errors: string[] = [];

    // 从断点恢复页码
    const typeProgress = opts.checkpoint.types[typeCode.toString()] || {
      page: 0,
      totalPages: 1,
      downloaded: 0,
      completed: false,
    };
    let page = typeProgress.page + 1;
    let totalPages = typeProgress.totalPages;

    // 确保输出目录存在
    const typeDir = path.join(opts.outDir, typeConfig.flfgFl);
    fs.mkdirSync(typeDir, { recursive: true });

    // 已下载的 bbbs 集合 (用于去重)
    const downloadedIds = new Set(
      opts.checkpoint.items
        .filter(item => item.flfgCodeId === typeCode)
        .map(item => item.bbbs)
    );

    while (page <= totalPages) {
      if (opts.maxPages > 0 && page > opts.maxPages) break;

      try {
        // 新版列表 API (POST)
        const listResponse = await this.fetchList(
          typeCode,
          page,
          opts.pageSize,
          opts.sinceDate
        );

        if (listResponse.code !== 200 || !listResponse.rows) {
          errors.push(
            `[${typeCode}] 列表请求失败: page=${page}, code=${listResponse.code}, msg=${listResponse.msg}`
          );
          break;
        }

        const { rows } = listResponse;
        totalPages = Math.ceil(listResponse.total / opts.pageSize);

        this.updateProgress({
          totalItems: listResponse.total,
          currentItem: `下载 ${typeConfig.label} 第 ${page}/${totalPages} 页`,
        });

        if (rows.length === 0) {
          console.log(
            `[FLKCrawler] ${typeConfig.label} 第 ${page}/${totalPages} 页无数据`
          );
          break;
        }

        console.log(
          `[FLKCrawler] ${typeConfig.label} 第 ${page}/${totalPages} 页, ${rows.length} 条, 开始逐条下载...`
        );

        for (const item of rows) {
          // 去重
          if (downloadedIds.has(item.bbbs)) continue;

          try {
            const filePath = await this.downloadSingleItem(
              item,
              typeConfig,
              typeDir
            );

            opts.checkpoint.items.push({
              bbbs: item.bbbs,
              title: item.title,
              flfgCodeId: item.flfgCodeId,
              zdjgCodeId: item.zdjgCodeId,
              flxz: item.flxz,
              gbrq: item.gbrq,
              sxrq: item.sxrq,
              sxx: item.sxx,
              zdjgName: item.zdjgName,
              filePath,
              downloadedAt: new Date().toISOString(),
            });
            downloadedIds.add(item.bbbs);
            downloaded++;
          } catch (err) {
            const msg = `[${typeCode}] 下载失败 [${item.title}]: ${err instanceof Error ? err.message : err}`;
            errors.push(msg);
            this.recordError(msg);

            // 下载失败也记录元数据
            opts.checkpoint.items.push({
              bbbs: item.bbbs,
              title: item.title,
              flfgCodeId: item.flfgCodeId,
              zdjgCodeId: item.zdjgCodeId,
              flxz: item.flxz,
              gbrq: item.gbrq,
              sxrq: item.sxrq,
              sxx: item.sxx,
              zdjgName: item.zdjgName,
              filePath: '',
              downloadedAt: new Date().toISOString(),
              error: String(err),
            });
            downloadedIds.add(item.bbbs);
          }

          this.updateProgress({
            processedItems: this.progress.processedItems + 1,
          });
          await this.randomDelay();
        }

        console.log(
          `[FLKCrawler] ${typeConfig.label} 第 ${page}/${totalPages} 页下载完成, 累计 ${downloaded} 个文件`
        );

        // 更新断点
        typeProgress.page = page;
        typeProgress.totalPages = totalPages;
        typeProgress.downloaded = downloaded;
        opts.checkpoint.types[typeCode.toString()] = typeProgress;
        opts.checkpoint.lastUpdatedAt = new Date().toISOString();

        // 每页保存一次断点
        this.saveCheckpoint(opts.outDir, opts.checkpoint);

        page++;
        await this.randomDelay();
      } catch (err) {
        const msg = `[${typeCode}] 列表页 ${page} 异常: ${err instanceof Error ? err.message : err}`;
        errors.push(msg);
        this.recordError(msg);

        this.consecutiveErrors++;
        await this.randomDelay();
        page++;
      }
    }

    // 标记分类完成
    typeProgress.completed = true;
    typeProgress.downloaded = downloaded;
    opts.checkpoint.types[typeCode.toString()] = typeProgress;

    return { downloaded, errors };
  }

  /**
   * 下载单条法规的 DOCX 文件到磁盘
   */
  private async downloadSingleItem(
    item: FLKListItem,
    typeConfig: FLKTypeConfig,
    typeDir: string
  ): Promise<string> {
    // 1. 获取详情 (新版 API)
    const detail = await this.fetchDetail(item.bbbs);

    if (!detail?.data?.ossFile?.ossWordPath) {
      throw new Error('详情接口无 DOCX 下载路径');
    }

    // 2. 下载 DOCX
    const docxBuffer = await this.downloadDocx(
      item.bbbs,
      detail.data.ossFile.ossWordPath
    );

    if (docxBuffer.length < 100) {
      throw new Error(`文件过小 (${docxBuffer.length} bytes), 可能下载失败`);
    }

    // 3. 保存到磁盘
    const safeId = item.bbbs.replace(/[^a-zA-Z0-9_-]/g, '_');
    const filePath = path.join(typeDir, `${safeId}.docx`);
    await fs.promises.writeFile(filePath, docxBuffer);

    return filePath;
  }

  // ════════════════════════════════════════════════════════════════════
  //  Phase 2: 解析阶段
  // ════════════════════════════════════════════════════════════════════

  async parseAll(options?: FLKParseOptions): Promise<CrawlerResult> {
    const {
      types,
      outputDir,
      maxAttempts = 3,
      onlyFailed = false,
    } = options || {};

    const outDir = outputDir || this.DEFAULT_OUTPUT_DIR;
    const startTime = Date.now();
    let created = 0;
    let updated = 0;
    const allErrors: string[] = [];

    this.updateProgress({
      status: 'running',
      startedAt: new Date(),
      errors: [],
    });

    const checkpoint = this.loadCheckpoint(outDir);
    if (checkpoint.items.length === 0) {
      console.log('[FLKCrawler] 没有已下载的文件，请先执行 downloadAll()');
      return {
        success: true,
        itemsCrawled: 0,
        itemsCreated: 0,
        itemsUpdated: 0,
        errors: [],
        duration: 0,
      };
    }

    const parseResults = this.loadParseResults(outDir);

    // 过滤要处理的文件
    const itemsToProcess = checkpoint.items.filter(item => {
      if (types && !(types as number[]).includes(item.flfgCodeId)) return false;
      if (!item.filePath) return false;
      if (onlyFailed) {
        const status = parseResults.files[item.bbbs];
        return status?.status === 'failed';
      }
      const status = parseResults.files[item.bbbs];
      if (status?.status === 'success') return false;
      if (status && status.attempts >= maxAttempts) return false;
      return true;
    });

    console.log(
      `[FLKCrawler] 解析阶段 - 待处理 ${itemsToProcess.length} 个文件 (共 ${checkpoint.items.length} 个)`
    );

    this.updateProgress({
      totalItems: itemsToProcess.length,
      processedItems: 0,
    });

    for (const item of itemsToProcess) {
      try {
        if (!fs.existsSync(item.filePath)) {
          throw new Error(`文件不存在: ${item.filePath}`);
        }

        const buffer = await fs.promises.readFile(item.filePath);
        const fullText = await this.parseDocxFile(buffer, item.bbbs);

        const typeConfig = FLK_TYPE_CONFIGS.find(
          c => c.code === item.flfgCodeId
        );

        const articleData: LawArticleData = {
          sourceId: item.bbbs,
          sourceUrl: `${this.API_BASE}/detail2.html?${item.bbbs}`,
          lawName: item.title,
          articleNumber: item.bbbs,
          fullText,
          lawType: typeConfig?.lawType || LawType.LAW,
          category: typeConfig?.category || LawCategory.OTHER,
          issuingAuthority: item.zdjgName || '未知',
          effectiveDate: item.sxrq ? new Date(item.sxrq) : new Date(item.gbrq),
          searchableText:
            `${item.title} ${item.zdjgName || ''} ${item.flxz || ''} ${fullText}`.substring(
              0,
              50000
            ),
          status: this.determineStatus(item.sxx),
          version: '1.0',
          tags: [item.flxz, typeConfig?.label].filter(Boolean) as string[],
        };

        const result = await this.saveArticles([articleData]);
        created += result.created;
        updated += result.updated;

        parseResults.files[item.bbbs] = {
          status: 'success',
          attempts: (parseResults.files[item.bbbs]?.attempts || 0) + 1,
          lastAttemptAt: new Date().toISOString(),
          docFormat: this.detectDocxFormat(buffer),
        };
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        allErrors.push(`[${item.title}] ${errorMsg}`);

        parseResults.files[item.bbbs] = {
          status: 'failed',
          attempts: (parseResults.files[item.bbbs]?.attempts || 0) + 1,
          lastAttemptAt: new Date().toISOString(),
          error: errorMsg,
        };

        // 保存元数据
        try {
          const typeConfig = FLK_TYPE_CONFIGS.find(
            c => c.code === item.flfgCodeId
          );
          const articleData: LawArticleData = {
            sourceId: item.bbbs,
            sourceUrl: `${this.API_BASE}/detail2.html?${item.bbbs}`,
            lawName: item.title,
            articleNumber: item.bbbs,
            fullText: '',
            lawType: typeConfig?.lawType || LawType.LAW,
            category: typeConfig?.category || LawCategory.OTHER,
            issuingAuthority: item.zdjgName || '未知',
            effectiveDate: item.sxrq
              ? new Date(item.sxrq)
              : new Date(item.gbrq),
            status: this.determineStatus(item.sxx),
            version: '1.0',
            tags: [item.flxz].filter(Boolean),
          };
          await this.saveArticles([articleData]);
        } catch {
          // 忽略
        }
      }

      this.updateProgress({ processedItems: this.progress.processedItems + 1 });

      if (this.progress.processedItems % 50 === 0) {
        this.updateParseStats(parseResults);
        this.saveParseResults(outDir, parseResults);
      }
    }

    this.updateParseStats(parseResults);
    parseResults.lastRunAt = new Date().toISOString();
    this.saveParseResults(outDir, parseResults);

    const duration = Date.now() - startTime;
    this.updateProgress({ status: 'completed', completedAt: new Date() });

    console.log(
      `[FLKCrawler] 解析完成: 成功 ${parseResults.stats.success}, 失败 ${parseResults.stats.failed}, 新增 ${created}, 更新 ${updated}`
    );

    return {
      success: true,
      itemsCrawled: itemsToProcess.length,
      itemsCreated: created,
      itemsUpdated: updated,
      errors: allErrors,
      duration,
    };
  }

  async reparseFailed(options?: FLKParseOptions): Promise<CrawlerResult> {
    return this.parseAll({ ...options, onlyFailed: true });
  }

  getStats(outputDir?: string): FLKStats {
    const outDir = outputDir || this.DEFAULT_OUTPUT_DIR;
    const checkpoint = this.loadCheckpoint(outDir);
    const parseResults = this.loadParseResults(outDir);

    const byType: Record<string, number> = {};
    for (const item of checkpoint.items) {
      const typeCode = item.flfgCodeId.toString();
      byType[typeCode] = (byType[typeCode] || 0) + 1;
    }

    return {
      download: {
        total: checkpoint.items.length,
        byType,
        status: checkpoint.status,
        lastUpdated: checkpoint.lastUpdatedAt,
      },
      parse: {
        total: parseResults.stats.total,
        success: parseResults.stats.success,
        failed: parseResults.stats.failed,
        pending: parseResults.stats.pending,
        failRate:
          parseResults.stats.total > 0
            ? `${((parseResults.stats.failed / parseResults.stats.total) * 100).toFixed(1)}%`
            : '0%',
        lastRun: parseResults.lastRunAt,
      },
    };
  }

  // ════════════════════════════════════════════════════════════════════
  //  DOCX 解析
  // ════════════════════════════════════════════════════════════════════

  private async parseDocxFile(
    buffer: Buffer,
    sourceId: string
  ): Promise<string> {
    try {
      const { docxParser } = await import('./docx-parser');
      const doc = await docxParser.parse(buffer, `flk://${sourceId}`);
      if (doc?.fullText && doc.fullText.length > 20) {
        return doc.fullText;
      }
    } catch {
      // 降级
    }

    try {
      const mammoth = await import('mammoth');
      const result = await mammoth.extractRawText({ buffer });
      if (result.value && result.value.length > 20) {
        return result.value;
      }
    } catch {
      // 降级
    }

    try {
      const text = await this.extractTextFromZip(buffer);
      if (text && text.length > 20) return text;
    } catch {
      // 失败
    }

    throw new Error('所有 DOCX 解析方式均失败');
  }

  private async extractTextFromZip(buffer: Buffer): Promise<string> {
    const jszip = await import('jszip');
    const zip = await jszip.loadAsync(buffer);
    const docXml = zip.file('word/document.xml');
    if (!docXml) return '';

    const xmlContent = await docXml.async('text');
    return xmlContent
      .replace(/<w:br[^>]*\/>/g, '\n')
      .replace(/<\/w:p>/g, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/\s+/g, ' ')
      .replace(/ \n /g, '\n')
      .trim();
  }

  private detectDocxFormat(buffer: Buffer): string {
    if (buffer.length < 4) return 'unknown';
    const header = buffer.subarray(0, 4).toString('hex');
    if (header === '504b0304') return 'docx';
    if (header === 'd0cf11e0') return 'doc-ole';
    if (buffer.subarray(0, 5).toString() === '<?xml') return 'doc-xml';
    return 'unknown';
  }

  // ════════════════════════════════════════════════════════════════════
  //  断点/状态文件管理
  // ════════════════════════════════════════════════════════════════════

  private loadCheckpoint(outDir: string): DownloadCheckpoint {
    const filePath = path.join(outDir, 'checkpoint.json');
    try {
      if (fs.existsSync(filePath)) {
        return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      }
    } catch {
      console.warn(`[FLKCrawler] 读取断点文件失败, 将重新开始`);
    }

    return {
      version: '2.0',
      startedAt: '',
      lastUpdatedAt: '',
      status: 'in_progress',
      types: {},
      items: [],
    };
  }

  private saveCheckpoint(outDir: string, checkpoint: DownloadCheckpoint): void {
    fs.mkdirSync(outDir, { recursive: true });
    const filePath = path.join(outDir, 'checkpoint.json');
    fs.writeFileSync(filePath, JSON.stringify(checkpoint, null, 2), 'utf-8');
  }

  private loadParseResults(outDir: string): ParseResults {
    const filePath = path.join(outDir, 'parse-results.json');
    try {
      if (fs.existsSync(filePath)) {
        return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      }
    } catch {
      console.warn(`[FLKCrawler] 读取解析状态失败`);
    }

    return {
      version: '2.0',
      lastRunAt: '',
      stats: { total: 0, success: 0, failed: 0, pending: 0 },
      files: {},
    };
  }

  private saveParseResults(outDir: string, results: ParseResults): void {
    fs.mkdirSync(outDir, { recursive: true });
    const filePath = path.join(outDir, 'parse-results.json');
    fs.writeFileSync(filePath, JSON.stringify(results, null, 2), 'utf-8');
  }

  private updateParseStats(results: ParseResults): void {
    const files = Object.values(results.files);
    results.stats = {
      total: files.length,
      success: files.filter(f => f.status === 'success').length,
      failed: files.filter(f => f.status === 'failed').length,
      pending: files.filter(f => f.status === 'pending').length,
    };
  }

  // ════════════════════════════════════════════════════════════════════
  //  API 请求 (新版)
  // ════════════════════════════════════════════════════════════════════

  /**
   * 列表 API (POST /law-search/search/list)
   */
  private async fetchList(
    typeCode: FLKTypeCode,
    page: number,
    pageSize: number,
    sinceDate?: string
  ): Promise<FLKListResponse> {
    const requestBody: FLKListRequest = {
      searchRange: 1,
      sxrq: sinceDate
        ? [sinceDate, new Date().toISOString().split('T')[0]]
        : [],
      gbrq: [],
      searchType: 2,
      sxx: [],
      gbrqYear: [],
      flfgCodeId: [typeCode],
      zdjgCodeId: [],
      searchContent: '',
      pageNum: page,
      pageSize,
    };

    const response = await this.fetchWithRetry(this.API_LIST, {
      method: 'POST',
      headers: {
        'User-Agent': this.randomUA(),
        Accept: 'application/json, text/plain, */*',
        'Content-Type': 'application/json;charset=utf-8',
        Referer: 'https://flk.npc.gov.cn/',
        Origin: 'https://flk.npc.gov.cn',
      },
      body: JSON.stringify(requestBody),
    });

    return response.json();
  }

  /**
   * 详情 API (GET /law-search/search/flfgDetails)
   */
  private async fetchDetail(bbbs: string): Promise<FLKDetailResponse> {
    const url = `${this.API_DETAIL}?bbbs=${encodeURIComponent(bbbs)}`;
    const response = await this.fetchWithRetry(url, {
      method: 'GET',
      headers: {
        'User-Agent': this.randomUA(),
        Accept: 'application/json, text/plain, */*',
        Referer: 'https://flk.npc.gov.cn/',
      },
    });

    return response.json();
  }

  /**
   * 下载 DOCX 文件
   */
  private async downloadDocx(
    bbbs: string,
    ossFilePath: string
  ): Promise<Buffer> {
    const url = `${this.API_DOWNLOAD}?bbbs=${encodeURIComponent(bbbs)}&ossFilePath=${encodeURIComponent(ossFilePath)}`;
    const response = await this.fetchWithRetry(url, {
      method: 'GET',
      headers: {
        'User-Agent': this.randomUA(),
        Accept: '*/*',
        Referer: 'https://flk.npc.gov.cn/',
      },
    });

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  private async fetchWithRetry(
    url: string,
    init: RequestInit,
    retries?: number
  ): Promise<Response> {
    const maxRetries = retries ?? this.config.maxRetries;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(
          () => controller.abort(),
          this.config.requestTimeout
        );

        const response = await fetch(url, {
          ...init,
          signal: controller.signal,
        });

        clearTimeout(timeout);

        if (!response.ok) {
          if (
            (response.status === 429 || response.status >= 500) &&
            attempt < maxRetries
          ) {
            this.consecutiveErrors++;
            const backoff = this.backoffWithJitter(attempt);
            console.log(
              `[FLKCrawler] HTTP ${response.status}, ${backoff}ms 后重试 (${attempt + 1}/${maxRetries})`
            );
            await this.delay(backoff);
            continue;
          }
          this.consecutiveErrors++;
          throw new Error(
            `HTTP ${response.status}: ${response.statusText} (${url})`
          );
        }

        this.consecutiveErrors = 0;
        return response;
      } catch (error) {
        this.consecutiveErrors++;
        if (attempt >= maxRetries) throw error;

        const isTimeout = error instanceof Error && error.name === 'AbortError';
        const backoff = this.backoffWithJitter(attempt);
        console.log(
          `[FLKCrawler] ${isTimeout ? '超时' : '网络错误'}, ${backoff}ms 后重试 (${attempt + 1}/${maxRetries})`
        );
        await this.delay(backoff);
      }
    }

    throw new Error(`请求失败: 超过最大重试次数 (${url})`);
  }

  private async randomDelay(): Promise<void> {
    const base = 2000 + Math.random() * 3000;
    const errorPenalty = this.consecutiveErrors * 2000;
    const total = Math.min(base + errorPenalty, 30000);
    await this.delay(total);
  }

  private backoffWithJitter(attempt: number): number {
    const base = this.config.rateLimitDelay * Math.pow(2, attempt);
    const jitter = base * (0.5 + Math.random() * 0.5);
    return Math.min(jitter, 60000);
  }

  private randomUA(): string {
    return FLKCrawler.UA_POOL[
      Math.floor(Math.random() * FLKCrawler.UA_POOL.length)
    ];
  }

  private determineStatus(sxx: number): LawStatus {
    switch (sxx) {
      case 1:
        return LawStatus.REPEALED;
      case 2:
        return LawStatus.AMENDED;
      case 4:
        return LawStatus.DRAFT;
      case 3:
      default:
        return LawStatus.VALID;
    }
  }
}

export const flkCrawler = new FLKCrawler();
