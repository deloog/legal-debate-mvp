# Cookie认证流程调试指南

## 🔍 已添加的调试日志

为了追踪Cookie从登录到认证的完整流程，我在以下位置添加了详细的日志：

### 1. 登录API (`/api/auth/login`)
**位置**: `src/app/api/auth/login/route.ts:168-179`

**日志输出**:
```
[Login API] 登录成功，Cookie已设置: {
  userId: '...',
  email: '...',
  hasAccessToken: true,
  hasRefreshToken: true,
  accessTokenPreview: '...',
  cookieSettings: { ... }
}
```

### 2. 认证检查API (`/api/auth/me`)
**位置**: `src/app/api/auth/me/route.ts:14-29`

**日志输出**:
```
[/api/auth/me] 收到请求: {
  hasCookie: boolean,
  hasAuthHeader: boolean,
  cookiePreview: '...',
  allCookies: [...]
}

[/api/auth/me] getAuthUser结果: {
  hasUser: boolean,
  userId: '...',
  userEmail: '...'
}
```

### 3. Middleware (`middleware.ts`)
**位置**: `src/middleware.ts:48-54`

**日志输出**:
```
[Middleware] /api/auth/me 请求: {
  hasCookie: boolean,
  cookieValue: '...',
  allCookies: [...]
}
```

### 4. getAuthUser函数 (`lib/middleware/auth.ts`)
**位置**: `src/lib/middleware/auth.ts`

**日志输出**:
```
[getAuthUser] Token来源: 'Cookie'/'Authorization header'/'middleware headers'
预览: '...'

[getAuthUser] Token验证结果: {
  valid: boolean,
  hasPayload: boolean,
  error: 'TOKEN_EXPIRED'/'INVALID_TOKEN'/null
}
```

---

## 🧪 测试步骤

### 第1步: 清理环境
```bash
# 1. 停止dev服务器（如果正在运行）
Ctrl+C

# 2. 打开浏览器开发者工具（F12）
# Application → Storage → Clear site data → 点击 "Clear site data"

# 3. 关闭所有localhost:3000的浏览器标签页
```

### 第2步: 重启开发服务器
```bash
npm run dev
```

### 第3步: 执行登录测试
1. 打开浏览器访问 http://localhost:3000
2. 点击"登录"按钮
3. 使用测试账号登录:
   - 邮箱: `test@example.com`
   - 密码: `test123`
4. 点击"登录"

### 第4步: 观察日志输出

#### A. 浏览器控制台（Console标签）
应该看到:
```
[Login] 登录成功，准备跳转到: /
[AuthProvider] 收到登录成功事件，延迟100ms后检查认证
[AuthProvider] API响应: { success: true, hasUser: true }
[AuthProvider] 用户已认证: test@example.com
```

#### B. 开发服务器终端
应该看到完整的日志流:

**1. 登录请求日志**:
```
[Login API] 登录成功，Cookie已设置: {
  userId: '...',
  email: 'test@example.com',
  hasAccessToken: true,
  hasRefreshToken: true,
  ...
}
```

**2. Middleware日志**:
```
[Middleware] /api/auth/me 请求: {
  hasCookie: true,  ← 关键：应该是true
  cookieValue: 'eyJhbGciOiJIUzI1NiIsInR5c...',
  allCookies: [ 'accessToken', 'refreshToken' ]
}
```

**3. /api/auth/me日志**:
```
[/api/auth/me] 收到请求: {
  hasCookie: true,  ← 关键：应该是true
  cookiePreview: 'eyJhbGciOiJIUzI1NiIsInR5c...',
  allCookies: [ { name: 'accessToken', hasValue: true }, ... ]
}
```

**4. getAuthUser日志**:
```
[getAuthUser] Token来源: Cookie 预览: eyJhbGciOiJIUzI1NiIsInR5c...
[getAuthUser] Token验证结果: {
  valid: true,  ← 关键：应该是true
  hasPayload: true,
  error: null
}
```

**5. 最终响应日志**:
```
[/api/auth/me] getAuthUser结果: {
  hasUser: true,  ← 关键：应该是true
  userId: '...',
  userEmail: 'test@example.com'
}
```

---

## 🎯 成功标志

如果Cookie认证正常工作，你应该看到：

✅ **浏览器控制台**:
- 无401错误
- `[AuthProvider] 用户已认证: test@example.com`
- 首页右上角显示用户名（不是"登录"按钮）

