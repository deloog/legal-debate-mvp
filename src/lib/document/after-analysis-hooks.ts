/**
 * 文档分析完成后的后置钩子
 *
 * 所有钩子均为 fire-and-forget：错误被捕获并记录，不会影响主链路。
 * 调用方只需 `runAfterAnalysisHooks(caseId).catch(noop)` 即可。
 */

import {
  shouldTriggerExtraction,
  runCaseExtraction,
} from '@/lib/case/case-extraction-service';
import { upsertAutoEvidenceDrafts } from '@/lib/evidence/auto-evidence-draft-service';
import { logger } from '@/lib/logger';

/**
 * 文档分析成功完成后触发的异步后置钩子（Promise.allSettled — 互不阻塞）。
 *
 * 1. 案件提炼：满足阈值时自动触发
 * 2. 证据草稿落库：幂等生成并持久化自动证据草稿
 */
export async function runAfterAnalysisHooks(caseId: string): Promise<void> {
  await Promise.allSettled([
    // Hook 1: 满足阈值时触发案件提炼
    shouldTriggerExtraction(caseId)
      .then(meets => {
        if (meets) {
          logger.info(`[after-analysis] 触发案件提炼 [caseId=${caseId}]`);
          return runCaseExtraction(caseId);
        }
        return null;
      })
      .catch(err => {
        logger.warn(`[after-analysis] 案件提炼失败 [caseId=${caseId}]:`, err);
      }),

    // Hook 2: 自动生成并落库证据草稿（幂等，不覆盖人工证据）
    upsertAutoEvidenceDrafts(caseId).catch(err => {
      logger.warn(`[after-analysis] 证据草稿生成失败 [caseId=${caseId}]:`, err);
    }),
  ]);
}
