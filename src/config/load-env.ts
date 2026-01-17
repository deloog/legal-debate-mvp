/**
 * 环境变量加载工具
 * 用于安全地加载和解析环境变量
 */

/**
 * 获取字符串环境变量
 */
export function getStringEnv(key: string, defaultValue = ''): string {
  const value = process.env[key];
  if (value === undefined) {
    return defaultValue;
  }
  return value;
}

/**
 * 获取数字环境变量
 */
export function getNumberEnv(key: string, defaultValue = 0): number {
  const value = process.env[key];
  if (value === undefined) {
    return defaultValue;
  }
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) {
    return defaultValue;
  }
  return parsed;
}

/**
 * 获取布尔值环境变量
 */
export function getBooleanEnv(key: string, defaultValue = false): boolean {
  const value = process.env[key];
  if (value === undefined) {
    return defaultValue;
  }
  return value === 'true' || value === '1';
}

/**
 * 获取JSON环境变量
 */
export function getJsonEnv<T = unknown>(key: string, defaultValue: T): T {
  const value = process.env[key];
  if (value === undefined) {
    return defaultValue;
  }
  try {
    return JSON.parse(value) as T;
  } catch {
    return defaultValue;
  }
}

/**
 * 获取数组环境变量（逗号分隔）
 */
export function getArrayEnv(
  key: string,
  defaultValue: string[] = []
): string[] {
  const value = process.env[key];
  if (value === undefined) {
    return defaultValue;
  }
  return value.split(',').map(item => item.trim());
}

/**
 * 获取URL环境变量（带验证）
 */
export function getUrlEnv(key: string, defaultValue = ''): string {
  const value = getStringEnv(key, defaultValue);
  if (value && !isValidUrl(value)) {
    console.warn(`环境变量 ${key} 不是有效的URL: ${value}`);
  }
  return value;
}

/**
 * 验证URL格式
 */
function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * 获取持续时间环境变量（如：7d, 24h, 60m）
 */
export function getDurationEnv(key: string, defaultValue = '7d'): string {
  const value = getStringEnv(key, defaultValue);
  if (!isValidDuration(value)) {
    console.warn(`环境变量 ${key} 不是有效的持续时间格式: ${value}`);
  }
  return value;
}

/**
 * 验证持续时间格式
 */
function isValidDuration(duration: string): boolean {
  const pattern = /^\d+(s|m|h|d)$/;
  return pattern.test(duration);
}

/**
 * 检查必需的环境变量
 */
export function checkRequiredEnvVars(requiredVars: string[]): string[] {
  const missing: string[] = [];

  for (const varName of requiredVars) {
    if (!process.env[varName]) {
      missing.push(varName);
    }
  }

  if (missing.length > 0) {
    throw new Error(`缺少必需的环境变量: ${missing.join(', ')}`);
  }

  return missing;
}
