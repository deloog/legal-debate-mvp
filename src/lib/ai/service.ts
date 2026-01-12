// 重构后的AI服务 - 使用模块化架构
import { AIService, AIServiceFactory } from './service-refactored';

// 重新导出以保持向后兼容
export { AIService, AIServiceFactory };
export default AIServiceFactory;
