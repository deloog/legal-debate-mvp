"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ServiceContainer = void 0;
exports.getDocumentParser = getDocumentParser;
exports.getAmountExtractor = getAmountExtractor;
exports.getConfig = getConfig;
const document_parser_1 = require("../../ai/document-parser");
const amount_extractor_precision_1 = require("../../extraction/amount-extractor-precision");
class ServiceContainer {
    constructor() {
        this.services = new Map();
        this.factories = new Map();
    }
    static getInstance() {
        if (!ServiceContainer.instance) {
            ServiceContainer.instance = new ServiceContainer();
        }
        return ServiceContainer.instance;
    }
    register(key, factory) {
        this.factories.set(key, factory);
    }
    registerInstance(key, instance) {
        this.services.set(key, instance);
    }
    get(key) {
        // 如果已有实例，直接返回
        if (this.services.has(key)) {
            return this.services.get(key);
        }
        // 如果有工厂方法，创建新实例
        if (this.factories.has(key)) {
            const factory = this.factories.get(key);
            const instance = factory();
            this.services.set(key, instance);
            return instance;
        }
        throw new Error(`服务未注册: ${key}`);
    }
    has(key) {
        return this.services.has(key) || this.factories.has(key);
    }
    clear() {
        this.services.clear();
        this.factories.clear();
    }
    // 默认服务注册
    static registerDefaults() {
        const container = ServiceContainer.getInstance();
        // 注册文档解析器
        container.register('documentParser', () => {
            return new document_parser_1.DocumentParser();
        });
        // 注册金额提取器
        container.register('amountExtractor', () => {
            return new amount_extractor_precision_1.PrecisionAmountExtractor();
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
                    process.cwd() + '/test-data'
                ]
            }
        }));
    }
}
exports.ServiceContainer = ServiceContainer;
// 便捷的服务访问函数
function getDocumentParser() {
    return ServiceContainer.getInstance().get('documentParser');
}
function getAmountExtractor() {
    return ServiceContainer.getInstance().get('amountExtractor');
}
function getConfig() {
    return ServiceContainer.getInstance().get('config');
}
// 初始化默认服务
ServiceContainer.registerDefaults();
