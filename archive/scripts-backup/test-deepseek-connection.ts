import { loadEnvConfig } from '@next/env';
import { OpenAI } from 'openai';

// 加载环境变量
loadEnvConfig(process.cwd());

async function testDeepSeekConnection() {
  console.log('测试DeepSeek API连接...');
  console.log(
    'API Key:',
    process.env.DEEPSEEK_API_KEY?.substring(0, 10) + '...'
  );
  console.log('Base URL:', process.env.DEEPSEEK_BASE_URL);

  try {
    const client = new OpenAI({
      apiKey: process.env.DEEPSEEK_API_KEY,
      baseURL: process.env.DEEPSEEK_BASE_URL,
      timeout: 10000,
    });

    console.log('开始API调用...');
    const response = await client.chat.completions.create({
      model: 'deepseek-chat',
      messages: [
        {
          role: 'user',
          content: "你好，请回复'成功'",
        },
      ],
      max_tokens: 10,
    });

    console.log('API调用成功！');
    console.log('响应:', JSON.stringify(response, null, 2));
  } catch (error) {
    console.error('API调用失败:', error);
    if (error instanceof Error) {
      console.error('错误消息:', error.message);
      console.error('错误堆栈:', error.stack);
    }
  }
}

testDeepSeekConnection();
