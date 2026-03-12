#!/bin/bash

# API测试脚本
# 用于运行API测试并生成覆盖率报告

echo "🧪 运行API测试..."
echo "================================"

# 运行API测试
npx jest --config=jest.config.api.js src/__tests__/api/

echo ""
echo "📊 生成覆盖率报告..."
echo "================================"

# 生成覆盖率报告
npx jest --config=jest.config.api.js src/__tests__/api/ --coverage

echo ""
echo "✅ API测试完成！"
echo "📁 覆盖率报告位置: coverage/api/"
