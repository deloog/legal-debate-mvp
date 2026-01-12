// 流式生成器：支持流式输出生成的文档

import { StreamConfig, SSEMessage } from './types';

/**
 * 流式生成器类
 */
export class StreamGenerator {
  private config: StreamConfig;

  constructor(config?: Partial<StreamConfig>) {
    this.config = {
      chunkSize: config?.chunkSize ?? 200,
      delayMs: config?.delayMs ?? 100,
      format: config?.format ?? 'sse',
      maxChunks: config?.maxChunks,
    };
  }

  /**
   * 生成SSE流
   */
  async *generateSSEStream(
    content: string
  ): AsyncGenerator<SSEMessage, void, unknown> {
    const chunks = this.splitContent(content);

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const message: SSEMessage = {
        data: chunk,
        event: i === chunks.length - 1 ? 'done' : 'chunk',
        id: `chunk-${i}`,
      };

      if (this.config.delayMs > 0) {
        await this.delay(this.config.delayMs);
      }

      yield message;
    }
  }

  /**
   * 生成JSON流
   */
  async *generateJSONStream(
    content: string
  ): AsyncGenerator<SSEMessage, void, unknown> {
    const chunks = this.splitContent(content);

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const message: SSEMessage = {
        data: JSON.stringify({
          chunk,
          index: i,
          total: chunks.length,
          finished: i === chunks.length - 1,
        }),
        event: i === chunks.length - 1 ? 'done' : 'chunk',
        id: `chunk-${i}`,
      };

      if (this.config.delayMs > 0) {
        await this.delay(this.config.delayMs);
      }

      yield message;
    }
  }

  /**
   * 格式化SSE消息为字符串
   */
  formatSSEMessage(message: SSEMessage): string {
    let output = '';

    if (message.id) {
      output += `id: ${message.id}\n`;
    }

    if (message.event) {
      output += `event: ${message.event}\n`;
    }

    output += `data: ${message.data}\n\n`;

    return output;
  }

  /**
   * 流式生成文本内容
   */
  async generateStreamText(
    content: string,
    callback: (chunk: string, index: number, total: number) => void
  ): Promise<void> {
    const chunks = this.splitContent(content);

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      callback(chunk, i, chunks.length);

      if (this.config.delayMs > 0) {
        await this.delay(this.config.delayMs);
      }
    }
  }

  /**
   * 流式生成带进度的内容
   */
  async *generateWithProgress(
    content: string
  ): AsyncGenerator<
    { chunk: string; progress: number; finished: boolean },
    void,
    unknown
  > {
    const chunks = this.splitContent(content);
    const totalChunks = chunks.length;

    for (let i = 0; i < totalChunks; i++) {
      const chunk = chunks[i];
      const progress = ((i + 1) / totalChunks) * 100;

      if (this.config.delayMs > 0) {
        await this.delay(this.config.delayMs);
      }

      yield {
        chunk,
        progress: Math.round(progress),
        finished: i === totalChunks - 1,
      };
    }
  }

  /**
   * 分割内容为块
   */
  private splitContent(content: string): string[] {
    const chunks: string[] = [];
    let position = 0;
    const maxChunks = this.config.maxChunks;

    while (position < content.length) {
      if (maxChunks !== undefined && chunks.length >= maxChunks) {
        break;
      }

      const end = Math.min(position + this.config.chunkSize, content.length);
      chunks.push(content.substring(position, end));
      position = end;
    }

    return chunks;
  }

  /**
   * 延迟函数
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<StreamConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 获取配置
   */
  getConfig(): StreamConfig {
    return { ...this.config };
  }

  /**
   * 重置配置为默认值
   */
  resetConfig(): void {
    this.config = {
      chunkSize: 200,
      delayMs: 100,
      format: 'sse',
      maxChunks: undefined,
    };
  }

  /**
   * 创建StreamGenerator实例
   */
  static create(config?: Partial<StreamConfig>): StreamGenerator {
    return new StreamGenerator(config);
  }

  /**
   * 估算生成时间
   */
  estimateGenerationTime(contentLength: number): number {
    const chunks = Math.ceil(contentLength / this.config.chunkSize);
    return chunks * this.config.delayMs;
  }

  /**
   * 获取块信息
   */
  getChunkInfo(content: string): { count: number; sizes: number[] } {
    const chunks = this.splitContent(content);
    return {
      count: chunks.length,
      sizes: chunks.map(chunk => chunk.length),
    };
  }
}
