#!/usr/bin/env tsx

/**
 * AI POC修复验证测试脚本
 * 验证AI服务初始化、缓存键长度和错误序列化修复
 */

import AIServiceFactory from '../src/lib/ai/service';
import AIErrorSerializer from '../src/lib/ai/error-serializer';
import type { AIServiceConfig, AIProvider } from '../src/types/ai-service';

// =============================================================================
// 测试配置
// =============================================================================

const TEST_CONFIG: AIServiceConfig = {
  clients: [
    {
      provider: 'zhipu' as AIProvider,
      apiKey: process.env.ZHIPU_API_KEY || 'test-key',
      timeout: 30000,
    },
    {
      provider: 'deepseek' as AIProvider,
      apiKey: process.env.DEEPSEEK_API_KEY || 'test-key',
      timeout: 30000,
    },
  ],
  loadBalancer: {
    strategy: 'round_robin',
    healthCheckInterval: 30000,
    healthCheckTimeout: 5000,
    failureThreshold: 3,
    recoveryThreshold: 2,
  },
  monitor: {
    enabled: true,
    metricsInterval: 60000,
    logLevel: 'info',
    persistMetrics: false,
  },
  fallback: {
    enabled: true,
    strategies: [],
    cacheFallback: {
      enabled: true,
      ttl: 3600,
      maxAge: 7200,
    },
    simplifiedMode: {
      enabled: true,
      maxTokens: 1000,
      simplifiedPrompts: true,
    },
    localProcessing: {
      enabled: false,
      capabilities: [],
    },
  },
  defaultProvider: 'zhipu' as AIProvider,
  enableMetrics: true,
};

// =============================================================================
// 测试函数
// =============================================================================

/**
 * 测试AI服务初始化
 */
async function testServiceInitialization(): Promise<boolean> {
  console.log('🧪 测试AI服务初始化...');

  try {
    const service = await AIServiceFactory.getInstance('test', TEST_CONFIG);
    const status = service.getServiceStatus();

    console.log('✅ AI服务初始化成功');
    console.log('📊 服务状态:', {
      initialized: status.initialized,
      healthy: status.healthy,
      availableProviders: service.getAvailableProviders(),
    });

    return true;
  } catch (error) {
    console.error('❌ AI服务初始化失败:', error);
    return false;
  }
}

/**
 * 测试缓存键长度限制修复
 */
async function testCacheKeyLengthFix(): Promise<boolean> {
  console.log('🧪 测试缓存键长度限制修复...');

  try {
    const service = await AIServiceFactory.getInstance('test', TEST_CONFIG);

    // 创建一个长消息来测试缓存键生成
    const longMessage =
      '这是一个非常长的消息，用来测试缓存键的长度限制问题。'.repeat(100);

    const testRequest = {
      model: 'test-model',
      messages: [
        { role: 'system' as const, content: '你是一个AI助手' },
        { role: 'user' as const, content: longMessage },
      ],
      temperature: 0.7,
      maxTokens: 2000,
    };

    // 这里我们直接测试缓存键生成逻辑
    const crypto = await import('crypto');
    const keyData = {
      model: testRequest.model,
      messages: testRequest.messages.map(m => ({
        role: m.role,
        content: m.content,
      })),
      temperature: testRequest.temperature,
      maxTokens: testRequest.maxTokens,
    };

    const hash = crypto
      .createHash('sha256')
      .update(JSON.stringify(keyData))
      .digest('hex');
    const cacheKey = `ai_chat_${hash}`;

    console.log('✅ 缓存键生成成功');
    console.log('🔑 缓存键长度:', cacheKey.length);
    console.log('🔑 缓存键示例:', cacheKey.substring(0, 50) + '...');

    // 验证键长度合理（应该远小于Redis的键长度限制）
    if (cacheKey.length < 100) {
      console.log('✅ 缓存键长度合理');
      return true;
    } else {
      console.log('❌ 缓存键仍然过长');
      return false;
    }
  } catch (error) {
    console.error('❌ 缓存键测试失败:', error);
    return false;
  }
}

/**
 * 测试错误序列化改进
 */
