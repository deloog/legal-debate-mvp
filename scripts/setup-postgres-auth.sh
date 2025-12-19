#!/bin/bash

# PostgreSQL认证设置脚本
# 用于配置无密码数据库访问

echo "设置PostgreSQL认证配置..."

# 设置PGPASSFILE环境变量
export PGPASSFILE="$(pwd)/.pgpass"

# 确保.pgpass文件权限正确（Windows系统可能不支持chmod，但我们在Unix系统上需要）
if [[ "$OSTYPE" == "linux-gnu"* ]] || [[ "$OSTYPE" == "darwin"* ]]; then
    chmod 600 .pgpass
    echo "已设置.pgpass文件权限为600"
fi

# 验证.pgpass文件是否存在
if [ ! -f ".pgpass" ]; then
    echo "错误: .pgpass文件不存在"
    exit 1
fi

echo "PostgreSQL认证配置完成"
echo "PGPASSFILE=$PGPASSFILE"
echo ""
echo "现在您可以运行以下命令而无需输入密码："
echo "- psql postgresql://postgres:password@localhost:5432/legal_debate_dev"
echo "- pg_dump postgresql://postgres:password@localhost:5432/legal_debate_dev"
echo "- pg_restore [备份文件]"
