/**
 * 合规规则关联关系服务 (ComplianceRuleRelationService)
 *
 * 提供法规/合规规则之间关联关系的管理功能，包括创建、查询、审核和删除关联关系。
 * 支持构建规则之间的关联网络，检测冲突关系，以及追踪规则引用链。
 *
 * ## 功能特性
 * - 创建和管理法规之间的关联关系
 * - 支持多种关联类型（SUPERSEDES, AMENDS, REFERENCES, CONFLICTS, COMPLEMENTS, RELATED）
 * - 构建规则的关联网络（BFS遍历）
 * - 审核和验证关联关系
 * - 检测规则之间的冲突
 * - 追踪规则的引用和被引用关系
 *
 * ## 关联类型说明
 * - SUPERSEDES: 新规则替代旧规则
 * - AMENDS: 新规则修订旧规则
 * - REFERENCES: 规则引用其他规则
 * - CONFLICTS: 规则与其他规则冲突
 * - COMPLEMENTS: 规则与其他规则互补
 * - RELATED: 规则与其他规则相关
 *
 * ## 使用示例
 * ```typescript
 * import { ComplianceRuleRelationService } from '@/services/enterprise/legal/compliance-rule-relation.service';
 * import { PrismaClient } from '@prisma/client';
 *
 * const prisma = new PrismaClient();
 * const service = new ComplianceRuleRelationService(prisma);
 *
 * // 创建关联关系
 * const relation = await service.createRelation({
 *   sourceRuleId: 'rule-uuid-1',
 *   targetRuleId: 'rule-uuid-2',
 *   relationType: 'REFERENCES',
 *   strength: 0.8,
 *   confidence: 0.9,
 *   description: '该规则引用了数据保护规定'
 * });
 *
 * // 获取规则的关联网络
 * const network = await service.getRuleRelationNetwork('rule-uuid-1', 3);
 * // 返回 { nodes: [...], edges: [...] }
 * ```
 *
 * @module services/enterprise/legal/compliance-rule-relation.service
 */

import { PrismaClient } from '@prisma/client';
import { logger } from '@/lib/logger';

// 使用any作为临时类型（待Prisma客户端修复后替换）
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Entity = any;

// 合规规则关联关系数据类型定义
interface ComplianceRuleRelationData {
  sourceRuleId: string;
  targetRuleId: string;
  relationType: string;
  strength?: number;
  confidence?: number;
  description?: string;
}

interface ComplianceRuleRelationFilter {
  sourceRuleId?: string;
  targetRuleId?: string;
  relationType?: string;
  status?: string;
}

/**
 * 合规规则关联关系服务
 * 负责管理法规之间的关联关系网络
 */
export class ComplianceRuleRelationService {
  constructor(private prisma: PrismaClient) {}

  /**
   * 创建法规关联关系
   */
  async createRelation(data: ComplianceRuleRelationData): Promise<Entity> {
    try {
      // 验证源规则和目标规则是否存在
      const [sourceRule, targetRule] = await Promise.all([
        this.prisma.complianceRule.findUnique({
          where: { id: data.sourceRuleId },
        }),
        this.prisma.complianceRule.findUnique({
          where: { id: data.targetRuleId },
        }),
      ]);

      if (!sourceRule) {
        throw new Error('源规则不存在');
      }

      if (!targetRule) {
        throw new Error('目标规则不存在');
      }

      if (data.sourceRuleId === data.targetRuleId) {
        throw new Error('不能创建自引用关系');
      }

      // 使用原生SQL插入数据（Prisma类型未生成时）
      const relation = await this.prisma.$queryRaw`
        INSERT INTO compliance_rule_relations (
          id, "sourceRuleId", "targetRuleId", "relationType",
          strength, confidence, description, status, "createdAt", "updatedAt"
        ) VALUES (
          gen_random_uuid(), ${data.sourceRuleId}, ${data.targetRuleId},
          ${data.relationType}, ${data.strength || 1.0}, ${data.confidence || 1.0},
          ${data.description || null}, 'pending', NOW(), NOW()
        )
        RETURNING *
      `;

      logger.info('法规关联关系创建成功', {
        data,
      });

      return relation;
    } catch (error) {
      logger.error('创建法规关联关系失败', {
        error,
        data,
      });
      throw error;
    }
  }

  /**
   * 根据ID获取法规关联关系
   */
  async getRelationById(id: string): Promise<Entity | null> {
    try {
      const [relation] = await this.prisma.$queryRaw<Entity>`
        SELECT * FROM compliance_rule_relations WHERE id = ${id}
      `;
      return relation || null;
    } catch (error) {
      logger.error('获取法规关联关系失败', { error, relationId: id });
      throw error;
    }
  }

