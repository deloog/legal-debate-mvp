-- 创建测试数据库
CREATE DATABASE legal_debate_test;

-- 创建用户并授予权限
-- 注意：这些命令在Docker环境中通常不是必需的，
-- 因为环境变量已经设置了用户和权限

-- 为开发数据库授予权限
GRANT ALL PRIVILEGES ON DATABASE legal_debate_dev TO postgres;

-- 为测试数据库授予权限
GRANT ALL PRIVILEGES ON DATABASE legal_debate_test TO postgres;

-- 创建扩展（如果需要）
-- \c legal_debate_dev;
-- CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
-- CREATE EXTENSION IF NOT EXISTS "pg_trgm";
