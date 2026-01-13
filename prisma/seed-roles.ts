/**
 * 角色和权限种子数据初始化脚本
 * 用于初始化RBAC系统的默认角色和权限
 */

import { PrismaClient } from '@prisma/client';
import {
  PERMISSION_DEFINITIONS,
  USER_ROLE_PERMISSIONS,
  LAWYER_ROLE_PERMISSIONS,
  ENTERPRISE_ROLE_PERMISSIONS,
  ADMIN_ROLE_PERMISSIONS,
  SUPER_ADMIN_ROLE_PERMISSIONS,
} from '@/types/permission';

const prisma = new PrismaClient();

// =============================================================================
// 角色定义
// =============================================================================

const ROLES = [
  {
    name: 'USER',
    description: '普通用户角色，拥有基本的案件和辩论创建权限',
    isDefault: true,
  },
  {
    name: 'LAWYER',
    description: '律师角色，拥有额外的案件和辩论编辑权限',
    isDefault: false,
  },
  {
    name: 'ENTERPRISE',
    description: '企业角色，拥有额外的案件和辩论编辑权限',
    isDefault: false,
  },
  {
    name: 'ADMIN',
    description: '管理员角色，拥有系统大部分权限',
    isDefault: false,
  },
  {
    name: 'SUPER_ADMIN',
    description: '超级管理员角色，拥有所有权限',
    isDefault: false,
  },
] as const;

// =============================================================================
// 主函数
// =============================================================================

async function main() {
  console.log('开始初始化角色和权限数据...\n');

  // 第一步：创建所有权限
  console.log('1. 创建权限...');
  let permissionsCount = 0;
  for (const permDef of PERMISSION_DEFINITIONS) {
    const permission = await prisma.permission.upsert({
      where: { name: permDef.name },
      update: {
        description: permDef.description,
        resource: permDef.resource,
        action: permDef.action,
      },
      create: {
        name: permDef.name,
        description: permDef.description,
        resource: permDef.resource,
        action: permDef.action,
      },
    });
    permissionsCount++;
    console.log(`   ✓ 创建权限: ${permission.name}`);
  }
  console.log(`   总计创建/更新 ${permissionsCount} 个权限\n`);

  // 第二步：创建角色
  console.log('2. 创建角色...');
  const createdRoles: Record<string, string> = {};
  for (const roleDef of ROLES) {
    const role = await prisma.role.upsert({
      where: { name: roleDef.name },
      update: {
        description: roleDef.description,
        isDefault: roleDef.isDefault,
      },
      create: {
        name: roleDef.name,
        description: roleDef.description,
        isDefault: roleDef.isDefault,
      },
    });
    createdRoles[roleDef.name] = role.id;
    console.log(`   ✓ 创建角色: ${role.name}`);
  }
  console.log(`   总计创建/更新 ${Object.keys(createdRoles).length} 个角色\n`);

  // 第三步：为角色分配权限
  console.log('3. 为角色分配权限...');

  // 普通用户角色权限
  console.log('   配置 USER 角色权限...');
  const userRoleId = createdRoles['USER'];
  if (userRoleId) {
    await assignPermissionsToRole(userRoleId, USER_ROLE_PERMISSIONS);
  }

  // 律师角色权限
  console.log('   配置 LAWYER 角色权限...');
  const lawyerRoleId = createdRoles['LAWYER'];
  if (lawyerRoleId) {
    await assignPermissionsToRole(lawyerRoleId, LAWYER_ROLE_PERMISSIONS);
  }

  // 企业角色权限
  console.log('   配置 ENTERPRISE 角色权限...');
  const enterpriseRoleId = createdRoles['ENTERPRISE'];
  if (enterpriseRoleId) {
    await assignPermissionsToRole(
      enterpriseRoleId,
      ENTERPRISE_ROLE_PERMISSIONS
    );
  }

  // 管理员角色权限
  console.log('   配置 ADMIN 角色权限...');
  const adminRoleId = createdRoles['ADMIN'];
  if (adminRoleId) {
    await assignPermissionsToRole(adminRoleId, ADMIN_ROLE_PERMISSIONS);
  }

  // 超级管理员角色权限
  console.log('   配置 SUPER_ADMIN 角色权限...');
  const superAdminRoleId = createdRoles['SUPER_ADMIN'];
  if (superAdminRoleId) {
    await assignPermissionsToRole(
      superAdminRoleId,
      SUPER_ADMIN_ROLE_PERMISSIONS
    );
  }

  console.log('   权限分配完成\n');

  // 第四步：统计信息
  console.log('================ 初始化完成 ================');
  const roleCount = await prisma.role.count();
  const permissionCount = await prisma.permission.count();
  const rolePermissionCount = await prisma.rolePermission.count();

  console.log(`- 角色总数: ${roleCount}`);
  console.log(`- 权限总数: ${permissionCount}`);
  console.log(`- 角色权限关联数: ${rolePermissionCount}`);
  console.log('==============================================\n');

  // 第五步：打印权限分配情况
  console.log('5. 权限分配详情:');
  for (const roleDef of ROLES) {
    const role = await prisma.role.findUnique({
      where: { name: roleDef.name },
      include: {
        permissions: {
          include: {
            permission: true,
          },
        },
      },
    });

    if (role) {
      console.log(`\n${role.name} (${role.description}):`);
      console.log(`  - 权限数量: ${role.permissions.length}`);
      role.permissions.forEach(rp => {
        console.log(
          `    • ${rp.permission?.name} - ${rp.permission?.description ?? ''}`
        );
      });
    }
  }
}

// =============================================================================
// 辅助函数
// =============================================================================

/**
 * 为角色分配权限
 * @param roleId 角色ID
 * @param permissionNames 权限名称数组
 */
async function assignPermissionsToRole(
  roleId: string,
  permissionNames: readonly string[]
): Promise<void> {
  for (const permissionName of permissionNames) {
    const permission = await prisma.permission.findUnique({
      where: { name: permissionName },
    });

    if (permission) {
      try {
        await prisma.rolePermission.upsert({
          where: {
            roleId_permissionId: {
              roleId,
              permissionId: permission.id,
            },
          },
          update: {},
          create: {
            roleId,
            permissionId: permission.id,
          },
        });
      } catch {
        // 忽略重复创建错误
      }
    } else {
      console.warn(`   ⚠ 权限不存在: ${permissionName}`);
    }
  }
}

// =============================================================================
// 执行脚本
// =============================================================================

main()
  .catch(e => {
    console.error('❌ 初始化失败:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
