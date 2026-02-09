# 管理后台数据导入指南

## 概述

您可以通过管理后台的"法条管理"页面，方便地批量导入各类法律数据，无需使用命令行工具。

## 访问方式

1. 登录管理后台
2. 导航到 `法条管理` 页面
3. 点击右上角的 `导入法条` 按钮

## 导入功能特性

### 1. 数据源选择
支持选择以下数据源：
- 本地数据
- 司法部
- CAIL
- LaWGPT
- 法律之星
- 北大法宝

选择正确的数据源有助于追踪法条来源和管理数据同步。

### 2. 两种导入方式

#### 方式一：粘贴JSON
直接将JSON数据粘贴到文本框中。

#### 方式二：上传文件
选择本地的JSON文件进行导入。

### 3. 数据格式要求

#### 最简格式
```json
[
  {
    "lawName": "中华人民共和国民法典",
    "articleNumber": "第一条",
    "fullText": "为了保护民事主体的合法权益...",
    "lawType": "LAW",
    "category": "CIVIL_GENERAL",
    "effectiveDate": "2021-01-01"
  }
]
```

#### 完整格式
```json
[
  {
    "lawName": "法律名称",
    "articleNumber": "条号",
    "fullText": "法条完整内容",
    "lawType": "LAW | CONSTITUTION | ADMINISTRATIVE_REGULATION | ...",
    "category": "CIVIL | CRIMINAL | ADMINISTRATIVE | ...",
    "subCategory": "子类别（可选）",
    "effectiveDate": "2021-01-01",
    "expiryDate": "2025-01-01（可选）",
    "status": "VALID | AMENDED | REPEALED（可选）",
    "issuingAuthority": "颁布机关（可选）",
    "jurisdiction": "适用地区（可选）",
    "keywords": ["关键词1", "关键词2"]（可选）,
    "tags": ["标签1", "标签2"]（可选）,
    "level": 1（法律层级，可选）,
    "sourceId": "原始数据ID（可选）"
  }
]
```

### 4. 字段说明

| 字段 | 必填 | 说明 | 示例 |
|------|------|------|------|
| lawName | 是 | 法律名称 | "中华人民共和国民法典" |
| articleNumber | 是 | 法条编号 | "第一条" |
| fullText | 是 | 法条完整内容 | "为了保护..." |
| lawType | 是 | 法律类型（枚举） | "LAW", "CONSTITUTION", "ADMINISTRATIVE_REGULATION" |
| category | 是 | 法律类别（枚举） | "CIVIL", "CRIMINAL", "ADMINISTRATIVE" |
| subCategory | 否 | 子类别 | "总则" |
| effectiveDate | 是 | 生效日期 | "2021-01-01" |
| expiryDate | 否 | 失效日期 | "2025-01-01" |
| status | 否 | 法条状态 | "VALID", "AMENDED", "REPEALED", "EXPIRED" |
| issuingAuthority | 否 | 颁布机关 | "全国人民代表大会" |
| jurisdiction | 否 | 适用地区 | "全国" |
| keywords | 否 | 关键词数组 | ["民事", "权益"] |
| tags | 否 | 标签数组 | ["核心", "重要"] |
| level | 否 | 法律层级 | 1, 2, 3, 4, 5 |
| sourceId | 否 | 原始数据ID | "md5hash" |

### 5. 枚举值说明

#### lawType（法律类型）
- `CONSTITUTION` - 宪法
- `LAW` - 法律
- `ADMINISTRATIVE_REGULATION` - 行政法规
- `LOCAL_REGULATION` - 地方性法规
- `JUDICIAL_INTERPRETATION` - 司法解释
- `DEPARTMENTAL_RULE` - 部门规章
- `OTHER` - 其他

#### category（法律类别）
- `CIVIL` - 民事
- `CRIMINAL` - 刑事
- `ADMINISTRATIVE` - 行政
- `COMMERCIAL` - 商事
- `ECONOMIC` - 经济
- `LABOR` - 劳动
- `INTELLECTUAL_PROPERTY` - 知识产权
- `PROCEDURE` - 诉讼
- `OTHER` - 其他

#### status（法条状态）
- `VALID` - 有效
- `AMENDED` - 已修订
- `REPEALED` - 已废止
- `EXPIRED` - 已过期
- `DRAFT` - 草稿

## 使用场景

### 场景1：导入司法部数据

1. 从 https://flk.npc.gov.cn/ 下载法律法规数据包
2. 将数据转换为标准JSON格式
3. 在管理后台选择数据源为"司法部"
4. 上传JSON文件并导入

### 场景2：导入CAIL案例数据

1. 从CAIL官网下载案例数据
2. 转换为标准JSON格式
3. 选择数据源为"CAIL"
4. 上传并导入

### 场景3：批量更新现有法条

如果法条已存在（相同lawName和articleNumber），系统会自动更新法条内容，而不是创建重复记录。

## 注意事项

1. **单次导入限制**：最多1000条法条
2. **数据验证**：系统会自动验证必填字段和枚举值
3. **重复处理**：相同的法条（lawName + articleNumber）会自动更新
4. **错误处理**：导入失败的法条会显示在结果中，不影响其他法条的导入

## 常见问题

### Q: 导入失败怎么办？
A: 检查JSON格式是否正确，确保必填字段都已填写，枚举值是否合法。系统会显示具体的错误原因。

### Q: 如何确认导入是否成功？
A: 导入完成后会显示成功和失败的数量。刷新法条列表即可查看导入的数据。

### Q: 可以重复导入同一份数据吗？
A: 可以。如果法条已存在，系统会更新而不是创建重复记录。

### Q: 导入的数据可以修改吗？
A: 可以。导入后可以在法条管理页面查看、编辑和删除法条。

## 命令行导入（可选）

如果您更喜欢使用命令行工具，也可以通过以下命令导入数据：

```bash
# 导入司法部数据
npm run import:judiciary -- data/judiciary-laws.json

# 导入CAIL数据
npm run import:cail -- data/cail-cases.json

# 导入LaWGPT数据
npm run import:lawgpt -- data/lawgpt-articles.json

# 批量导入所有数据源
npm run import:all
```

## 更多帮助

如需了解更多关于数据源策略的信息，请参考：
- [数据源策略总体方案](./DATA_SOURCES_STRATEGY.md)
- [数据源实施指南](./DATA_SOURCE_IMPLEMENTATION_GUIDE.md)
