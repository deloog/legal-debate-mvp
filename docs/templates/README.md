# 代码模板目录

> 本目录提供标准的代码模板，供AI助手在生成新代码时参考使用。

## 模板列表

| 模板 | 文件 | 说明 |
|------|------|------|
| API路由 | [`api-route-template.ts`](api-route-template.ts) | Next.js API路由的标准结构 |
| React组件 | [`component-template.tsx`](component-template.tsx) | React组件的标准结构 |
| 自定义Hook | [`hook-template.ts`](hook-template.ts) | 自定义Hook的标准结构 |
| 单元测试 | [`test-template.ts`](test-template.ts) | 单元测试的标准结构 |

## 使用说明

1. 复制模板文件到目标位置
2. 根据实际需求修改类型和业务逻辑
3. 确保遵循 `.clinerules` 中的规范：
   - 单个文件最多500行
   - 优先使用命名导出（Next.js 页面组件可使用默认导出）
   - 生产代码禁止使用 `any` 类型
   - 异步操作必须有错误处理

## 文件放置规范

- **测试文件**：放在 `src/__tests__/` 目录下
- **API 路由**：
  - 新功能：放在 `src/app/api/v1/` 目录下
  - 认证相关：放在 `src/app/api/auth/` 目录下
  - 管理员功能：放在 `src/app/api/admin/` 目录下
  - 禁止在 `src/app/api/` 根级新增路由
- **React 组件**：放在 `src/components/` 目录下
- **自定义 Hook**：放在 `src/lib/hooks/` 目录下
- **工具函数**：放在 `src/lib/utils/` 目录下

## 文件命名规范

- **禁止创建重复文件**：禁止创建增强版、v2、new_、backup 等重复文件
- **改进原则**：所有改进必须在原文件上进行
- **日志输出**：使用 `import { logger } from '@/lib/logger'` 替代 `console.log/warn/error`

## 注意事项

- 模板仅提供基础结构，具体业务逻辑需要根据实际情况实现
- 修改文件时遵循 `opportunistic_cleanup` 原则，顺带修复已存在的问题：
  - `any` 类型 → 替换为具体类型或 `unknown`
  - `console.log/warn/error` → 替换为 `logger` 方法
  - 非必要的 `eslint-disable` 注释 → 删除并修复根本原因

## 相关文档

- 详见 [`docs/API_VERSIONING_GUIDE.md`](../API_VERSIONING_GUIDE.md) 了解完整的 API 版本策略
