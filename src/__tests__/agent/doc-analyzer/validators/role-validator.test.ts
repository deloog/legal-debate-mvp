/**
 * 角色验证器单元测试
 */

import { RoleValidator } from '@/lib/agent/doc-analyzer/validators/role-validator';
import type { Party, Claim } from '@/lib/agent/doc-analyzer/core/types';

describe('RoleValidator', () => {
  let validator: RoleValidator;

  beforeEach(() => {
    validator = new RoleValidator();
  });

  const mockValidParties: Party[] = [
    { type: 'plaintiff', name: '张三' },
    { type: 'defendant', name: '李四' },
  ];

  const mockValidClaims: Claim[] = [
    {
      type: 'PAY_PRINCIPAL',
      content: '判令被告李四偿还本金100万元',
      amount: 1000000,
      currency: 'CNY',
    },
    {
      type: 'PAY_PRINCIPAL',
      content: '张三起诉李四',
      amount: 1000000,
      currency: 'CNY',
    },
  ];

  describe('validate', () => {
    it('should pass validation for valid roles', () => {
      const result = validator.validate(mockValidParties, mockValidClaims);
      expect(result.passed).toBe(true);
      expect(result.issues.length).toBe(0);
      expect(result.conflicts.length).toBe(0);
    });

    it('should fail when party name is empty', () => {
      const parties: Party[] = [{ type: 'plaintiff', name: '' }];
      const result = validator.validate(parties, mockValidClaims);
      expect(result.passed).toBe(false);
      expect(result.issues.some(i => i.message.includes('姓名为空'))).toBe(
        true
      );
    });

    it('should fail when party name is too short', () => {
      const parties: Party[] = [{ type: 'plaintiff', name: '张' }];
      const result = validator.validate(parties, mockValidClaims);
      expect(result.passed).toBe(false);
      expect(result.issues.some(i => i.message.includes('姓名过短'))).toBe(
        true
      );
    });

    it('should warn when party name is too long', () => {
      const parties: Party[] = [
        { type: 'plaintiff', name: '张' + '三'.repeat(50) },
      ];
      const result = validator.validate(parties, mockValidClaims);
      expect(result.passed).toBe(false);
      expect(result.issues.some(i => i.message.includes('姓名过长'))).toBe(
        true
      );
    });

    it('should warn when party name contains invalid pattern', () => {
      const parties: Party[] = [{ type: 'plaintiff', name: '公司1' }];
      const result = validator.validate(parties, mockValidClaims);
      expect(result.issues.some(i => i.category === '姓名')).toBe(true);
    });

    it('should detect role conflict (same name, different roles)', () => {
      const parties: Party[] = [
        { type: 'plaintiff', name: '张三' },
        { type: 'defendant', name: '张三' },
      ];
      const result = validator.validate(parties, mockValidClaims);
      expect(result.passed).toBe(false);
      expect(result.conflicts.length).toBe(1);
      expect(result.conflicts[0].name).toBe('张三');
      expect(result.conflicts[0].roles).toContain('plaintiff');
      expect(result.conflicts[0].roles).toContain('defendant');
    });

    it('should fail when plaintiff is missing with claims', () => {
      const parties: Party[] = [{ type: 'defendant', name: '李四' }];
      const result = validator.validate(parties, mockValidClaims);
      expect(result.passed).toBe(false);
      expect(result.issues.some(i => i.message.includes('缺少原告'))).toBe(
        true
      );
    });

    it('should fail when defendant is missing with claims', () => {
      const parties: Party[] = [{ type: 'plaintiff', name: '张三' }];
      const result = validator.validate(parties, mockValidClaims);
      expect(result.passed).toBe(false);
      expect(result.issues.some(i => i.message.includes('缺少被告'))).toBe(
        true
      );
    });

    it('should warn when plaintiff count is too high', () => {
      const parties: Party[] = [
        ...Array.from({ length: 11 }, (_, i) => ({
          type: 'plaintiff' as const,
          name: `原告${i + 1}`,
        })),
        { type: 'defendant', name: '李四' },
      ];
      const result = validator.validate(parties, mockValidClaims);
      expect(result.issues.some(i => i.category === '角色完整性')).toBe(true);
      expect(result.issues.some(i => i.message.includes('原告数量过多'))).toBe(
        true
      );
    });

    it('should warn when defendant count is too high', () => {
      const parties: Party[] = [
        { type: 'plaintiff', name: '张三' },
        ...Array.from({ length: 11 }, (_, i) => ({
          type: 'defendant' as const,
          name: `被告${i + 1}`,
        })),
      ];
      const result = validator.validate(parties, mockValidClaims);
      expect(result.issues.some(i => i.category === '角色完整性')).toBe(true);
      expect(result.issues.some(i => i.message.includes('被告数量过多'))).toBe(
        true
      );
    });

    it('should provide suggestions for missing plaintiff', () => {
      const parties: Party[] = [{ type: 'defendant', name: '李四' }];
      const result = validator.validate(parties, mockValidClaims);
      expect(result.suggestions.length).toBeGreaterThan(0);
      expect(result.suggestions.some(s => s.type === 'plaintiff')).toBe(true);
      expect(result.suggestions.some(s => s._inferred)).toBe(true);
    });

    it('should provide suggestions for missing defendant', () => {
      const parties: Party[] = [{ type: 'plaintiff', name: '张三' }];
      const result = validator.validate(parties, mockValidClaims);
      expect(result.suggestions.length).toBeGreaterThan(0);
      expect(result.suggestions.some(s => s.type === 'defendant')).toBe(true);
    });
  });

  describe('hasConflicts', () => {
    it('should return true when conflicts exist', () => {
      const parties: Party[] = [
        { type: 'plaintiff', name: '张三' },
        { type: 'defendant', name: '张三' },
      ];
      expect(validator.hasConflicts(parties)).toBe(true);
    });

    it('should return false when no conflicts exist', () => {
      expect(validator.hasConflicts(mockValidParties)).toBe(false);
    });

    it('should detect conflicts with similar names', () => {
      const parties: Party[] = [
        { type: 'plaintiff', name: '张三 ' },
        { type: 'defendant', name: ' 张三' },
      ];
      expect(validator.hasConflicts(parties)).toBe(true);
    });
  });

  describe('getSuggestions', () => {
    it('should suggest plaintiff when missing', () => {
      const parties: Party[] = [{ type: 'defendant', name: '李四' }];
      const suggestions = validator.getSuggestions(parties, mockValidClaims);
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions[0].type).toBe('plaintiff');
      expect(suggestions[0].role).toBe('推断原告');
    });

    it('should suggest defendant when missing', () => {
      const parties: Party[] = [{ type: 'plaintiff', name: '张三' }];
      const suggestions = validator.getSuggestions(parties, mockValidClaims);
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions[0].type).toBe('defendant');
      expect(suggestions[0].role).toBe('推断被告');
    });

    it('should not suggest when both roles exist', () => {
      const suggestions = validator.getSuggestions(
        mockValidParties,
        mockValidClaims
      );
      expect(suggestions.length).toBe(0);
    });

    it('should infer plaintiff from claims', () => {
      const claims: Claim[] = [
        {
          type: 'PAY_PRINCIPAL',
          content: '张三起诉李四要求偿还本金',
          currency: 'CNY',
        },
      ];
      const parties: Party[] = [{ type: 'defendant', name: '李四' }];
      const suggestions = validator.getSuggestions(parties, claims);
      expect(suggestions.some(s => s.name.includes('张三'))).toBe(true);
    });

    it('should infer defendant from claims', () => {
      const claims: Claim[] = [
        {
          type: 'PAY_PRINCIPAL',
          content: '判令李四偿还本金',
          currency: 'CNY',
        },
      ];
      const parties: Party[] = [{ type: 'plaintiff', name: '张三' }];
      const suggestions = validator.getSuggestions(parties, claims);
      expect(suggestions.some(s => s.name === '李四')).toBe(true);
    });

    it('should not suggest when claims do not contain inference patterns', () => {
      const claims: Claim[] = [
        {
          type: 'PAY_PRINCIPAL',
          content: '请求法院判决',
          currency: 'CNY',
        },
      ];
      const parties: Party[] = [{ type: 'plaintiff', name: '张三' }];
      const suggestions = validator.getSuggestions(parties, claims);
      expect(suggestions.length).toBe(0);
    });
  });
});
