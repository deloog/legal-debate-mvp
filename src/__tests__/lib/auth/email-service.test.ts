/**
 * 邮件服务测试
 */

import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { getEmailService, DevEmailService } from "@/lib/auth/email-service";

// Mock console.log 和 console.warn
const mockConsoleLog = jest.fn();
const mockConsoleWarn = jest.fn();

describe("邮件服务", () => {
  let envSpy: jest.SpiedGetter<string | undefined>;

  beforeEach(() => {
    jest.clearAllMocks();
    global.console.log = mockConsoleLog;
    global.console.warn = mockConsoleWarn;
    envSpy = jest.spyOn(process.env, "NODE_ENV", "get");
  });

  afterEach(() => {
    envSpy.mockRestore();
  });

  describe("DevEmailService", () => {
    let service: DevEmailService;

    beforeEach(() => {
      service = new DevEmailService();
    });

    describe("sendPasswordResetEmail", () => {
      it("应该在开发环境中发送密码重置邮件", async () => {
        envSpy.mockReturnValue("development");

        const result = await service.sendPasswordResetEmail(
          "test@example.com",
          "123456",
          new Date(Date.now() + 15 * 60 * 1000),
        );

        expect(result.success).toBe(true);
        expect(result.messageId).toBeDefined();
        expect(result.messageId).toMatch(/^dev-/);
        expect(result.devMessage).toContain("test@example.com");
        expect(result.devMessage).toContain("123456");
        expect(mockConsoleLog).toHaveBeenCalled();
      });

      it("应该输出格式正确的邮件内容", async () => {
        envSpy.mockReturnValue("development");

        await service.sendPasswordResetEmail(
          "test@example.com",
          "123456",
          new Date(Date.now() + 15 * 60 * 1000),
        );

        const logCalls = mockConsoleLog.mock.calls.flat();
        const logContent = logCalls.join(" ");

        expect(logContent).toContain("密码重置");
        expect(logContent).toContain("test@example.com");
        expect(logContent).toContain("123456");
      });

      it("应该在非开发环境返回错误", async () => {
        envSpy.mockReturnValue("production");

        const result = await service.sendPasswordResetEmail(
          "test@example.com",
          "123456",
          new Date(Date.now() + 15 * 60 * 1000),
        );

        expect(result.success).toBe(false);
        expect(result.error).toBe("非开发环境，请使用生产邮件服务");
      });
    });

    describe("sendVerificationEmail", () => {
      it("应该在开发环境中发送验证邮件", async () => {
        envSpy.mockReturnValue("development");

        const result = await service.sendVerificationEmail(
          "test@example.com",
          "654321",
          new Date(Date.now() + 15 * 60 * 1000),
        );

        expect(result.success).toBe(true);
        expect(result.messageId).toBeDefined();
        expect(result.devMessage).toContain("test@example.com");
        expect(result.devMessage).toContain("654321");
        expect(mockConsoleLog).toHaveBeenCalled();
      });

      it("应该输出格式正确的验证邮件内容", async () => {
        envSpy.mockReturnValue("development");

        await service.sendVerificationEmail(
          "test@example.com",
          "654321",
          new Date(Date.now() + 15 * 60 * 1000),
        );

        const logCalls = mockConsoleLog.mock.calls.flat();
        const logContent = logCalls.join(" ");

        expect(logContent).toContain("邮箱验证");
        expect(logContent).toContain("test@example.com");
        expect(logContent).toContain("654321");
      });

      it("应该在非开发环境返回错误", async () => {
        envSpy.mockReturnValue("production");

        const result = await service.sendVerificationEmail(
          "test@example.com",
          "654321",
          new Date(Date.now() + 15 * 60 * 1000),
        );

        expect(result.success).toBe(false);
        expect(result.error).toBe("非开发环境，请使用生产邮件服务");
      });
    });
  });

  describe("getEmailService", () => {
    it("应该在开发环境返回 DevEmailService", () => {
      envSpy.mockReturnValue("development");

      const service = getEmailService();

      expect(service).toBeInstanceOf(DevEmailService);
    });

    it("应该在测试环境返回 DevEmailService", () => {
      envSpy.mockReturnValue("test");

      const service = getEmailService();

      expect(service).toBeInstanceOf(DevEmailService);
    });

    it("应该在生产环境返回 ProdEmailService", () => {
      envSpy.mockReturnValue("production");

      const service = getEmailService();

      // ProdEmailService 应该是一个单独的类
      expect(service).toBeDefined();
      expect(service).not.toBeInstanceOf(DevEmailService);
    });
  });
});
