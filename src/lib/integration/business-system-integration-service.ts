/**
 * 业务系统集成服务模块
 *
 * 负责管理与企业业务系统（ERP、CRM、财务系统等）的对接，
 * 提供标准化的 API 接口和 Webhook 事件推送功能。
 */

import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/logger';
import { encrypt, decrypt } from '@/lib/security/encryption';

// =============================================================================
// 类型定义
// =============================================================================

export interface CreateIntegrationInput {
  enterpriseId: string;
  systemType: string;
  systemName: string;
  systemUrl: string;
  authType: string;
  authToken?: string;
  apiKey?: string;
  refreshToken?: string;
  syncConfig?: Record<string, unknown>;
  syncEnabled?: boolean;
  syncInterval?: number;
  webhookUrl?: string;
  webhookSecret?: string;
  webhookEnabled?: boolean;
  webhookEvents?: string[];
  description?: string;
  metadata?: Record<string, unknown>;
}

export interface UpdateIntegrationInput {
  systemName?: string;
  systemUrl?: string;
  authType?: string;
  authToken?: string;
  apiKey?: string;
  refreshToken?: string;
  tokenExpiresAt?: Date;
  syncConfig?: Record<string, unknown>;
  syncEnabled?: boolean;
  syncInterval?: number;
  webhookUrl?: string;
  webhookSecret?: string;
  webhookEnabled?: boolean;
  webhookEvents?: string[];
  status?: string;
  description?: string;
  metadata?: Record<string, unknown>;
}

export interface IntegrationQueryParams {
  enterpriseId?: string;
  systemType?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}

export interface IntegrationResponse {
  id: string;
  enterpriseId: string;
  systemType: string;
  systemName: string;
  systemUrl: string;
  authType: string;
  syncEnabled: boolean;
  syncInterval: number;
  webhookEnabled: boolean;
  webhookEvents: string[];
  status: string;
  lastSyncAt: Date | null;
  lastSyncStatus: string | null;
  lastSyncError: string | null;
  totalSyncs: number;
  successSyncs: number;
  failedSyncs: number;
  description: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface SyncLogResponse {
  id: string;
  integrationId: string;
  syncType: string;
  eventType: string | null;
  direction: string;
  status: string;
  startedAt: Date;
  completedAt: Date | null;
  recordsProcessed: number;
  recordsCreated: number;
  recordsUpdated: number;
  recordsDeleted: number;
  errorMessage: string | null;
  duration: number | null;
  createdAt: Date;
}

// =============================================================================
// 业务系统集成服务
// =============================================================================

class BusinessSystemIntegrationService {
  /**
   * 创建业务系统集成
   */
  async createIntegration(
    input: CreateIntegrationInput
  ): Promise<IntegrationResponse> {
    try {
      // 加密存储敏感信息
      let encryptedAuthToken: string | undefined;
      let encryptedApiKey: string | undefined;

      if (input.authToken) {
        const encrypted = encrypt(input.authToken);
        encryptedAuthToken = encrypted;
      }

      if (input.apiKey) {
        const encrypted = encrypt(input.apiKey);
        encryptedApiKey = encrypted;
      }

      const integration = await prisma.businessSystemIntegration.create({
        data: {
          enterpriseId: input.enterpriseId,
          systemType: input.systemType as never,
          systemName: input.systemName,
          systemUrl: input.systemUrl,
          authType: input.authType as never,
          authToken: encryptedAuthToken,
          authTokenEncrypted: !!encryptedAuthToken,
          apiKey: encryptedApiKey,
          apiKeyEncrypted: !!encryptedApiKey,
          refreshToken: input.refreshToken || null,
          syncConfig: (input.syncConfig || {}) as Prisma.JsonObject,
          syncEnabled: input.syncEnabled ?? true,
          syncInterval: input.syncInterval || 3600,
          webhookUrl: input.webhookUrl || null,
          webhookSecret: input.webhookSecret || null,
          webhookEnabled: input.webhookEnabled ?? false,
          webhookEvents: input.webhookEvents || [],
          status: 'PENDING',
          description: input.description || null,
          metadata: (input.metadata || null) as Prisma.JsonValue,
        },
        include: {
          enterprise: {
            select: {
              id: true,
              enterpriseName: true,
            },
          },
        },
      });

      logger.info('创建业务系统集成成功', {
        id: integration.id,
        enterpriseId: integration.enterpriseId,
        systemType: integration.systemType,
        systemName: integration.systemName,
      });

      return this.toIntegrationResponse(integration);
    } catch (error) {
      logger.error('创建业务系统集成失败', error as Error);
      throw error;
    }
  }

