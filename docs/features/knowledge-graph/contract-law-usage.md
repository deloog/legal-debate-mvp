# 合同法条关联功能使用指南

## 快速开始

### 1. 在合同详情页使用组件

```tsx
// src/app/contracts/[id]/page.tsx
import { ContractRecommendations } from '@/components/contract/ContractRecommendations';

export default function ContractDetailPage({ params }: { params: { id: string } }) {
  // 假设从session或context获取当前用户ID
  const userId = 'current-user-id';

  return (
    <div className="container mx-auto p-6">
      <h1>合同详情</h1>

      {/* 法条推荐组件 */}
      <ContractRecommendations
        contractId={params.id}
        userId={userId}
        showFilter={true}
        limit={10}
        minScore={0.5}
        onSelect={(article) => {
          console.log('用户选择了法条:', article.lawName, article.articleNumber);
        }}
      />
    </div>
  );
}
```

### 2. 直接调用API

#### 获取已关联的法条

```typescript
async function getAssociatedArticles(contractId: string) {
  const response = await fetch(`/api/v1/contracts/${contractId}/law-articles`);
  const data = await response.json();

  if (data.success) {
    console.log('已关联法条:', data.lawArticles);
    console.log('总数:', data.metadata.totalCount);
  }
}
```

#### 添加法条关联

```typescript
async function addArticleAssociation(
  contractId: string,
  lawArticleId: string,
  userId: string
) {
  const response = await fetch(`/api/v1/contracts/${contractId}/law-articles`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      lawArticleId,
      addedBy: userId,
      reason: '基于推荐系统选择',
      relevanceScore: 0.9,
    }),
  });

  const data = await response.json();

  if (data.success) {
    console.log('关联成功:', data.association);
  } else {
    console.error('关联失败:', data.error);
  }
}
```

#### 删除法条关联

```typescript
async function removeArticleAssociation(
  contractId: string,
  lawArticleId: string
) {
  const response = await fetch(
    `/api/v1/contracts/${contractId}/law-articles/${lawArticleId}`,
    {
      method: 'DELETE',
    }
  );

  const data = await response.json();

  if (data.success) {
    console.log('删除成功');
  } else {
    console.error('删除失败:', data.error);
  }
}
```

### 3. 使用Prisma直接操作

```typescript
import { prisma } from '@/lib/db';

// 查询合同的所有关联法条
async function getContractArticles(contractId: string) {
  const associations = await prisma.contractLawArticle.findMany({
    where: { contractId },
    include: {
      lawArticle: true,
    },
    orderBy: {
      addedAt: 'desc',
    },
  });

  return associations;
}

// 创建关联
async function createAssociation(
  contractId: string,
  lawArticleId: string,
  userId: string
) {
  const association = await prisma.contractLawArticle.create({
    data: {
      contractId,
      lawArticleId,
      addedBy: userId,
      reason: '手动添加',
      relevanceScore: 0.8,
    },
  });

  return association;
}

// 删除关联
async function deleteAssociation(contractId: string, lawArticleId: string) {
  await prisma.contractLawArticle.delete({
    where: {
      contractId_lawArticleId: {
        contractId,
        lawArticleId,
      },
    },
  });
}

// 检查是否已关联
async function isArticleAssociated(
  contractId: string,
  lawArticleId: string
): Promise<boolean> {
  const association = await prisma.contractLawArticle.findUnique({
    where: {
      contractId_lawArticleId: {
        contractId,
        lawArticleId,
      },
    },
  });

  return association !== null;
}
```

## 组件Props说明

### ContractRecommendations

| 属性 | 类型 | 必需 | 默认值 | 说明 |
|------|------|------|--------|------|
| `contractId` | `string` | ✅ | - | 合同ID |
| `userId` | `string` | ✅ | - | 当前用户ID |
| `onSelect` | `(article: LawArticle) => void` | ❌ | - | 选择法条时的回调 |
| `showFilter` | `boolean` | ❌ | `false` | 是否显示搜索过滤框 |
| `limit` | `number` | ❌ | `10` | 推荐法条数量限制 |
| `minScore` | `number` | ❌ | `0` | 最低推荐分数（0-1） |

## API响应格式

### 成功响应

```json
{
  "success": true,
  "lawArticles": [...],
  "metadata": {
    "contractId": "contract-123",
    "totalCount": 5
  }
}
```

### 错误响应

```json
{
  "success": false,
  "error": "错误信息"
}
```

