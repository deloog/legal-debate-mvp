# 部署脚本使用指南

## 概述

本目录包含用于部署律伴助手系统的脚本工具。

## 脚本列表

| 脚本 | 说明 |
|------|------|
| `config.sh` | 配置文件，定义所有部署相关参数 |
| `lib.sh` | 公共函数库，包含共享的辅助函数 |
| `check-environment.sh` | 环境检查脚本，验证部署环境 |
| `migrate-database.sh` | 数据库迁移脚本，执行数据库升级 |
| `deploy-app.sh` | 应用部署脚本，构建和部署应用 |

## 使用方法

### 1. 环境检查

在部署之前，首先运行环境检查脚本验证部署环境：

```bash
cd scripts/deploy
./check-environment.sh
```

环境检查包括：
- 配置文件检查
- 环境变量检查
- 依赖服务检查（Docker、Docker Compose等）
- 系统资源检查（磁盘空间、内存）
- 网络连接检查
- 服务状态检查

检查结果会显示在终端和日志文件中。

### 2. 数据库迁移

执行数据库迁移：

```bash
cd scripts/deploy
./migrate-database.sh
```

数据库迁移流程：
1. 备份当前数据库
2. 执行Prisma迁移
3. 初始化种子数据
4. 验证迁移结果
5. 清理旧备份

如果迁移失败，会自动回滚到之前的备份。

### 3. 应用部署

部署应用到生产环境：

```bash
cd scripts/deploy
./deploy-app.sh
```

应用部署流程：
1. 构建Next.js应用
2. 构建Docker镜像
3. 停止旧容器
4. 启动新容器
5. 健康检查
6. 验证部署
7. 清理Docker资源

如果部署失败，会自动回滚到上一个版本。

## 环境变量

### 必需变量

| 变量名 | 说明 |
|--------|------|
| `DEPLOY_ENV` | 部署环境：development、staging、production |
| `DATABASE_URL` | 数据库连接字符串 |
| `REDIS_HOST` | Redis服务器地址 |
| `JWT_SECRET` | JWT密钥 |

### 生产环境必需变量

| 变量名 | 说明 |
|--------|------|
| `ZHIPU_API_KEY` | 智谱AI API密钥 |
| `DEEPSEEK_API_KEY` | DeepSeek API密钥 |
| `POSTGRES_PASSWORD` | PostgreSQL密码 |
| `REDIS_PASSWORD` | Redis密码 |

### 可选变量

| 变量名 | 默认值 | 说明 |
|--------|---------|------|
| `DEBUG` | false | 是否启用调试模式 |
| `APP_NAME` | legal-debate | 应用名称 |
| `APP_VERSION` | latest | 应用版本 |
| `APP_PORT` | 3000 | 应用端口 |
| `BACKUP_RETENTION_DAYS` | 7 | 备份保留天数 |
| `HEALTH_CHECK_RETRIES` | 30 | 健康检查重试次数 |
| `HEALTH_CHECK_INTERVAL` | 2 | 健康检查间隔（秒） |
| `MIN_DISK_SPACE_MB` | 1000 | 最小磁盘空间（MB） |
| `MIN_MEMORY_MB` | 1024 | 最小内存（MB） |

## 目录结构

```
scripts/deploy/
├── config.sh              # 配置文件
├── lib.sh                 # 公共函数库
├── check-environment.sh    # 环境检查脚本
├── migrate-database.sh      # 数据库迁移脚本
├── deploy-app.sh           # 应用部署脚本
└── README.md              # 本文档
```

## 日志文件

所有脚本都会生成日志文件，位于：

- `${PROJECT_ROOT}/logs/deploy.log` - 部署日志
- `${PROJECT_ROOT}/logs/environment-check-report.txt` - 环境检查报告

## 完整部署流程

### 开发环境部署

```bash
# 1. 设置环境变量
export DEPLOY_ENV=development

# 2. 运行环境检查
./scripts/deploy/check-environment.sh

# 3. 数据库迁移（如需要）
./scripts/deploy/migrate-database.sh

# 4. 部署应用
./scripts/deploy/deploy-app.sh
```

### 生产环境部署

```bash
# 1. 设置环境变量
export DEPLOY_ENV=production

# 2. 加载生产环境变量
source ../../.env.production

# 3. 运行环境检查
./scripts/deploy/check-environment.sh

# 4. 数据库迁移
./scripts/deploy/migrate-database.sh

# 5. 部署应用
./scripts/deploy/deploy-app.sh
```

## 回滚操作

### 数据库回滚

```bash
# 手动回滚数据库
./scripts/deploy/migrate-database.sh rollback <backup-file>
```

### 应用回滚

应用部署脚本会在失败时自动回滚。如需手动回滚：

```bash
# 查看上一个版本
cat ../../.previous-version

# 手动回滚
./scripts/deploy/deploy-app.sh
# 脚本会检测到失败并自动回滚
```

## 故障排查

### 问题：Docker命令未找到

**解决方案**：
- 安装Docker：https://docs.docker.com/get-docker/
- 安装Docker Compose：https://docs.docker.com/compose/install/

### 问题：环境检查失败

**解决方案**：
- 检查环境变量是否正确设置
- 查看日志文件：`../../logs/deploy.log`
- 检查磁盘空间是否充足

### 问题：数据库迁移失败

**解决方案**：
- 检查数据库连接是否正常
- 检查备份文件是否存在
- 查看详细错误日志
- 尝试手动回滚：`./migrate-database.sh rollback <backup-file>`

### 问题：应用部署失败

**解决方案**：
- 检查Docker容器状态：`docker ps -a`
- 查看容器日志：`docker logs legal-debate-app`
- 检查端口是否被占用
- 查看部署日志：`../../logs/deploy.log`

## 最佳实践

1. **在部署前进行环境检查**：确保所有依赖和资源满足要求
2. **备份数据库**：数据库迁移前自动备份，但建议手动备份
3. **在测试环境验证**：先在测试环境验证，再部署到生产环境
4. **监控日志**：实时监控部署日志，及时发现问题
5. **准备回滚计划**：准备好回滚方案，确保能快速恢复
6. **定期清理备份**：避免备份占用过多磁盘空间

## 注意事项

1. **Windows用户**：需要使用Git Bash或WSL（Windows Subsystem for Linux）运行这些脚本
2. **权限要求**：需要Docker和数据库操作的相应权限
3. **网络要求**：需要访问外部网络（下载依赖、AI服务等）
4. **磁盘空间**：确保有足够的磁盘空间用于构建和备份

## 支持和反馈

如果遇到问题，请：
1. 查看日志文件获取详细信息
2. 检查本文档的故障排查部分
3. 联系运维团队获取支持

## 版本历史

| 版本 | 日期 | 说明 |
|------|------|------|
| 1.0.0 | 2026-01-18 | 初始版本，包含基础部署脚本 |
