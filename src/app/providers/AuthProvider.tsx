'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';

interface User {
  id: string;
  email: string;
  username?: string;
  name?: string;
  role: string;
  avatar?: string;
  createdAt: Date;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  checkAuth: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // 尝试用 refreshToken 续期 accessToken
  const tryRefresh = async (): Promise<boolean> => {
    try {
      const res = await fetch('/api/auth/refresh', {
        method: 'POST',
        credentials: 'include',
        cache: 'no-store',
      });
      return res.ok;
    } catch {
      return false;
    }
  };

  const checkAuth = async () => {
    try {
      setLoading(true);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      let response = await fetch('/api/auth/me', {
        credentials: 'include', // 包含cookie
        cache: 'no-store', // 不缓存，确保获取最新状态
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      // accessToken 过期（401）→ 尝试刷新后重试一次
      if (response.status === 401) {
        const refreshed = await tryRefresh();
        if (refreshed) {
          response = await fetch('/api/auth/me', {
            credentials: 'include',
            cache: 'no-store',
          });
        }
      }

      // 检查HTTP状态码
      if (!response.ok) {
        setUser(null);
        sessionStorage.removeItem('user');
        return;
      }

      // 检查响应是否为JSON
      const contentType = response.headers.get('content-type');
      if (!contentType?.includes('application/json')) {
        setUser(null);
        sessionStorage.removeItem('user');
        return;
      }

      const result = await response.json();

      if (result.success && result.data?.user) {
        setUser(result.data.user);
        // 同时更新sessionStorage以保持向后兼容
        sessionStorage.setItem('user', JSON.stringify(result.data.user));
      } else {
        setUser(null);
        sessionStorage.removeItem('user');
      }
    } catch {
      setUser(null);
      sessionStorage.removeItem('user');
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });
    } catch {
      // 登出失败时仍清理本地状态
    } finally {
      setUser(null);
      sessionStorage.removeItem('user');
      router.push('/');
    }
  };

  useEffect(() => {
    // 全局 fetch 拦截：401 → 先尝试刷新，失败则清理状态跳转登录
    const originalFetch = window.fetch.bind(window);
    let isRefreshing = false;

    window.fetch = async (...args) => {
      const response = await originalFetch(...args);

      // 只处理 API 路由的 401（排除 auth 端点自身，避免死循环）
      const url =
        typeof args[0] === 'string' ? args[0] : (args[0] as Request).url;
      const isAuthEndpoint = url.includes('/api/auth/');

      if (response.status === 401 && !isAuthEndpoint && !isRefreshing) {
        isRefreshing = true;
        try {
          const refreshed = await tryRefresh();
          if (refreshed) {
            // 使用原始 fetch 重试，避免再次触发拦截
            isRefreshing = false;
            return originalFetch(...args);
          }
        } finally {
          isRefreshing = false;
        }
        // 刷新失败 → 清理状态，跳转登录
        setUser(null);
        sessionStorage.removeItem('user');
        const currentPath = window.location.pathname;
        if (currentPath !== '/login') {
          router.push('/login?redirect=' + encodeURIComponent(currentPath));
        }
      }

      return response;
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, [router]);

  useEffect(() => {
    // 初始化时检查认证状态
    checkAuth();

    // 监听自定义事件，用于跨标签页同步登录状态
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === 'user') {
        if (event.newValue) {
          try {
            setUser(JSON.parse(event.newValue));
          } catch {
            setUser(null);
          }
        } else {
          setUser(null);
        }
      }
    };

    // 监听登录成功事件
    const handleLoginSuccess = () => {
      // 延迟一点时间，确保cookie已经设置
      setTimeout(() => {
        checkAuth();
      }, 100);
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('login-success', handleLoginSuccess);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('login-success', handleLoginSuccess);
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, checkAuth, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth必须在AuthProvider内部使用');
  }
  return context;
}