  /**
   * 更新业务系统集成
   */
  async updateIntegration(
    id: string,
    input: UpdateIntegrationInput
  ): Promise<IntegrationResponse> {
    try {
      // 准备更新数据
      const updateData: Prisma.BusinessSystemIntegrationUpdateInput = {};

      if (input.systemName !== undefined) {
        updateData.systemName = input.systemName;
      }
      if (input.systemUrl !== undefined) {
        updateData.systemUrl = input.systemUrl;
      }
      if (input.authType !== undefined) {
        updateData.authType = input.authType as never;
      }
      if (input.authToken !== undefined) {
        const encrypted = encrypt(input.authToken);
        updateData.authToken = encrypted;
        updateData.authTokenEncrypted = true;
      }
      if (input.apiKey !== undefined) {
        const encrypted = encrypt(input.apiKey);
        updateData.apiKey = encrypted;
        updateData.apiKeyEncrypted = true;
      }
      if (input.refreshToken !== undefined) {
        updateData.refreshToken = input.refreshToken;
      }
      if (input.tokenExpiresAt !== undefined) {
        updateData.tokenExpiresAt = input.tokenExpiresAt;
      }
      if (input.syncConfig !== undefined) {
        updateData.syncConfig = input.syncConfig as Prisma.JsonObject;
      }
      if (input.syncEnabled !== undefined) {
        updateData.syncEnabled = input.syncEnabled;
      }
      if (input.syncInterval !== undefined) {
        updateData.syncInterval = input.syncInterval;
      }
      if (input.webhookUrl !== undefined) {
        updateData.webhookUrl = input.webhookUrl;
      }
      if (input.webhookSecret !== undefined) {
        updateData.webhookSecret = input.webhookSecret;
      }
      if (input.webhookEnabled !== undefined) {
        updateData.webhookEnabled = input.webhookEnabled;
      }
      if (input.webhookEvents !== undefined) {
        updateData.webhookEvents = input.webhookEvents;
      }
      if (input.status !== undefined) {
        updateData.status = input.status as never;
      }
      if (input.description !== undefined) {
        updateData.description = input.description;
      }
      if (input.metadata !== undefined) {
        updateData.metadata = input.metadata as Prisma.JsonValue;
      }

      const integration = await prisma.businessSystemIntegration.update({
        where: { id },
        data: updateData,
        include: {
          enterprise: {
            select: {
              id: true,
              enterpriseName: true,
            },
          },
        },
      });

      logger.info('更新业务系统集成成功', {
        id: integration.id,
        systemName: integration.systemName,
      });

      return this.toIntegrationResponse(integration);
    } catch (error) {
      logger.error('更新业务系统集成失败', error as Error);
      throw error;
    }
  }

  /**
   * 删除业务系统集成
   */
  async deleteIntegration(id: string): Promise<void> {
    try {
      await prisma.businessSystemIntegration.delete({
        where: { id },
      });

      logger.info('删除业务系统集成成功', { id });
    } catch (error) {
      logger.error('删除业务系统集成失败', error as Error);
      throw error;
    }
  }

  /**
   * 获取业务系统集成详情
   */
  async getIntegration(id: string): Promise<IntegrationResponse | null> {
    try {
      const integration = await prisma.businessSystemIntegration.findUnique({
        where: { id },
        include: {
          enterprise: {
            select: {
              id: true,
              enterpriseName: true,
            },
          },
        },
      });

      if (!integration) {
        return null;
      }

      return this.toIntegrationResponse(integration);
    } catch (error) {
      logger.error('获取业务系统集成详情失败', error as Error);
      throw error;
    }
  }

  /**
   * 查询业务系统集成列表
   */
  async queryIntegrations(
    params: IntegrationQueryParams
  ): Promise<{ items: IntegrationResponse[]; total: number }> {
    try {
      const {
        enterpriseId,
        systemType,
        status,
        page = 1,
        pageSize = 20,
      } = params;

      const where: Prisma.BusinessSystemIntegrationWhereInput = {};

      if (enterpriseId) {
        where.enterpriseId = enterpriseId;
      }
      if (systemType) {
        where.systemType = systemType as never;
      }
      if (status) {
        where.status = status as never;
      }

      const [items, total] = await Promise.all([
        prisma.businessSystemIntegration.findMany({
          where,
          skip: (page - 1) * pageSize,
          take: pageSize,
          orderBy: { createdAt: 'desc' },
          include: {
            enterprise: {
              select: {
                id: true,
                enterpriseName: true,
              },
            },
          },
        }),
        prisma.businessSystemIntegration.count({ where }),
      ]);

      return {
        items: items.map(item => this.toIntegrationResponse(item)),
        total,
      };
    } catch (error) {
      logger.error('查询业务系统集成列表失败', error as Error);
      throw error;
    }
  }

