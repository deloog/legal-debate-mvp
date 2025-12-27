/**
 * 角色验证器 - 验证当事人角色分配的合理性
 * 
 * 核心功能：
 * - 验证原告和被告角色的存在性
 * - 验证角色名称的合理性
 * - 检测角色冲突
 * - 提供角色推断和修正建议
 */

import type {
  Party,
  Claim
} from '../core/types';
import {
  PARTY_ROLE_INDICATORS
} from '../core/constants';

export interface RoleIssue {
  severity: 'ERROR' | 'WARNING';
  category: string;
  message: string;
  suggestion?: string;
}

export interface RoleValidationResult {
  passed: boolean;
  issues: RoleIssue[];
  suggestions: Party[];
  conflicts: Array<{ name: string; roles: string[] }>;
}

/**
 * 检测角色冲突（同一人既是原告又是被告）
 */
function detectRoleConflicts(parties: Party[]): Array<{ name: string; roles: string[] }> {
  const nameMap = new Map<string, string[]>();
  
  parties.forEach(party => {
    const normalizedName = normalizePartyName(party.name);
    if (!nameMap.has(normalizedName)) {
      nameMap.set(normalizedName, []);
    }
    nameMap.get(normalizedName)!.push(party.type);
  });
  
  const conflicts: Array<{ name: string; roles: string[] }> = [];
  
  nameMap.forEach((roles, name) => {
    if (roles.length > 1) {
      conflicts.push({
        name,
        roles: Array.from(new Set(roles))
      });
    }
  });
  
  return conflicts;
}

/**
 * 标准化当事人姓名
 */
function normalizePartyName(name: string): string {
  return name
    .trim()
    .replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, '')
    .toLowerCase();
}

/**
 * 验证角色名称合理性
 */
function validatePartyNames(parties: Party[]): RoleIssue[] {
  const issues: RoleIssue[] = [];
  
  parties.forEach((party, index) => {
    const name = party.name?.trim();
    
    if (!name) {
      issues.push({
        severity: 'ERROR',
        category: '姓名',
        message: `第${index + 1}个当事人姓名为空`
      });
      return;
    }
    
    if (name.length < 2) {
      issues.push({
        severity: 'ERROR',
        category: '姓名',
        message: `第${index + 1}个当事人姓名过短：${name}`
      });
    }
    
    if (name.length > 50) {
      issues.push({
        severity: 'WARNING',
        category: '姓名',
        message: `第${index + 1}个当事人姓名过长：${name}`
      });
    }
    
    const invalidPatterns = [
      /^(原告|被告|第三人|申请人|被申请人)$/,
      /^公司\d*$/,
      /^单位\d*$/,
      /^某[企业公司单位]/,
      /^\d+$/
    ];
    
    if (invalidPatterns.some(pattern => pattern.test(name))) {
      issues.push({
        severity: 'WARNING',
        category: '姓名',
        message: `第${index + 1}个当事人姓名可能不合法：${name}`,
        suggestion: '检查是否为占位符或缺少具体名称'
      });
    }
  });
  
  return issues;
}

/**
 * 验证角色完整性
 */
function validateRoleCompleteness(parties: Party[], claims: Claim[]): RoleIssue[] {
  const issues: RoleIssue[] = [];
  
  const hasPlaintiff = parties.some(p => p.type === 'plaintiff');
  const hasDefendant = parties.some(p => p.type === 'defendant');
  
  if (!hasPlaintiff && claims.length > 0) {
    issues.push({
      severity: 'ERROR',
      category: '角色完整性',
      message: '缺少原告',
      suggestion: '从诉讼请求中推断原告信息'
    });
  }
  
  if (!hasDefendant && claims.length > 0) {
    issues.push({
      severity: 'ERROR',
      category: '角色完整性',
      message: '缺少被告',
      suggestion: '从诉讼请求中推断被告信息'
    });
  }
  
  const plaintiffCount = parties.filter(p => p.type === 'plaintiff').length;
  const defendantCount = parties.filter(p => p.type === 'defendant').length;
  
  if (plaintiffCount > 10) {
    issues.push({
      severity: 'WARNING',
      category: '角色完整性',
      message: `原告数量过多（${plaintiffCount}个）`
    });
  }
  
  if (defendantCount > 10) {
    issues.push({
      severity: 'WARNING',
      category: '角色完整性',
      message: `被告数量过多（${defendantCount}个）`
    });
  }
  
  return issues;
}

