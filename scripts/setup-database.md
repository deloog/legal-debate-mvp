# 数据库设置指南

## 方案1: 使用Docker运行PostgreSQL（推荐）

### 1. 启动PostgreSQL容器
```bash
docker run --name legal-debate-postgres \
  -e POSTGRES_DB=legal_debate_dev \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=password \
  -p 5432:5432 \
  -d postgres:15
```

### 2. 创建测试数据库
```bash
docker exec legal-debate-postgres psql -U postgres -c "CREATE DATABASE legal_debate_test;"
```

## 方案2: 本地PostgreSQL安装

如果您已经安装了本地PostgreSQL，请执行以下步骤：

### 1. 创建数据库
```sql
CREATE DATABASE legal_debate_dev;
CREATE DATABASE legal_debate_test;
```

### 2. 创建用户（可选）
```sql
CREATE USER postgres WITH PASSWORD 'password';
GRANT ALL PRIVILEGES ON DATABASE legal_debate_dev TO postgres;
GRANT ALL PRIVILEGES ON DATABASE legal_debate_test TO postgres;
```

## 验证连接

### 1. 检查Docker容器状态
```bash
docker ps | grep legal-debate-postgres
```

### 2. 测试数据库连接
```bash
npm run db:generate
npm run db:migrate -- --name init
```

## 环境变量配置

确保您的`.env`文件包含正确的数据库URL：

```env
# 开发环境
DATABASE_URL="postgresql://postgres:password@localhost:5432/legal_debate_dev"

# 测试环境
TEST_DATABASE_URL="postgresql://postgres:password@localhost:5432/legal_debate_test"
```

## 常见问题

### 连接被拒绝
- 确保PostgreSQL服务正在运行
- 检查端口5432是否被占用
- 验证防火墙设置

### 认证失败
- 检查用户名和密码是否正确
- 确保数据库用户具有适当的权限

### 数据库不存在
- 运行数据库创建命令
- 检查数据库名称拼写
