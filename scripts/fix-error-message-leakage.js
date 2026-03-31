/**
 * 批量修复 API 路由中的 error.message 泄漏问题
 * 将响应体中的 `(error|err|e) instanceof Error ? \1.message : 'fallback'`
 * 替换为静态 fallback 字符串，跳过 logger.* 行
 */
const fs = require('fs');
const path = require('path');

const files = [
  'src/app/api/admin/alerts/[id]/acknowledge/route.ts',
  'src/app/api/admin/alerts/[id]/resolve/route.ts',
  'src/app/api/admin/alerts/[id]/route.ts',
  'src/app/api/admin/alerts/route.ts',
  'src/app/api/admin/law-articles/import/route.ts',
  'src/app/api/admin/qualifications/[id]/review/route.ts',
  'src/app/api/approval-templates/[id]/route.ts',
  'src/app/api/approval-templates/route.ts',
  'src/app/api/auth/oauth/bind/route.ts',
  'src/app/api/auth/oauth/unbind/[provider]/route.ts',
  'src/app/api/cases/[id]/discussions/route.ts',
  'src/app/api/cases/[id]/risk-assessment/route.ts',
  'src/app/api/cases/[id]/similar/route.ts',
  'src/app/api/cases/[id]/success-rate/route.ts',
  'src/app/api/compliance/checklist/route.ts',
  'src/app/api/compliance/report/route.ts',
  'src/app/api/consultations/calculate-fee/route.ts',
  'src/app/api/contract-templates/[id]/route.ts',
  'src/app/api/contract-templates/route.ts',
  'src/app/api/contracts/[id]/approval/cancel/route.ts',
  'src/app/api/contracts/[id]/approval/route.ts',
  'src/app/api/contracts/[id]/approval/start/route.ts',
  'src/app/api/contracts/[id]/approval/submit/route.ts',
  'src/app/api/contracts/[id]/pdf/route.ts',
  'src/app/api/contracts/[id]/send-email/route.ts',
  'src/app/api/contracts/[id]/versions/compare/route.ts',
  'src/app/api/contracts/[id]/versions/rollback/route.ts',
  'src/app/api/contracts/[id]/versions/route.ts',
  'src/app/api/enterprise/compliance/route.ts',
  'src/app/api/enterprise/contract-clause-risk/route.ts',
  'src/app/api/enterprise/risk-profile/route.ts',
  'src/app/api/evidence/[id]/cross-examination/route.ts',
  'src/app/api/evidence/categories/route.ts',
  'src/app/api/evidence/chain-analysis/route.ts',
  'src/app/api/filing-materials/route.ts',
  'src/app/api/follow-up-tasks/send-reminder/route.ts',
  'src/app/api/follow-up-tasks/send-reminders/route.ts',
  'src/app/api/health/deps/route.ts',
  'src/app/api/health/route.ts',
  'src/app/api/invoices/[id]/route.ts',
  'src/app/api/invoices/apply/route.ts',
  'src/app/api/knowledge-graph/ai-feedback/route.ts',
  'src/app/api/knowledge-graph/experts/[expertId]/route.ts',
  'src/app/api/knowledge-graph/experts/route.ts',
  'src/app/api/knowledge-graph/export/route.ts',
  'src/app/api/knowledge-graph/import/route.ts',
  'src/app/api/knowledge-graph/reasoning/route.ts',
  'src/app/api/memberships/cancel/route.ts',
  'src/app/api/memberships/downgrade/route.ts',
  'src/app/api/memberships/tiers/route.ts',
  'src/app/api/memberships/upgrade/route.ts',
  'src/app/api/qualifications/me/route.ts',
  'src/app/api/qualifications/upload/route.ts',
  'src/app/api/reports/export/route.ts',
  'src/app/api/reports/route.ts',
  'src/app/api/risk-assessment/route.ts',
  'src/app/api/v1/approval-workflow/templates/[id]/route.ts',
  'src/app/api/v1/approval-workflow/templates/route.ts',
  'src/app/api/v1/debates/[id]/stream/route.ts',
  'src/app/api/v1/documents/[id]/route.ts',
  'src/app/api/v1/documents/upload/route.ts',
  'src/app/api/v1/feedbacks/recommendation/route.ts',
  'src/app/api/v1/feedbacks/relation/route.ts',
  'src/app/api/v1/integrations/[id]/route.ts',
  'src/app/api/v1/integrations/route.ts',
  'src/app/api/v1/knowledge-graph/algorithms/[algorithm]/route.ts',
  'src/app/api/v1/knowledge-graph/conflicts/route.ts',
  'src/app/api/v1/knowledge-graph/enterprise-risk-analysis/route.ts',
  'src/app/api/v1/knowledge-graph/export/route.ts',
  'src/app/api/v1/knowledge-graph/neighbors/route.ts',
  'src/app/api/v1/knowledge-graph/paths/route.ts',
  'src/app/api/v1/knowledge-graph/query/route.ts',
  'src/app/api/v1/knowledge-graph/validity-chain/route.ts',
  'src/app/api/v1/law-article-relations/[id]/route.ts',
  'src/app/api/v1/law-articles/[id]/relations/route.ts',
  'src/app/api/v1/legal-references/[id]/feedback/route.ts',
  'src/app/api/v1/memory/migration-history/route.ts',
  'src/app/api/v1/memory/migration-stats/route.ts',
  'src/app/api/witnesses/bulk-action/route.ts',
];

// Matches: varName instanceof Error ? varName.message : 'fallback string'
// Also handles double-quote fallbacks
const PATTERN = /(\w+)\s+instanceof\s+Error\s*\?\s*\1\.message\s*:\s*(['"][^'"]*['"])/g;

const rootDir = path.join(__dirname, '..');
let totalFixed = 0;
let totalFiles = 0;

for (const relPath of files) {
  const fullPath = path.join(rootDir, relPath);
  if (!fs.existsSync(fullPath)) {
    console.warn(`SKIP (not found): ${relPath}`);
    continue;
  }

  const original = fs.readFileSync(fullPath, 'utf8');
  const lines = original.split('\n');
  let fileChanged = false;
  let fixCount = 0;

  const newLines = lines.map((line, idx) => {
    // Skip logger lines — those should show error details
    if (/logger\s*\.\s*(error|warn|info|debug)\s*\(/.test(line)) {
      return line;
    }
    // Only fix lines that are inside a return/response context
    // i.e., lines containing NextResponse or return with error object
    const newLine = line.replace(PATTERN, (match, varName, fallback) => {
      fixCount++;
      return fallback;
    });
    if (newLine !== line) fileChanged = true;
    return newLine;
  });

  if (fileChanged) {
    fs.writeFileSync(fullPath, newLines.join('\n'), 'utf8');
    console.log(`FIXED (${fixCount} replacements): ${relPath}`);
    totalFixed += fixCount;
    totalFiles++;
  } else {
    console.log(`CLEAN (no match): ${relPath}`);
  }
}

console.log(`\nDone. Fixed ${totalFixed} occurrences across ${totalFiles} files.`);
