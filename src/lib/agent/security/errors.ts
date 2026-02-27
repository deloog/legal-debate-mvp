// =============================================================================
// 安全相关错误类定义
// =============================================================================

export class AnalysisError extends Error {
  constructor(
    message: string,
    public readonly cause: Error,
    public readonly context: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AnalysisError';
  }
}

export class SecurityError extends Error {
  constructor(
    message: string,
    public readonly context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'SecurityError';
  }
}

export class ValidationError<T = unknown> extends Error {
  constructor(
    message: string,
    public readonly field?: string,
    public readonly value?: T
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}
