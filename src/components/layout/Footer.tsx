import Link from 'next/link';
import { Scale } from 'lucide-react';

/**
 * 网站底部导航组件
 * 4列布局：品牌介绍 / 功能 / 支持 / 关于
 */
export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className='border-t border-zinc-200 bg-white mt-auto'>
      <div className='mx-auto max-w-7xl px-6 py-10'>
        {/* 4列导航区域 */}
        <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-8'>
          {/* 列1：品牌介绍 */}
          <div>
            <div className='flex items-center gap-2 mb-3'>
              <Scale className='h-5 w-5 text-blue-600' />
              <span className='font-semibold text-zinc-900'>律伴AI助手</span>
            </div>
            <p className='text-sm text-zinc-500 leading-relaxed'>
              基于人工智能的法律辩论与文书分析平台，为法律从业者提供专业支持。AI
              分析结果仅供参考，不构成正式法律意见。
            </p>
          </div>

          {/* 列2：功能 */}
          <div>
            <h4 className='text-sm font-semibold text-zinc-700 mb-3'>功能</h4>
            <ul className='space-y-2 text-sm text-zinc-500'>
              <li>
                <Link
                  href='/law-articles'
                  className='hover:text-blue-600 transition-colors'
                >
                  法条检索
                </Link>
              </li>
              <li>
                <Link
                  href='/cases'
                  className='hover:text-blue-600 transition-colors'
                >
                  案件管理
                </Link>
              </li>
              <li>
                <Link
                  href='/debates'
                  className='hover:text-blue-600 transition-colors'
                >
                  法律辩论
                </Link>
              </li>
              <li>
                <Link
                  href='/contracts'
                  className='hover:text-blue-600 transition-colors'
                >
                  合同管理
                </Link>
              </li>
            </ul>
          </div>

          {/* 列3：支持 */}
          <div>
            <h4 className='text-sm font-semibold text-zinc-700 mb-3'>支持</h4>
            <ul className='space-y-2 text-sm text-zinc-500'>
              <li>
                <Link
                  href='/dashboard'
                  className='hover:text-blue-600 transition-colors'
                >
                  工作台
                </Link>
              </li>
              <li>
                <Link
                  href='/consultations'
                  className='hover:text-blue-600 transition-colors'
                >
                  法律咨询
                </Link>
              </li>
              <li>
                <Link
                  href='/documents'
                  className='hover:text-blue-600 transition-colors'
                >
                  文书管理
                </Link>
              </li>
            </ul>
          </div>

          {/* 列4：关于 */}
          <div>
            <h4 className='text-sm font-semibold text-zinc-700 mb-3'>关于</h4>
            <ul className='space-y-2 text-sm text-zinc-500'>
              <li>
                <Link
                  href='/about'
                  className='hover:text-blue-600 transition-colors'
                >
                  关于我们
                </Link>
              </li>
              <li>
                <Link
                  href='/help'
                  className='hover:text-blue-600 transition-colors'
                >
                  帮助中心
                </Link>
              </li>
              <li>
                <Link
                  href='/terms'
                  className='hover:text-blue-600 transition-colors'
                >
                  服务条款
                </Link>
              </li>
              <li>
                <Link
                  href='/privacy'
                  className='hover:text-blue-600 transition-colors'
                >
                  隐私政策
                </Link>
              </li>
              <li>
                <a
                  href='mailto:support@luban-ai.com'
                  className='hover:text-blue-600 transition-colors'
                >
                  联系我们
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* 底部版权栏 */}
        <div className='border-t border-zinc-100 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-zinc-400'>
          {/* 左侧：版权信息 */}
          <span>© {year} 律伴AI助手 保留所有权利</span>

          {/* 右侧：法律链接 */}
          <div className='flex items-center gap-1'>
            <Link
              href='/terms'
              className='hover:text-blue-600 transition-colors'
            >
              服务条款
            </Link>
            <span className='mx-1'>·</span>
            <Link
              href='/privacy'
              className='hover:text-blue-600 transition-colors'
            >
              隐私政策
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