## 常见问题

### Q: 如何获取当前用户ID？

A: 通常从session或authentication context中获取：

```typescript
import { useSession } from 'next-auth/react';

function MyComponent() {
  const { data: session } = useSession();
  const userId = session?.user?.id;

  return (
    <ContractRecommendations
      contractId="contract-123"
      userId={userId || ''}
    />
  );
}
```

### Q: 如何自定义推荐原因？

A: 在调用API时传入自定义的`reason`参数：

```typescript
await fetch(`/api/v1/contracts/${contractId}/law-articles`, {
  method: 'POST',
  body: JSON.stringify({
    lawArticleId,
    addedBy: userId,
    reason: '根据案件类型手动选择', // 自定义原因
    relevanceScore: 0.95,
  }),
});
```

### Q: 如何批量添加关联？

A: 目前不支持批量操作，需要循环调用API：

```typescript
async function addMultipleAssociations(
  contractId: string,
  articleIds: string[],
  userId: string
) {
  const results = await Promise.all(
    articleIds.map(articleId =>
      fetch(`/api/v1/contracts/${contractId}/law-articles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lawArticleId: articleId,
          addedBy: userId,
        }),
      })
    )
  );

  return results;
}
```

### Q: 如何处理重复关联？

A: API会自动检测重复关联并返回409状态码：

```typescript
const response = await fetch(...);
const data = await response.json();

if (response.status === 409) {
  console.log('该法条已经关联到此合同');
} else if (data.success) {
  console.log('关联成功');
}
```

## 最佳实践

1. **错误处理**: 始终检查API响应的`success`字段
2. **加载状态**: 在操作过程中显示加载指示器
3. **用户反馈**: 操作成功或失败后给予明确提示
4. **权限控制**: 确保只有授权用户可以添加/删除关联
5. **数据验证**: 在客户端和服务端都进行参数验证

## 示例：完整的React Hook

```typescript
import { useState, useCallback } from 'react';

interface UseContractArticlesResult {
  articles: LawArticle[];
  loading: boolean;
  error: string | null;
  addArticle: (articleId: string, score: number) => Promise<void>;
  removeArticle: (articleId: string) => Promise<void>;
  refresh: () => Promise<void>;
}

export function useContractArticles(
  contractId: string,
  userId: string
): UseContractArticlesResult {
  const [articles, setArticles] = useState<LawArticle[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(
        `/api/v1/contracts/${contractId}/law-articles`
      );
      const data = await response.json();

      if (data.success) {
        setArticles(data.lawArticles);
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, [contractId]);

  const addArticle = useCallback(
    async (articleId: string, score: number) => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(
          `/api/v1/contracts/${contractId}/law-articles`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              lawArticleId: articleId,
              addedBy: userId,
              relevanceScore: score,
            }),
          }
        );

        const data = await response.json();

        if (data.success) {
          await refresh();
        } else {
          setError(data.error);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : '添加失败');
      } finally {
        setLoading(false);
      }
    },
    [contractId, userId, refresh]
  );

  const removeArticle = useCallback(
    async (articleId: string) => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(
          `/api/v1/contracts/${contractId}/law-articles/${articleId}`,
          { method: 'DELETE' }
        );

        const data = await response.json();

        if (data.success) {
          await refresh();
        } else {
          setError(data.error);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : '删除失败');
      } finally {
        setLoading(false);
      }
    },
    [contractId, refresh]
  );

  return {
    articles,
    loading,
    error,
    addArticle,
    removeArticle,
    refresh,
  };
}
```

使用这个Hook：

```tsx
function MyComponent({ contractId, userId }: Props) {
  const {
    articles,
    loading,
    error,
    addArticle,
    removeArticle,
    refresh,
  } = useContractArticles(contractId, userId);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <div>
      {loading && <p>加载中...</p>}
      {error && <p>错误: {error}</p>}

      <ul>
        {articles.map(article => (
          <li key={article.id}>
            {article.lawName} - {article.articleNumber}
            <button onClick={() => removeArticle(article.id)}>
              删除
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

## 更多资源

- [完整实现报告](./CONTRACT_LAW_ARTICLE_ASSOCIATION_IMPLEMENTATION.md)
- [API文档](../src/app/api/v1/contracts/[id]/law-articles/route.ts)
- [组件源码](../src/components/contract/ContractRecommendations.tsx)
- [测试用例](../src/__tests__/app/api/v1/contracts/)
