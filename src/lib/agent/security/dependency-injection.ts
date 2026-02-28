import { DocumentParser } from '../../ai/document-parser';
import {
  PrecisionAmountExtractor,
  type AmountExtractionResult,
  type AmountValidationResult,
} from '../../extraction/amount-extractor-precision';

// =============================================================================
// 依赖注入容器
// =============================================================================

export interface IDocumentParser {
  analyzeWithAI(prompt: string): Promise<string>;
}

export interface IAmountExtractor {
  extractWithPrecision(text: string): Promise<AmountExtractionResult[]>;
  validateAmountConsistency(amounts: AmountExtractionResult[]): AmountValidationResult;
}

export interface AppConfig {
  maxConcurrentDocuments: number;
  defaultTimeout: number;
  enableDebugLogging: boolean;
  security: {
    maxFileSize: number;
    allowedPaths: string[];
  };
}

export class ServiceContainer {
  private static instance: ServiceContainer;
  private services: Map<string, unknown> = new Map();
  private factories: Map<string, () => unknown> = new Map();

  static getInstance(): ServiceContainer {
    if (!ServiceContainer.instance) {
      ServiceContainer.instance = new ServiceContainer();
    }
    return ServiceContainer.instance;
  }

  register<T>(key: string, factory: () => T): void {
    this.factories.set(key, factory);
  }

  registerInstance<T>(key: string, instance: T): void {
    this.services.set(key, instance);
  }

  get<T>(key: string): T {
    // 如果已有实例，直接返回
    if (this.services.has(key)) {
      return this.services.get(key) as T;
    }

    // 如果有工厂方法，创建新实例
    if (this.factories.has(key)) {
      const factory = this.factories.get(key)!;
      const instance = factory();
      this.services.set(key, instance);
      return instance as T;
    }

    throw new Error(`服务未注册: ${key}`);
  }

  has(key: string): boolean {
    return this.services.has(key) || this.factories.has(key);
  }

  clear(): void {
    this.services.clear();
    this.factories.clear();
  }

  // 默认服务注册
  static registerDefaults(): void {
    const container = ServiceContainer.getInstance();

    // 注册文档解析器
    container.register<IDocumentParser>('documentParser', () => {
      return new DocumentParser();
    });

    // 注册金额提取器
    container.register<IAmountExtractor>('amountExtractor', () => {
      return new PrecisionAmountExtractor();
    });

    // 注册配置
    container.register('config', () => ({
      maxConcurrentDocuments: 3,
      defaultTimeout: 30000,
      enableDebugLogging: process.env.NODE_ENV !== 'production',
      security: {
        maxFileSize: 50 * 1024 * 1024, // 50MB
        allowedPaths: [
          process.cwd(),
          process.cwd() + '/temp',
          process.cwd() + '/uploads',
          process.cwd() + '/test-data',
        ],
      },
    }));
  }
}

// 便捷的服务访问函数
export function getDocumentParser(): IDocumentParser {
  return ServiceContainer.getInstance().get<IDocumentParser>('documentParser');
}

export function getAmountExtractor(): IAmountExtractor {
  return ServiceContainer.getInstance().get<IAmountExtractor>(
    'amountExtractor'
  );
}

export function getConfig(): AppConfig {
  return ServiceContainer.getInstance().get<AppConfig>('config');
}

// 初始化默认服务
ServiceContainer.registerDefaults();
