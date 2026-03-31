/**
 * SSE流式输出类型定义
 * 用于辩论生成过程中的实时数据推送
 */

/**
 * SSE事件格式（符合W3C标准）
 */
export interface SSEEvent {
  event?: string; // 事件类型
  data: string; // 事件数据（JSON字符串）
  id?: string; // 事件ID（用于断线重连）
  retry?: number; // 重连间隔（毫秒）
}

/**
 * 辩论流式事件类型
 */
export type DebateStreamEventType =
  | 'connected' // 连接确认
  | 'round-start' // 轮次开始
  | 'law-search-complete' // 法条检索完成（携带检索结果）
  | 'ai_stream' // AI流式内容（实时token）
  | 'argument' // 论点生成
  | 'progress' // 进度更新
  | 'completed' // 完成
  | 'error' // 错误
  | 'ping' // 心跳
  | 'disconnected'; // 断开连接

/**
 * 法条检索完成事件数据
 */
export interface LawSearchCompleteEventData {
  articles: Array<{ lawName: string; articleNumber: string }>;
  count: number;
  timestamp: string;
}

/**
 * 连接事件数据
 */
export interface ConnectedEventData {
  debateId: string;
  roundId: string;
  timestamp: string;
  sessionId: string;
}

/**
 * 轮次开始事件数据
 */
export interface RoundStartEventData {
  debateId: string;
  roundId: string;
  roundNumber: number;
  timestamp: string;
}

/**
 * 论点生成事件数据
 */
export interface ArgumentEventData {
  argumentId: string;
  roundId: string;
  side: 'PLAINTIFF' | 'DEFENDANT';
  content: string;
  type:
    | 'MAIN_POINT'
    | 'SUPPORTING'
    | 'REBUTTAL'
    | 'EVIDENCE'
    | 'LEGAL_BASIS'
    | 'CONCLUSION';
  timestamp: string;
  reasoning?: string;
  legalBasis?: Array<{
    lawName: string;
    articleNumber: string;
    relevance: number;
    explanation: string;
  }>;
  confidence?: number;
}

/**
 * 进度更新事件数据
 */
export interface ProgressEventData {
  debateId: string;
  roundId: string;
  progress: number; // 0-100
  currentStep: string;
  totalSteps: number;
  estimatedRemainingTime?: number; // 毫秒
  timestamp: string;
}

/**
 * 完成事件数据
 */
export interface CompletedEventData {
  debateId: string;
  roundId?: string;
  totalArguments?: number;
  plaintiffArguments?: number;
  defendantArguments?: number;
  generationTime?: number; // 毫秒
  roundNumber?: number;
  hasMoreRounds?: boolean; // 是否还有更多轮次可继续
  isLastRound?: boolean; // 是否已是最后一轮
  timestamp: string;
}

/**
 * 错误事件数据
 */
export interface ErrorEventData {
  debateId: string;
  roundId?: string;
  code: string;
  message: string;
  details?: unknown;
  timestamp: string;
}

/**
 * 心跳事件数据
 */
export interface PingEventData {
  timestamp: string;
  serverTime: string;
}

/**
 * 断开连接事件数据
 */
export interface DisconnectedEventData {
  reason: string;
  code?: number;
  timestamp: string;
}

/**
 * AI流式内容事件数据（实时token）
 */
export interface AIStreamEventData {
  chunkId: number;
  content: string; // 新增的token内容
  side?: string; // 当前生成方：'plaintiff' | 'defendant'
  sideLabel?: string; // 中文标签：'原告' | '被告'
  accumulatedLength?: number;
  progress: number; // 0-100
  roundNumber: number;
  timestamp: string;
}

/**
 * AI流开始事件数据
 */
export interface AIStreamStartedEventData {
  type: 'started';
  timestamp: string;
}

/**
 * AI流完成事件数据
 */
export interface AIStreamCompleteEventData {
  type: 'complete';
  content: string;
  isComplete: true;
  progress: number;
  totalChunks: number;
  timestamp: string;
}

/**
 * AI流错误事件数据
 */
export interface AIStreamErrorEventData {
  type: 'error';
  error: string;
  timestamp: string;
}

/**
 * SSE连接配置
 */
export interface SSEConnectionConfig {
  debateId: string;
  roundId: string;
  heartbeatInterval?: number; // 心跳间隔（毫秒），默认30000
  connectionTimeout?: number; // 连接超时（毫秒），默认300000
  maxRetryAttempts?: number; // 最大重连次数，默认5
  enableReconnection?: boolean; // 是否启用自动重连，默认true
}

/**
 * SSE连接状态
 */
export enum SSEConnectionState {
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
  DISCONNECTED = 'DISCONNECTED',
  ERROR = 'ERROR',
  RECONNECTING = 'RECONNECTING',
}

/**
 * SSE连接统计信息
 */
export interface SSEConnectionStats {
  sessionId: string;
  startTime: Date;
  lastActivityTime: Date;
  totalEventsSent: number;
  totalBytesSent: number;
  lastEventId: string;
  reconnectAttempts: number;
  averageEventInterval?: number;
}
