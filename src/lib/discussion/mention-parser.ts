/**
 * 提及解析器模块
 *
 * 解析文本中的@提及，验证用户存在性，提取有效的用户ID。
 */

import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/agent/security/logger';
import type { MentionParseResult } from '@/types/discussion';

// =============================================================================
// 正则表达式常量
// =============================================================================

/**
 * 提及用户名的正则表达式
 * 匹配 @username 格式，允许使用字母、数字、中文、下划线
 */
const USERNAME_MENTION_REGEX = /@([a-zA-Z0-9_\u4e00-\u9fa5]+)/g;

/**
 * 提及用户ID的正则表达式
 * 匹配 @cuid 格式（Prisma的cuid格式）
 */
const USER_ID_MENTION_REGEX = /@([a-z0-9]{25})/g;

// =============================================================================
// 提及解析器类
// =============================================================================

class MentionParser {
  /**
   * 解析文本中的提及
   *
   * @param content - 要解析的文本内容
   * @param caseId - 案件ID，用于验证用户是否有权访问该案件
   * @returns 解析结果，包含有效的提及ID列表和处理后的文本
   */
  async parseMentions(
    content: string,
    caseId?: string
  ): Promise<MentionParseResult> {
    if (!content || content.trim().length === 0) {
      return {
        mentions: [],
        text: content,
        valid: true,
      };
    }

    const usernameMentions = this.extractUsernameMentions(content);
    const userIdMentions = this.extractUserIdMentions(content);
    const allMentions = new Set([...usernameMentions, ...userIdMentions]);

    if (allMentions.size === 0) {
      return {
        mentions: [],
        text: content,
        valid: true,
      };
    }

    const validUserIds = await this.validateUsers(
      Array.from(allMentions),
      caseId
    );

    if (validUserIds.length === 0) {
      logger.warn('解析提及时未找到有效用户', {
        totalMentions: allMentions.size,
        validMentions: 0,
      } as never);
    } else {
      logger.info('成功解析提及', {
        totalMentions: allMentions.size,
        validMentions: validUserIds.length,
        caseId,
      } as never);
    }

    return {
      mentions: validUserIds,
      text: content,
      valid: validUserIds.length > 0,
    };
  }

  /**
   * 从文本中提取用户名提及
   */
  private extractUsernameMentions(content: string): string[] {
    const mentions: string[] = [];
    const matches = content.matchAll(USERNAME_MENTION_REGEX);

    for (const match of matches) {
      const username = match[1];
      if (username) {
        mentions.push(username);
      }
    }

    return mentions;
  }

  /**
   * 从文本中提取用户ID提及
   */
  private extractUserIdMentions(content: string): string[] {
    const mentions: string[] = [];
    const matches = content.matchAll(USER_ID_MENTION_REGEX);

    for (const match of matches) {
      const userId = match[1];
      if (userId && this.isValidCuid(userId)) {
        mentions.push(userId);
      }
    }

    return mentions;
  }

  /**
   * 验证用户是否存在
   */
  private async validateUsers(
    users: string[],
    caseId?: string
  ): Promise<string[]> {
    if (users.length === 0) {
      return [];
    }

    try {
      const validUsers = await prisma.user.findMany({
        where: {
          OR: [{ id: { in: users } }, { username: { in: users } }],
          status: 'ACTIVE',
        },
        select: {
          id: true,
          username: true,
        },
      });

      const validUserIds = validUsers.map((user: { id: string }) => user.id);

      if (caseId) {
        const caseData = await prisma.case.findUnique({
          where: { id: caseId },
          select: {
            userId: true,
            sharedWithTeam: true,
            teamMembers: {
              select: {
                userId: true,
              },
            },
          },
        });

        if (caseData) {
          const accessibleUserIds = validUserIds.filter((userId: string) => {
            return (
              caseData.userId === userId ||
              caseData.teamMembers.some(
                (member: { userId: string }) => member.userId === userId
              )
            );
          });

          return accessibleUserIds;
        }
      }

      return validUserIds;
    } catch (error) {
      logger.error(
        '验证提及用户时发生错误',
        error instanceof Error ? error : new Error(String(error))
      );
      return [];
    }
  }

  /**
   * 验证是否为有效的cuid格式
   */
  private isValidCuid(value: string): boolean {
    return /^[a-z0-9]{25}$/.test(value);
  }

  /**
   * 清理文本中的无效提及
   */
  removeInvalidMentions(content: string, invalidMentions: string[]): string {
    if (invalidMentions.length === 0) {
      return content;
    }

    let cleanedText = content;

    for (const mention of invalidMentions) {
      cleanedText = cleanedText.replace(new RegExp(`@${mention}`, 'g'), '');
      cleanedText = cleanedText.replace(new RegExp(`@${mention}`, 'g'), '');
    }

    return cleanedText.trim();
  }

  /**
   * 格式化提及，返回可读的用户信息
   */
  async getMentionedUsersInfo(
    userId: string[]
  ): Promise<
    Array<{ id: string; username: string | null; name: string | null }>
  > {
    if (userId.length === 0) {
      return [];
    }

    try {
      const users = await prisma.user.findMany({
        where: {
          id: { in: userId },
        },
        select: {
          id: true,
          username: true,
          name: true,
        },
      });

      return users.map(
        (user: {
          id: string;
          username: string | null;
          name: string | null;
        }) => ({
          id: user.id,
          username: user.username,
          name: user.name,
        })
      );
    } catch (error) {
      logger.error(
        '获取提及用户信息时发生错误',
        error instanceof Error ? error : new Error(String(error))
      );
      return [];
    }
  }
}

export const mentionParser = new MentionParser();
export default mentionParser;
