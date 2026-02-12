# Just-Laws 数据下载和导入指南

## 概述

Just-Laws 是一个包含31部法律的GitHub开源项目。本指南说明如何下载并导入这些数据到系统。

## 项目地址

https://github.com/ImCa0/just-laws

## 下载方式

### 方式一：直接下载（推荐）

1. 访问项目页面：https://github.com/ImCa0/just-laws
2. 点击绿色的 "Code" 按钮
3. 选择 "Download ZIP"
4. 解压下载的ZIP文件
5. 找到数据文件（通常是 `data.json` 或类似文件）

### 方式二：使用Git克隆

如果您的网络可以访问GitHub，可以使用以下命令：

```bash
# 克隆仓库
git clone https://github.com/ImCa0/just-laws.git

# 进入目录
cd just-laws

# 查看数据文件
ls -la
```

### 方式三：使用镜像站（国内推荐）

如果GitHub访问困难，可以使用以下方式：

1. **使用Gitee镜像**
   - 访问：https://gitee.com/mirrors/just-laws（如果存在）
   
2. **使用FastGit镜像**
   - 将 `github.com` 替换为 `github.com.cnpmjs.org`
   - 访问：https://github.com.cnpmjs.org/ImCa0/just-laws

3. **使用下载工具**
   - 使用下载工具（如IDM、迅雷等）下载ZIP文件
   - 直接访问：https://github.com/ImCa0/just-laws/archive/refs/heads/main.zip

## 数据格式

Just-Laws 数据通常包含以下字段：

```json
{
  "title": "法律名称",
  "article": "条号",
  "content": "法条内容",
  "law_type": "法律类型（可选）",
  "category": "类别（可选）",
  "effective_date": "生效日期（可选）",
  "issuing_authority": "颁布机关（可选）"
}
```

## 转换和导入

### 方式一：使用管理后台（推荐）

1. **准备数据**
   - 下载并解压 Just-Laws 数据包
   - 将数据文件保存到本地

2. **转换数据**（如果需要）
   ```bash
   # 如果数据格式不是标准格式，使用转换脚本
   npm run import:convert-just-laws -- path/to/data.json
   ```

3. **导入数据**
   - 登录管理后台
   - 进入 `法条管理` 页面
   - 点击 `导入法条` 按钮
   - 选择数据源为 `local` 或 `just-laws`
   - 选择 `上传文件` 方式
   - 选择数据文件
   - 点击 `导入`

### 方式二：使用命令行

```bash
# 1. 转换数据（如果需要）
npm run import:convert-just-laws -- data/just-laws/data.json

# 2. 导入数据
npm run import:judiciary -- data/just-laws-converted-xxx.json
```

## 自动转换脚本

项目已包含 Just-Laws 数据转换脚本：`scripts/import-data/convert-just-laws.ts`

### 功能特性

- 自动映射法律类型和类别
- 生成可搜索文本
- 提取关键词
- 生成唯一标识
- 支持多种数据格式

### 使用方法

```bash
# 转换数据
npm run import:convert-just-laws <原始数据文件路径>

# 示例
npm run import:convert-just-laws data/just-laws/data.json
```

转换后会生成一个新的JSON文件：`just-laws-converted-[时间戳].json`

## 数据映射

### 类别映射

| 原始类别 | 系统类别 |
|-----------|----------|
| 宪法 | OTHER |
| 民事 | CIVIL |
| 刑事 | CRIMINAL |
| 行政 | ADMINISTRATIVE |
| 商事 | COMMERCIAL |
| 经济 | ECONOMIC |
| 劳动 | LABOR |
| 知识产权 | INTELLECTUAL_PROPERTY |
| 诉讼 | PROCEDURE |
| 其他 | OTHER |

### 法律类型映射

| 原始类型 | 系统类型 |
|---------|----------|
| 宪法 | CONSTITUTION |
| 法律 | LAW |
| 行政法规 | ADMINISTRATIVE_REGULATION |
| 地方性法规 | LOCAL_REGULATION |
| 司法解释 | JUDICIAL_INTERPRETATION |
| 部门规章 | DEPARTMENTAL_RULE |
| 其他 | OTHER |

## 预期数据量

根据项目描述，Just-Laws 包含约31部法律，每部法律可能包含数十到数百条法条。

预计总法条数量：**500-2000条**

## 常见问题

### Q: 下载失败怎么办？
A: 
- 尝试使用镜像站
- 使用下载工具下载ZIP文件
- 或请求他人帮忙下载后发送给您

### Q: 数据格式不对怎么办？
A: 使用项目提供的转换脚本进行格式转换。

### Q: 导入后如何验证？
A: 
1. 导入完成后查看成功/失败数量
2. 在法条管理页面查看导入的法条
3. 尝试搜索测试法条是否可正常显示

### Q: 可以重复导入吗？
A: 可以。如果法条已存在（相同的法律名称和条号），系统会更新而不是创建重复记录。

### Q: 导入的数据来源标识是什么？
A: 建议使用 `local` 或 `just-laws` 作为数据源标识。

## 下一步

导入 Just-Laws 数据后，您可以：

1. **查看法条**：在法条管理页面查看所有导入的法条
2. **搜索测试**：使用搜索功能测试法条是否正常工作
3. **数据对比**：对比其他数据源，检查是否有重复或缺失
4. **定期更新**：关注 Just-Laws 项目更新，及时导入新数据

## 技术支持

如有问题，请参考：
- [数据源策略总体方案](./DATA_SOURCES_STRATEGY.md)
- [数据源实施指南](./DATA_SOURCE_IMPLEMENTATION_GUIDE.md)
- [管理后台导入指南](./DATA_IMPORT_USER_GUIDE.md)
