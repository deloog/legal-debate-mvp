// Jest polyfill configuration
// 为node环境提供必要的polyfills（jsdom环境会自动提供这些API）

// 只在node环境中需要这些polyfills
if (typeof window === 'undefined') {
  // 添加TextEncoder和TextDecoder到global
  const { TextEncoder, TextDecoder } = require('util');
  if (typeof global.TextEncoder === 'undefined') {
    global.TextEncoder = TextEncoder;
  }
  if (typeof global.TextDecoder === 'undefined') {
    global.TextDecoder = TextDecoder;
  }

  // 添加web-streams-polyfill（仅node环境需要）
  require('web-streams-polyfill/polyfill');
}

// 添加ResizeObserver polyfill（用于图表组件的响应式测试）
global.ResizeObserver = class ResizeObserver {
  constructor(callback) {
    this.callback = callback;
  }
  observe(target) {
    // 模拟观察
    setTimeout(() => {
      this.callback([], this);
    }, 0);
  }
  unobserve() {
    // 模拟取消观察
  }
  disconnect() {
    // 模拟断开连接
  }
};

// 注意：window对象由jsdom环境自动提供，这里不需要手动创建
// matchMedia polyfill在src/test-utils/setup.ts中已经提供
