/**
 * 权限装饰器
 * 用于类和方法级别的权限控制
 */

import type { NextRequest } from 'next/server';
import type { PermissionCheckOptions } from '../middleware/permission-check';
import {
  checkPermissions,
  PermissionCheckMode,
} from '../middleware/permission-check';
import type { PermissionCheckResult } from '@/types/permission';

// =============================================================================
// 权限装饰器选项
// =============================================================================

/**
 * 权限装饰器配置
 */
export interface RequirePermissionDecoratorOptions extends PermissionCheckOptions {
  skip?: boolean; // 跳过权限检查（用于开发/测试）
}

// =============================================================================
// 方法装饰器
// =============================================================================

/**
 * 方法权限装饰器
 * @param permissions 需要的权限列表
 * @param options 装饰器选项
 * @returns 方法装饰器
 */
export function RequirePermission(
  permissions: string | string[],
  options: RequirePermissionDecoratorOptions = {}
): MethodDecorator {
  return function (
    _target: unknown,
    _propertyKey: string | symbol,
    descriptor: PropertyDescriptor
  ): PropertyDescriptor {
    // 防御性编程：如果 descriptor 不存在，直接返回
    if (!descriptor || !descriptor.value) {
      return descriptor;
    }

    const originalMethod = descriptor.value;

    // 包装原方法
    descriptor.value = async function (...args: unknown[]): Promise<unknown> {
      if (options.skip === true) {
        return originalMethod.apply(this, args);
      }

      const request = args[0] as NextRequest;
      const userId = getUserIdFromArgs(args);

      if (!request || !userId) {
        throw createPermissionError('未认证', '请先登录', 'user:login');
      }

      const permissionList = Array.isArray(permissions)
        ? permissions
        : [permissions];
      const result = await checkPermissions(userId, permissionList, options);

      if (!result.hasPermission) {
        throw createPermissionError(
          result.reason ?? '权限不足',
          '您没有执行此操作的权限',
          result.requiredPermission ?? permissionList.join(',')
        );
      }

      return originalMethod.apply(this, args);
    };

    return descriptor;
  };
}

/**
 * 任意权限装饰器（满足任意一个权限即可）
 * @param permissions 需要的权限列表
 * @param options 装饰器选项
 * @returns 方法装饰器
 */
export function RequireAnyPermission(
  permissions: string[],
  options: RequirePermissionDecoratorOptions = {}
): MethodDecorator {
  return RequirePermission(permissions, {
    ...options,
    mode: PermissionCheckMode.ANY,
  });
}

/**
 * 所有权限装饰器（必须拥有所有权限）
 * @param permissions 需要的权限列表
 * @param options 装饰器选项
 * @returns 方法装饰器
 */
export function RequireAllPermissions(
  permissions: string[],
  options: RequirePermissionDecoratorOptions = {}
): MethodDecorator {
  return RequirePermission(permissions, {
    ...options,
    mode: PermissionCheckMode.ALL,
  });
}

// =============================================================================
// 辅助函数
// =============================================================================

/**
 * 从方法参数中提取用户ID
 * @param args 方法参数
 * @returns 用户ID或null
 */
function getUserIdFromArgs(args: unknown[]): string | null {
  if (args.length > 1 && typeof args[1] === 'string') {
    return args[1] as string;
  }

  if (args.length > 0) {
    const request = args[0] as NextRequest;
    // 防御性检查：确保 request 和 headers 存在
    if (request && request.headers) {
      return request.headers.get('x-user-id');
    }
  }

  return null;
}

/**
 * 创建权限错误
 * @param error 错误名称
 * @param message 错误消息
 * @param requiredPermission 需要的权限
 * @returns 权限错误对象
 */
function createPermissionError(
  _error: string,
  message: string,
  requiredPermission?: string
): Error {
  const permissionError = new Error(message) as Error & {
    statusCode: number;
    code: string;
    requiredPermission?: string;
  };

  permissionError.statusCode = 403;
  permissionError.code = 'PERMISSION_DENIED';
  permissionError.requiredPermission = requiredPermission;

  return permissionError;
}

// =============================================================================
// 权限检查器类
// =============================================================================

/**
 * 权限检查器
 * 提供链式API进行权限检查
 */
export class PermissionChecker {
  private permissionList: string[] = [];
  private checkMode: PermissionCheckMode = PermissionCheckMode.ALL;
  private skip = false;

  /**
   * 添加权限
   * @param permission 权限名称
   * @returns PermissionChecker实例
   */
  public permission(permission: string): this {
    this.permissionList.push(permission);
    return this;
  }

  /**
   * 添加多个权限
   * @param perms 权限列表
   * @returns PermissionChecker实例
   */
  public addPermissions(perms: string[]): this {
    this.permissionList.push(...perms);
    return this;
  }

  /**
   * 设置检查模式为any
   * @returns PermissionChecker实例
   */
  public any(): this {
    this.checkMode = PermissionCheckMode.ANY;
    return this;
  }

  /**
   * 设置检查模式为all
   * @returns PermissionChecker实例
   */
  public all(): this {
    this.checkMode = PermissionCheckMode.ALL;
    return this;
  }

  /**
   * 跳过权限检查
   * @returns PermissionChecker实例
   */
  public skipCheck(): this {
    this.skip = true;
    return this;
  }

  /**
   * 执行权限检查
   * @param userId 用户ID
   * @returns 检查结果
   */
  public async check(userId: string): Promise<PermissionCheckResult> {
    if (this.skip || this.permissionList.length === 0) {
      return {
        hasPermission: true,
      };
    }

    return checkPermissions(userId, this.permissionList, {
      mode: this.checkMode,
    });
  }

  /**
   * 创建方法装饰器
   * @returns 方法装饰器
   */
  public asDecorator(): MethodDecorator {
    return RequirePermission(this.permissionList, {
      mode: this.checkMode,
      skip: this.skip,
    });
  }
}

// =============================================================================
// 工厂函数
// =============================================================================

/**
 * 创建权限检查器
 * @param perms 初始权限列表
 * @returns PermissionChecker实例
 */
export function createPermissionChecker(perms?: string[]): PermissionChecker {
  const checker = new PermissionChecker();
  if (perms) {
    checker.addPermissions(perms);
  }
  return checker;
}
