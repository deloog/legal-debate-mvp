@echo off
REM PostgreSQL认证设置脚本 (Windows版本)
REM 用于配置无密码数据库访问

echo 设置PostgreSQL认证配置...

REM 设置PGPASSFILE和PGPASSWORD环境变量
set PGPASSFILE=%cd%\.pgpass
set PGPASSWORD=TFL5650056btg

REM 验证.pgpass文件是否存在
if not exist ".pgpass" (
    echo 错误: .pgpass文件不存在
    exit /b 1
)

echo PostgreSQL认证配置完成
echo PGPASSFILE=%PGPASSFILE%
echo PGPASSWORD=[已设置]
echo.
echo 现在您可以运行以下命令而无需输入密码：
echo - psql postgresql://postgres:TFL5650056btg@localhost:5432/legal_debate_dev
echo - pg_dump postgresql://postgres:TFL5650056btg@localhost:5432/legal_debate_dev
echo - pg_restore [备份文件]
echo.
REM 在当前会话中保持环境变量
cmd /k
