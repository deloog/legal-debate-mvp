/**
 * 格式转换操作模块（Format Operations）
 * 包含：格式转换功能
 */

import type { FormatTransformResult } from "./types";

/**
 * transform_format - 格式转换（别名函数）
 * 在不同格式之间转换数据
 */
export async function transform_format(
  sourceFormat: string,
  targetFormat: string,
  data: unknown,
): Promise<FormatTransformResult> {
  return format_transform({
    sourceFormat,
    targetFormat,
    data,
  });
}

/**
 * format_transform - 格式转换
 * 在不同格式之间转换数据
 */
export async function format_transform(params: {
  sourceFormat: string;
  targetFormat: string;
  data: unknown;
}): Promise<FormatTransformResult> {
  const { sourceFormat, targetFormat, data } = params;
  const warnings: string[] = [];
  let transformed: unknown = data;

  const supportedFormats = ["json", "text", "object"];
  if (
    !supportedFormats.includes(sourceFormat) ||
    !supportedFormats.includes(targetFormat)
  ) {
    return {
      success: false,
      data,
      warnings: [
        `Unsupported format conversion: ${sourceFormat} -> ${targetFormat}`,
      ],
    };
  }

  if (sourceFormat === "json" && targetFormat === "text") {
    transformed = JSON.stringify(data, null, 2);
  } else if (sourceFormat === "text" && targetFormat === "json") {
    try {
      transformed = JSON.parse(data as string);
    } catch {
      transformed = { content: data };
    }
  } else if (sourceFormat === "object" && targetFormat === "json") {
    transformed = JSON.stringify(data);
  } else {
    warnings.push("No transformation needed");
  }

  return {
    success: true,
    data: transformed,
    warnings,
  };
}
