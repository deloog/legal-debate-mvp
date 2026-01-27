# 优化功能测试指南

> **测试版本**: v1.0
> **最后更新**: 2026-01-27

---

## 🎯 本次测试目标

验证已完成的安全性优化和用户体验改进是否正常工作。

---

## 🔧 测试前准备

### 1. 启动开发服务器
```bash
npm run dev
```

### 2. 清除浏览器数据
**重要**：为了测试新的Cookie认证机制，请清除以下数据：
- Cookie
- LocalStorage
- SessionStorage

**Chrome操作步骤**：
1. 按 `F12` 打开开发者工具
2. 进入 `Application` 标签
3. 左侧 `Storage` 下：
   - 点击 `Cookies` → 删除 `localhost:3000` 的所有cookie
   - 点击 `Local Storage` → 清空
   - 点击 `Session Storage` → 清空

---

## ✅ 测试清单

### 第一部分：路由保护测试

#### Test 1.1: 未登录访问首页
**步骤**：
1. 清除所有cookie和storage
2. 访问 `http://localhost:3000`

**预期结果**：
- ✅ 首页正常加载
- ✅ 可以看到功能模块卡片
- ✅ 右上角有"登录"按钮
- ✅ 控制台无错误

#### Test 1.2: 未登录访问保护页面
**步骤**：
1. 清除cookie
2. 直接访问 `http://localhost:3000/cases`

**预期结果**：
- ✅ 自动重定向到 `/login?redirect=/cases`
- ✅ 登录页面正常显示

#### Test 1.3: 登录后自动返回
**步骤**：
1. 被重定向到登录页后
2. 使用测试账号登录：
   - 邮箱: `test@example.com`
   - 密码: `test123`

**预期结果**：
- ✅ 登录成功
- ✅ 自动跳转回 `/cases` 页面
- ✅ 浏览器Cookie中有 `accessToken` 和 `refreshToken`

#### Test 1.4: 管理员权限测试
**步骤**：
1. 使用普通用户登录 (test@example.com)
2. 尝试访问 `http://localhost:3000/admin`

**预期结果**：
- ✅ 被自动重定向回首页
- ✅ 不能访问管理后台

**步骤**：
1. 退出登录
2. 使用管理员账号登录：
   - 邮箱: `admin@example.com`
   - 密码: `admin123`
3. 访问 `http://localhost:3000/admin`

**预期结果**：
- ✅ 可以正常访问管理后台

---

### 第二部分：Cookie认证测试

#### Test 2.1: Cookie存储验证
**步骤**：
1. 登录后，打开开发者工具
2. `Application` → `Cookies` → `localhost:3000`

**预期结果**：
- ✅ 看到 `accessToken` cookie
  - HttpOnly: ✓
  - SameSite: Lax
  - Path: /
- ✅ 看到 `refreshToken` cookie
  - HttpOnly: ✓
  - SameSite: Lax
  - Path: /

#### Test 2.2: LocalStorage检查
**步骤**：
1. 登录后，检查 `Application` → `Local Storage`

**预期结果**：
- ✅ **不应该**有 `token` 或 `refreshToken`
- ✅ LocalStorage应该是空的或只有非敏感数据

#### Test 2.3: SessionStorage检查
**步骤**：
1. 登录后，检查 `Application` → `Session Storage`

**预期结果**：
- ✅ 可能有 `user` 对象（仅用户基本信息，无token）

#### Test 2.4: JavaScript访问测试
**步骤**：
1. 登录后，在控制台执行：
```javascript
console.log(document.cookie);
```

**预期结果**：
- ✅ **不应该**看到 `accessToken` 或 `refreshToken`
- ✅ 这证明HttpOnly有效，JavaScript无法访问

---

### 第三部分：登出测试

#### Test 3.1: 正常登出
**步骤**：
1. 登录成功后
2. 点击"登出"按钮（如果有）或调用登出API：
```javascript
fetch('/api/auth/logout', { method: 'POST' })
  .then(() => window.location.reload());
```

**预期结果**：
- ✅ Cookie被清除
- ✅ 被重定向到登录页
- ✅ 访问保护页面会被拦截

---

### 第四部分：错误处理测试

#### Test 4.1: 页面错误边界
**步骤**：
1. 修改任意页面代码，故意引入错误
2. 访问该页面

**预期结果**：
- ✅ 不会看到白屏
- ✅ 显示友好的错误提示页面
- ✅ 有"重试"和"返回首页"按钮

---

### 第五部分：安全响应头测试

#### Test 5.1: 检查安全响应头
**步骤**：
1. 打开开发者工具 `Network` 标签
2. 访问任意页面
3. 查看响应头（Response Headers）

**预期结果**：应该包含以下安全头：
- ✅ `X-Content-Type-Options: nosniff`
- ✅ `X-Frame-Options: DENY`
- ✅ `X-XSS-Protection: 1; mode=block`
- ✅ `Referrer-Policy: strict-origin-when-cross-origin`
- ✅ `Permissions-Policy: camera=(), microphone=(), geolocation=()`

---

## 🐛 常见问题排查

### 问题1: 首页加载失败
**症状**: 看到 "加载Dashboard数据失败" 错误

**原因**: `/api/dashboard` 被middleware拦截

**解决**:
- 确认middleware.ts中 `/api/dashboard` 在公开路径列表中
- 重启dev服务器

### 问题2: 登录后仍被重定向
**症状**: 登录成功但访问页面仍跳转到登录页

**原因**:
- Cookie未正确设置
- middleware验证逻辑问题

**排查步骤**:
1. 检查浏览器Cookie是否存在
2. 检查Cookie的domain和path是否正确
3. 查看控制台错误信息

### 问题3: 无法访问管理后台
**症状**: 使用admin账号仍无法访问 `/admin`

**排查步骤**:
1. 确认用户role为 `ADMIN`
2. 检查middleware中的角色判断逻辑
3. 查看Network标签的请求头 `x-user-role`

---

## 📊 测试结果记录

| 测试项 | 预期结果 | 实际结果 | 状态 | 备注 |
|--------|----------|----------|------|------|
| 1.1 未登录访问首页 | 正常显示 | | ⬜ |  |
| 1.2 访问保护页面 | 重定向登录 | | ⬜ |  |
| 1.3 登录后返回 | 跳转原页面 | | ⬜ |  |
| 1.4 管理员权限 | 权限正确 | | ⬜ |  |
| 2.1 Cookie存储 | HttpOnly生效 | | ⬜ |  |
| 2.2 LocalStorage | 无token | | ⬜ |  |
| 2.3 SessionStorage | 仅用户信息 | | ⬜ |  |
| 2.4 JS访问测试 | 无法访问 | | ⬜ |  |
| 3.1 登出功能 | Cookie清除 | | ⬜ |  |
| 4.1 错误边界 | 友好提示 | | ⬜ |  |
| 5.1 安全响应头 | 头部完整 | | ⬜ |  |

**状态说明**:
- ⬜ 待测试
- ✅ 通过
- ❌ 失败
- ⚠️ 部分通过

---

## 🎉 测试完成后

### 如果所有测试通过：
1. 更新 `OPTIMIZATION_PROGRESS.md`
2. 提交代码并打tag
3. 继续下一阶段优化

### 如果发现问题：
1. 记录问题详情
2. 检查相关代码
3. 修复后重新测试

---

## 📞 需要帮助？

如遇到任何测试问题，请提供：
1. 测试编号（如 Test 1.2）
2. 浏览器控制台错误信息
3. Network标签的请求/响应详情
4. 浏览器版本和操作系统

这样可以更快定位和解决问题。
