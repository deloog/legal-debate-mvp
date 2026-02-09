/**
 * 知识图谱通知功能测试
 * 测试待审核关系达到阈值时发送通知的功能
 * @jest-environment node
 */

import { prisma } from '@/lib/db';
import {
  checkPendingRelationsThreshold,
  sendPendingRelationsNotification,
  NotificationThresholdConfig,
} from '@/lib/knowledge-graph/notification-service';
import {
  RelationType,
  DiscoveryMethod,
  VerificationStatus,
  LawType,
  LawCategory,
  LawStatus,
  UserRole,
  NotificationType,
  NotificationPriority,
} from '@prisma/client';
import type { LawArticle, User } from '@prisma/client';

describe('知识图谱通知功能测试', () => {
  const testArticles: LawArticle[] = [];
  let adminUser: User;

  beforeAll(async () => {
    // 创建管理员用户
    adminUser = await prisma.user.create({
      data: {
        email: 'admin-notification-test@test.com',
        role: UserRole.ADMIN,
        password: 'hashed-password',
      },
    });

    // 创建测试法条
    for (let i = 1; i <= 5; i++) {
      const article = await prisma.lawArticle.create({
        data: {
          lawName: `通知测试法${i}`,
          articleNumber: `${i}`,
          fullText: `这是通知测试法条${i}的内容`,
          lawType: LawType.LAW,
          category: LawCategory.CIVIL,
          tags: [],
          keywords: [],
          effectiveDate: new Date('2020-01-01'),
          status: LawStatus.VALID,
          issuingAuthority: '全国人大',
          relatedArticles: [],
          searchableText: `这是通知测试法条${i}的内容`,
        },
      });
      testArticles.push(article);
    }
  });

  afterAll(async () => {
    // 清理测试数据
    await prisma.notification.deleteMany({
      where: {
        userId: adminUser.id,
      },
    });

    await prisma.lawArticleRelation.deleteMany({
      where: {
        OR: [
          { sourceId: { in: testArticles.map(a => a.id) } },
          { targetId: { in: testArticles.map(a => a.id) } },
        ],
      },
    });

    await prisma.lawArticle.deleteMany({
      where: {
        id: { in: testArticles.map(a => a.id) },
      },
    });

    await prisma.user.deleteMany({
      where: {
        id: adminUser.id,
      },
    });
  });

  beforeEach(async () => {
    // 清理之前的关系和通知
    await prisma.notification.deleteMany({
      where: {
        userId: adminUser.id,
      },
    });

    await prisma.lawArticleRelation.deleteMany({
      where: {
        OR: [
          { sourceId: { in: testArticles.map(a => a.id) } },
          { targetId: { in: testArticles.map(a => a.id) } },
        ],
      },
    });
  });

  describe('checkPendingRelationsThreshold', () => {
    it('应该检测到待审核关系超过阈值', async () => {
      // 创建10个待审核关系
      await Promise.all(
        Array.from({ length: 10 }, (_, i) =>
          prisma.lawArticleRelation.create({
            data: {
              sourceId: testArticles[i % testArticles.length].id,
              targetId: testArticles[(i + 1) % testArticles.length].id,
              relationType: RelationType.RELATED,
              strength: 0.7,
              confidence: 0.75,
              discoveryMethod: DiscoveryMethod.AI_DETECTED,
              verificationStatus: VerificationStatus.PENDING,
            },
          })
        )
      );

      const config: NotificationThresholdConfig = {
        threshold: 5,
        checkIntervalMinutes: 60,
      };

      const result = await checkPendingRelationsThreshold(config);

      expect(result.shouldNotify).toBe(true);
      expect(result.pendingCount).toBe(10);
      expect(result.threshold).toBe(5);
    });

    it('应该检测到待审核关系未超过阈值', async () => {
      // 创建3个待审核关系
      await Promise.all(
        Array.from({ length: 3 }, (_, i) =>
          prisma.lawArticleRelation.create({
            data: {
              sourceId: testArticles[i].id,
              targetId: testArticles[(i + 1) % testArticles.length].id,
              relationType: RelationType.RELATED,
              strength: 0.7,
              confidence: 0.75,
              discoveryMethod: DiscoveryMethod.AI_DETECTED,
              verificationStatus: VerificationStatus.PENDING,
            },
          })
        )
      );

      const config: NotificationThresholdConfig = {
        threshold: 5,
        checkIntervalMinutes: 60,
      };

      const result = await checkPendingRelationsThreshold(config);

      expect(result.shouldNotify).toBe(false);
      expect(result.pendingCount).toBe(3);
    });

    it('应该正确处理没有待审核关系的情况', async () => {
      const config: NotificationThresholdConfig = {
        threshold: 5,
        checkIntervalMinutes: 60,
      };

      const result = await checkPendingRelationsThreshold(config);

      expect(result.shouldNotify).toBe(false);
      expect(result.pendingCount).toBe(0);
    });
  });

  describe('sendPendingRelationsNotification', () => {
    it('应该成功发送待审核通知给管理员', async () => {
      // 创建10个待审核关系
      await Promise.all(
        Array.from({ length: 10 }, (_, i) =>
          prisma.lawArticleRelation.create({
            data: {
              sourceId: testArticles[i % testArticles.length].id,
              targetId: testArticles[(i + 1) % testArticles.length].id,
              relationType: RelationType.RELATED,
              strength: 0.7,
              confidence: 0.75,
              discoveryMethod: DiscoveryMethod.AI_DETECTED,
              verificationStatus: VerificationStatus.PENDING,
            },
          })
        )
      );

      await sendPendingRelationsNotification(adminUser.id, 10, 5);

      // 验证通知是否被创建
      const notifications = await prisma.notification.findMany({
        where: {
          userId: adminUser.id,
          type: NotificationType.ALERT,
        },
      });

      expect(notifications.length).toBeGreaterThan(0);
      const notification = notifications[0];
      expect(notification.title).toContain('待审核');
      expect(notification.content).toContain('10');
      expect(notification.priority).toBe(NotificationPriority.HIGH);
      expect(notification.link).toContain('/admin/knowledge-graph');
    });

    it('应该在通知内容中包含正确的数量信息', async () => {
      await sendPendingRelationsNotification(adminUser.id, 25, 10);

      const notifications = await prisma.notification.findMany({
        where: {
          userId: adminUser.id,
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 1,
      });

      expect(notifications).toHaveLength(1);
      expect(notifications[0].content).toContain('25');
      expect(notifications[0].content).toContain('10');
    });

    it('应该设置通知的过期时间', async () => {
      await sendPendingRelationsNotification(adminUser.id, 10, 5);

      const notifications = await prisma.notification.findMany({
        where: {
          userId: adminUser.id,
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 1,
      });

      expect(notifications).toHaveLength(1);
      expect(notifications[0].expiresAt).toBeDefined();
      expect(notifications[0].expiresAt).not.toBeNull();

      // 验证过期时间在未来
      const now = new Date();
      expect(notifications[0].expiresAt!.getTime()).toBeGreaterThan(
        now.getTime()
      );
    });

    it('应该在元数据中包含详细信息', async () => {
      await sendPendingRelationsNotification(adminUser.id, 15, 10);

      const notifications = await prisma.notification.findMany({
        where: {
          userId: adminUser.id,
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 1,
      });

      expect(notifications).toHaveLength(1);
      const metadata = notifications[0].metadata as Record<string, unknown>;
      expect(metadata.pendingCount).toBe(15);
      expect(metadata.threshold).toBe(10);
      expect(metadata.source).toBe('knowledge_graph');
    });
  });

  describe('通知去重', () => {
    it('应该避免在短时间内重复发送相同通知', async () => {
      // 第一次发送通知
      await sendPendingRelationsNotification(adminUser.id, 10, 5);

      // 立即再次发送
      await sendPendingRelationsNotification(adminUser.id, 10, 5);

      // 验证只有一个未读通知
      const unreadNotifications = await prisma.notification.findMany({
        where: {
          userId: adminUser.id,
          status: 'UNREAD',
          type: NotificationType.ALERT,
        },
      });

      // 应该只有一个通知（第二次发送应该被去重）
      expect(unreadNotifications.length).toBe(1);
    });
  });

  describe('批量通知管理员', () => {
    it('应该向所有管理员发送通知', async () => {
      // 创建另一个管理员
      const admin2 = await prisma.user.create({
        data: {
          email: 'admin2-notification-test@test.com',
          role: UserRole.ADMIN,
          password: 'hashed-password',
        },
      });

      try {
        // 创建待审核关系
        await Promise.all(
          Array.from({ length: 10 }, (_, i) =>
            prisma.lawArticleRelation.create({
              data: {
                sourceId: testArticles[i % testArticles.length].id,
                targetId: testArticles[(i + 1) % testArticles.length].id,
                relationType: RelationType.RELATED,
                strength: 0.7,
                confidence: 0.75,
                discoveryMethod: DiscoveryMethod.AI_DETECTED,
                verificationStatus: VerificationStatus.PENDING,
              },
            })
          )
        );

        // 获取所有管理员
        const admins = await prisma.user.findMany({
          where: {
            role: { in: [UserRole.ADMIN, UserRole.SUPER_ADMIN] },
          },
        });

        // 向所有管理员发送通知
        await Promise.all(
          admins.map(admin => sendPendingRelationsNotification(admin.id, 10, 5))
        );

        // 验证两个管理员都收到了通知
        const admin1Notifications = await prisma.notification.count({
          where: {
            userId: adminUser.id,
            type: NotificationType.ALERT,
          },
        });

        const admin2Notifications = await prisma.notification.count({
          where: {
            userId: admin2.id,
            type: NotificationType.ALERT,
          },
        });

        expect(admin1Notifications).toBeGreaterThan(0);
        expect(admin2Notifications).toBeGreaterThan(0);
      } finally {
        // 清理
        await prisma.notification.deleteMany({
          where: {
            userId: admin2.id,
          },
        });
        await prisma.user.delete({
          where: {
            id: admin2.id,
          },
        });
      }
    });
  });

  describe('错误处理', () => {
    it('应该处理不存在的用户ID', async () => {
      await expect(
        sendPendingRelationsNotification('non-existent-user-id', 10, 5)
      ).rejects.toThrow();
    });

    it('应该处理数据库错误', async () => {
      // 使用无效的配置触发错误
      const config: NotificationThresholdConfig = {
        threshold: -1, // 无效的阈值
        checkIntervalMinutes: 60,
      };

      const result = await checkPendingRelationsThreshold(config);
      expect(result.shouldNotify).toBe(false);
    });
  });

  describe('性能测试', () => {
    it('应该在合理时间内完成阈值检查', async () => {
      // 创建大量待审核关系
      await Promise.all(
        Array.from({ length: 50 }, (_, i) =>
          prisma.lawArticleRelation.create({
            data: {
              sourceId: testArticles[i % testArticles.length].id,
              targetId: testArticles[(i + 1) % testArticles.length].id,
              relationType: RelationType.RELATED,
              strength: 0.7,
              confidence: 0.75,
              discoveryMethod: DiscoveryMethod.AI_DETECTED,
              verificationStatus: VerificationStatus.PENDING,
            },
          })
        )
      );

      const config: NotificationThresholdConfig = {
        threshold: 10,
        checkIntervalMinutes: 60,
      };

      const startTime = Date.now();
      await checkPendingRelationsThreshold(config);
      const endTime = Date.now();

      // 应该在500ms内完成
      expect(endTime - startTime).toBeLessThan(500);
    });

    it('应该在合理时间内发送通知', async () => {
      const startTime = Date.now();
      await sendPendingRelationsNotification(adminUser.id, 10, 5);
      const endTime = Date.now();

      // 应该在1秒内完成
      expect(endTime - startTime).toBeLessThan(1000);
    });
  });
});