  /**
   * 查询法规关联关系列表
   */
  async queryRelations(
    filter: ComplianceRuleRelationFilter
  ): Promise<Entity[]> {
    try {
      let query = 'SELECT * FROM compliance_rule_relations WHERE 1=1';
      const params: (string | undefined)[] = [];

      if (filter.sourceRuleId) {
        query += ` AND "sourceRuleId" = $${params.length + 1}`;
        params.push(filter.sourceRuleId);
      }

      if (filter.targetRuleId) {
        query += ` AND "targetRuleId" = $${params.length + 1}`;
        params.push(filter.targetRuleId);
      }

      if (filter.relationType) {
        query += ` AND "relationType" = $${params.length + 1}`;
        params.push(filter.relationType);
      }

      if (filter.status) {
        query += ` AND status = $${params.length + 1}`;
        params.push(filter.status);
      }

      query += ' ORDER BY "createdAt" DESC';

      return await this.prisma.$queryRawUnsafe(query, ...params);
    } catch (error) {
      logger.error('查询法规关联关系列表失败', { error, filter });
      throw error;
    }
  }

  /**
   * 获取规则的关联关系（包括作为源和作为目标）
   */
  async getRuleRelations(ruleId: string): Promise<{
    asSource: Entity[];
    asTarget: Entity[];
  }> {
    try {
      const [asSource, asTarget] = await Promise.all([
        this.prisma.$queryRaw<Entity>`
          SELECT * FROM compliance_rule_relations
          WHERE "sourceRuleId" = ${ruleId}
          ORDER BY "createdAt" DESC
        `,
        this.prisma.$queryRaw<Entity>`
          SELECT * FROM compliance_rule_relations
          WHERE "targetRuleId" = ${ruleId}
          ORDER BY "createdAt" DESC
        `,
      ]);

      return { asSource, asTarget };
    } catch (error) {
      logger.error('获取规则关联关系失败', { error, ruleId });
      throw error;
    }
  }

  /**
   * 获取规则的完整关联网络（递归获取）
   */
  async getRuleRelationNetwork(
    ruleId: string,
    maxDepth: number = 3
  ): Promise<{
    nodes: Array<{ id: string; ruleName: string; ruleCode: string }>;
    edges: Array<{
      sourceId: string;
      targetId: string;
      relationType: string;
      strength: number;
    }>;
  }> {
    try {
      const visited = new Set<string>();
      const nodes: Array<{ id: string; ruleName: string; ruleCode: string }> =
        [];
      const edges: Array<{
        sourceId: string;
        targetId: string;
        relationType: string;
        strength: number;
      }> = [];

      // BFS遍历
      const queue: Array<{ ruleId: string; depth: number }> = [
        { ruleId, depth: 0 },
      ];

      while (queue.length > 0) {
        const current = queue.shift()!;

        if (visited.has(current.ruleId) || current.depth > maxDepth) {
          continue;
        }

        visited.add(current.ruleId);

        // 获取规则信息
        const rule = await this.prisma.complianceRule.findUnique({
          where: { id: current.ruleId },
          select: { id: true, ruleName: true, ruleCode: true },
        });

        if (rule) {
          nodes.push({
            id: rule.id,
            ruleName: rule.ruleName,
            ruleCode: rule.ruleCode,
          });
        }

        // 获取关联关系
        const relations = await this.prisma.$queryRaw<Entity>`
          SELECT * FROM compliance_rule_relations
          WHERE ("sourceRuleId" = ${current.ruleId} OR "targetRuleId" = ${current.ruleId})
            AND status = 'verified'
        `;

        for (const relation of relations) {
          // 添加边
          edges.push({
            sourceId: relation.sourceRuleId,
            targetId: relation.targetRuleId,
            relationType: relation.relationType,
            strength: Number(relation.strength),
          });

          // 将相关规则加入队列
          const nextRuleId =
            relation.sourceRuleId === current.ruleId
              ? relation.targetRuleId
              : relation.sourceRuleId;

          if (!visited.has(nextRuleId) && current.depth < maxDepth) {
            queue.push({ ruleId: nextRuleId, depth: current.depth + 1 });
          }
        }
      }

      return { nodes, edges };
    } catch (error) {
      logger.error('获取规则关联网络失败', { error, ruleId, maxDepth });
      throw error;
    }
  }

