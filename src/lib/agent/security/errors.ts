// =============================================================================
// 安全相关错误类定义
// =============================================================================

export class AnalysisError extends Error {
  constructor(
    message: string,
    public readonly cause: Error,
    public readonly context: Record<string, any>,
  ) {
    super(message);
    this.name = "AnalysisError";
  }
}

export class SecurityError extends Error {
  constructor(
    message: string,
    public readonly context?: Record<string, any>,
  ) {
    super(message);
    this.name = "SecurityError";
  }
}

export class ValidationError extends Error {
  constructor(
    message: string,
    public readonly field?: string,
    public readonly value?: any,
  ) {
    super(message);
    this.name = "ValidationError";
  }
}
