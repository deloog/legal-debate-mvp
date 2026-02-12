# 系统修复计划

> 创建时间：2026-02-06
> 目的：系统化修复当前项目中的关键问题，按优先级分阶段实施

## 📋 问题概览

- **Critical级别**：7处硬编码问题（影响核心功能）
- **编译错误**：11个错误（阻止构建）
- **High级别**：4处硬编码问题
- **测试失败**：3个测试失败
- **移动端缺失**：相机/图片选择、PWA支持

---

## 🔴 阶段1：修复编译错误（必须立即完成）

### 1.1 安装缺失的npm包
```bash
npm install date-fns
```

### 1.2 创建缺失的UI组件

#### 创建 Alert 组件
- 文件：`src/components/ui/alert.tsx`
- 需要实现：Alert, AlertDescription, AlertTitle
- 参考：shadcn/ui alert组件

#### 创建 Tabs 组件
- 文件：`src/components/ui/tabs.tsx`
- 需要实现：Tabs, TabsList, TabsTrigger, TabsContent
- 参考：shadcn/ui tabs组件

### 1.3 修复导入路径错误
- 全局搜索 `@/lib/prisma`
- 替换为 `@/lib/db`
- 受影响文件数：约3个

### 1.4 修复 textract 模块问题
- 检查 `textract` 是否在 package.json 中
- 如果缺失，安装：`npm install textract`
- 或者移除相关代码（如果不需要）

---

## 🔴 阶段2：修复Critical级别硬编码（影响核心功能）

### 2.1 实现真实的用户认证系统

#### 问题文件清单：
1. `src/app/law-articles/[id]/page.tsx:39` - 'demo-user-id'
2. `src/app/api/approvals/pending/route.ts:12` - 'current-user-id'
3. `src/app/api/consultations/[id]/convert/route.ts:191` - 'demo-user-id'
4. 其他4处类似问题

#### 修复方案：
```typescript
// 创建统一的用户session获取函数
// 文件：src/lib/auth/get-current-user.ts

import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

export async function getCurrentUserId(): Promise<string> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    throw new Error('Unauthorized');
  }
  return session.user.id;
}
```

#### 替换步骤：
1. 创建 `get-current-user.ts` 工具函数
2. 在每个硬编码文件中导入并使用
3. 添加错误处理（未登录返回401）

### 2.2 移除API中的Mock数据

#### 问题文件清单：
1. `src/app/api/admin/export/tasks/route.ts:30-66` - 假的导出任务列表
2. `src/app/api/v1/documents/upload/route.ts:141-214` - mock分析结果
3. `src/app/api/v1/memory/compress-preview/route.ts:14-33` - mock AI服务

#### 修复方案：
- **export/tasks/route.ts**：连接真实数据库查询
- **documents/upload/route.ts**：集成真实的文档分析服务
- **memory/compress-preview/route.ts**：集成真实的AI压缩服务

---

## ⚠️ 阶段3：修复High级别问题

### 3.1 移除硬编码的localhost URL
- 搜索所有 `http://localhost` 出现的地方
- 替换为环境变量：`process.env.NEXT_PUBLIC_API_URL`
- 在 `.env.example` 中添加示例配置

### 3.2 移除硬编码的mock API端点
- 识别所有mock API调用
- 替换为真实的API端点
- 或者通过环境变量控制（开发/生产模式）

---

## 📝 阶段4：修复测试失败

### 4.1 DiscussionForm测试修复
- 文件：`src/__tests__/components/DiscussionForm.test.tsx`
- 失败原因：验证逻辑未实现
- 需要修复的测试：3个
- 超时测试：1个（需要优化或增加超时时间）

#### 修复步骤：
1. 检查表单验证逻辑是否正确实现
2. 确认错误提示是否正确显示
3. 优化超时测试的性能

---

## 📱 阶段5：移动端优化（功能增强）