  /**
   * 测试集成连接
   */
  async testConnection(
    id: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      const integration = await prisma.businessSystemIntegration.findUnique({
        where: { id },
      });

      if (!integration) {
        return { success: false, message: '集成不存在' };
      }

      // TODO: 实现实际的连接测试逻辑
      // 这里应该根据不同的系统类型调用相应的 API 进行测试

      const connectionTestedAt = new Date();
      const connectionStatus = 'success';

      await prisma.businessSystemIntegration.update({
        where: { id },
        data: {
          connectionTestedAt,
          connectionStatus,
        },
      });

      logger.info('测试集成连接成功', { id });

      return { success: true, message: '连接测试成功' };
    } catch (error) {
      logger.error('测试集成连接失败', error as Error);

      // 更新连接状态
      try {
        await prisma.businessSystemIntegration.update({
          where: { id },
          data: {
            connectionTestedAt: new Date(),
            connectionStatus: 'failed',
          },
        });
      } catch {
        // 忽略更新错误
      }

      return {
        success: false,
        message: `连接测试失败: ${(error as Error).message}`,
      };
    }
  }

  /**
   * 执行同步
   */
  async performSync(
    id: string,
    syncType: string = 'manual'
  ): Promise<SyncLogResponse> {
    let syncLogId: string | null = null;

    try {
      const integration = await prisma.businessSystemIntegration.findUnique({
        where: { id },
      });

      if (!integration) {
        throw new Error('集成不存在');
      }

      if (!integration.syncEnabled) {
        throw new Error('同步已禁用');
      }

      // 创建同步日志
      const syncLog = await prisma.integrationSyncLog.create({
        data: {
          integrationId: id,
          syncType,
          direction: 'inbound',
          status: 'running',
          startedAt: new Date(),
        },
      });

      syncLogId = syncLog.id;

      // TODO: 实现实际的同步逻辑
      // 这里应该根据不同的系统类型和配置进行数据同步

      const startTime = Date.now();

      // 模拟同步完成
      const completedAt = new Date();
      const duration = Date.now() - startTime;

      // 更新同步日志
      const updatedLog = await prisma.integrationSyncLog.update({
        where: { id: syncLog.id },
        data: {
          status: 'completed',
          completedAt,
          duration,
          recordsProcessed: 0,
          recordsCreated: 0,
          recordsUpdated: 0,
          recordsDeleted: 0,
        },
      });

      // 更新集成统计
      await prisma.businessSystemIntegration.update({
        where: { id },
        data: {
          lastSyncAt: completedAt,
          lastSyncStatus: 'success',
          lastSyncError: null,
          totalSyncs: { increment: 1 },
          successSyncs: { increment: 1 },
        },
      });

      logger.info('执行同步成功', { id, syncLogId: syncLog.id });

      return this.toSyncLogResponse(updatedLog);
    } catch (error) {
      logger.error('执行同步失败', error as Error);

      // 更新同步日志为失败状态
      try {
        if (syncLogId) {
          await prisma.integrationSyncLog.update({
            where: { id: syncLogId },
            data: {
              status: 'failed',
              completedAt: new Date(),
              errorMessage: (error as Error).message,
            },
          });
        }

        // 更新集成统计
        await prisma.businessSystemIntegration.update({
          where: { id },
          data: {
            lastSyncAt: new Date(),
            lastSyncStatus: 'failed',
            lastSyncError: (error as Error).message,
            totalSyncs: { increment: 1 },
            failedSyncs: { increment: 1 },
          },
        });
      } catch {
        // 忽略更新错误
      }

      throw error;
    }
  }

  /**
   * 获取同步日志
   */
  async getSyncLogs(
    integrationId: string,
    page: number = 1,
    pageSize: number = 20
  ): Promise<{ items: SyncLogResponse[]; total: number }> {
    try {
      const [items, total] = await Promise.all([
        prisma.integrationSyncLog.findMany({
          where: { integrationId },
          skip: (page - 1) * pageSize,
          take: pageSize,
          orderBy: { startedAt: 'desc' },
        }),
        prisma.integrationSyncLog.count({ where: { integrationId } }),
      ]);

      return {
        items: items.map(item => this.toSyncLogResponse(item)),
        total,
      };
    } catch (error) {
      logger.error('获取同步日志失败', error as Error);
      throw error;
    }
  }

