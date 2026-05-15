export type ReviewMatchStatus = 'matched' | 'mismatch' | 'missing';

export interface ReviewMatchResult {
  status: ReviewMatchStatus;
  message: string;
}

interface ReviewRecord {
  contentHash: string;
  selectedSections: unknown;
  [key: string]: unknown;
}

interface ResolveArgs {
  latestReview: ReviewRecord | null;
  currentHash: string;
  selectedSections: string[];
  templateVersion: string;
}

function sortedSections(sections: unknown): string {
  if (!Array.isArray(sections)) return '';
  return [...(sections as string[])].sort().join(',');
}

export function resolveReviewMatch(args: ResolveArgs): ReviewMatchResult {
  const { latestReview, currentHash, selectedSections } = args;

  if (!latestReview) {
    return { status: 'missing', message: '待律师复核' };
  }

  // contentHash 已编码 templateVersion（computePackageHash 第三参数），
  // 因此 hash 匹配即隐含 templateVersion 匹配，无需单独比较。
  const hashMatches = latestReview.contentHash === currentHash;
  const sectionsMatch =
    sortedSections(latestReview.selectedSections) ===
    sortedSections(selectedSections);

  if (hashMatches && sectionsMatch) {
    return { status: 'matched', message: '已完成律师复核' };
  }

  return { status: 'mismatch', message: '当前内容已变更，需重新复核' };
}
