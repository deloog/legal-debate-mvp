"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AIServiceFactory = exports.AIService = void 0;
// 重构后的AI服务 - 使用模块化架构
const service_refactored_1 = require("./service-refactored");
Object.defineProperty(exports, "AIService", {
  enumerable: true,
  get: function () {
    return service_refactored_1.AIService;
  },
});
Object.defineProperty(exports, "AIServiceFactory", {
  enumerable: true,
  get: function () {
    return service_refactored_1.AIServiceFactory;
  },
});
exports.default = service_refactored_1.AIServiceFactory;
