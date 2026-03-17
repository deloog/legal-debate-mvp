// Jest polyfill configuration
// 为node环境提供必要的polyfills（jsdom环境会自动提供这些API）

// 确保测试使用 legal_debate_test 数据库，而不是开发数据库
// 在 Prisma 客户端初始化之前设置正确的环境变量
const path = require('path');
const dotenv = require('dotenv');
// 加载 .env.test（会覆盖 process.env 中已有的值，除非设置 override:false）
dotenv.config({ path: path.resolve(__dirname, '.env.test'), override: true });
// 为测试数据库连接加上限制，防止多个 PrismaClient 实例耗尽连接池
if (process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('connection_limit')) {
  process.env.DATABASE_URL = process.env.DATABASE_URL + '?connection_limit=3&pool_timeout=10';
}

// 只在node环境中需要这些polyfills
if (typeof window === 'undefined') {
  // 为 @testing-library/user-event 的 Clipboard.js afterEach 回调提供最小 window stub
  // 当 components 项目与 unit 项目共享 worker 时，Clipboard.js 注册的 afterEach 会在
  // node 环境下尝试访问 globalThis.window.navigator，如果 window 未定义则报错
  global.window = global.window || { navigator: { clipboard: undefined } };
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
