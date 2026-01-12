/**
 * DocAnalyzerAgent适配器
 *
 * 将新的模块化DocAnalyzerAgent适配到现有的API接口
 */

import { DocAnalyzerAgent } from './doc-analyzer-agent';
import type { AgentContext } from '../../../types/agent';
import type { DocumentAnalysisOutput } from './core/types';

export class DocAnalyzerAgentAdapter {
  private agent: DocAnalyzerAgent;

  constructor(useMock: boolean = false) {
    this.agent = new DocAnalyzerAgent(useMock);
  }

  /**
   * 初始化Agent
   */
  async initialize(): Promise<void> {
    await this.agent.initialize();
  }

  /**
   * 清理Agent资源
   */
  async cleanup(): Promise<void> {
    await this.agent.cleanup();
  }

  /**
   * 执行文档分析（兼容旧接口）
   */
  async execute(context: AgentContext): Promise<{
    success: boolean;
    data?: DocumentAnalysisOutput;
    executionTime?: number;
    tokensUsed?: number;
    error?: {
      code: string;
      message: string;
      type: string;
    };
  }> {
    try {
      const startTime = Date.now();
      const result = await this.agent.execute(context);
      const executionTime = Date.now() - startTime;

      return {
        success: true,
        data: result.data as DocumentAnalysisOutput,
        executionTime,
        tokensUsed: result.tokensUsed,
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code:
            error instanceof Error ? error.constructor.name : 'UNKNOWN_ERROR',
          message: error instanceof Error ? error.message : String(error),
          type: 'EXECUTION_ERROR',
        },
      };
    }
  }

  /**
   * 获取Agent实例
   */
  getAgent(): DocAnalyzerAgent {
    return this.agent;
  }

  /**
   * 禁用缓存（用于测试）
   */
  async disableCache(): Promise<void> {
    await this.agent.getCacheProcessor().updateConfig({ enabled: false });
  }
}
