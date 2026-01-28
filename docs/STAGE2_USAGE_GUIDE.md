# Stage 2: 用户体验优化 - 使用指南

本文档说明如何使用新增的骨架屏和Toast通知功能。

---

## 📦 已实现的功能

### 1. Skeleton 骨架屏组件

**位置**: `src/components/ui/Skeleton.tsx`

**用途**: 在数据加载时显示占位符，提升用户体验。

#### 可用组件：

- `Skeleton` - 基础骨架屏
- `TableSkeleton` - 表格骨架屏
- `CardSkeleton` - 卡片骨架屏
- `DetailSkeleton` - 详情页骨架屏
- `ListSkeleton` - 列表页骨架屏

#### 使用示例：

```typescript
import { TableSkeleton, CardSkeleton } from '@/components/ui/Skeleton';

// 在组件中使用
function MyComponent() {
  const [loading, setLoading] = useState(true);

  if (loading) {
    return <TableSkeleton rows={10} />;
  }

  return <div>数据内容</div>;
}
```

---

### 2. Toast 通知系统

**库**: Sonner
**配置文件**: `src/components/providers/ToastProvider.tsx`

**用途**: 显示操作成功/失败/警告等通知。

#### 使用方法：

```typescript
import { toast } from 'sonner';

// 成功通知
toast.success('操作成功！');

// 错误通知
toast.error('操作失败，请重试');

// 警告通知
toast.warning('请注意...');

// 信息通知
toast.info('提示信息');

// 加载通知
const toastId = toast.loading('正在处理...');
// 完成后更新
toast.success('完成！', { id: toastId });

// 自定义通知
toast('自定义消息', {
  description: '这是详细描述',
  duration: 5000, // 5秒后自动关闭
  action: {
    label: '撤销',
    onClick: () => console.log('撤销'),
  },
});
```

#### 实际应用示例：

```typescript
// 表单提交
async function handleSubmit(data: FormData) {
  try {
    const response = await fetch('/api/cases', {
      method: 'POST',
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error('提交失败');
    }

    toast.success('案件创建成功！');
    router.push('/cases');
  } catch (error) {
    toast.error('创建失败，请检查输入并重试');
  }
}

// 删除操作
async function handleDelete(id: string) {
  toast.promise(
    fetch(`/api/cases/${id}`, { method: 'DELETE' }),
    {
      loading: '正在删除...',
      success: '删除成功！',
      error: '删除失败',
    }
  );
}

// 文件上传
async function handleUpload(file: File) {
  const toastId = toast.loading('正在上传文件...');

  try {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch('/api/upload', {
      method: 'POST',
      body: formData,
    });

    if (response.ok) {
      toast.success('上传成功！', { id: toastId });
    } else {
      toast.error('上传失败', { id: toastId });
    }
  } catch (error) {
    toast.error('上传出错', { id: toastId });
  }
}
```

---

### 3. Loading.tsx 页面

**已创建的页面**:
- `/cases/loading.tsx` - 案件列表加载状态
- `/debates/loading.tsx` - 辩论页面加载状态
- `/dashboard/loading.tsx` - 仪表盘加载状态

**工作原理**: Next.js会在页面数据加载时自动显示loading.tsx内容。

#### 为新页面添加loading.tsx：

```typescript
// src/app/your-page/loading.tsx
import { ListSkeleton } from '@/components/ui/Skeleton';

export default function YourPageLoading() {
  return (
    <div className='min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 p-6'>
      <div className='mx-auto max-w-7xl'>
        <div className='mb-6'>
          <div className='h-8 w-48 animate-pulse rounded bg-slate-200' />
        </div>
        <ListSkeleton />
      </div>
    </div>
  );
}
```

---

## 🎨 样式配置

Toast的样式已在`ToastProvider.tsx`中配置：

```typescript
<Toaster
  position='top-right'      // 位置：右上角
  expand={true}             // 展开显示
  richColors                // 丰富的颜色
  closeButton               // 显示关闭按钮
  toastOptions={{
    duration: 4000,         // 默认4秒后关闭
  }}
/>
```

### 修改Toast配置：

编辑 `src/components/providers/ToastProvider.tsx`：

```typescript
// 修改位置
position='top-center'  // 或 'bottom-right', 'bottom-center', etc.

// 修改默认持续时间
duration: 3000  // 3秒

// 修改主题
theme='dark'  // 或 'light', 'system'
```

---

## 🧪 测试

### 测试骨架屏：

1. 打开浏览器开发者工具（F12）
2. Network标签 → 设置 "Slow 3G" 网络限制
3. 访问 `/cases` 或 `/debates` 页面
4. 应该看到骨架屏动画

### 测试Toast通知：

在任何页面的浏览器控制台中运行：

```javascript
// 测试成功通知
import('sonner').then(m => m.toast.success('测试成功！'));

// 测试错误通知
import('sonner').then(m => m.toast.error('测试错误'));

// 测试加载通知
import('sonner').then(m => {
  const id = m.toast.loading('加载中...');
  setTimeout(() => m.toast.success('完成', { id }), 2000);
});
```

---

## 📝 最佳实践

### 1. Toast使用建议：

✅ **推荐**:
```typescript
// 简洁明了的消息
toast.success('保存成功');

// 提供操作提示
toast.error('保存失败', {
  description: '请检查网络连接后重试',
});

// 重要操作使用确认
toast('即将删除', {
  description: '此操作不可撤销',
  action: {
    label: '确认',
    onClick: handleDelete,
  },
});
```

❌ **避免**:
```typescript
// 过长的消息
toast.success('您的案件已经成功保存到数据库中，现在可以在案件列表中查看...');

// 频繁的toast
setInterval(() => toast.info('提示'), 1000); // 不要这样做！
```

### 2. 骨架屏使用建议：

✅ **推荐**:
```typescript
// 匹配实际布局
<TableSkeleton rows={data?.length || 5} />

// 组合使用
<div>
  <Skeleton className='h-8 w-48 mb-4' /> {/* 标题 */}
  <CardSkeleton count={3} />              {/* 内容 */}
</div>
```

❌ **避免**:
```typescript
// 骨架屏与实际内容差异太大
<TableSkeleton />  // 实际是卡片布局

// 加载时间过长仍显示骨架屏
{loading && <Skeleton />}  // 如果超过10秒应显示错误信息
```

---

## 🔧 故障排查

### Toast不显示：

1. **检查ToastProvider是否已添加到layout.tsx**
```typescript
// src/app/layout.tsx应包含：
<ToastProvider />
```

2. **检查导入是否正确**
```typescript
import { toast } from 'sonner';  // ✅ 正确
import { toast } from 'react-hot-toast';  // ❌ 错误的库
```

### 骨架屏不显示动画：

1. **检查Tailwind配置**
```javascript
// tailwind.config.ts 应该包含动画类
theme: {
  extend: {
    animation: {
      pulse: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
    }
  }
}
```

2. **检查className是否正确**
```typescript
<Skeleton className='animate-pulse' />  // ✅
<Skeleton className='pulse' />  // ❌
```

---

## 📚 参考资源

- [Sonner官方文档](https://sonner.emilkowal.ski/)
- [Next.js Loading UI](https://nextjs.org/docs/app/building-your-application/routing/loading-ui-and-streaming)
- [Tailwind Animation](https://tailwindcss.com/docs/animation)

---

**Stage 2优化完成！** 🎉

现在您的应用具有：
- ✅ 优雅的加载状态
- ✅ 清晰的操作反馈
- ✅ 更好的用户体验
