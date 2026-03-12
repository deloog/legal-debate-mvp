/**
 * 律师资格验证服务
 * 提供资格验证、第三方核验接口
 */

import { logger } from '@/lib/logger';
import type { ThirdPartyVerificationResult } from '@/types/qualification';

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
    apiUrl: process.env.MOJ_VERIFICATION_API_URL || '',
    apiKey: process.env.MOJ_VERIFICATION_API_KEY || '',
    enabled: process.env.ENABLE_MOJ_VERIFICATION === 'true',
  };
}

/**
 * 调用司法部律师身份核验平台API
 * 注意：此功能需要申请司法部API访问权限
 * @param licenseNumber 执业证号
 * @returns 验证结果
 */
async function callMoJVerificationApi(
  licenseNumber: string
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
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        licenseNumber,
        verifyType: 'LAWYER_STATUS',
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
        verified: verifiedData.status === 'NORMAL',
        data: verifiedData,
      };
    }

    return {
      success: true,
      verified: false,
    };
  } catch (error) {
    logger.error('司法部API调用失败:', error);
    return {
      success: true,
      verified: false,
      error: error instanceof Error ? error.message : '未知错误',
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
  licenseNumber: string
): Promise<ThirdPartyVerificationResult> {
  return callMoJVerificationApi(licenseNumber);
}

/** OCR 识别结果 */
export interface LicenseOcrResult {
  /** 执业证号 */
  licenseNumber?: string;
  /** 姓名 */
  name?: string;
  /** 执业机构（律师事务所） */
  lawFirm?: string;
  /** 执业证类型 */
  licenseType?: string;
  /** 发证机关 */
  issuingAuthority?: string;
  /** 有效期 */
  validUntil?: string;
}

/** 图片输入：base64 或 URL 二选一 */
export type LicensePhotoInput =
  | { base64: string; mimeType: 'image/jpeg' | 'image/png' | 'image/webp' }
  | { url: string };

/**
 * 使用 AI 视觉模型 OCR 识别律师执业证照片
 *
 * 调用 ZhipuAI GLM-4V（视觉模型）分析图片，提取执业证关键信息。
 * 若未配置 AI 服务，引导用户手动输入。
 *
 * @param photo 图片输入（base64 或公开 URL）
 * @returns 识别结果
 */
export async function recognizeLicensePhoto(
  photo?: LicensePhotoInput
): Promise<{
  success: boolean;
  data?: LicenseOcrResult;
  error?: string;
}> {
  if (!photo) {
    return {
      success: false,
      error: '请提供执业证照片（支持 base64 或图片URL）',
    };
  }

  const apiKey = process.env.ZHIPU_API_KEY;
  const baseUrl =
    process.env.ZHIPU_BASE_URL || 'https://open.bigmodel.cn/api/paas/v4';

  if (!apiKey) {
    logger.warn('ZHIPU_API_KEY 未配置，OCR 功能不可用');
    return {
      success: false,
      error: 'AI 服务未配置，请手动输入执业证信息',
    };
  }

  // 构造 GLM-4V 视觉模型的图片 content 块
  const imageContent =
    'base64' in photo
      ? {
          type: 'image_url' as const,
          image_url: {
            url: `data:${photo.mimeType};base64,${photo.base64}`,
          },
        }
      : {
          type: 'image_url' as const,
          image_url: { url: photo.url },
        };

  const prompt = `请识别这张律师执业证照片，提取以下字段并以 JSON 格式返回（字段不存在则省略）：
{
  "licenseNumber": "执业证号",
  "name": "姓名",
  "lawFirm": "执业机构名称",
  "licenseType": "执业证类型",
  "issuingAuthority": "发证机关",
  "validUntil": "有效期（格式 YYYY-MM-DD）"
}
只返回 JSON，不要其他文字。`;

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'glm-4v',
        messages: [
          {
            role: 'user',
            content: [
              imageContent,
              { type: 'text', text: prompt },
            ],
          },
        ],
        max_tokens: 512,
        temperature: 0,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      logger.error('GLM-4V OCR 请求失败', { status: response.status, errText });
      return { success: false, error: `AI 服务请求失败 (${response.status})` };
    }

    const json = (await response.json()) as {
      choices?: Array<{
        message?: { content?: string };
      }>;
    };

    const content = json.choices?.[0]?.message?.content ?? '';

    // 提取 JSON（模型有时会包裹在 markdown 代码块中）
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      logger.warn('GLM-4V OCR 响应未包含 JSON', { content });
      return {
        success: false,
        error: '无法从照片中识别执业证信息，请手动输入',
      };
    }

    const ocrData = JSON.parse(jsonMatch[0]) as LicenseOcrResult;

    logger.info('执业证 OCR 识别成功', {
      hasLicenseNumber: !!ocrData.licenseNumber,
      hasName: !!ocrData.name,
    });

    return { success: true, data: ocrData };
  } catch (error) {
    logger.error('执业证 OCR 识别失败', error instanceof Error ? error : undefined);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'OCR 识别失败，请手动输入',
    };
  }
}

/**
 * 构建验证数据记录
 * @param verificationResult 第三方验证结果
 * @returns 验证数据
 */
export function buildVerificationData(
  verificationResult: ThirdPartyVerificationResult
): Record<string, unknown> {
  return {
    verified: verificationResult.verified,
    verifiedAt: new Date().toISOString(),
    source: verificationResult.data ? 'MOJ_API' : 'MANUAL',
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
  verificationResult: ThirdPartyVerificationResult
): boolean {
  if (!verificationResult.success) {
    return true;
  }

  if (!verificationResult.verified) {
    return true;
  }

  return false;
}
