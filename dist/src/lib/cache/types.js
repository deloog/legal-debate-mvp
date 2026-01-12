'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.defaultCacheConfig =
  exports.CacheStrategy =
  exports.CacheNamespace =
    void 0;
// 缓存命名空间枚举
var CacheNamespace;
(function (CacheNamespace) {
  CacheNamespace['USER_SESSION'] = 'user_session';
  CacheNamespace['USER_DATA'] = 'user_data';
  CacheNamespace['AI_RESPONSE'] = 'ai_response';
  CacheNamespace['CONFIGURATION'] = 'configuration';
  CacheNamespace['DATABASE_QUERY'] = 'database_query';
  CacheNamespace['API_RESPONSE'] = 'api_response';
  CacheNamespace['TEMPORARY'] = 'temporary';
  CacheNamespace['SYSTEM'] = 'system';
})(CacheNamespace || (exports.CacheNamespace = CacheNamespace = {}));
// 缓存策略枚举
var CacheStrategy;
(function (CacheStrategy) {
  CacheStrategy['LAZY_LOADING'] = 'lazy_loading';
  CacheStrategy['WRITE_THROUGH'] = 'write_through';
  CacheStrategy['WRITE_BEHIND'] = 'write_behind';
  CacheStrategy['REFRESH_AHEAD'] = 'refresh_ahead';
})(CacheStrategy || (exports.CacheStrategy = CacheStrategy = {}));
// 默认缓存配置
exports.defaultCacheConfig = {
  keyPrefix: process.env.CACHE_KEY_PREFIX || 'legal_debate:',
  defaultTtl: parseInt(process.env.CACHE_DEFAULT_TTL || '3600', 10), // 1小时
  sessionTtl: parseInt(process.env.CACHE_SESSION_TTL || '1800', 10), // 30分钟
  configTtl: parseInt(process.env.CACHE_CONFIG_TTL || '86400', 10), // 24小时
  enableMetrics: process.env.NODE_ENV !== 'production',
  enableCompression: false,
  maxKeyLength: 2000, // 增加到2000，支持更长的缓存键
  maxValueSize: 1024 * 1024, // 1MB
};
