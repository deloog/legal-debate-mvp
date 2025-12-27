/**
 * 命名约定检查器
 * 检查变量和函数的命名规范
 */

import { MAX_ISSUES_TO_SHOW } from "../config.mjs";

/**
 * 检查命名约定
 */
export function checkNamingConventions(filePath, content) {
  const issues = [];

  // 检查匿名函数
  const anonymousFunctionRegex =
    /export\s+(const|let|var)\s+\w+\s*=\s*(function|async\s+function)\s*\(/g;
  const anonymousMatches = content.match(anonymousFunctionRegex);

  if (anonymousMatches) {
    issues.push("发现匿名函数导出，建议使用命名函数");
  }

  // 检查snake_case变量名（应该使用camelCase）
  const camelCaseRegex = /(?:const|let|var)\s+([a-z][a-zA-Z0-9]*)\s*=/g;
  const snakeCaseVars = [];
  let match;
  while ((match = camelCaseRegex.exec(content)) !== null) {
    if (match[1].includes("_") && match[1] !== match[1].toUpperCase()) {
      snakeCaseVars.push(match[1]);
    }
  }

  if (snakeCaseVars.length > 0) {
    issues.push(
      `发现snake_case变量名，建议使用camelCase: ${snakeCaseVars.slice(0, MAX_ISSUES_TO_SHOW).join(", ")}`,
    );
  }

  // 检查PascalCase变量名（应该用于类/组件，普通变量应该用camelCase）
  const pascalCaseVarRegex = /(?:const|let|var)\s+([A-Z][a-zA-Z0-9]*)\s*=/g;
  const pascalCaseVars = [];
  while ((match = pascalCaseVarRegex.exec(content)) !== null) {
    // 排除React组件（通常以大写字母开头）
    if (!filePath.includes(".tsx") && !filePath.includes(".jsx")) {
      pascalCaseVars.push(match[1]);
    }
  }

  if (pascalCaseVars.length > 0) {
    issues.push(
      `发现PascalCase变量名，建议用于类/组件: ${pascalCaseVars.slice(0, MAX_ISSUES_TO_SHOW).join(", ")}`,
    );
  }

  return {
    passed: issues.length === 0,
    message: issues.length === 0 ? "命名约定检查通过" : issues.join("; "),
  };
}