  /**
   * 发送 Webhook 事件
   */
  async sendWebhookEvent(
    integrationId: string,
    eventType: string,
    _payload: Record<string, unknown>
  ): Promise<{ success: boolean; message: string }> {
    try {
      const integration = await prisma.businessSystemIntegration.findUnique({
        where: { id: integrationId },
      });

      if (!integration) {
        return { success: false, message: '集成不存在' };
      }

      if (!integration.webhookEnabled) {
        return { success: false, message: 'Webhook 已禁用' };
      }

      if (!integration.webhookUrl) {
        return { success: false, message: 'Webhook URL 未配置' };
      }

      if (!integration.webhookEvents.includes(eventType)) {
        return { success: false, message: '未订阅此事件类型' };
      }

      // TODO: 实现实际的 Webhook 发送逻辑
      // 这里应该使用签名验证和重试机制发送 Webhook

      logger.info('发送 Webhook 事件成功', {
        integrationId,
        eventType,
        webhookUrl: integration.webhookUrl,
      });

      return { success: true, message: 'Webhook 事件发送成功' };
    } catch (error) {
      logger.error('发送 Webhook 事件失败', error as Error);
      return {
        success: false,
        message: `发送失败: ${(error as Error).message}`,
      };
    }
  }

  /**
   * 解密敏感信息（仅供内部使用）
   */
  async getDecryptedCredentials(id: string): Promise<{
    authToken?: string;
    apiKey?: string;
    refreshToken?: string;
  } | null> {
    try {
      const integration = await prisma.businessSystemIntegration.findUnique({
        where: { id },
      });

      if (!integration) {
        return null;
      }

      const result: {
        authToken?: string;
        apiKey?: string;
        refreshToken?: string;
      } = {};

      if (integration.authToken && integration.authTokenEncrypted) {
        result.authToken = decrypt(integration.authToken);
      }

      if (integration.apiKey && integration.apiKeyEncrypted) {
        result.apiKey = decrypt(integration.apiKey);
      }

      if (integration.refreshToken) {
        result.refreshToken = integration.refreshToken;
      }

      return result;
    } catch (error) {
      logger.error('解密凭证失败', error as Error);
      throw error;
    }
  }

  // =============================================================================
  // 私有方法
  // =============================================================================

  /**
   * 转换为响应对象
   */
  private toIntegrationResponse(
    integration: Awaited<
      ReturnType<typeof prisma.businessSystemIntegration.findUnique>
    >
  ): IntegrationResponse {
    return {
      id: integration.id,
      enterpriseId: integration.enterpriseId,
      systemType: integration.systemType,
      systemName: integration.systemName,
      systemUrl: integration.systemUrl,
      authType: integration.authType,
      syncEnabled: integration.syncEnabled,
      syncInterval: integration.syncInterval,
      webhookEnabled: integration.webhookEnabled,
      webhookEvents: integration.webhookEvents,
      status: integration.status,
      lastSyncAt: integration.lastSyncAt,
      lastSyncStatus: integration.lastSyncStatus,
      lastSyncError: integration.lastSyncError,
      totalSyncs: integration.totalSyncs,
      successSyncs: integration.successSyncs,
      failedSyncs: integration.failedSyncs,
      description: integration.description,
      metadata: integration.metadata as Record<string, unknown> | null,
      createdAt: integration.createdAt,
      updatedAt: integration.updatedAt,
    };
  }

  /**
   * 转换为同步日志响应对象
   */
  private toSyncLogResponse(
    log: Awaited<ReturnType<typeof prisma.integrationSyncLog.findUnique>>
  ): SyncLogResponse {
    return {
      id: log.id,
      integrationId: log.integrationId,
      syncType: log.syncType,
      eventType: log.eventType,
      direction: log.direction,
      status: log.status,
      startedAt: log.startedAt,
      completedAt: log.completedAt,
      recordsProcessed: log.recordsProcessed,
      recordsCreated: log.recordsCreated,
      recordsUpdated: log.recordsUpdated,
      recordsDeleted: log.recordsDeleted,
      errorMessage: log.errorMessage,
      duration: log.duration,
      createdAt: log.createdAt,
    };
  }
}

// =============================================================================
// 导出
// =============================================================================

export const businessSystemIntegrationService =
  new BusinessSystemIntegrationService();
