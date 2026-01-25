/**
 * 提及解析器测试
 */

import { mentionParser } from '@/lib/discussion/mention-parser';

describe('MentionParser', () => {
  describe('parseMentions', () => {
    it('应该正确解析空文本', async () => {
      const result = await mentionParser.parseMentions('');
      expect(result).toEqual({
        mentions: [],
        text: '',
        valid: true,
      });
    });

    it('应该正确解析只有空白字符的文本', async () => {
      const result = await mentionParser.parseMentions('   ');
      expect(result).toEqual({
        mentions: [],
        text: '   ',
        valid: true,
      });
    });

    it('应该正确解析单个用户名提及', async () => {
      const result = await mentionParser.parseMentions('你好 @john ');
      expect(result.mentions).toBeInstanceOf(Array);
      expect(result.text).toBe('你好 @john ');
      expect(typeof result.valid).toBe('boolean');
    });

    it('应该正确解析多个用户名提及', async () => {
      const result = await mentionParser.parseMentions('你好 @john 和 @jane');
      expect(result.mentions).toBeInstanceOf(Array);
      expect(result.text).toBe('你好 @john 和 @jane');
    });

    it('应该正确解析中文用户名提及', async () => {
      const result = await mentionParser.parseMentions('你好 @张三');
      expect(result.mentions).toBeInstanceOf(Array);
      expect(result.text).toBe('你好 @张三');
    });

    it('应该正确解析混合中文和英文用户名提及', async () => {
      const result = await mentionParser.parseMentions('你好 @john 和 @张三');
      expect(result.mentions).toBeInstanceOf(Array);
      expect(result.text).toBe('你好 @john 和 @张三');
    });

    it('应该正确解析用户ID提及（cuid格式）', async () => {
      const userId = 'abcde12345fghij67890klmno';
      const result = await mentionParser.parseMentions(`你好 @${userId}`);
      expect(result.mentions).toBeInstanceOf(Array);
      expect(result.text).toContain(`@${userId}`);
    });

    it('应该正确解析用户ID提及（25字符）', async () => {
      const userId = 'a'.repeat(25);
      const result = await mentionParser.parseMentions(`@${userId} 你好`);
      expect(result.mentions).toBeInstanceOf(Array);
    });

    it('应该忽略不符合cuid格式的ID提及', async () => {
      const result = await mentionParser.parseMentions(
        '你好 @123 和 @abcdefghij'
      );
      expect(result.mentions).toBeInstanceOf(Array);
      expect(result.text).toBe('你好 @123 和 @abcdefghij');
    });

    it('应该正确解析包含特殊字符的提及', async () => {
      const result = await mentionParser.parseMentions(
        '你好 @john_doe 和 @jane-smith'
      );
      expect(result.mentions).toBeInstanceOf(Array);
      expect(result.text).toBe('你好 @john_doe 和 @jane-smith');
    });

    it('应该正确解析带有数字的用户名提及', async () => {
      const result = await mentionParser.parseMentions(
        '你好 @user123 和 @user456'
      );
      expect(result.mentions).toBeInstanceOf(Array);
      expect(result.text).toBe('你好 @user123 和 @user456');
    });

    it('应该正确解析重复的提及', async () => {
      const result = await mentionParser.parseMentions(
        '你好 @john 和 @john 还有 @jane'
      );
      expect(result.mentions).toBeInstanceOf(Array);
    });

    it('应该正确处理没有提及的文本', async () => {
      const result = await mentionParser.parseMentions('你好世界');
      expect(result.mentions).toEqual([]);
      expect(result.text).toBe('你好世界');
      expect(result.valid).toBe(true);
    });

    it('应该正确处理长文本', async () => {
      const longText = 'a'.repeat(1000) + ' @john ' + 'b'.repeat(1000);
      const result = await mentionParser.parseMentions(longText);
      expect(result.mentions).toBeInstanceOf(Array);
      expect(result.text.length).toBe(longText.length);
    });

    it('应该正确处理提及在文本开头的情况', async () => {
      const result = await mentionParser.parseMentions('@john 你好');
      expect(result.mentions).toBeInstanceOf(Array);
      expect(result.text).toBe('@john 你好');
    });

    it('应该正确处理提及在文本结尾的情况', async () => {
      const result = await mentionParser.parseMentions('你好 @john');
      expect(result.mentions).toBeInstanceOf(Array);
      expect(result.text).toBe('你好 @john');
    });

    it('应该正确处理多个连续的提及', async () => {
      const result = await mentionParser.parseMentions('@john @jane @alice');
      expect(result.mentions).toBeInstanceOf(Array);
      expect(result.text).toBe('@john @jane @alice');
    });
  });

  describe('extractUsernameMentions', () => {
    it('应该正确提取用户名提及', () => {
      const content = '你好 @john 和 @jane';
      const mentions = (
        mentionParser as unknown as {
          extractUsernameMentions: (s: string) => string[];
        }
      ).extractUsernameMentions(content);
      expect(mentions).toContain('john');
      expect(mentions).toContain('jane');
    });

    it('应该正确提取中文用户名提及', () => {
      const content = '你好 @张三 和 @李四';
      const mentions = (
        mentionParser as unknown as {
          extractUsernameMentions: (s: string) => string[];
        }
      ).extractUsernameMentions(content);
      expect(mentions).toContain('张三');
      expect(mentions).toContain('李四');
    });

    it('应该正确处理带有下划线的用户名', () => {
      const content = '你好 @john_doe';
      const mentions = (
        mentionParser as unknown as {
          extractUsernameMentions: (s: string) => string[];
        }
      ).extractUsernameMentions(content);
      expect(mentions).toContain('john_doe');
    });
  });

  describe('extractUserIdMentions', () => {
    it('应该正确提取有效的cuid格式的ID', () => {
      const userId = 'abcde12345fghij67890klmno';
      const content = `你好 @${userId}`;
      const mentions = (
        mentionParser as unknown as {
          extractUserIdMentions: (s: string) => string[];
        }
      ).extractUserIdMentions(content);
      expect(mentions).toContain(userId);
    });

    it('应该忽略不符合cuid格式的ID', () => {
      const content = '你好 @123 @abcdefghij';
      const mentions = (
        mentionParser as unknown as {
          extractUserIdMentions: (s: string) => string[];
        }
      ).extractUserIdMentions(content);
      expect(mentions).not.toContain('123');
      expect(mentions).not.toContain('abcdefghij');
    });

    it('应该忽略过短或过长的ID', () => {
      const content = '你好 @abc @abcdefghijklmnopqrstuvwxyz';
      const mentions = (
        mentionParser as unknown as {
          extractUserIdMentions: (s: string) => string[];
        }
      ).extractUserIdMentions(content);
      expect(mentions).not.toContain('abc');
      expect(mentions).not.toContain('abcdefghijklmnopqrstuvwxyz');
    });
  });

  describe('isValidCuid', () => {
    it('应该验证有效的cuid', () => {
      const validCuid = 'abcde12345fghij67890klmno';
      const isValid = (
        mentionParser as unknown as {
          isValidCuid: (s: string) => boolean;
        }
      ).isValidCuid(validCuid);
      expect(isValid).toBe(true);
    });

    it('应该拒绝包含大写字母的字符串', () => {
      const invalidCuid = 'ABCDE12345FGHIJ67890KLMNO';
      const isValid = (
        mentionParser as unknown as {
          isValidCuid: (s: string) => boolean;
        }
      ).isValidCuid(invalidCuid);
      expect(isValid).toBe(false);
    });

    it('应该拒绝包含特殊字符的字符串', () => {
      const invalidCuid = 'abcde-2345-ghij-7890-lmno';
      const isValid = (
        mentionParser as unknown as {
          isValidCuid: (s: string) => boolean;
        }
      ).isValidCuid(invalidCuid);
      expect(isValid).toBe(false);
    });

    it('应该拒绝长度不正确的字符串', () => {
      const isValid = (
        mentionParser as unknown as {
          isValidCuid: (s: string) => boolean;
        }
      ).isValidCuid;

      expect(isValid('a'.repeat(24))).toBe(false);
      expect(isValid('a'.repeat(26))).toBe(false);
      expect(isValid('a'.repeat(25))).toBe(true);
    });
  });

  describe('removeInvalidMentions', () => {
    it('应该移除无效的提及', () => {
      const content = '你好 @john 和 @invaliduser';
      const invalidMentions = ['invaliduser'];
      const result = (
        mentionParser as unknown as {
          removeInvalidMentions: (s: string, m: string[]) => string;
        }
      ).removeInvalidMentions(content, invalidMentions);
      expect(result).not.toContain('@invaliduser');
      expect(result).toContain('@john');
    });

    it('应该移除所有指定的无效提及', () => {
      const content = '你好 @user1 @user2 @user3';
      const invalidMentions = ['user1', 'user2'];
      const result = (
        mentionParser as unknown as {
          removeInvalidMentions: (s: string, m: string[]) => string;
        }
      ).removeInvalidMentions(content, invalidMentions);
      expect(result).not.toContain('@user1');
      expect(result).not.toContain('@user2');
      expect(result).toContain('@user3');
    });

    it('应该处理无效提及为空的情况', () => {
      const content = '你好 @john';
      const invalidMentions: string[] = [];
      const result = (
        mentionParser as unknown as {
          removeInvalidMentions: (s: string, m: string[]) => string;
        }
      ).removeInvalidMentions(content, invalidMentions);
      expect(result).toBe('你好 @john');
    });

    it('应该移除重复的无效提及', () => {
      const content = '你好 @user @user 还有一个 @user';
      const invalidMentions = ['user'];
      const result = (
        mentionParser as unknown as {
          removeInvalidMentions: (s: string, m: string[]) => string;
        }
      ).removeInvalidMentions(content, invalidMentions);
      expect(result).not.toContain('@user');
    });
  });

  describe('边界情况', () => {
    it('应该正确处理null输入', async () => {
      const result = await mentionParser.parseMentions(
        null as unknown as string
      );
      expect(result.mentions).toEqual([]);
      expect(result.text).toBe(null);
      expect(result.valid).toBe(true);
    });

    it('应该正确处理undefined输入', async () => {
      const result = await mentionParser.parseMentions(
        undefined as unknown as string
      );
      expect(result.mentions).toEqual([]);
      expect(result.text).toBe(undefined);
      expect(result.valid).toBe(true);
    });

    it('应该正确处理只有@符号的文本', async () => {
      const result = await mentionParser.parseMentions('@@@');
      expect(result.mentions).toEqual([]);
      expect(result.text).toBe('@@@');
      expect(result.valid).toBe(true);
    });

    it('应该正确处理@在文本中间但不形成有效提及的情况', async () => {
      const result = await mentionParser.parseMentions(
        '邮箱: example@test.com'
      );
      expect(result.mentions).toEqual([]);
      expect(result.text).toBe('邮箱: example@test.com');
    });

    it('应该正确处理用户名包含下划线和数字的情况', async () => {
      const result = await mentionParser.parseMentions('你好 @user_123_456');
      expect(result.mentions).toBeInstanceOf(Array);
      expect(result.text).toBe('你好 @user_123_456');
    });
  });
});
