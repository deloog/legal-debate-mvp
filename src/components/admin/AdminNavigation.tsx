'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  FileText,
  ShieldAlert,
  Download,
  Users,
  Scale,
  Briefcase,
  CreditCard,
  ScrollText,
  FileCheck,
  Settings,
  Activity,
  Brain,
} from 'lucide-react';

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const navigation: NavSection[] = [
  {
    title: '管理',
    items: [
      {
        label: '用户管理',
        href: '/admin/users',
        icon: <Users className='h-5 w-5' />,
      },
      {
        label: '案件管理',
        href: '/admin/cases',
        icon: <Scale className='h-5 w-5' />,
      },
      {
        label: '会员管理',
        href: '/admin/memberships',
        icon: <CreditCard className='h-5 w-5' />,
      },
      {
        label: '订单管理',
        href: '/admin/orders',
        icon: <Briefcase className='h-5 w-5' />,
      },
    ],
  },
  {
    title: '系统',
    items: [
      {
        label: 'Dashboard',
        href: '/dashboard',
        icon: <LayoutDashboard className='h-5 w-5' />,
      },
      {
        label: '数据导出',
        href: '/admin/export',
        icon: <Download className='h-5 w-5' />,
      },
      {
        label: '告警监控',
        href: '/admin/alerts',
        icon: <ShieldAlert className='h-5 w-5' />,
      },
      {
        label: '系统日志',
        href: '/admin/logs',
        icon: <ScrollText className='h-5 w-5' />,
      },
      {
        label: 'Agent 监控',
        href: '/admin/agent-monitor',
        icon: <Activity className='h-5 w-5' />,
      },
      {
        label: '记忆管理',
        href: '/admin/memories',
        icon: <Brain className='h-5 w-5' />,
      },
    ],
  },
  {
    title: '配置',
    items: [
      {
        label: '系统配置',
        href: '/admin/configs',
        icon: <Settings className='h-5 w-5' />,
      },
      {
        label: '法条管理',
        href: '/admin/law-articles',
        icon: <FileText className='h-5 w-5' />,
      },
      {
        label: '报告管理',
        href: '/admin/reports',
        icon: <FileCheck className='h-5 w-5' />,
      },
      {
        label: '企业认证',
        href: '/admin/enterprise',
        icon: <Briefcase className='h-5 w-5' />,
      },
      {
        label: '资质审核',
        href: '/admin/qualifications',
        icon: <FileCheck className='h-5 w-5' />,
      },
      {
        label: '角色管理',
        href: '/admin/roles',
        icon: <Users className='h-5 w-5' />,
      },
    ],
  },
];

export function AdminNavigation(): React.ReactElement {
  const pathname = usePathname();

  const isActive = (href: string): boolean => {
    if (href === pathname) {
      return true;
    }
    if (href !== '/' && pathname.startsWith(href + '/')) {
      return true;
    }
    return false;
  };

  return (
    <nav className='space-y-6'>
      {navigation.map(section => (
        <div key={section.title}>
          <h3 className='px-3 mb-2 text-xs font-semibold text-gray-500 uppercase tracking-wider'>
            {section.title}
          </h3>
          <ul className='space-y-1'>
            {section.items.map(item => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    isActive(item.href)
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}
