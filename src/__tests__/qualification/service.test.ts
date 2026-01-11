/**
 * 律师资格验证服务单元测试
 */

import {
  verifyLawyerQualification,
  recognizeLicensePhoto,
  buildVerificationData,
  requiresManualReview,
} from "@/lib/qualification/service";

// Mock fetch
global.fetch = jest.fn();

describe("verifyLawyerQualification", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.ENABLE_MOJ_VERIFICATION = "false";
  });

  it("当API未启用时应返回未验证状态", async () => {
    const result = await verifyLawyerQualification("12345678901234567");
    expect(result.success).toBe(true);
    expect(result.verified).toBe(false);
    expect(result.data).toBeUndefined();
  });

  it("当API已启用但配置缺失时应返回未验证状态", async () => {
    process.env.ENABLE_MOJ_VERIFICATION = "true";
    const result = await verifyLawyerQualification("12345678901234567");
    expect(result.success).toBe(true);
    expect(result.verified).toBe(false);
  });

  it("当API配置完整时应调用API", async () => {
    process.env.ENABLE_MOJ_VERIFICATION = "true";
    process.env.MOJ_VERIFICATION_API_URL = "https://api.test.com";
    process.env.MOJ_VERIFICATION_API_KEY = "test-key";

    const mockFetch = jest.mocked(fetch);
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          status: "NORMAL",
          lawFirm: "测试律所",
          issueDate: "2020-01-01",
          verifiedAt: "2024-01-01",
        },
      }),
    } as Response);

    await verifyLawyerQualification("12345678901234567");
    expect(mockFetch).toHaveBeenCalled();
  });

  it("当API返回正常状态时应验证通过", async () => {
    process.env.ENABLE_MOJ_VERIFICATION = "true";
    process.env.MOJ_VERIFICATION_API_URL = "https://api.test.com";
    process.env.MOJ_VERIFICATION_API_KEY = "test-key";

    const mockFetch = jest.mocked(fetch);
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          status: "NORMAL",
          lawFirm: "测试律所",
          issueDate: "2020-01-01",
          verifiedAt: "2024-01-01",
        },
      }),
    } as Response);

    const result = await verifyLawyerQualification("12345678901234567");
    expect(result.success).toBe(true);
    expect(result.verified).toBe(true);
    expect(result.data).toBeDefined();
  });

  it("当API返回非正常状态时应验证失败", async () => {
    process.env.ENABLE_MOJ_VERIFICATION = "true";
    process.env.MOJ_VERIFICATION_API_URL = "https://api.test.com";
    process.env.MOJ_VERIFICATION_API_KEY = "test-key";

    const mockFetch = jest.mocked(fetch);
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          status: "SUSPENDED",
          lawFirm: "测试律所",
        },
      }),
    } as Response);

    const result = await verifyLawyerQualification("12345678901234567");
    expect(result.success).toBe(true);
    expect(result.verified).toBe(false);
  });

  it("当API调用失败时应捕获错误", async () => {
    process.env.ENABLE_MOJ_VERIFICATION = "true";
    process.env.MOJ_VERIFICATION_API_URL = "https://api.test.com";
    process.env.MOJ_VERIFICATION_API_KEY = "test-key";

    const mockFetch = jest.mocked(fetch);
    mockFetch.mockRejectedValue(new Error("网络错误"));

    const result = await verifyLawyerQualification("12345678901234567");
    expect(result.success).toBe(true);
    expect(result.verified).toBe(false);
    expect(result.error).toBe("网络错误");
  });
});

describe("recognizeLicensePhoto", () => {
  it("应该返回暂未实现的错误", async () => {
    const result = await recognizeLicensePhoto();
    expect(result.success).toBe(false);
    expect(result.error).toBe("OCR功能暂未实现，请手动输入执业证信息");
  });
});

describe("buildVerificationData", () => {
  it("应该构建验证通过的记录", () => {
    const verificationResult = {
      success: true,
      verified: true,
      data: {
        status: "NORMAL",
        lawFirm: "测试律所",
        issueDate: "2020-01-01",
        verifiedAt: "2024-01-01",
      },
    };

    buildVerificationData(verificationResult);
    const data = buildVerificationData(verificationResult);
    expect(data.verified).toBe(true);
    expect(data.source).toBe("MOJ_API");
    expect(data.data).toBeDefined();
    expect(data.verifiedAt).toBeDefined();
  });

  it("应该构建验证失败的记录", () => {
    const verificationResult = {
      success: true,
      verified: false,
      error: "未找到该执业证号",
    };

    const data = buildVerificationData(verificationResult);
    expect(data.verified).toBe(false);
    expect(data.source).toBe("MANUAL");
    expect(data.error).toBe("未找到该执业证号");
  });
});

describe("requiresManualReview", () => {
  it("验证成功且通过时不应需要人工审核", () => {
    const verificationResult = {
      success: true,
      verified: true,
      data: {
        status: "NORMAL",
        lawFirm: "测试律所",
        issueDate: "2020-01-01",
        verifiedAt: "2024-01-01",
      },
    };

    const result = requiresManualReview(verificationResult);
    expect(result).toBe(false);
  });

  it("验证失败时应需要人工审核", () => {
    const verificationResult = {
      success: true,
      verified: false,
    };

    const result = requiresManualReview(verificationResult);
    expect(result).toBe(true);
  });

  it("验证API调用失败时应需要人工审核", () => {
    const verificationResult = {
      success: false,
      verified: false,
      error: "网络错误",
    };

    const result = requiresManualReview(verificationResult);
    expect(result).toBe(true);
  });
});
