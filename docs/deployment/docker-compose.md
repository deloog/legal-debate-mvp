# Docker Compose 部署指南

本文档介绍如何使用 Docker Compose 部署法律辩论 MVP 应用程序。

## 目录

- [前置要求](#前置要求)
- [快速开始](#快速开始)
- [配置说明](#配置说明)
- [部署流程](#部署流程)
- [环境管理](#环境管理)
- [故障排查](#故障排查)
- [配置验证](#配置验证)

## 前置要求

- Docker Engine 20.10+
- Docker Compose 2.0+
- 至少 4GB 可用内存
- 至少 10GB 可用磁盘空间

## 快速开始

### 1. 克隆项目

```bash
git clone <repository-url>
cd legal_debate_mvp
```

### 2. 配置环境变量

```bash
# 复制环境变量模板
cp .env.example .env

# 编辑 .env 文件，填写必要的配置
# 或者使用开发环境默认配置
```

### 3. 启动服务（开发环境）

```bash
# 使用开发环境配置启动
docker-compose -f config/docker-compose.yml up -d

# 查看服务状态
docker-compose -f config/docker-compose.yml ps

# 查看日志
docker-compose -f config/docker-compose.yml logs -f
```

### 4. 访问应用

- **Web 应用**: http://localhost:3000
- **API 文档**: http://localhost:3000/api/docs
- **PostgreSQL**: localhost:5432
- **Redis**: localhost:6379

## 配置说明

### 环境变量

应用使用 `.env` 文件配置环境变量。关键配置项：

```env
# 数据库配置
POSTGRES_DB=legal_debate
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your_password
POSTGRES_PORT=5432

# Redis 配置
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password

# 应用配置
NODE_ENV=development
APP_PORT=3000
DATABASE_URL=postgresql://postgres:your_password@postgres:5432/legal_debate

# JWT 配置
JWT_SECRET=your_jwt_secret_key
JWT_EXPIRES_IN=7d
BCRYPT_SALT_ROUNDS=10

# AI 服务配置
USE_REAL_AI=false  # 开发环境使用 Mock AI
ZHIPU_API_KEY=your_zhipu_api_key
DEEPSEEK_API_KEY=your_deepseek_api_key
OPENAI_API_KEY=your_openai_api_key
```

### 端口映射

| 服务 | 容器端口 | 主机端口（开发） | 主机端口（生产） |
|------|---------|----------------|----------------|
| App | 3000 | 3000 | 80, 443 |
| PostgreSQL | 5432 | 5432 | - |
| Redis | 6379 | 6379 | - |

## 部署流程

### 开发环境部署

1. **启动服务**

```bash
docker-compose -f config/docker-compose.yml up -d
```

2. **运行数据库迁移**

```bash
# 进入应用容器
docker-compose -f config/docker-compose.yml exec app bash

# 运行 Prisma 迁移
npx prisma migrate deploy

# 填充初始数据
npm run seed

# 退出容器
exit
```

3. **验证服务状态**

```bash
# 检查所有服务是否健康
docker-compose -f config/docker-compose.yml ps

# 检查应用日志
docker-compose -f config/docker-compose.yml logs app
```

### 生产环境部署

1. **配置生产环境变量**

创建生产环境配置文件：

```bash
cp .env.example .env.production
# 编辑 .env.production，填写生产环境配置
```

2. **构建并启动服务**

```bash
# 使用生产环境配置启动
docker-compose -f config/docker-compose.prod.yml up -d --build
```

3. **配置 SSL/TLS（可选）**

使用 Nginx 反向代理和 Let's Encrypt：

```bash
# 安装 certbot
apt-get install certbot python3-certbot-nginx

# 获取 SSL 证书
certbot --nginx -d your-domain.com
```

## 环境管理

### 启动服务

```bash
# 开发环境
docker-compose -f config/docker-compose.yml up -d

# 生产环境
docker-compose -f config/docker-compose.prod.yml up -d
```

### 停止服务

```bash
# 停止所有服务
docker-compose -f config/docker-compose.yml down

# 停止并删除数据卷（谨慎使用）
docker-compose -f config/docker-compose.yml down -v
```

### 重启服务

```bash
# 重启所有服务
docker-compose -f config/docker-compose.yml restart

# 重启特定服务
docker-compose -f config/docker-compose.yml restart app
```

### 查看日志

```bash
# 查看所有服务日志
docker-compose -f config/docker-compose.yml logs

# 查看特定服务日志
docker-compose -f config/docker-compose.yml logs app

# 实时跟踪日志
docker-compose -f config/docker-compose.yml logs -f app
```

### 更新服务

```bash
# 拉取最新代码
git pull origin main

# 重新构建并启动
docker-compose -f config/docker-compose.yml up -d --build

# 运行数据库迁移
docker-compose -f config/docker-compose.yml exec app npx prisma migrate deploy
```

## 故障排查

### 服务无法启动

1. **检查端口占用**

```bash
# Windows
netstat -ano | findstr :3000

# Linux/Mac
lsof -i :3000
```

2. **检查磁盘空间**

```bash
# Windows
dir

# Linux/Mac
df -h
```

3. **查看详细日志**

```bash
docker-compose -f config/docker-compose.yml logs --tail=100 app
```

### 数据库连接失败

1. **检查 PostgreSQL 服务状态**

```bash
docker-compose -f config/docker-compose.yml ps postgres
```

2. **测试数据库连接**

```bash
docker-compose -f config/docker-compose.yml exec app npx prisma db push
```

3. **检查环境变量**

```bash
docker-compose -f config/docker-compose.yml config
```

### 应用启动缓慢

1. **检查资源使用**

```bash
docker stats
```

2. **增加资源限制**

编辑 `config/docker-compose.prod.yml`：

```yaml
services:
  app:
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 4G
        reservations:
          cpus: '1.0'
          memory: 2G
```

### 健康检查失败

1. **查看健康检查状态**

```bash
docker inspect <container_id> | grep -A 10 Health
```

2. **调整健康检查参数**

编辑 `config/docker-compose.yml`：

```yaml
services:
  postgres:
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U postgres']
      interval: 10s
      timeout: 5s
      retries: 10
      start_period: 30s
```

## 配置验证

### 使用验证工具

项目提供了 Docker Compose 配置验证工具：

```bash
# 运行验证测试
npm test -- src/__tests__/lib/docker/validate-config.test.ts

# 使用 Node.js 验证配置文件
node -e "
const { validateDockerComposeConfig, generateConfigSummary } = require('./src/lib/docker/validate-config');
const fs = require('fs');
const yaml = require('js-yaml');

// 读取配置文件
const config = yaml.load(fs.readFileSync('config/docker-compose.yml', 'utf8'));

// 验证配置
const result = validateDockerComposeConfig(config);
console.log('验证结果:', result.valid ? '通过' : '失败');
console.log('错误:', result.errors);
console.log('警告:', result.warnings);

// 生成配置摘要
console.log('\n' + generateConfigSummary(config));
"
```

### 手动验证清单

- [ ] Docker 和 Docker Compose 版本符合要求
- [ ] 环境变量已正确配置
- [ ] 端口未被占用
- [ ] 磁盘空间充足
- [ ] 网络连接正常
- [ ] 数据库凭据正确
- [ ] AI API 密钥已设置（如需使用真实 AI）
- [ ] SSL/TLS 证书已配置（生产环境）

## 备份与恢复

### 备份数据库

```bash
# 备份 PostgreSQL 数据
docker-compose -f config/docker-compose.yml exec postgres pg_dump -U postgres legal_debate > backup.sql

# 备份数据卷
docker run --rm -v legal_debate_mvp_postgres_data:/data -v $(pwd):/backup alpine tar czf /backup/postgres_data.tar.gz -C /data .
```

### 恢复数据库

```bash
# 恢复 PostgreSQL 数据
cat backup.sql | docker-compose -f config/docker-compose.yml exec -T postgres psql -U postgres legal_debate

# 恢复数据卷
docker run --rm -v legal_debate_mvp_postgres_data:/data -v $(pwd):/backup alpine tar xzf /backup/postgres_data.tar.gz -C /data
```

## 性能优化

### 资源限制

根据实际负载调整资源限制：

```yaml
services:
  app:
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 4G
        reservations:
          cpus: '1.0'
          memory: 2G
```

### 日志轮转

配置日志轮转防止磁盘填满：

```yaml
services:
  app:
    logging:
      driver: 'json-file'
      options:
        max-size: '10m'
        max-file: '3'
```

## 安全建议

1. **使用强密码**: 生产环境必须使用强密码
2. **限制网络访问**: 仅暴露必要的端口
3. **定期更新**: 及时更新 Docker 镜像和依赖
4. **启用 SSL/TLS**: 生产环境必须启用 HTTPS
5. **监控日志**: 定期检查服务日志
6. **备份数据**: 定期备份数据库和重要数据

## 参考资料

- [Docker Compose 官方文档](https://docs.docker.com/compose/)
- [Next.js 部署指南](https://nextjs.org/docs/deployment)
- [Prisma 部署指南](https://www.prisma.io/docs/guides/deployment)
