/**
 * 配置历史记录模块
 * 用于追踪配置的修改历史
 */

/**
 * 配置历史记录接口
 */
export interface ConfigHistoryRecord {
  id: string;
  configKey: string;
  oldValue: unknown;
  newValue: unknown;
  changedBy: string;
  changedAt: Date;
  changeReason?: string;
}

/**
 * 历史记录存储（生产环境应使用数据库）
 */
let historyRecords: ConfigHistoryRecord[] = [];

/**
 * 添加配置修改历史记录
 */
export function addConfigHistory(
  configKey: string,
  oldValue: unknown,
  newValue: unknown,
  changedBy: string,
  changeReason?: string
): void {
  const record: ConfigHistoryRecord = {
    id: generateId(),
    configKey,
    oldValue,
    newValue,
    changedBy,
    changedAt: new Date(),
    changeReason,
  };

  historyRecords.push(record);

  // 保留最近100条记录
  if (historyRecords.length > 100) {
    historyRecords = historyRecords.slice(-100);
  }
}

/**
 * 获取指定配置的历史记录
 */
export function getConfigHistory(
  configKey: string,
  limit?: number
): ConfigHistoryRecord[] {
  let records = historyRecords.filter(r => r.configKey === configKey);

  // 按时间倒序排列
  records.sort((a, b) => b.changedAt.getTime() - a.changedAt.getTime());

  // 应用限制
  if (limit && limit > 0) {
    records = records.slice(0, limit);
  }

  return records;
}

/**
 * 获取所有历史记录
 */
export function getAllHistory(limit?: number): ConfigHistoryRecord[] {
  let records = [...historyRecords];

  // 按时间倒序排列
  records.sort((a, b) => b.changedAt.getTime() - a.changedAt.getTime());

  // 应用限制
  if (limit && limit > 0) {
    records = records.slice(0, limit);
  }

  return records;
}

/**
 * 清除指定配置的历史记录
 */
export function clearConfigHistory(configKey: string): void {
  historyRecords = historyRecords.filter(r => r.configKey !== configKey);
}

/**
 * 清除所有历史记录
 */
export function clearAllHistory(): void {
  historyRecords = [];
}

/**
 * 获取配置修改统计
 */
export function getConfigModificationStats(configKey: string) {
  const records = getConfigHistory(configKey);

  return {
    totalModifications: records.length,
    lastModifiedAt: records.length > 0 ? records[0].changedAt : null,
    lastModifiedBy: records.length > 0 ? records[0].changedBy : null,
    modificationsInLast24Hours: records.filter(
      r => Date.now() - r.changedAt.getTime() < 24 * 60 * 60 * 1000
    ).length,
    modificationsInLast7Days: records.filter(
      r => Date.now() - r.changedAt.getTime() < 7 * 24 * 60 * 60 * 1000
    ).length,
    modificationsInLast30Days: records.filter(
      r => Date.now() - r.changedAt.getTime() < 30 * 24 * 60 * 60 * 1000
    ).length,
  };
}

/**
 * 生成唯一ID
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * 比较两个值是否相等
 */
export function isValueEqual(value1: unknown, value2: unknown): boolean {
  if (value1 === value2) {
    return true;
  }

  if (
    typeof value1 !== 'object' ||
    typeof value2 !== 'object' ||
    value1 === null ||
    value2 === null
  ) {
    return false;
  }

  if (Array.isArray(value1) && Array.isArray(value2)) {
    if (value1.length !== value2.length) {
      return false;
    }
    return value1.every((item, index) => isValueEqual(item, value2[index]));
  }

  const keys1 = Object.keys(value1 as Record<string, unknown>);
  const keys2 = Object.keys(value2 as Record<string, unknown>);

  if (keys1.length !== keys2.length) {
    return false;
  }

  return keys1.every(key =>
    isValueEqual(
      (value1 as Record<string, unknown>)[key],
      (value2 as Record<string, unknown>)[key]
    )
  );
}

/**
 * 获取值的差异描述
 */
export function getValueDifference(
  oldValue: unknown,
  newValue: unknown
): string {
  if (isValueEqual(oldValue, newValue)) {
    return '值未发生变化';
  }

  if (
    typeof oldValue !== typeof newValue ||
    (typeof oldValue !== 'object' && typeof newValue !== 'object')
  ) {
    return `${JSON.stringify(oldValue)} -> ${JSON.stringify(newValue)}`;
  }

  if (Array.isArray(oldValue) && Array.isArray(newValue)) {
    const oldLen = oldValue.length;
    const newLen = newValue.length;
    if (oldLen !== newLen) {
      return `数组长度从 ${oldLen} 变为 ${newLen}`;
    }
    return '数组内容已更改';
  }

  if (
    typeof oldValue === 'object' &&
    typeof newValue === 'object' &&
    oldValue !== null &&
    newValue !== null &&
    !Array.isArray(oldValue) &&
    !Array.isArray(newValue)
  ) {
    const oldKeys = Object.keys(oldValue);
    const newKeys = Object.keys(newValue);
    return `对象属性从 ${oldKeys.length} 个变为 ${newKeys.length} 个`;
  }

  return '值已更改';
}