/**
 * 从诉讼请求推断缺失的角色
 */
function inferMissingRoles(parties: Party[], claims: Claim[]): Party[] {
  const suggestions: Party[] = [];
  
  const hasPlaintiff = parties.some(p => p.type === 'plaintiff');
  const hasDefendant = parties.some(p => p.type === 'defendant');
  
  if (!hasPlaintiff) {
    const inferredPlaintiff = inferPlaintiff(claims);
    if (inferredPlaintiff) {
      suggestions.push({
        type: 'plaintiff',
        name: inferredPlaintiff,
        role: '推断原告',
        _inferred: true
      });
    }
  }
  
  if (!hasDefendant) {
    const inferredDefendant = inferDefendant(claims);
    if (inferredDefendant) {
      suggestions.push({
        type: 'defendant',
        name: inferredDefendant,
        role: '推断被告',
        _inferred: true
      });
    }
  }
  
  return suggestions;
}

/**
 * 推断原告
 */
function inferPlaintiff(claims: Claim[]): string | null {
  for (const claim of claims) {
    const content = claim.content || '';
    
    const plaintiffPatterns = [
      /(.+?)起诉.+?/,
      /(.+?)诉.+?/,
      /请求.+?判令/
    ];
    
    for (const pattern of plaintiffPatterns) {
      const match = content.match(pattern);
      if (match && match[1] && match[1].length < 20) {
        const name = match[1].trim();
        if (!name.includes('法院') && !name.includes('本院')) {
          return name;
        }
      }
    }
  }
  
  return null;
}

/**
 * 推断被告
 */
function inferDefendant(claims: Claim[]): string | null {
  for (const claim of claims) {
    const content = claim.content || '';
    
    const defendantPatterns = [
      /判令(.+?)偿还/,
      /判令(.+?)支付/,
      /判令(.+?)履行/
    ];
    
    for (const pattern of defendantPatterns) {
      const match = content.match(pattern);
      if (match && match[1] && match[1].length < 20) {
        const name = match[1].trim();
        if (
          !name.includes('公司') ||
          (name.length > 2 && name.length < 30)
        ) {
          return name;
        }
      }
    }
  }
  
  return null;
}

/**
 * 角色验证器类
 */
export class RoleValidator {
  /**
   * 验证角色分配
   */
  public validate(parties: Party[], claims?: Claim[]): RoleValidationResult {
    const issues: RoleIssue[] = [];
    
    issues.push(...validatePartyNames(parties));
    issues.push(...validateRoleCompleteness(parties, claims || []));
    
    const conflicts = detectRoleConflicts(parties);
    
    conflicts.forEach(conflict => {
      issues.push({
        severity: 'ERROR',
        category: '角色冲突',
        message: `${conflict.name}同时担任多个角色：${conflict.roles.join(', ')}`,
        suggestion: '检查是否为同一个人或公司，需要修正'
      });
    });
    
    const suggestions = claims ? inferMissingRoles(parties, claims) : [];
    
    const passed = !issues.some(i => i.severity === 'ERROR');
    
    return {
      passed,
      issues,
      suggestions,
      conflicts
    };
  }
  
  /**
   * 检查是否有角色冲突
   */
  public hasConflicts(parties: Party[]): boolean {
    return detectRoleConflicts(parties).length > 0;
  }
  
  /**
   * 获取角色建议
   */
  public getSuggestions(parties: Party[], claims: Claim[]): Party[] {
    return inferMissingRoles(parties, claims);
  }
}
