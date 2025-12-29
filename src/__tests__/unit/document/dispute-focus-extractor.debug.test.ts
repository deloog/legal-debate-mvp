/**
 * 争议焦点提取器调试测试
 * 用于快速验证规则匹配功能
 */

import { describe, it, expect } from "@jest/globals";
import {
  DisputeFocusExtractor,
  createDisputeFocusExtractor,
} from "@/lib/agent/doc-analyzer/extractors/dispute-focus";

const SIMPLE_TEXT = `
原告认为被告已构成违约，应当承担违约责任。
被告辩称已按照合同约定履行义务，不存在违约行为。
双方争议：被告是否违反合同约定。
`;

describe("DisputeFocusExtractor Debug", () => {
  it("规则匹配应该能找到违约争议", async () => {
    const extractor = createDisputeFocusExtractor();

    // 禁用AI层，只测试规则匹配
    const result = await extractor.extractFromText(SIMPLE_TEXT, undefined, {
      useAIExtraction: false,
      useAIMatching: false,
    });

    console.log("提取到的争议焦点数量:", result.disputeFocuses.length);
    console.log("争议焦点:", JSON.stringify(result.disputeFocuses, null, 2));

    expect(result.disputeFocuses).toBeDefined();
    expect(result.disputeFocuses.length).toBeGreaterThan(0);

    // 应该找到CONTRACT_BREACH类别的争议
    const hasContractBreach = result.disputeFocuses.some(
      (f) => f.category === "CONTRACT_BREACH",
    );
    expect(hasContractBreach).toBe(true);
  });

  it("规则匹配应该能找到支付争议", async () => {
    const text = `
原告认为应支付本金100万元。
被告认为本金数额为80万元，而非100万元。
双方争议：支付本金数额。
`;

    const extractor = createDisputeFocusExtractor();
    const result = await extractor.extractFromText(text, undefined, {
      useAIExtraction: false,
      useAIMatching: false,
    });

    console.log("提取到的争议焦点数量:", result.disputeFocuses.length);
    console.log("争议焦点:", JSON.stringify(result.disputeFocuses, null, 2));

    expect(result.disputeFocuses).toBeDefined();
    expect(result.disputeFocuses.length).toBeGreaterThan(0);

    // 应该找到PAYMENT_DISPUTE类别的争议
    const hasPaymentDispute = result.disputeFocuses.some(
      (f) => f.category === "PAYMENT_DISPUTE",
    );
    expect(hasPaymentDispute).toBe(true);
  });

  it("规则匹配应该能找到责任争议", async () => {
    const text = `
原告认为被告应承担全部违约责任。
被告认为不应承担或减轻责任。
双方争议：违约责任承担方式。
`;

    const extractor = createDisputeFocusExtractor();
    const result = await extractor.extractFromText(text, undefined, {
      useAIExtraction: false,
      useAIMatching: false,
    });

    console.log("提取到的争议焦点数量:", result.disputeFocuses.length);
    console.log("争议焦点:", JSON.stringify(result.disputeFocuses, null, 2));

    expect(result.disputeFocuses).toBeDefined();
    expect(result.disputeFocuses.length).toBeGreaterThan(0);

    // 应该找到LIABILITY_ISSUE类别的争议
    const hasLiabilityIssue = result.disputeFocuses.some(
      (f) => f.category === "LIABILITY_ISSUE",
    );
    expect(hasLiabilityIssue).toBe(true);
  });
});
