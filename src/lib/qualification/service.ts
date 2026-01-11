/**
 * 律师资格验证服务
 * 提供资格验证、第三方核验接口
 */

import type { ThirdPartyVerificationResult } from "@/types/qualification";

/**
 * 第三方验证服务配置
 * 司法部中国律师身份核验平台配置
 */
interface VerificationConfig {
  apiUrl: string;
  apiKey: string;
  enabled: boolean;
}

/**
 * 获取第三方验证配置
 * @returns 验证配置
 */
function getVerificationConfig(): VerificationConfig {
  return {
    apiUrl: process.env.MOJ_VERIFICATION_API_URL || "",
    apiKey: process.env.MOJ_VERIFICATION_API_KEY || "",
    enabled: process.env.ENABLE_MOJ_VERIFICATION === "true",
  };
}

/**
 * 调用司法部律师身份核验平台API
 * 注意：此功能需要申请司法部API访问权限
 * @param licenseNumber 执业证号
 * @returns 验证结果
 */
async function callMoJVerificationApi(
  licenseNumber: string,
): Promise<ThirdPartyVerificationResult> {
  const config = getVerificationConfig();

  if (!config.enabled || !config.apiUrl || !config.apiKey) {
    return {
      success: true,
      verified: false,
      data: undefined,
    };
  }

  try {
    const response = await fetch(config.apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        licenseNumber,
        verifyType: "LAWYER_STATUS",
      }),
    });

    if (!response.ok) {
      throw new Error(`API请求失败: ${response.status}`);
    }

    const data = (await response.json()) as {
      success: boolean;
      data?: unknown;
    };

    if (data.success && data.data) {
      const verifiedData = data.data as {
        status: string;
        lawFirm: string;
        issueDate: string;
        verifiedAt: string;
      };

      return {
        success: true,
        verified: verifiedData.status === "NORMAL",
        data: verifiedData,
      };
    }

    return {
      success: true,
      verified: false,
    };
  } catch (error) {
    console.error("司法部API调用失败:", error);
    return {
      success: true,
      verified: false,
      error: error instanceof Error ? error.message : "未知错误",
    };
  }
}

/**
 * 执行第三方律师资格验证
 * 使用混合验证模式：优先调用司法部API，失败则返回未验证状态
 * @param licenseNumber 执业证号
 * @returns 验证结果
 */
export async function verifyLawyerQualification(
  licenseNumber: string,
): Promise<ThirdPartyVerificationResult> {
  return callMoJVerificationApi(licenseNumber);
}

/**
 * OCR识别执业证照片
 * 注意：此功能需要集成OCR服务（如百度OCR、腾讯OCR等）
 * @returns 识别结果
 */
export async function recognizeLicensePhoto(): Promise<{
  success: boolean;
  data?: Record<string, unknown>;
  error?: string;
}> {
  // 预留OCR接口
  // 前期不实现，要求用户手动输入关键信息
  return {
    success: false,
    error: "OCR功能暂未实现，请手动输入执业证信息",
  };
}

/**
 * 构建验证数据记录
 * @param verificationResult 第三方验证结果
 * @returns 验证数据
 */
export function buildVerificationData(
  verificationResult: ThirdPartyVerificationResult,
): Record<string, unknown> {
  return {
    verified: verificationResult.verified,
    verifiedAt: new Date().toISOString(),
    source: verificationResult.data ? "MOJ_API" : "MANUAL",
    data: verificationResult.data,
    error: verificationResult.error,
  };
}

/**
 * 检查资格验证是否需要人工审核
 * @param verificationResult 验证结果
 * @returns 是否需要人工审核
 */
export function requiresManualReview(
  verificationResult: ThirdPartyVerificationResult,
): boolean {
  if (!verificationResult.success) {
    return true;
  }

  if (!verificationResult.verified) {
    return true;
  }

  return false;
}
