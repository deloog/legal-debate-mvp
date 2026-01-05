// Agent初始化 - 注册所有Agent到AgentRegistry

import { agentRegistry } from "./registry";
import { DocAnalyzerAgent } from "./doc-analyzer/doc-analyzer-agent";

/**
 * 初始化并注册所有Agent
 */
export async function initAgents(): Promise<void> {
  try {
    // 注册DocAnalyzer Agent
    try {
      const docAnalyzerAgent = new DocAnalyzerAgent();
      docAnalyzerAgent.initialize();
      agentRegistry.registerAgent(docAnalyzerAgent, "system-init");
    } catch (error) {
      console.warn("DocAnalyzer Agent初始化失败:", error);
    }

    // 输出注册统计信息
    const stats = agentRegistry.getStatistics();
    console.log("Agent初始化完成:", {
      总数: stats.totalAgents,
      活跃: stats.activeAgents,
      禁用: stats.disabledAgents,
      按类型: stats.agentsByType,
    });

    // 执行健康检查
    const healthResults = await agentRegistry.performHealthCheck();
    console.log("Agent健康检查结果:", healthResults);
  } catch (error) {
    console.error("Agent初始化失败:", error);
    throw error;
  }
}

/**
 * 获取已注册的DocAnalyzer Agent
 */
export function getDocAnalyzerAgent(): DocAnalyzerAgent {
  const agent = agentRegistry.getAgent("docAnalyzer");
  if (!agent) {
    throw new Error("DocAnalyzer Agent未注册");
  }
  return agent as DocAnalyzerAgent;
}

/**
 * 清理所有Agent
 */
export async function cleanupAgents(): Promise<void> {
  try {
    const agents = agentRegistry.getAllAgents();

    for (const agent of agents) {
      try {
        if (agent.cleanup) {
          await agent.cleanup();
        }
      } catch (error) {
        console.error(`清理Agent '${agent.name}'失败:`, error);
      }
    }

    // 清空注册表
    agentRegistry.clear();
    console.log("Agent清理完成");
  } catch (error) {
    console.error("Agent清理失败:", error);
    throw error;
  }
}
