/**
 * 实体提取模块（Entity Extraction）
 * 包含：extract_entities
 */

import type { EntityExtractionResult } from './types';

/**
 * 3. extract_entities - 实体提取
 * 从文本中提取实体（人名、日期、金额等）
 */
export async function extract_entities(
  text: string,
  entityTypes: string[]
): Promise<EntityExtractionResult> {
  const entities: Array<{
    text: string;
    type: string;
    confidence: number;
    startIndex: number;
    endIndex: number;
  }> = [];

  const allPatterns = getAllPatterns();
  const selectedPatterns =
    entityTypes.length > 0
      ? allPatterns.filter(p => entityTypes.includes(p.type))
      : allPatterns;

  for (const pattern of selectedPatterns) {
    const regex = new RegExp(pattern.regex, 'g');
    let match;
    while ((match = regex.exec(text)) !== null) {
      entities.push({
        text: match[0],
        type: pattern.type,
        confidence: pattern.confidence,
        startIndex: match.index,
        endIndex: match.index + match[0].length,
      });
    }
  }

  const entitiesByType: Record<
    string,
    Array<{
      text: string;
      type: string;
      confidence: number;
      startIndex: number;
      endIndex: number;
    }>
  > = {};
  for (const entity of entities) {
    if (!entitiesByType[entity.type]) {
      entitiesByType[entity.type] = [];
    }
    entitiesByType[entity.type].push(entity);
  }

  return {
    entities,
    totalEntities: entities.length,
    entitiesByType,
  };
}

/**
 * getAllPatterns - 获取所有实体提取模式
 */
function getAllPatterns(): Array<{
  type: string;
  regex: string;
  confidence: number;
}> {
  return [
    {
      type: 'PERSON',
      regex: '[一-龥]{2,4}(先生|女士|先生|女士)?',
      confidence: 0.8,
    },
    {
      type: 'DATE',
      regex:
        '\\d{4}[年/-]\\d{1,2}[月/-]\\d{1,2}[日]?(\\s*\\d{1,2}[:：]\\d{1,2})?',
      confidence: 0.95,
    },
    {
      type: 'AMOUNT',
      regex: '\\d+(\\.\\d+)?(万|千|百|十|元|人民币|美元|港元|欧元|日元)',
      confidence: 0.9,
    },
    {
      type: 'PHONE',
      regex: '1[3-9]\\d{9}',
      confidence: 0.9,
    },
    {
      type: 'ID_CARD',
      regex: '\\d{15}|\\d{18}|\\d{17}[Xx]',
      confidence: 0.95,
    },
    {
      type: 'EMAIL',
      regex: '[\\w.-]+@[\\w.-]+\\.[a-zA-Z]{2,}',
      confidence: 0.95,
    },
  ];
}
