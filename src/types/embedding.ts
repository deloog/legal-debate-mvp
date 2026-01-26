/**
 * 向量嵌入相关类型定义
 */

/**
 * 向量嵌入模型类型
 */
export enum EmbeddingModel {
  ZHIPU_EMBEDDING_2 = 'embedding-2',
  ZHIPU_EMBEDDING_3 = 'embedding-3',
  OPENAI_ADA_002 = 'text-embedding-ada-002',
  OPENAI_3_SMALL = 'text-embedding-3-small',
  OPENAI_3_LARGE = 'text-embedding-3-large',
}

/**
 * 向量嵌入配置接口
 */
export interface EmbeddingConfig {
  model: EmbeddingModel;
  dimension: number;
  provider: 'zhipu' | 'openai' | 'deepseek';
}

/**
 * 向量嵌入结果接口
 */
export interface EmbeddingResult {
  embedding: number[];
  model: EmbeddingModel;
  dimension: number;
  generatedAt: Date;
  version: string;
}

/**
 * 向量嵌入存储格式接口
 */
export interface EmbeddingStorage {
  embedding: number[];
  model: string;
  dimension: number;
  generatedAt: string;
  version: string;
}

/**
 * 文本预处理选项接口
 */
export interface TextPreprocessingOptions {
  maxLength?: number;
  includeTitle?: boolean;
  includeFacts?: boolean;
  includeJudgment?: boolean;
  separator?: string;
}

/**
 * 向量生成请求接口
 */
export interface EmbeddingRequest {
  text: string;
  model?: EmbeddingModel;
  provider?: 'zhipu' | 'openai' | 'deepseek';
}

/**
 * 向量生成响应接口
 */
export interface EmbeddingResponse {
  success: boolean;
  data?: EmbeddingResult;
  error?: string;
  statusCode?: number;
}

/**
 * 向量相似度计算结果接口
 */
export interface SimilarityResult {
  similarity: number;
  cosineSimilarity?: number;
  euclideanDistance?: number;
}

/**
 * 批量嵌入生成结果接口
 */
export interface BatchEmbeddingResult {
  total: number;
  successful: number;
  failed: number;
  results: Array<{
    id: string;
    success: boolean;
    data?: EmbeddingResult;
    error?: string;
  }>;
}

/**
 * 向量归一化选项接口
 */
export interface NormalizationOptions {
  method?: 'l2' | 'l1' | 'max';
}

/**
 * 向量验证结果接口
 */
export interface EmbeddingValidation {
  valid: boolean;
  dimension?: number;
  errors?: string[];
}

/**
 * 默认嵌入配置
 */
export const DEFAULT_EMBEDDING_CONFIG: EmbeddingConfig = {
  model: EmbeddingModel.ZHIPU_EMBEDDING_2,
  dimension: 1536,
  provider: 'zhipu',
};

/**
 * 支持的嵌入模型列表
 */
export const SUPPORTED_EMBEDDING_MODELS: EmbeddingModel[] = [
  EmbeddingModel.ZHIPU_EMBEDDING_2,
  EmbeddingModel.ZHIPU_EMBEDDING_3,
  EmbeddingModel.OPENAI_ADA_002,
  EmbeddingModel.OPENAI_3_SMALL,
  EmbeddingModel.OPENAI_3_LARGE,
];

/**
 * 模型维度映射
 */
export const MODEL_DIMENSIONS: Record<EmbeddingModel, number> = {
  [EmbeddingModel.ZHIPU_EMBEDDING_2]: 1024,
  [EmbeddingModel.ZHIPU_EMBEDDING_3]: 1536,
  [EmbeddingModel.OPENAI_ADA_002]: 1536,
  [EmbeddingModel.OPENAI_3_SMALL]: 1536,
  [EmbeddingModel.OPENAI_3_LARGE]: 3072,
};

/**
 * 获取模型维度
 */
export function getModelDimension(model: EmbeddingModel): number {
  return MODEL_DIMENSIONS[model] || 1536;
}

/**
 * 验证嵌入向量
 */
export function validateEmbedding(
  embedding: unknown,
  expectedDimension?: number
): EmbeddingValidation {
  const errors: string[] = [];

  if (!Array.isArray(embedding)) {
    return { valid: false, errors: ['Embedding must be an array'] };
  }

  if (embedding.length === 0) {
    errors.push('Embedding cannot be empty');
  }

  if (expectedDimension && embedding.length !== expectedDimension) {
    errors.push(
      `Embedding dimension mismatch: expected ${expectedDimension}, got ${embedding.length}`
    );
  }

  // 检查所有元素都是数字
  const nonNumericElements = embedding.filter(
    (item): item is number => typeof item !== 'number' || isNaN(item)
  );
  if (nonNumericElements.length > 0) {
    errors.push('Embedding contains non-numeric elements');
  }

  return {
    valid: errors.length === 0,
    dimension: embedding.length,
    errors: errors.length > 0 ? errors : undefined,
  };
}

/**
 * 计算余弦相似度
 */
export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length) {
    throw new Error('Vectors must have the same length');
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  normA = Math.sqrt(normA);
  normB = Math.sqrt(normB);

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return dotProduct / (normA * normB);
}

/**
 * 归一化向量
 */
export function normalizeVector(
  vector: number[],
  options: NormalizationOptions = {}
): number[] {
  const method = options.method || 'l2';

  if (method === 'l2') {
    const norm = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
    if (norm === 0) {
      return vector;
    }
    return vector.map(val => val / norm);
  }

  if (method === 'l1') {
    const norm = vector.reduce((sum, val) => sum + Math.abs(val), 0);
    if (norm === 0) {
      return vector;
    }
    return vector.map(val => val / norm);
  }

  if (method === 'max') {
    const max = Math.max(...vector.map(Math.abs));
    if (max === 0) {
      return vector;
    }
    return vector.map(val => val / max);
  }

  return vector;
}

/**
 * 计算欧几里得距离
 */
export function euclideanDistance(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length) {
    throw new Error('Vectors must have the same length');
  }

  let sum = 0;
  for (let i = 0; i < vecA.length; i++) {
    const diff = vecA[i] - vecB[i];
    sum += diff * diff;
  }

  return Math.sqrt(sum);
}

/**
 * 压缩向量存储
 */
export function compressVector(embedding: number[]): string {
  const float32Array = new Float32Array(embedding);
  return Array.from(float32Array).join(',');
}

/**
 * 解压向量
 */
export function decompressVector(compressed: string): number[] {
  const values = compressed.split(',').map(Number);
  const float32Array = Float32Array.from(values);
  return Array.from(float32Array);
}
