'use client';

/**
 * 用户模式上下文
 *
 * 管理用户在 律师模式 和 企业法务模式 之间的切换
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from 'react';
import { flushSync } from 'react-dom';

// =============================================================================
// 类型定义
// =============================================================================

export type UserMode = 'lawyer' | 'enterprise';

export interface UserModeConfig {
  mode: UserMode;
  title: string;
  description: string;
  features: {
    id: string;
    name: string;
    icon: string;
    href: string;
    description: string;
  }[];
  quickActions: {
    id: string;
    label: string;
    href: string;
    icon: string;
  }[];
}

interface UserModeContextValue {
  mode: UserMode;
  setMode: (mode: UserMode) => void;
  config: UserModeConfig;
  isLawyerMode: boolean;
  isEnterpriseMode: boolean;
}

// =============================================================================
// 模式配置
// =============================================================================

const lawyerModeConfig: UserModeConfig = {
  mode: 'lawyer',
  title: '律师工作台',
  description: '专为执业律师打造的智能工作平台',
  features: [
    {
      id: 'cases',
      name: '案件管理',
      icon: 'briefcase',
      href: '/cases',
      description: '全面管理您的案件，追踪进度，维护卷宗',
    },
    {
      id: 'clients',
      name: '客户管理',
      icon: 'users',
      href: '/clients',
      description: '维护客户关系，记录沟通，管理跟进任务',
    },
    {
      id: 'debates',
      name: 'AI 辩论分析',
      icon: 'scale',
      href: '/debates',
      description: '智能分析案件争议点，生成辩论策略建议',
    },
    {
      id: 'documents',
      name: '文书模板',
      icon: 'document',
      href: '/document-templates',
      description: '快速生成法律文书，提高文档处理效率',
    },
    {
      id: 'court-schedule',
      name: '开庭日程',
      icon: 'calendar',
      href: '/court-schedule',
      description: '管理开庭安排，设置提醒，不错过任何日期',
    },
    {
      id: 'teams',
      name: '团队协作',
      icon: 'team',
      href: '/teams',
      description: '与团队成员协作处理案件，共享资源',
    },
  ],
  quickActions: [
    { id: 'new-case', label: '创建新案件', href: '/cases/new', icon: 'plus' },
    {
      id: 'new-client',
      label: '添加客户',
      href: '/clients/new',
      icon: 'user-add',
    },
    {
      id: 'new-debate',
      label: '发起辩论',
      href: '/debates/new',
      icon: 'scale',
    },
    {
      id: 'calendar',
      label: '查看日程',
      href: '/court-schedule',
      icon: 'calendar',
    },
  ],
};

const enterpriseModeConfig: UserModeConfig = {
  mode: 'enterprise',
  title: '企业法务工作台',
  description: '专为企业法务团队打造的合规管理平台',
  features: [
    {
      id: 'contracts',
      name: '合同管理',
      icon: 'document-text',
      href: '/contracts',
      description: '统一管理企业合同，追踪履行状态，预警到期',
    },
    {
      id: 'compliance',
      name: '合规审查',
      icon: 'shield-check',
      href: '/compliance',
      description: '企业合规自检，法规更新追踪，风险预警',
    },
    {
      id: 'disputes',
      name: '纠纷处理',
      icon: 'scale',
      href: '/disputes',
      description: '管理企业涉诉案件，协调内外部资源',
    },
    {
      id: 'legal-opinions',
      name: '法律意见',
      icon: 'annotation',
      href: '/legal-opinions',
      description: '内部法律咨询记录，意见存档与检索',
    },
    {
      id: 'training',
      name: '合规培训',
      icon: 'academic-cap',
      href: '/training',
      description: '法务知识库，员工合规培训管理',
    },
    {
      id: 'reports',
      name: '法务报告',
      icon: 'chart-bar',
      href: '/reports',
      description: '生成法务工作报告，数据分析与展示',
    },
  ],
  quickActions: [
    {
      id: 'new-contract',
      label: '新建合同',
      href: '/contracts/new',
      icon: 'plus',
    },
    {
      id: 'compliance-check',
      label: '合规自检',
      href: '/compliance/check',
      icon: 'shield',
    },
    {
      id: 'legal-consult',
      label: '法律咨询',
      href: '/legal-opinions/new',
      icon: 'chat',
    },
    { id: 'view-reports', label: '查看报告', href: '/reports', icon: 'chart' },
  ],
};

// =============================================================================
// Context 实现
// =============================================================================

const UserModeContext = createContext<UserModeContextValue | undefined>(
  undefined
);

const STORAGE_KEY = 'legal-debate-user-mode';

export function UserModeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<UserMode>('lawyer');

  // 从本地存储恢复模式
  useEffect(() => {
    const savedMode = localStorage.getItem(STORAGE_KEY);
    if (savedMode === 'lawyer' || savedMode === 'enterprise') {
      flushSync(() => setModeState(savedMode));
    }
  }, []);

  // 设置模式并保存
  const setMode = useCallback((newMode: UserMode) => {
    setModeState(newMode);
    localStorage.setItem(STORAGE_KEY, newMode);
  }, []);

  const config = mode === 'lawyer' ? lawyerModeConfig : enterpriseModeConfig;

  const value: UserModeContextValue = {
    mode,
    setMode,
    config,
    isLawyerMode: mode === 'lawyer',
    isEnterpriseMode: mode === 'enterprise',
  };

  return (
    <UserModeContext.Provider value={value}>
      {children}
    </UserModeContext.Provider>
  );
}

// =============================================================================
// Hook
// =============================================================================

export function useUserMode(): UserModeContextValue {
  const context = useContext(UserModeContext);
  if (!context) {
    throw new Error('useUserMode must be used within a UserModeProvider');
  }
  return context;
}

// =============================================================================
// 导出配置
// =============================================================================

export { lawyerModeConfig, enterpriseModeConfig };
