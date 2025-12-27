require("dotenv").config();
const { Pool } = require("pg");

const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ||
    "postgresql://postgres:password@localhost:5432/legal_debate_dev",
});

async function seedDatabase() {
  const client = await pool.connect();

  try {
    console.log("开始插入种子数据...");

    // 插入用户数据
    await client.query(`
      INSERT INTO users (id, email, name) VALUES 
        ('test-user-1', 'test@example.com', 'Test User'),
        ('admin-user-1', 'admin@example.com', 'Admin User')
      ON CONFLICT (email) DO NOTHING
    `);

    // 插入文档数据
    await client.query(`
      INSERT INTO documents (id, title, filename, fileSize, mimeType, content, userId) VALUES 
        ('doc-1', 'Sample Legal Contract', 'sample_contract.pdf', 1024000, 'application/pdf', 'This is a sample legal contract content...', 'test-user-1')
      ON CONFLICT DO NOTHING
    `);

    // 插入分析数据
    await client.query(`
      INSERT INTO analyses (id, documentId, userId, type, result, status) VALUES 
        ('analysis-1', 'doc-1', 'test-user-1', 'DOCUMENT_SUMMARY', 
        '{"summary": "This is a standard service contract", "keyPoints": ["Service scope", "Payment terms", "Confidentiality agreement"], "risks": ["Breach liability needs clarification"]}', 
        'COMPLETED')
      ON CONFLICT DO NOTHING
    `);

    // 插入聊天消息
    await client.query(`
      INSERT INTO chat_messages (id, documentId, role, content, metadata) VALUES 
        ('msg-1', 'doc-1', 'USER', 'Please analyze the main risk points of this contract', '{"timestamp": "2024-01-01T00:00:00Z"}'),
        ('msg-2', 'doc-1', 'ASSISTANT', 'Based on the contract content, I found the following main risk points: 1. Unclear breach liability...', '{"model": "gpt-4", "tokens": 150}')
      ON CONFLICT DO NOTHING
    `);

    // 插入AI交互记录
    await client.query(`
      INSERT INTO ai_interactions (id, type, request, response, model, tokensUsed, duration, success) VALUES 
        ('ai-1', 'document_analysis', 
        '{"documentId": "doc-1", "analysisType": "DOCUMENT_SUMMARY"}', 
        '{"summary": "This is a standard service contract"}', 
        'gpt-4', 250, 1500, true)
      ON CONFLICT DO NOTHING
    `);

    console.log("种子数据插入完成！");

    // 显示插入的数据统计
    const userCount = await client.query("SELECT COUNT(*) as count FROM users");
    const docCount = await client.query(
      "SELECT COUNT(*) as count FROM documents",
    );
    const analysisCount = await client.query(
      "SELECT COUNT(*) as count FROM analyses",
    );
    const msgCount = await client.query(
      "SELECT COUNT(*) as count FROM chat_messages",
    );
    const aiCount = await client.query(
      "SELECT COUNT(*) as count FROM ai_interactions",
    );

    console.log("\n数据统计：");
    console.log(`- 用户: ${userCount.rows[0].count} 个`);
    console.log(`- 文档: ${docCount.rows[0].count} 个`);
    console.log(`- 分析: ${analysisCount.rows[0].count} 个`);
    console.log(`- 聊天消息: ${msgCount.rows[0].count} 个`);
    console.log(`- AI交互: ${aiCount.rows[0].count} 个`);
  } catch (error) {
    console.error("种子数据插入失败:", error);
  } finally {
    client.release();
    await pool.end();
  }
}

seedDatabase();