✅ **服务器终端**:
- `[Login API] 登录成功，Cookie已设置`
- `[Middleware] /api/auth/me 请求: { hasCookie: true, ... }`
- `[/api/auth/me] 收到请求: { hasCookie: true, ... }`
- `[getAuthUser] Token来源: Cookie`
- `[getAuthUser] Token验证结果: { valid: true, ... }`
- `[/api/auth/me] getAuthUser结果: { hasUser: true, ... }`

---

## 🐛 故障排查

### 问题1: hasCookie: false
**位置**: Middleware或/api/auth/me日志显示 `hasCookie: false`

**可能原因**:
1. Cookie没有正确设置
2. Cookie的domain/path不匹配
3. 浏览器阻止了Cookie（隐私设置）

**排查步骤**:
```bash
# 1. 检查浏览器Cookie存储
# F12 → Application → Cookies → http://localhost:3000
# 应该看到: accessToken 和 refreshToken

# 2. 检查Cookie属性:
# - Domain: localhost
# - Path: /
# - HttpOnly: ✓
# - Secure: (空白，因为是开发环境)
# - SameSite: Lax

# 3. 检查登录API日志
# 确认看到: [Login API] 登录成功，Cookie已设置
```

### 问题2: valid: false
**位置**: getAuthUser日志显示 `valid: false`

**可能原因**:
1. Token已过期
2. JWT_SECRET不匹配
3. Token格式错误

**排查步骤**:
```bash
# 1. 检查.env文件中的JWT_SECRET
cat .env | grep JWT_SECRET

# 2. 检查token是否过期
# accessToken有效期: 15分钟
# refreshToken有效期: 7天

# 3. 查看error字段:
# - TOKEN_EXPIRED: token已过期，重新登录
# - INVALID_TOKEN: token格式错误或secret不匹配
```

### 问题3: 仍然返回401
**位置**: 浏览器控制台显示401错误

**可能原因**:
1. Middleware拦截了请求
2. getAuthUser返回null
3. 数据库查询失败

**排查步骤**:
```bash
# 1. 按顺序检查所有日志点:
#    Login API → Middleware → /api/auth/me → getAuthUser
#    找出哪个环节出了问题

# 2. 如果在Middleware就返回401:
#    查看: [Middleware] API请求无token，返回401
#    说明Middleware没有读取到Cookie

# 3. 如果在getAuthUser返回null:
#    查看: [/api/auth/me] 认证失败，返回401
#    说明token验证失败或未找到token
```

---

## 📋 完整日志示例（成功案例）

```
# === 登录阶段 ===
[Login API] 登录成功，Cookie已设置: {
  userId: 'cm5abc123',
  email: 'test@example.com',
  hasAccessToken: true,
  hasRefreshToken: true,
  accessTokenPreview: 'eyJhbGciOiJIUzI1NiIsInR5c...',
  cookieSettings: { httpOnly: true, secure: false, sameSite: 'lax', path: '/' }
}

# === 前端日志 ===
[Login] 登录成功，准备跳转到: /
[AuthProvider] 收到登录成功事件，延迟100ms后检查认证

# === Middleware检查 ===
[Middleware] /api/auth/me 请求: {
  hasCookie: true,
  cookieValue: 'eyJhbGciOiJIUzI1NiIsInR5c...',
  allCookies: [ 'accessToken', 'refreshToken' ]
}

# === API认证检查 ===
[/api/auth/me] 收到请求: {
  hasCookie: true,
  hasAuthHeader: false,
  cookiePreview: 'eyJhbGciOiJIUzI1NiIsInR5c...',
  allCookies: [
    { name: 'accessToken', hasValue: true },
    { name: 'refreshToken', hasValue: true }
  ]
}

[getAuthUser] Token来源: Cookie 预览: eyJhbGciOiJIUzI1NiIsInR5c...
[getAuthUser] Token验证结果: {
  valid: true,
  hasPayload: true,
  error: null
}

[/api/auth/me] getAuthUser结果: {
  hasUser: true,
  userId: 'cm5abc123',
  userEmail: 'test@example.com'
}

# === 前端收到响应 ===
[AuthProvider] API响应: { success: true, hasUser: true }
[AuthProvider] 用户已认证: test@example.com
[Login] 执行页面跳转
```

---

## 🔧 清理调试日志

测试完成后，如果一切正常，你可以选择保留或删除这些调试日志。

**保留建议**: 建议保留这些日志（可以用环境变量控制是否输出），它们对于未来的问题排查非常有帮助。

**删除方式**: 如果需要删除，搜索代码中的 `console.log('[Login API]'`, `console.log('[/api/auth/me]'`, `console.log('[getAuthUser]'` 并删除这些行。

---

**准备好后，请按照上述步骤进行测试，并将服务器终端的完整日志输出发给我！**
