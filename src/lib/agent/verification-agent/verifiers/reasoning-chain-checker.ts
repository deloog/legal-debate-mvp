/**
 * 推理链完整性检查器
 * 检查推理步骤的完整性、连贯性和是否存在循环推理
 */
import { ReasoningChainCheck } from '../types';

/**
 * 待验证数据接口
 */
interface DataToVerify {
  arguments?: string[]; // 论点
  reasoning?: string; // 推理过程
  [key: string]: unknown;
}

/**
 * 推理链检查器类
 */
export class ReasoningChainChecker {
  /**
   * 检查推理链完整性
   */
  async check(data: DataToVerify): Promise<ReasoningChainCheck> {
    const gaps: string[] = [];
    const loops: string[] = [];
    const steps: string[] = [];

    // 从arguments中提取推理步骤
    if (data.arguments) {
      for (let i = 0; i < data.arguments.length; i++) {
        steps.push(`步骤${i + 1}: ${data.arguments[i]}`);
      }
    }

    // 检查推理缺口
    if (steps.length < 2) {
      gaps.push('推理步骤过少，无法形成完整的推理链');
    }

    // 检查逻辑连接词
    if (data.reasoning) {
      const connectors = [
        '因此',
        '所以',
        '由于',
        '基于',
        '综上',
        '由此可见',
        '这意味着',
      ];
      const hasConnector = connectors.some(conn =>
        data.reasoning!.includes(conn)
      );

      if (!hasConnector) {
        gaps.push('缺少逻辑连接词，推理链不连贯');
      }
    }

    // 检查循环推理
    if (data.arguments && data.arguments.length > 1) {
      for (let i = 0; i < data.arguments.length; i++) {
        for (let j = i + 1; j < data.arguments.length; j++) {
          // 检查直接重复
          if (data.arguments[i] === data.arguments[j]) {
            loops.push(`步骤${i + 1}和步骤${j + 1}内容完全相同，存在循环推理`);
            continue;
          }

          // 检查内容相似
          const similarity = this.calculateSimilarity(
            data.arguments[i],
            data.arguments[j]
          );
          if (similarity > 0.8) {
            loops.push(
              `步骤${i + 1}和步骤${j + 1}内容高度相似，可能存在循环推理`
            );
          }

          // 检查是否包含相同的核心结论（如 "因为A所以A" 和 "因此A成立"）
          const keywords1 = this.extractKeywords(data.arguments[i]);
          const keywords2 = this.extractKeywords(data.arguments[j]);

          if (keywords1.length > 0 && keywords2.length > 0) {
            const coreKeywords1 = keywords1.slice(0, 3);
            const coreKeywords2 = keywords2.slice(0, 3);
            const coreOverlap = coreKeywords1.filter(k =>
              coreKeywords2.includes(k)
            );

            if (
              coreOverlap.length >= 2 &&
              coreOverlap.length /
                Math.max(coreKeywords1.length, coreKeywords2.length) >
                0.6
            ) {
              loops.push(
                `步骤${i + 1}和步骤${j + 1}核心论点重复，可能存在循环推理`
              );
            }
          }
        }
      }
    }

    // 计算评分
    let score = 1.0;
    score -= gaps.length * 0.15;
    score -= loops.length * 0.1;
    score = Math.max(0, score);

    return {
      score,
      steps: steps.length,
      gaps,
      loops,
    };
  }

  /**
   * 计算两个文本的相似度
   */
  private calculateSimilarity(text1: string, text2: string): number {
    const words1 = new Set(this.extractKeywords(text1));
    const words2 = new Set(this.extractKeywords(text2));

    if (words1.size === 0 || words2.size === 0) {
      return 0;
    }

    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);

    return intersection.size / union.size;
  }

  /**
   * 提取文本中的关键词
   */
  private extractKeywords(text: string): string[] {
    // 移除停用词和标点
    const stopWords = new Set([
      '的',
      '了',
      '是',
      '在',
      '和',
      '有',
      '我',
      '你',
      '他',
      '她',
      '它',
      '我们',
      '你们',
      '他们',
      '这',
      '那',
      '这个',
      '那个',
    ]);

    const words = text
      .replace(/[，。！？；：""''（）]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 1 && !stopWords.has(word));

    return [...new Set(words)].slice(0, 10); // 最多返回10个关键词
  }

  /**
   * 创建空的推理链结果
   */
  async getEmptyResult(): Promise<ReasoningChainCheck> {
    return {
      score: 1,
      steps: 0,
      gaps: [],
      loops: [],
    };
  }
}
