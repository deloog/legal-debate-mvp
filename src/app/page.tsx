/**
 * 首页 - 动态角色首页
 * 功能：根据用户角色展示不同的首页内容
 */

'use client';

import { useEffect, useState } from 'react';
import { DynamicHomepage } from '@/components/homepage/DynamicHomepage';
import { getHomepageConfig } from '@/config/homepage-config';
import { detectUserRole, HomepageRole } from '@/lib/user/role-detector';
import { useAuth } from '@/app/providers/AuthProvider';
import type { HomepageConfig } from '@/config/homepage-config';

export default function Home() {
  const { user, loading } = useAuth();
  const [config, setConfig] = useState<HomepageConfig | null>(null);

  useEffect(() => {
    // 如果正在加载，不做任何操作
    if (loading) {
      return;
    }

    // 检测用户角色
    let role: HomepageRole;

    if (!user) {
      // 未登录用户：显示普通用户版首页
      role = HomepageRole.GENERAL;
    } else {
      // 已登录用户：根据认证状态检测角色
      role = detectUserRole(user);
    }

    // 获取对应角色的配置
    const homepageConfig = getHomepageConfig(role);
    setConfig(homepageConfig);
  }, [user, loading]);

  // 加载状态
  if (loading) {
    return (
      <div className='flex min-h-screen items-center justify-center bg-white'>
        <div className='text-center'>
          <div className='mb-4 inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent'></div>
          <p className='text-sm text-gray-600'>加载中...</p>
        </div>
      </div>
    );
  }

  // 配置未加载完成
  if (!config) {
    return (
      <div className='flex min-h-screen items-center justify-center bg-white'>
        <div className='text-center'>
          <div className='mb-4 inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent'></div>
          <p className='text-sm text-gray-600'>正在准备页面...</p>
        </div>
      </div>
    );
  }

  // 渲染动态首页
  return <DynamicHomepage config={config} />;
}
