#!/usr/bin/env tsx

/**
 * DeepSeek API连接诊断脚本
 *
 * 用于诊断DeepSeek API连接问题，输出详细的错误信息
 */

import { config } from 'dotenv';
import OpenAI from 'openai';

// 加载环境变量
config();

// 输出环境变量（隐藏敏感信息）
console.log('=== 环境变量检查 ===');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log(
  'DEEPSEEK_API_KEY:',
  process.env.DEEPSEEK_API_KEY
    ? `${process.env.DEEPSEEK_API_KEY.substring(0, 8)}...`
    : 'NOT CONFIGURED'
);
console.log(
  'DEEPSEEK_BASE_URL:',
  process.env.DEEPSEEK_BASE_URL || 'NOT CONFIGURED'
);
console.log('');

async function testDeepSeekConnection() {
  console.log('=== DeepSeek API 连接测试 ===');

  const apiKey = process.env.DEEPSEEK_API_KEY;
  const baseURL =
    process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1';

  if (!apiKey) {
    console.error('❌ DEEPSEEK_API_KEY 未配置');
    return false;
  }

  console.log('API密钥格式检查:');
  if (apiKey.startsWith('sk-')) {
    console.log('✅ API密钥格式正确（以sk-开头）');
  } else {
    console.log('⚠️ API密钥格式可能不正确（应以sk-开头）');
  }

  console.log('');
  console.log('API客户端配置:');
  console.log('Base URL:', baseURL);
  console.log('');

  // 创建OpenAI客户端
  let client: OpenAI;
  try {
    client = new OpenAI({
      apiKey: apiKey,
      baseURL: baseURL,
      timeout: 30000, // 30秒超时
    });
    console.log('✅ OpenAI客户端创建成功');
  } catch (error) {
    console.error('❌ OpenAI客户端创建失败:', error);
    return false;
  }

  console.log('');
  console.log('=== 测试1: 简单聊天请求 ===');
  try {
    const response = await client.chat.completions.create({
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: '你好' }],
      max_tokens: 10,
    });

    console.log('✅ 请求成功');
    console.log('响应内容:', response.choices[0]?.message?.content);
    console.log('模型:', response.model);
    console.log('Token使用:', response.usage);
    return true;
  } catch (error: unknown) {
    console.error('❌ 请求失败');

    if (error instanceof Error) {
      console.error('错误类型:', error.constructor.name);
      console.error('错误消息:', error.message);

      // 检查是否是OpenAI SDK错误
      const openAIError = error as {
        status?: number;
        code?: string;
        type?: string;
      };
      if (openAIError.status) {
        console.error('HTTP状态码:', openAIError.status);
        if (openAIError.status === 401) {
          console.error('⚠️  API密钥无效或已过期');
        } else if (openAIError.status === 429) {
          console.error('⚠️  请求频率超限');
        } else if (openAIError.status === 500) {
          console.error('⚠️  服务器内部错误');
        }
      }
      if (openAIError.code) {
        console.error('错误代码:', openAIError.code);
      }
      if (openAIError.type) {
        console.error('错误类型:', openAIError.type);
      }
    }

    console.error('完整错误对象:', error);
    return false;
  }
}

async function testDeepSeekModels() {
  console.log('');
  console.log('=== 测试2: 查询可用模型 ===');

  const apiKey = process.env.DEEPSEEK_API_KEY;
  const baseURL =
    process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1';

  try {
    const client = new OpenAI({
      apiKey: apiKey,
      baseURL: baseURL,
      timeout: 30000,
    });

    // 注意：DeepSeek可能不支持models端点，这只是测试
    try {
      const models = await client.models.list();
      console.log('✅ 模型列表获取成功');
      console.log('可用模型数量:', models.data.length);
      models.data.forEach((model, index) => {
        console.log(`  ${index + 1}. ${model.id}`);
      });
    } catch {
      console.log('⚠️  模型列表端点不可用（DeepSeek可能不支持此端点）');
      console.log('这通常是正常的，不影响聊天功能');
    }
  } catch (error) {
    console.error('❌ 查询模型失败:', error);
  }
}

async function testDifferentBaseURLs() {
  console.log('');
  console.log('=== 测试3: 尝试不同的Base URL ===');

  const apiKey = process.env.DEEPSEEK_API_KEY;
  const urls = [
    'https://api.deepseek.com/v1',
    'https://api.deepseek.com',
    'https://api.deepseek.com/chat/completions',
  ];

  for (const url of urls) {
    console.log(`\n尝试Base URL: ${url}`);

    try {
      const client = new OpenAI({
        apiKey: apiKey,
        baseURL: url,
        timeout: 10000,
      });

      await client.chat.completions.create({
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: 'test' }],
        max_tokens: 1,
      });

      console.log(`✅ Base URL ${url} 可用`);
      return url;
    } catch (error: unknown) {
      console.log(`❌ Base URL ${url} 不可用`);
      if (error instanceof Error) {
        console.log(`   错误: ${error.message}`);
      }
    }
  }

  return null;
}

async function main() {
  console.log('DeepSeek API 连接诊断工具');
  console.log('======================================\n');

  const test1Result = await testDeepSeekConnection();
  await testDeepSeekModels();
  const workingURL = await testDifferentBaseURLs();

  console.log('\n======================================');
  console.log('=== 诊断结果汇总 ===');

  if (test1Result) {
    console.log('✅ DeepSeek API连接正常，可以使用');
  } else {
    console.log('❌ DeepSeek API连接失败');
    console.log('');
    console.log('可能的解决方案:');
    console.log(
      '1. 检查API密钥是否正确（访问 https://platform.deepseek.com/apikeys）'
    );
    console.log('2. 检查API密钥是否已过期');
    console.log('3. 检查网络连接是否正常');
    console.log('4. 检查是否需要配置代理（如果在中国大陆）');
    console.log('5. 尝试更新DEEPSEEK_BASE_URL环境变量');

    if (workingURL) {
      console.log(`\n💡 建议将DEEPSEEK_BASE_URL设置为: ${workingURL}`);
    }
  }
}

// 运行诊断
main().catch(error => {
  console.error('诊断脚本执行失败:', error);
  process.exit(1);
});