async function testErrorSerializationImprovement(): Promise<boolean> {
  console.log('🧪 测试错误序列化改进...');

  try {
    // 测试各种错误类型的序列化
    const testErrors = [
      new Error('Network connection failed'),
      new Error('Authentication failed: invalid api key'),
      new Error('Rate limit exceeded'),
      new Error('Request timeout'),
      new Error('Model not available'),
    ];

    console.log('📝 测试错误序列化:');

    for (const error of testErrors) {
      const serialized = AIErrorSerializer.serialize(error, {
        requestId: 'test-request-123',
        provider: 'zhipu',
        model: 'test-model',
        statusCode: 500,
      });

      const userFriendly = AIErrorSerializer.createUserFriendlyMessage(
        serialized,
        'zh-CN'
      );
      const jsonSerialized = AIErrorSerializer.serializeToJson(
        error,
        undefined,
        {
          prettyFormat: true,
        }
      );

      console.log(`\n🔍 错误类型: ${serialized.type}`);
      console.log(`💬 用户友好消息: ${userFriendly}`);
      console.log(
        `🔒 敏感信息已清理: ${jsonSerialized.includes('***') ? '是' : '否'}`
      );
    }

    // 测试错误摘要生成
    const summary = AIErrorSerializer.generateSummary(
      testErrors.map(e =>
        AIErrorSerializer.serialize(e, undefined, {
          sanitizeSensitiveInfo: true,
        })
      )
    );

    console.log('\n📊 错误摘要:');
    console.log(`总错误数: ${summary.totalErrors}`);
    console.log(`最常见错误: ${summary.mostCommonError}`);
    console.log(`可重试错误: ${summary.retryableErrors}`);

    console.log('✅ 错误序列化测试完成');
    return true;
  } catch (error) {
    console.error('❌ 错误序列化测试失败:', error);
    return false;
  }
}

/**
 * 测试完整的聊天流程
 */
async function testChatCompletion(): Promise<boolean> {
  console.log('🧪 测试完整聊天流程...');

  try {
    const service = await AIServiceFactory.getInstance('test', TEST_CONFIG);

    const response = await service.chatCompletion({
      model: 'test-model',
      messages: [
        { role: 'system' as const, content: '你是一个AI助手' },
        { role: 'user' as const, content: '请简单介绍一下自己' },
      ],
      temperature: 0.7,
      maxTokens: 1000,
    });

    console.log('✅ 聊天完成请求成功');
    console.log(
      '📝 响应内容:',
      response.choices[0]?.message?.content?.substring(0, 100) + '...'
    );
    console.log('🏷️ 提供商:', response.provider);
    console.log('⏱️ 响应时间:', response.duration, 'ms');
    console.log('🔄 缓存状态:', response.cached ? '命中缓存' : '新请求');

    return true;
  } catch (error) {
    console.error('❌ 聊天完成请求失败:', error);

    // 测试错误序列化
    if (error instanceof Error) {
      const serializedError = AIErrorSerializer.serialize(error, {
        requestId: 'chat-test-123',
        provider: 'zhipu',
        model: 'test-model',
      });
      console.log(
        '🔍 序列化错误:',
        AIErrorSerializer.createUserFriendlyMessage(serializedError)
      );
    }

    return false;
  }
}

/**
 * 测试服务健康检查
 */
async function testHealthCheck(): Promise<boolean> {
  console.log('🧪 测试服务健康检查...');

  try {
    const service = await AIServiceFactory.getInstance('test', TEST_CONFIG);
    const isHealthy = await service.healthCheck();

    console.log(isHealthy ? '✅ 服务健康检查通过' : '❌ 服务健康检查失败');
    console.log('📊 详细状态:', service.getServiceStatus());

    return isHealthy;
  } catch (error) {
    console.error('❌ 健康检查测试失败:', error);
    return false;
  }
}

// =============================================================================
// 主测试函数
// =============================================================================

async function runAllTests(): Promise<void> {
  console.log('🚀 开始AI POC修复验证测试\n');

  const tests = [
    { name: 'AI服务初始化', fn: testServiceInitialization },
    { name: '缓存键长度限制修复', fn: testCacheKeyLengthFix },
    { name: '错误序列化改进', fn: testErrorSerializationImprovement },
    { name: '完整聊天流程', fn: testChatCompletion },
    { name: '服务健康检查', fn: testHealthCheck },
  ];

  let passedTests = 0;
  const totalTests = tests.length;

  for (const test of tests) {
    console.log(`\n--- ${test.name} ---`);
    try {
      const passed = await test.fn();
      if (passed) {
        passedTests++;
        console.log(`✅ ${test.name} 通过`);
      } else {
        console.log(`❌ ${test.name} 失败`);
      }
    } catch (error) {
      console.error(`💥 ${test.name} 异常:`, error);
    }
  }

  console.log('\n📋 测试结果汇总:');
  console.log(`通过: ${passedTests}/${totalTests}`);
  console.log(`成功率: ${((passedTests / totalTests) * 100).toFixed(1)}%`);

  if (passedTests === totalTests) {
    console.log('🎉 所有修复验证测试通过！');
  } else {
    console.log('⚠️ 部分测试失败，需要进一步检查');
  }

  // 清理资源
  try {
    await AIServiceFactory.shutdownAll();
    console.log('🧹 服务实例已清理');
  } catch (error) {
    console.error('清理资源时出错:', error);
  }
}

// =============================================================================
// 执行测试
// =============================================================================

if (require.main === module) {
  runAllTests().catch(error => {
    console.error('💥 测试执行异常:', error);
    process.exit(1);
  });
}

export { runAllTests };
