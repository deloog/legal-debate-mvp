/**
 * 去重处理器
 *
 * 负责数据去重：
 * - 当事人去重
 * - 法定代表人过滤
 * - 诉讼请求去重
 */

import type { Party, Claim, Correction } from "../../core/types";
import { logger } from "../../../../agent/security/logger";

export class DeduplicationHandler {
  /**
   * 去重当事人
   */
  public deduplicateParties(parties: Party[], corrections: Correction[]): void {
    const nameMap = new Map<string, Party>();
    const duplicates: string[] = [];
    const filteredLegalReps: string[] = [];

    parties.forEach((party) => {
      const name = party.name?.trim();
      if (!name) return;

      // 过滤法定代表人（Bad Case 8修复）
      if (this.isLegalRepresentative(name, party.role, parties)) {
        filteredLegalReps.push(name);
        logger.info("过滤法定代表人，不作为独立当事人", {
          name,
          role: party.role,
        });
        return;
      }

      const existing = nameMap.get(name);
      if (existing) {
        duplicates.push(name);
        if (party.role && !existing.role?.includes(party.role)) {
          existing.role = existing.role
            ? `${existing.role}、${party.role}`
            : party.role;
        }
        if (party.contact && !existing.contact) {
          existing.contact = party.contact;
        }
        if (party.address && !existing.address) {
          existing.address = party.address;
        }
        if (
          party.type === "plaintiff" ||
          (party.type === "defendant" && existing.type !== "plaintiff")
        ) {
          existing.type = party.type;
        }
      } else {
        nameMap.set(name, { ...party });
      }
    });

    parties.length = 0;
    parties.push(...Array.from(nameMap.values()));

    // 记录去重和过滤结果
    const reportParts: string[] = [];
    if (duplicates.length > 0) {
      reportParts.push(`去重当事人：${duplicates.join(", ")}`);
    }
    if (filteredLegalReps.length > 0) {
      reportParts.push(`过滤法定代表人：${filteredLegalReps.join(", ")}`);
    }

    if (reportParts.length > 0) {
      corrections.push({
        type: "FIX_ROLE",
        description: reportParts.join("; "),
        rule: "PARTY_DEDUPLICATION_AND_FILTER",
        originalValue: { duplicates, filteredLegalReps },
        correctedValue: parties.length,
      });
    }
  }

  /**
   * 判断是否为法定代表人（Bad Case 8修复）
   */
  private isLegalRepresentative(
    name: string,
    role: string | undefined,
    allParties: Party[],
  ): boolean {
    // 检查角色是否表明是法定代表人
    const legalRepRolePatterns = [
      /法定代表人/,
      /法人代表/,
      /负责人/,
      /董事长/,
      /总经理/,
      /CEO/,
      /经理/,
      /董事/,
      /代表/,
    ];

    if (role && legalRepRolePatterns.some((pattern) => pattern.test(role))) {
      return true;
    }

    // 检查是否有公司实体当事人存在（如"ABC科技有限公司"）
    const companyParties = allParties.filter(
      (p) => p.name !== name && /公司|企业|集团|有限|股份/.test(p.name),
    );

    // 如果有公司当事人，而此人只是个人姓名且角色包含代表信息，很可能是法定代表人
    if (
      companyParties.length > 0 &&
      !/公司|企业|集团|有限|股份/.test(name) &&
      name.length <= 10
    ) {
      return true;
    }

    return false;
  }

  /**
   * 去重诉讼请求
   */
  public deduplicateClaims(claims: Claim[], corrections: Correction[]): void {
    const seen = new Set<string>();
    const unique: Claim[] = [];
    let duplicates = 0;

    claims.forEach((claim) => {
      const key = `${claim.type}_${claim.content}_${claim.amount || "null"}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(claim);
      } else {
        duplicates++;
      }
    });

    claims.length = 0;
    claims.push(...unique);

    if (duplicates > 0) {
      corrections.push({
        type: "FIX_AMOUNT",
        description: `去重诉讼请求：${duplicates}条`,
        rule: "CLAIM_DEDUPLICATION",
      });
    }
  }
}
