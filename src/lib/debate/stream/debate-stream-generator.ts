/**
 * 辩论流式生成器
 * 负责将辩论生成过程转换为流式事件
 */

import { SSEEventManager } from './sse-manager';
import {
  type SSEEvent,
  SSEConnectionState,
  type ConnectedEventData,
  type RoundStartEventData,
  type ArgumentEventData,
  type ProgressEventData,
  type CompletedEventData,
  type ErrorEventData,
  type PingEventData,
  type DisconnectedEventData,
} from './types';

/**
 * 流式生成器配置
 */
interface StreamGeneratorConfig {
  debateId: string;
  roundId: string;
  roundNumber: number;
  totalArguments: number;
  progressInterval: number; // 进度更新间隔（毫秒）
}

/**
 * 辩论流式生成器
 */
export class DebateStreamGenerator {
  private manager: SSEEventManager;
  private config: StreamGeneratorConfig;
  private write: (data: string) => void;
  private progressTimer?: NodeJS.Timeout;
  private startTime: number;
  private currentProgress = 0;
  private generatedArguments: ArgumentEventData[] = [];

  constructor(
    sessionId: string,
    config: StreamGeneratorConfig,
    write: (data: string) => void
  ) {
    this.manager = new SSEEventManager(sessionId);
    this.config = config;
    this.write = write;
    this.startTime = Date.now();
  }

  /**
   * 发送连接确认事件
   */
  sendConnected(): void {
    const eventData: ConnectedEventData = {
      debateId: this.config.debateId,
      roundId: this.config.roundId,
      timestamp: new Date().toISOString(),
      sessionId: this.manager.getStats().sessionId,
    };

    const event = this.manager.createEvent('connected', eventData);
    this.sendEvent(event);
    this.manager.setState(SSEConnectionState.CONNECTED);
  }

  /**
   * 发送轮次开始事件
   */
  sendRoundStart(): void {
    const eventData: RoundStartEventData = {
      debateId: this.config.debateId,
      roundId: this.config.roundId,
      roundNumber: this.config.roundNumber,
      timestamp: new Date().toISOString(),
    };

    const event = this.manager.createEvent('round-start', eventData);
    this.sendEvent(event);
  }

  /**
   * 发送论点生成事件
   */
  sendArgument(argument: ArgumentEventData): void {
    this.generatedArguments.push(argument);
    const event = this.manager.createEvent('argument', argument);
    this.sendEvent(event);
    this.updateProgress();
  }

  /**
   * 发送进度更新事件
   */
  sendProgress(
    currentStep: string,
    totalSteps: number,
    customProgress?: number
  ): void {
    let progress: number;
    if (customProgress) {
      progress = customProgress;
    } else {
      progress =
        (this.generatedArguments.length / this.config.totalArguments) * 100;
      progress = Math.round(progress);
    }

    const estimatedRemainingTime = this.calculateRemainingTime(progress);
    const eventData: ProgressEventData = {
      debateId: this.config.debateId,
      roundId: this.config.roundId,
      progress,
      currentStep,
      totalSteps,
      timestamp: new Date().toISOString(),
    };

    // 只在有有效的剩余时间估计时才添加该字段
    if (estimatedRemainingTime !== null) {
      eventData.estimatedRemainingTime = estimatedRemainingTime;
    }

    const event = this.manager.createEvent('progress', eventData);
    this.sendEvent(event);
    this.currentProgress = progress;
  }

  /**
   * 启动自动进度更新
   */
  startProgressUpdates(steps: string[]): void {
    const sendProgress = () => {
      const currentStep =
        steps[this.generatedArguments.length] || steps[steps.length - 1];
      this.sendProgress(currentStep, steps.length);
    };

    this.progressTimer = setInterval(() => {
      sendProgress();
    }, this.config.progressInterval);
  }

  /**
   * 停止自动进度更新
   */
  stopProgressUpdates(): void {
    if (this.progressTimer) {
      clearInterval(this.progressTimer);
      this.progressTimer = undefined;
    }
  }

  /**
   * 发送完成事件
   */
  sendCompleted(): void {
    const generationTime = Date.now() - this.startTime;

    const plaintiffCount = this.generatedArguments.filter(
      arg => arg.side === 'PLAINTIFF'
    ).length;
    const defendantCount = this.generatedArguments.filter(
      arg => arg.side === 'DEFENDANT'
    ).length;

    const eventData: CompletedEventData = {
      debateId: this.config.debateId,
      roundId: this.config.roundId,
      totalArguments: this.generatedArguments.length,
      plaintiffArguments: plaintiffCount,
      defendantArguments: defendantCount,
      generationTime,
      timestamp: new Date().toISOString(),
    };

    const event = this.manager.createEvent('completed', eventData);
    this.sendEvent(event);
    this.stopProgressUpdates();
  }

  /**
   * 发送错误事件
   */
  sendError(
    code: string,
    message: string,
    details?: unknown,
    roundId?: string
  ): void {
    const eventData: ErrorEventData = {
      debateId: this.config.debateId,
      roundId: roundId || this.config.roundId,
      code,
      message,
      details,
      timestamp: new Date().toISOString(),
    };

    const event = this.manager.createEvent('error', eventData, undefined, 3000);
    this.sendEvent(event);
    this.manager.setState(SSEConnectionState.ERROR);
  }

  /**
   * 发送心跳事件
   */
  sendPing(): void {
    const eventData: PingEventData = {
      timestamp: new Date().toISOString(),
      serverTime: new Date().toISOString(),
    };

    const event = this.manager.createEvent('ping', eventData);
    this.sendEvent(event);
  }

  /**
   * 发送断开连接事件
   */
  sendDisconnected(reason: string, code?: number): void {
    const eventData: DisconnectedEventData = {
      reason,
      code,
      timestamp: new Date().toISOString(),
    };

    const event = this.manager.createEvent('disconnected', eventData);
    this.sendEvent(event);
    this.manager.cleanup();
  }

  /**
   * 发送SSE事件
   */
  private sendEvent(event: SSEEvent): void {
    const formatted = this.manager.formatEvent(event);
    this.write(formatted);
    this.manager.updateStats(formatted.length);
  }

  /**
   * 更新进度
   */
  private updateProgress(): void {
    const progress =
      (this.generatedArguments.length / this.config.totalArguments) * 100;
    this.currentProgress = progress;
  }

  /**
   * 计算剩余时间
   */
  private calculateRemainingTime(progress: number): number | null {
    if (progress <= 0) {
      return null;
    }

    const elapsed = Date.now() - this.startTime;
    const remaining = (elapsed / progress) * (100 - progress);
    return Math.round(remaining);
  }

  /**
   * 获取统计信息
   */
  getStats() {
    return this.manager.getStats();
  }

  /**
   * 启动心跳
   */
  startHeartbeat(interval: number): void {
    this.manager.startHeartbeat(interval, () => {
      this.sendPing();
    });
  }

  /**
   * 停止心跳
   */
  stopHeartbeat(): void {
    this.manager.stopHeartbeat();
  }

  /**
   * 清理资源
   */
  cleanup(): void {
    this.stopProgressUpdates();
    this.stopHeartbeat();
    this.manager.cleanup();
  }
}
