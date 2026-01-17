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
export function getNumberEnv(
  key: string,
  defaultValue = 0,
  options?: { min?: number; max?: number }
): number {
  const value = process.env[key];
  if (value === undefined) {
    return defaultValue;
  }
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) {
    console.warn(`环境变量 ${key} 不是有效数字: ${value}`);
    return defaultValue;
  }
  // 验证范围
  if (options?.min !== undefined && parsed < options.min) {
    console.warn(`环境变量 ${key} 值小于最小值: ${parsed} < ${options.min}`);
    return options.min;
  }
  if (options?.max !== undefined && parsed > options.max) {
    console.warn(`环境变量 ${key} 值大于最大值: ${parsed} > ${options.max}`);
    return options.max;
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
    console.warn(`环境变量 ${key} 不是有效的JSON: ${value}`);
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
