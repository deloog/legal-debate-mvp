/**
 * 首页 - 内部系统工作台
 *
 * 根据FRONTEND_BACKEND_GAP_ANALYSIS.md分析结果，首页已重新设计为内部系统工作台：
 * - 移除营销内容（hero、testimonials、CTA）
 * - 移除不存在的功能（律师智能匹配等）
 * - 添加知识图谱统计和快速操作入口
 * - 显示系统状态和数据同步进度
 */

import InternalHomepage from './internal-homepage';

export default function Home() {
  return <InternalHomepage />;
}
