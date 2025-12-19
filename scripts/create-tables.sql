-- 创建用户表
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建账户表
CREATE TABLE IF NOT EXISTS accounts (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    type TEXT NOT NULL,
    provider TEXT NOT NULL,
    providerAccountId TEXT NOT NULL,
    refresh_token TEXT,
    access_token TEXT,
    expires_at INTEGER,
    token_type TEXT,
    scope TEXT,
    id_token TEXT,
    session_state TEXT,
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(provider, providerAccountId)
);

-- 创建会话表
CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    sessionToken TEXT UNIQUE NOT NULL,
    userId TEXT NOT NULL,
    expires TIMESTAMP NOT NULL,
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
);

-- 创建文档表
CREATE TABLE IF NOT EXISTS documents (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    filename TEXT NOT NULL,
    fileSize INTEGER NOT NULL,
    mimeType TEXT NOT NULL,
    content TEXT NOT NULL,
    userId TEXT NOT NULL,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
);

-- 创建分析表
CREATE TABLE IF NOT EXISTS analyses (
    id TEXT PRIMARY KEY,
    documentId TEXT NOT NULL,
    userId TEXT NOT NULL,
    type TEXT NOT NULL,
    result JSONB,
    status TEXT DEFAULT 'PENDING',
    error TEXT,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (documentId) REFERENCES documents(id) ON DELETE CASCADE,
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
);

-- 创建聊天消息表
CREATE TABLE IF NOT EXISTS chat_messages (
    id TEXT PRIMARY KEY,
    documentId TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    metadata JSONB,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (documentId) REFERENCES documents(id) ON DELETE CASCADE
);

-- 创建AI交互表
CREATE TABLE IF NOT EXISTS ai_interactions (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    request JSONB NOT NULL,
    response JSONB NOT NULL,
    model TEXT NOT NULL,
    tokensUsed INTEGER,
    duration INTEGER,
    success BOOLEAN NOT NULL,
    error TEXT,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 插入测试数据
INSERT INTO users (id, email, name) VALUES 
    ('test-user-1', 'test@example.com', '测试用户'),
    ('test-user-2', 'admin@example.com', '管理员')
ON CONFLICT (email) DO NOTHING;

INSERT INTO documents (id, title, filename, fileSize, mimeType, content, userId) VALUES 
    ('doc-1', '示例法律合同', 'sample_contract.pdf', 1024000, 'application/pdf', '这是一个示例法律合同的内容...', 'test-user-1')
ON CONFLICT DO NOTHING;

INSERT INTO analyses (id, documentId, userId, type, result, status) VALUES 
    ('analysis-1', 'doc-1', 'test-user-1', 'DOCUMENT_SUMMARY', 
    '{"summary": "这是一份标准的服务合同", "keyPoints": ["服务范围", "付款条款", "保密协议"], "risks": ["违约责任需要明确"]}', 
    'COMPLETED')
ON CONFLICT DO NOTHING;

-- 显示创建的表
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
ORDER BY table_name;
