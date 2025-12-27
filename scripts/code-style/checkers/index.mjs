/**
 * 检查器聚合模块
 * 统一导出所有检查器函数
 */

import { checkDefaultExports } from "./default-export.mjs";
import { checkNamingConventions } from "./naming-convention.mjs";
import { checkHardcodedValues } from "./hardcoded-values.mjs";
import { checkFileLength } from "./file-length.mjs";
import { config } from "../config.mjs";

import fs from "fs/promises";

/**
 * 检查单个文件的所有规则
 */
export async function checkFile(filePath) {
  try {
    const content = await fs.readFile(filePath, "utf8");

    // 增加空值检查
    if (!content || content.trim().length === 0) {
      return {
        file: filePath,
        passed: false,
        error: "文件为空或无法读取",
      };
    }

    const results = [];

    if (config.rules.checkDefaultExports) {
      const result = checkDefaultExports(filePath, content);
      results.push(result);
    }

    if (config.rules.checkNamingConventions) {
      const result = checkNamingConventions(filePath, content);
      results.push(result);
    }

    if (config.rules.checkHardcodedValues) {
      const result = checkHardcodedValues(filePath, content);
      results.push(result);
    }

    if (config.rules.checkFileLength) {
      const result = checkFileLength(filePath, content);
      results.push(result);
    }

    const failed = results.filter((r) => !r.passed);

    return {
      file: filePath,
      passed: failed.length === 0,
      results: results,
    };
  } catch (error) {
    return {
      file: filePath,
      passed: false,
      error: `文件检查失败: ${error.message}`,
    };
  }
}

// 导出所有单独的检查器函数
export {
  checkDefaultExports,
  checkNamingConventions,
  checkHardcodedValues,
  checkFileLength,
};
