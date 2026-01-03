/**
 * 数据排序模块（Data Rank）
 * 包含：rank_items
 */

import type { RankItemsResult } from "./types";

/**
 * 15. rank_items - 项目排序
 * 根据评分函数对项目排序
 */
export async function rank_items<T>(
  params:
    | T[]
    | { items: T[]; scoreFn: (item: T) => number; order?: "asc" | "desc" },
  scoreFn?: (item: T) => number,
  order: "asc" | "desc" = "desc",
): Promise<RankItemsResult<T>> {
  let itemsArr: T[];
  let score: (item: T) => number;
  let ord: "asc" | "desc" = "desc";

  if (Array.isArray(params)) {
    itemsArr = params;
    score = scoreFn!;
    ord = order;
  } else {
    itemsArr = params.items;
    score = params.scoreFn;
    ord = params.order || "desc";
  }

  const scores = itemsArr.map(score);
  const minScore = Math.min(...scores);
  const maxScore = Math.max(...scores);

  const indexed = itemsArr.map((item, index) => ({
    item,
    score: scores[index],
  }));

  indexed.sort((a, b) => {
    const diff = a.score - b.score;
    return ord === "asc" ? diff : -diff;
  });

  const ranked = indexed.map(({ item }) => item);
  const sortedScores = indexed.map(({ score }) => score);

  return {
    ranked,
    scores: sortedScores,
    minScore,
    maxScore,
  };
}