  /**
   * 更新法规关联关系
   */
  async updateRelation(
    id: string,
    data: Partial<ComplianceRuleRelationData>
  ): Promise<Entity> {
    try {
      const updates: string[] = [];
      const params: (string | number | null)[] = [];
      let paramIndex = 1;

      if (data.relationType) {
        updates.push(`"relationType" = $${paramIndex++}`);
        params.push(data.relationType);
      }

      if (data.strength !== undefined) {
        updates.push(`strength = $${paramIndex++}`);
        params.push(data.strength);
      }

      if (data.confidence !== undefined) {
        updates.push(`confidence = $${paramIndex++}`);
        params.push(data.confidence);
      }

      if (data.description !== undefined) {
        updates.push(`description = $${paramIndex++}`);
        params.push(data.description || null);
      }

      if (updates.length === 0) {
        throw new Error('没有要更新的字段');
      }

      updates.push(`"updatedAt" = NOW()`);
      params.push(id);

      const query = `
        UPDATE compliance_rule_relations
        SET ${updates.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING *
      `;

      const [relation] = await this.prisma.$queryRawUnsafe<Entity>(
        query,
        ...params
      );

      logger.info('法规关联关系更新成功', {
        relationId: id,
      });

      return relation;
    } catch (error) {
      logger.error('更新法规关联关系失败', { error, relationId: id });
      throw error;
    }
  }

  /**
   * 审核通过法规关联关系
   */
  async verifyRelation(id: string, verifiedBy: string): Promise<Entity> {
    try {
      const [relation] = await this.prisma.$queryRaw<Entity>`
        UPDATE compliance_rule_relations
        SET status = 'verified', "verifiedBy" = ${verifiedBy}, "verifiedAt" = NOW(), "updatedAt" = NOW()
        WHERE id = ${id}
        RETURNING *
      `;

      logger.info('法规关联关系审核通过', {
        relationId: id,
        verifiedBy,
      });

      return relation;
    } catch (error) {
      logger.error('审核法规关联关系失败', { error, relationId: id });
      throw error;
    }
  }

  /**
   * 拒绝法规关联关系
   */
  async rejectRelation(id: string): Promise<Entity> {
    try {
      const [relation] = await this.prisma.$queryRaw<Entity>`
        UPDATE compliance_rule_relations
        SET status = 'rejected', "updatedAt" = NOW()
        WHERE id = ${id}
        RETURNING *
      `;

      logger.info('法规关联关系已拒绝', {
        relationId: id,
      });

      return relation;
    } catch (error) {
      logger.error('拒绝法规关联关系失败', { error, relationId: id });
      throw error;
    }
  }

  /**
   * 删除法规关联关系
   */
  async deleteRelation(id: string): Promise<void> {
    try {
      await this.prisma.$executeRaw`
        DELETE FROM compliance_rule_relations WHERE id = ${id}
      `;

      logger.info('法规关联关系删除成功', { relationId: id });
    } catch (error) {
      logger.error('删除法规关联关系失败', { error, relationId: id });
      throw error;
    }
  }

  /**
   * 获取待审核的关联关系
   */
  async getPendingRelations(): Promise<Entity[]> {
    try {
      return await this.prisma.$queryRaw<Entity>`
        SELECT * FROM compliance_rule_relations
        WHERE status = 'pending'
        ORDER BY "createdAt" ASC
      `;
    } catch (error) {
      logger.error('获取待审核关联关系失败', { error });
      throw error;
    }
  }

  /**
   * 检测规则之间的冲突关系
   */
  async detectConflicts(ruleId: string): Promise<Entity[]> {
    try {
      return await this.prisma.$queryRaw<Entity>`
        SELECT * FROM compliance_rule_relations
        WHERE ("sourceRuleId" = ${ruleId} OR "targetRuleId" = ${ruleId})
          AND "relationType" = 'CONFLICTS'
          AND status = 'verified'
      `;
    } catch (error) {
      logger.error('检测规则冲突失败', { error, ruleId });
      throw error;
    }
  }

  /**
   * 获取规则的引用关系（引用了哪些规则）
   */
  async getRuleReferences(ruleId: string): Promise<Entity[]> {
    try {
      return await this.prisma.$queryRaw<Entity>`
        SELECT r.*, s."ruleCode" as "targetRuleCode", s."ruleName" as "targetRuleName"
        FROM compliance_rule_relations r
        JOIN compliance_rules s ON r."targetRuleId" = s.id
        WHERE r."sourceRuleId" = ${ruleId}
          AND r."relationType" = 'REFERENCES'
          AND r.status = 'verified'
      `;
    } catch (error) {
      logger.error('获取规则引用关系失败', { error, ruleId });
      throw error;
    }
  }

  /**
   * 获取规则被哪些规则引用
   */
  async getRuleReferencedBy(ruleId: string): Promise<Entity[]> {
    try {
      return await this.prisma.$queryRaw<Entity>`
        SELECT r.*, s."ruleCode" as "sourceRuleCode", s."ruleName" as "sourceRuleName"
        FROM compliance_rule_relations r
        JOIN compliance_rules s ON r."sourceRuleId" = s.id
        WHERE r."targetRuleId" = ${ruleId}
          AND r."relationType" = 'REFERENCES'
          AND r.status = 'verified'
      `;
    } catch (error) {
      logger.error('获取规则被引用关系失败', { error, ruleId });
      throw error;
    }
  }
}

export default ComplianceRuleRelationService;