### 5.1 添加移动端相机/图片选择支持

#### 方案A：快速方案（推荐先实施）
```typescript
// 在文件上传组件中添加
<input
  type="file"
  accept="image/*"
  capture="camera"  // 添加这个属性
/>
```

#### 需要修改的文件：
- 搜索所有 `<input type="file"` 的地方
- 添加 `capture` 属性
- 添加 `accept="image/*"` 限制

### 5.2 添加PWA支持（可选）

#### 创建 manifest.json
```json
{
  "name": "法律辩论平台",
  "short_name": "法辩",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#000000",
  "icons": [
    {
      "src": "/icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/icon-512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
```

#### 创建 Service Worker
- 文件：`public/sw.js`
- 实现基本的缓存策略
- 支持离线访问

#### 在 layout.tsx 中注册
```typescript
// 添加 manifest link
<link rel="manifest" href="/manifest.json" />

// 注册 service worker
useEffect(() => {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js');
  }
}, []);
```

### 5.3 微信集成方案（如需要）

#### 方案B：微信H5 + JSSDK
- 安装：`npm install weixin-js-sdk`
- 配置微信公众号
- 使用 `wx.chooseImage()` 调用相机

#### 方案C：微信小程序（需要重新开发）
- 使用 Taro 或 uni-app 框架
- 重新构建小程序版本

---

## 📊 阶段6：代码质量优化（Medium级别）

### 6.1 整理配置常量
- 创建 `src/config/constants.ts`
- 将所有硬编码的配置移到这里
- 使用环境变量覆盖

### 6.2 清理TODO注释
- 搜索所有 `// TODO` 注释
- 创建GitHub Issues跟踪
- 或者立即实现

### 6.3 移除重复的验证数组
- 识别重复的验证逻辑
- 提取到共享的工具函数
- 统一验证规则

---

## 🎯 实施优先级总结

### P0 - 立即修复（阻止构建）
1. ✅ 安装 date-fns
2. ✅ 创建 Alert 组件
3. ✅ 创建 Tabs 组件
4. ✅ 修复 @/lib/prisma 导入路径
5. ✅ 修复 textract 模块

### P1 - 高优先级（影响核心功能）
6. ✅ 替换所有硬编码的用户ID
7. ✅ 移除API中的mock数据
8. ✅ 修复硬编码的localhost URL

### P2 - 中优先级（功能完善）
9. ✅ 修复测试失败
10. ✅ 添加移动端相机支持

### P3 - 低优先级（代码质量）
11. ⏳ 添加PWA支持
12. ⏳ 整理配置常量
13. ⏳ 清理TODO注释

---

## 📝 实施检查清单

### 阶段1检查
- [ ] npm install 成功
- [ ] Alert组件创建并测试
- [ ] Tabs组件创建并测试
- [ ] 所有导入路径修复
- [ ] 项目可以成功编译

### 阶段2检查
- [ ] 创建 getCurrentUserId 函数
- [ ] 所有硬编码用户ID已替换
- [ ] 未登录用户返回401错误
- [ ] Mock数据已移除
- [ ] 真实API已连接

### 阶段3检查
- [ ] 所有localhost URL已替换
- [ ] 环境变量配置完成
- [ ] .env.example 已更新

### 阶段4检查
- [ ] 所有测试通过
- [ ] 无超时测试
- [ ] 测试覆盖率达标

### 阶段5检查
- [ ] 移动端可以调用相机
- [ ] 可以从相册选择图片
- [ ] PWA可以安装（如果实施）
- [ ] 离线功能正常（如果实施）

---

## 🚀 开始实施

按照以上优先级，从P0开始逐步实施。每完成一个阶段，更新检查清单。

**预计完成时间**：
- P0：立即开始
- P1：P0完成后
- P2：P1完成后
- P3：根据时间安排

**备注**：如果单个对话窗口无法完成所有任务，可以从此文档继续。
