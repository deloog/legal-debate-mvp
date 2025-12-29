import { PrismaClient, UserRole, UserStatus } from "@prisma/client";
import { beforeEach, describe, expect, it, afterEach } from "@jest/globals";

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
});

describe("User CRUD Operations", () => {
  let testUserId: string;

  beforeEach(async () => {
    // 清理测试数据
    await prisma.user.deleteMany({
      where: {
        email: {
          contains: "test-",
        },
      },
    });
  });

  afterEach(async () => {
    // 清理测试数据
    if (testUserId) {
      await prisma.user.delete({
        where: {
          id: testUserId,
        },
      });
      testUserId = "";
    }
  });

  describe("Basic User Creation", () => {
    it("should create a user with basic fields", async () => {
      const userData = {
        email: "test-basic@example.com",
        username: "testuser",
        name: "Test User",
        role: UserRole.USER,
      };

      const user = await prisma.user.create({
        data: userData,
      });

      testUserId = user.id;

      expect(user.id).toBeDefined();
      expect(user.email).toBe(userData.email);
      expect(user.username).toBe(userData.username);
      expect(user.name).toBe(userData.name);
      expect(user.role).toBe(userData.role);
      expect(user.status).toBe("ACTIVE");
      expect(user.loginCount).toBe(0);
      expect(user.createdAt).toBeDefined();
      expect(user.updatedAt).toBeDefined();
    });

    it("should create a user with profile information", async () => {
      const userData = {
        email: "test-profile@example.com",
        username: "testprofile",
        name: "Profile Test User",
        role: UserRole.LAWYER,
        avatar: "https://example.com/avatar.jpg",
        phone: "+1234567890",
        address: "123 Test Street, Test City",
        bio: "Test user bio",
      };

      const user = await prisma.user.create({
        data: userData,
      });

      testUserId = user.id;

      expect(user.avatar).toBe(userData.avatar);
      expect(user.phone).toBe(userData.phone);
      expect(user.address).toBe(userData.address);
      expect(user.bio).toBe(userData.bio);
      expect(user.role).toBe(userData.role);
    });

    it("should create a user with preferences", async () => {
      const preferences = {
        language: "zh-CN",
        timezone: "Asia/Shanghai",
        notifications: {
          email: true,
          sms: false,
        },
      };

      const userData = {
        email: "test-prefs@example.com",
        username: "testprefs",
        name: "Preferences Test User",
        role: UserRole.USER,
        preferences: preferences as any,
      };

      const user = await prisma.user.create({
        data: userData,
      });

      testUserId = user.id;

      expect(user.preferences).toEqual(expect.objectContaining(preferences));
    });
  });

  describe("User Status Management", () => {
    it("should create user with specific status", async () => {
      const userData = {
        email: "test-suspended@example.com",
        username: "testsuspended",
        name: "Suspended User",
        role: UserRole.USER,
        status: UserStatus.SUSPENDED,
      };

      const user = await prisma.user.create({
        data: userData,
      });

      testUserId = user.id;

      expect(user.status).toBe("SUSPENDED");
    });

    it("should update user status", async () => {
      const user = await prisma.user.create({
        data: {
          email: "test-status@example.com",
          username: "teststatus",
          name: "Status Test User",
          role: UserRole.USER,
        },
      });

      testUserId = user.id;

      const updatedUser = await prisma.user.update({
        where: { id: user.id },
        data: { status: UserStatus.BANNED },
      });

      expect(updatedUser.status).toBe("BANNED");
    });
  });

  describe("User Authentication Fields", () => {
    it("should set email verification timestamp", async () => {
      const verificationTime = new Date();

      const userData = {
        email: "test-verified@example.com",
        username: "testverified",
        name: "Verified User",
        role: UserRole.USER,
        emailVerified: verificationTime,
      };

      const user = await prisma.user.create({
        data: userData,
      });

      testUserId = user.id;

      expect(user.emailVerified).toEqual(verificationTime);
    });

    it("should handle password reset fields", async () => {
      const resetToken = "reset-token-123";
      const resetExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24小时后过期

      const userData = {
        email: "test-reset@example.com",
        username: "testreset",
        name: "Reset Test User",
        role: UserRole.USER,
        passwordResetToken: resetToken,
        passwordResetExpires: resetExpires,
      };

      const user = await prisma.user.create({
        data: userData,
      });

      testUserId = user.id;

      expect(user.passwordResetToken).toBe(resetToken);
      expect(user.passwordResetExpires).toEqual(resetExpires);
    });
  });

  describe("User Query Operations", () => {
    beforeEach(async () => {
      // 清理所有测试相关的用户数据
      await prisma.user.deleteMany({
        where: {
          OR: [
            { email: { contains: "user" } },
            { email: { contains: "test-" } },
          ],
        },
      });

      // 创建测试用户数据
      await prisma.user.createMany({
        data: [
          {
            email: "user1@example.com",
            username: "user1",
            name: "User One",
            role: UserRole.USER,
            status: UserStatus.ACTIVE,
          },
          {
            email: "user2@example.com",
            username: "user2",
            name: "User Two",
            role: UserRole.LAWYER,
            status: UserStatus.SUSPENDED,
          },
          {
            email: "user3@example.com",
            username: "user3",
            name: "User Three",
            role: UserRole.ADMIN,
            status: UserStatus.ACTIVE,
          },
        ],
      });
    });

    afterEach(async () => {
      await prisma.user.deleteMany({
        where: {
          email: {
            in: ["user1@example.com", "user2@example.com", "user3@example.com"],
          },
        },
      });
    });

    it("should filter users by status", async () => {
      const activeUsers = await prisma.user.findMany({
        where: { status: UserStatus.ACTIVE },
      });

      expect(activeUsers.length).toBeGreaterThan(0);
      expect(activeUsers.every((user) => user.status === "ACTIVE")).toBe(true);
    });

    it("should filter users by role", async () => {
      const lawyers = await prisma.user.findMany({
        where: {
          AND: [
            { role: UserRole.LAWYER },
            { email: { contains: "user" } }, // 只查找测试用户
          ],
        },
      });

      expect(lawyers).toHaveLength(1);
      expect(lawyers[0].role).toBe(UserRole.LAWYER);
    });

    it("should find user by username", async () => {
      const user = await prisma.user.findFirst({
        where: { username: "user1" },
      });

      expect(user).toBeDefined();
      expect(user?.username).toBe("user1");
    });
  });

  describe("Login Statistics", () => {
    it("should track login count", async () => {
      const user = await prisma.user.create({
        data: {
          email: "test-login@example.com",
          username: "testlogin",
          name: "Login Test User",
          role: UserRole.USER,
        },
      });

      testUserId = user.id;

      expect(user.loginCount).toBe(0);

      // 模拟登录
      const updatedUser = await prisma.user.update({
        where: { id: user.id },
        data: {
          loginCount: { increment: 1 },
          lastLoginAt: new Date(),
        },
      });

      expect(updatedUser.loginCount).toBe(1);
      expect(updatedUser.lastLoginAt).toBeDefined();
    });
  });

  describe("Permissions Handling", () => {
    it("should store permissions as JSON", async () => {
      const permissions = {
        cases: ["read", "create"],
        debates: ["read", "create", "update"],
        admin: [],
      };

      const user = await prisma.user.create({
        data: {
          email: "test-permissions@example.com",
          username: "testperms",
          name: "Permissions Test User",
          role: UserRole.USER,
          permissions: permissions as any,
        },
      });

      testUserId = user.id;

      expect(user.permissions).toEqual(expect.objectContaining(permissions));
    });
  });
});
