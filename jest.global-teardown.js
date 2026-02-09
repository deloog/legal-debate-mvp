/**
 * Jest Global Teardown
 * 测试环境全局清理
 */
module.exports = async () => {
  console.log('🧹 Jest Global Teardown: 清理测试环境...');

  // 清理全局状态
  if (global.gc) {
    console.log('🧹 执行垃圾回收...');
    global.gc();
  }

  console.log('✅ Jest Global Teardown 完成');
};
