"use strict";
// =============================================================================
// 安全相关错误类定义
// =============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.ValidationError = exports.SecurityError = exports.AnalysisError = void 0;
class AnalysisError extends Error {
    constructor(message, cause, context) {
        super(message);
        this.cause = cause;
        this.context = context;
        this.name = 'AnalysisError';
    }
}
exports.AnalysisError = AnalysisError;
class SecurityError extends Error {
    constructor(message, context) {
        super(message);
        this.context = context;
        this.name = 'SecurityError';
    }
}
exports.SecurityError = SecurityError;
class ValidationError extends Error {
    constructor(message, field, value) {
        super(message);
        this.field = field;
        this.value = value;
        this.name = 'ValidationError';
    }
}
exports.ValidationError = ValidationError;
