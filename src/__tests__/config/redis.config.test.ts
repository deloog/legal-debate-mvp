/**
 * Redis配置模块单元测试
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import {
  loadRedisConfig,
  validateRedisConfig,
  getRedisMode,
  getPersistenceMode,
  getConfigSummary,
  RedisMode,
  PersistenceMode,
  EvictionPolicy,
  type RedisConfig,
  type ConfigValidationResult,
} from '../../../config/redis.config';

describe('Redis配置模块', () => {
  // 保存原始环境变量
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    // 保存当前环境变量
    originalEnv = { ...process.env };

    // 重置环境变量为默认值
    // @ts-ignore - NODE_ENV 在测试中需要被修改
    delete process.env.NODE_ENV;
    delete process.env.REDIS_HOST;
    delete process.env.REDIS_PORT;
    delete process.env.REDIS_DB;
    delete process.env.REDIS_MODE;
    delete process.env.REDIS_PERSISTENCE_MODE;
    delete process.env.REDIS_MAX_MEMORY;
    delete process.env.REDIS_PASSWORD;
    delete process.env.REDIS_TLS;
    delete process.env.REDIS_APPEND_ONLY;
    delete process.env.REDIS_RENAME_COMMANDS;
    delete process.env.REDIS_SENTINEL_HOSTS;
    delete process.env.REDIS_SENTINEL_MASTER_NAME;
    delete process.env.REDIS_SENTINEL_PASSWORD;
    delete process.env.REDIS_CLUSTER_NODES;
  });

  afterEach(() => {
    // 恢复原始环境变量
    process.env = originalEnv;
  });

  describe('loadRedisConfig', () => {
    it('应该加载默认配置', () => {
      const config = loadRedisConfig();

      expect(config).toBeDefined();
      expect(config.mode).toBe(RedisMode.SINGLE);
      expect(config.host).toBe('localhost');
      expect(config.port).toBe(6379);
      expect(config.db).toBe(0);
    });

    it('应该从环境变量加载配置', () => {
      process.env.REDIS_HOST = 'redis.example.com';
      process.env.REDIS_PORT = '6380';
      process.env.REDIS_DB = '5';
      process.env.REDIS_PASSWORD = 'test-password';

      const config = loadRedisConfig();

      expect(config.host).toBe('redis.example.com');
      expect(config.port).toBe(6380);
      expect(config.db).toBe(5);
      expect(config.password).toBe('test-password');
    });

    it('应该根据环境设置生产配置', () => {
      // 设置生产环境，不设置REDIS_HOST以使用默认值
      // @ts-ignore - NODE_ENV 在测试中需要被修改
      process.env.NODE_ENV = 'production';

      const config = loadRedisConfig();

      expect(config.host).toBe('redis-prod');
      expect(config.tls).toBe(true);
      expect(config.maxRetries).toBe(5);
    });

    it('应该根据环境设置开发配置', () => {
      // @ts-ignore - NODE_ENV 在测试中需要被修改
      process.env.NODE_ENV = 'development';

      const config = loadRedisConfig();

      expect(config.host).toBe('localhost');
      expect(config.tls).toBe(false);
      expect(config.maxRetries).toBe(3);
    });

    it('应该支持哨兵模式', () => {
      process.env.REDIS_MODE = 'sentinel';
      process.env.REDIS_SENTINEL_HOSTS = '127.0.0.1:26379,127.0.0.1:26380';
      process.env.REDIS_SENTINEL_MASTER_NAME = 'mymaster';
      process.env.REDIS_SENTINEL_PASSWORD = 'sentinel-pass';

      const config = loadRedisConfig();

      expect(config.mode).toBe(RedisMode.SENTINEL);
      expect(config.sentinelHosts).toEqual([
        '127.0.0.1:26379',
        '127.0.0.1:26380',
      ]);
      expect(config.sentinelMasterName).toBe('mymaster');
      expect(config.sentinelPassword).toBe('sentinel-pass');
    });

    it('应该支持集群模式', () => {
      process.env.REDIS_MODE = 'cluster';
      process.env.REDIS_CLUSTER_NODES =
        '127.0.0.1:7000,127.0.0.1:7001,127.0.0.1:7002';

      const config = loadRedisConfig();

      expect(config.mode).toBe(RedisMode.CLUSTER);
      expect(config.clusterNodes).toHaveLength(3);
      expect(config.clusterNodes?.[0]).toEqual({
        host: '127.0.0.1',
        port: 7000,
      });
    });

    it('应该限制数值范围', () => {
      // 测试端口范围限制
      process.env.REDIS_PORT = '70000'; // 超出范围

      const config = loadRedisConfig();
      // getNumberEnv应该限制到max值
      expect(config.port).toBeLessThanOrEqual(65535);
    });

    it('应该正确处理布尔值环境变量', () => {
      process.env.REDIS_TLS = 'true';
      process.env.REDIS_APPEND_ONLY = 'false';

      const config = loadRedisConfig();

      expect(config.tls).toBe(true);
      expect(config.appendOnly).toBe(false);
    });

    it('应该处理JSON格式的重命名命令配置', () => {
      process.env.REDIS_RENAME_COMMANDS = '{"FLUSHDB":"","FLUSHALL":""}';

      const config = loadRedisConfig();

      expect(config.renameCommands).toEqual({ FLUSHDB: '', FLUSHALL: '' });
    });
  });

  describe('validateRedisConfig', () => {
    it('应该验证有效的配置', () => {
      const config: RedisConfig = {
        mode: RedisMode.SINGLE,
        host: 'localhost',
        port: 6379,
        password: 'password',
        db: 0,
        tls: false,
        maxRetries: 3,
        connectTimeout: 10000,
        idleTimeout: 30000,
        maxRetriesPerRequest: 3,
        enableReadyCheck: true,
        lazyConnect: true,
        keepAlive: 30000,
        persistenceMode: PersistenceMode.MIXED,
        saveEnabled: true,
        appendOnly: true,
        appendFsync: 'everysec',
        saveSeconds: 900,
        saveChanges: 1,
        maxMemory: 1073741824,
        maxMemoryPolicy: EvictionPolicy.VOLATILE_LRU,
        maxMemorySamples: 5,
        requirepass: false,
        bindAddresses: ['127.0.0.1'],
        protectedMode: false,
        renameCommands: {},
        slowlogLogSlowerThan: 10000,
        slowlogMaxLen: 128,
        latencyMonitorThreshold: 100,
      };

      const result = validateRedisConfig(config);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('应该拒绝无效的端口号', () => {
      const config: RedisConfig = {
        mode: RedisMode.SINGLE,
        host: 'localhost',
        port: 0, // 无效端口
        password: undefined,
        db: 0,
        tls: false,
        maxRetries: 3,
        connectTimeout: 10000,
        idleTimeout: 30000,
        maxRetriesPerRequest: 3,
        enableReadyCheck: true,
        lazyConnect: true,
        keepAlive: 30000,
        persistenceMode: PersistenceMode.MIXED,
        saveEnabled: true,
        appendOnly: true,
        appendFsync: 'everysec',
        saveSeconds: 900,
        saveChanges: 1,
        maxMemory: 1073741824,
        maxMemoryPolicy: EvictionPolicy.VOLATILE_LRU,
        maxMemorySamples: 5,
        requirepass: false,
        bindAddresses: ['127.0.0.1'],
        protectedMode: false,
        renameCommands: {},
        slowlogLogSlowerThan: 10000,
        slowlogMaxLen: 128,
        latencyMonitorThreshold: 100,
      };

      const result = validateRedisConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Redis端口无效: 0 (有效范围: 1-65535)');
    });

    it('应该拒绝空的主机地址', () => {
      const config: RedisConfig = {
        mode: RedisMode.SINGLE,
        host: '', // 空主机
        port: 6379,
        password: undefined,
        db: 0,
        tls: false,
        maxRetries: 3,
        connectTimeout: 10000,
        idleTimeout: 30000,
        maxRetriesPerRequest: 3,
        enableReadyCheck: true,
        lazyConnect: true,
        keepAlive: 30000,
        persistenceMode: PersistenceMode.MIXED,
        saveEnabled: true,
        appendOnly: true,
        appendFsync: 'everysec',
        saveSeconds: 900,
        saveChanges: 1,
        maxMemory: 1073741824,
        maxMemoryPolicy: EvictionPolicy.VOLATILE_LRU,
        maxMemorySamples: 5,
        requirepass: false,
        bindAddresses: ['127.0.0.1'],
        protectedMode: false,
        renameCommands: {},
        slowlogLogSlowerThan: 10000,
        slowlogMaxLen: 128,
        latencyMonitorThreshold: 100,
      };

      const result = validateRedisConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Redis主机地址不能为空');
    });

    it('应该拒绝无效的数据库索引', () => {
      const config: RedisConfig = {
        mode: RedisMode.SINGLE,
        host: 'localhost',
        port: 6379,
        password: undefined,
        db: 20, // 无效索引
        tls: false,
        maxRetries: 3,
        connectTimeout: 10000,
        idleTimeout: 30000,
        maxRetriesPerRequest: 3,
        enableReadyCheck: true,
        lazyConnect: true,
        keepAlive: 30000,
        persistenceMode: PersistenceMode.MIXED,
        saveEnabled: true,
        appendOnly: true,
        appendFsync: 'everysec',
        saveSeconds: 900,
        saveChanges: 1,
        maxMemory: 1073741824,
        maxMemoryPolicy: EvictionPolicy.VOLATILE_LRU,
        maxMemorySamples: 5,
        requirepass: false,
        bindAddresses: ['127.0.0.1'],
        protectedMode: false,
        renameCommands: {},
        slowlogLogSlowerThan: 10000,
        slowlogMaxLen: 128,
        latencyMonitorThreshold: 100,
      };

      const result = validateRedisConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        'Redis数据库索引无效: 20 (有效范围: 0-15)'
      );
    });

    it('应该拒绝过小的最大内存', () => {
      const config: RedisConfig = {
        mode: RedisMode.SINGLE,
        host: 'localhost',
        port: 6379,
        password: undefined,
        db: 0,
        tls: false,
        maxRetries: 3,
        connectTimeout: 10000,
        idleTimeout: 30000,
        maxRetriesPerRequest: 3,
        enableReadyCheck: true,
        lazyConnect: true,
        keepAlive: 30000,
        persistenceMode: PersistenceMode.MIXED,
        saveEnabled: true,
        appendOnly: true,
        appendFsync: 'everysec',
        saveSeconds: 900,
        saveChanges: 1,
        maxMemory: 1000, // 小于1MB
        maxMemoryPolicy: EvictionPolicy.VOLATILE_LRU,
        maxMemorySamples: 5,
        requirepass: false,
        bindAddresses: ['127.0.0.1'],
        protectedMode: false,
        renameCommands: {},
        slowlogLogSlowerThan: 10000,
        slowlogMaxLen: 128,
        latencyMonitorThreshold: 100,
      };

      const result = validateRedisConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        `Redis最大内存过小: ${config.maxMemory} (最小: 1MB)`
      );
    });

    it('应该对TLS连接给出警告', () => {
      const config: RedisConfig = {
        mode: RedisMode.SINGLE,
        host: 'localhost',
        port: 6379,
        password: undefined, // TLS但没有密码
        db: 0,
        tls: true, // 启用TLS
        maxRetries: 3,
        connectTimeout: 10000,
        idleTimeout: 30000,
        maxRetriesPerRequest: 3,
        enableReadyCheck: true,
        lazyConnect: true,
        keepAlive: 30000,
        persistenceMode: PersistenceMode.MIXED,
        saveEnabled: true,
        appendOnly: true,
        appendFsync: 'everysec',
        saveSeconds: 900,
        saveChanges: 1,
        maxMemory: 1073741824,
        maxMemoryPolicy: EvictionPolicy.VOLATILE_LRU,
        maxMemorySamples: 5,
        requirepass: false,
        bindAddresses: ['127.0.0.1'],
        protectedMode: false,
        renameCommands: {},
        slowlogLogSlowerThan: 10000,
        slowlogMaxLen: 128,
        latencyMonitorThreshold: 100,
      };

      const result = validateRedisConfig(config);

      expect(result.valid).toBe(true);
      expect(result.warnings).toContain('TLS连接建议使用密码认证');
    });

    it('应该验证哨兵配置', () => {
      const config: RedisConfig = {
        mode: RedisMode.SENTINEL,
        host: 'localhost',
        port: 6379,
        password: undefined,
        db: 0,
        tls: false,
        maxRetries: 3,
        connectTimeout: 10000,
        idleTimeout: 30000,
        maxRetriesPerRequest: 3,
        enableReadyCheck: true,
        lazyConnect: true,
        keepAlive: 30000,
        persistenceMode: PersistenceMode.MIXED,
        saveEnabled: true,
        appendOnly: true,
        appendFsync: 'everysec',
        saveSeconds: 900,
        saveChanges: 1,
        maxMemory: 1073741824,
        maxMemoryPolicy: EvictionPolicy.VOLATILE_LRU,
        maxMemorySamples: 5,
        requirepass: false,
        bindAddresses: ['127.0.0.1'],
        protectedMode: false,
        renameCommands: {},
        slowlogLogSlowerThan: 10000,
        slowlogMaxLen: 128,
        latencyMonitorThreshold: 100,
        sentinelHosts: [], // 空哨兵主机
        sentinelMasterName: 'mymaster',
      };

      const result = validateRedisConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('哨兵模式需要配置sentinelHosts');
    });

    it('应该验证集群配置', () => {
      const config: RedisConfig = {
        mode: RedisMode.CLUSTER,
        host: 'localhost',
        port: 6379,
        password: undefined,
        db: 0,
        tls: false,
        maxRetries: 3,
        connectTimeout: 10000,
        idleTimeout: 30000,
        maxRetriesPerRequest: 3,
        enableReadyCheck: true,
        lazyConnect: true,
        keepAlive: 30000,
        persistenceMode: PersistenceMode.MIXED,
        saveEnabled: true,
        appendOnly: true,
        appendFsync: 'everysec',
        saveSeconds: 900,
        saveChanges: 1,
        maxMemory: 1073741824,
        maxMemoryPolicy: EvictionPolicy.VOLATILE_LRU,
        maxMemorySamples: 5,
        requirepass: false,
        bindAddresses: ['127.0.0.1'],
        protectedMode: false,
        renameCommands: {},
        slowlogLogSlowerThan: 10000,
        slowlogMaxLen: 128,
        latencyMonitorThreshold: 100,
        clusterNodes: [{ host: '127.0.0.1', port: 7000 }], // 只有1个节点
      };

      const result = validateRedisConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('集群模式至少需要3个节点');
    });
  });

  describe('getRedisMode', () => {
    it('应该返回默认模式', () => {
      delete process.env.REDIS_MODE;

      const mode = getRedisMode();

      expect(mode).toBe(RedisMode.SINGLE);
    });

    it('应该从环境变量读取模式', () => {
      process.env.REDIS_MODE = 'sentinel';

      const mode = getRedisMode();

      expect(mode).toBe(RedisMode.SENTINEL);
    });
  });

  describe('getPersistenceMode', () => {
    it('应该返回默认持久化模式', () => {
      delete process.env.REDIS_PERSISTENCE_MODE;

      const mode = getPersistenceMode();

      expect(mode).toBe(PersistenceMode.MIXED);
    });

    it('应该从环境变量读取持久化模式', () => {
      process.env.REDIS_PERSISTENCE_MODE = 'aof';

      const mode = getPersistenceMode();

      expect(mode).toBe(PersistenceMode.AOF);
    });
  });

  describe('getConfigSummary', () => {
    it('应该生成配置摘要', () => {
      const config: RedisConfig = {
        mode: RedisMode.SINGLE,
        host: 'localhost',
        port: 6379,
        password: 'test-password',
        db: 0,
        tls: false,
        maxRetries: 3,
        connectTimeout: 10000,
        idleTimeout: 30000,
        maxRetriesPerRequest: 3,
        enableReadyCheck: true,
        lazyConnect: true,
        keepAlive: 30000,
        persistenceMode: PersistenceMode.MIXED,
        saveEnabled: true,
        appendOnly: true,
        appendFsync: 'everysec',
        saveSeconds: 900,
        saveChanges: 1,
        maxMemory: 1073741824,
        maxMemoryPolicy: EvictionPolicy.VOLATILE_LRU,
        maxMemorySamples: 5,
        requirepass: false,
        bindAddresses: ['127.0.0.1'],
        protectedMode: false,
        renameCommands: {},
        slowlogLogSlowerThan: 10000,
        slowlogMaxLen: 128,
        latencyMonitorThreshold: 100,
      };

      const summary = getConfigSummary(config);

      expect(summary).toContain('Redis配置摘要');
      expect(summary).toContain('模式: single');
      expect(summary).toContain('主机: localhost');
      expect(summary).toContain('端口: 6379');
      expect(summary).toContain('密码认证: 启用');
      expect(summary).toContain('最大内存: 1024.00MB');
      expect(summary).toContain('持久化模式: mixed');
    });

    it('应该显示哨兵配置摘要', () => {
      const config: RedisConfig = {
        mode: RedisMode.SENTINEL,
        host: 'localhost',
        port: 6379,
        password: 'test-password',
        db: 0,
        tls: false,
        maxRetries: 3,
        connectTimeout: 10000,
        idleTimeout: 30000,
        maxRetriesPerRequest: 3,
        enableReadyCheck: true,
        lazyConnect: true,
        keepAlive: 30000,
        persistenceMode: PersistenceMode.MIXED,
        saveEnabled: true,
        appendOnly: true,
        appendFsync: 'everysec',
        saveSeconds: 900,
        saveChanges: 1,
        maxMemory: 1073741824,
        maxMemoryPolicy: EvictionPolicy.VOLATILE_LRU,
        maxMemorySamples: 5,
        requirepass: false,
        bindAddresses: ['127.0.0.1'],
        protectedMode: false,
        renameCommands: {},
        slowlogLogSlowerThan: 10000,
        slowlogMaxLen: 128,
        latencyMonitorThreshold: 100,
        sentinelHosts: ['127.0.0.1:26379', '127.0.0.1:26380'],
        sentinelMasterName: 'mymaster',
        sentinelPassword: 'sentinel-pass',
      };

      const summary = getConfigSummary(config);

      expect(summary).toContain('哨兵配置');
      expect(summary).toContain('哨兵主机: 127.0.0.1:26379, 127.0.0.1:26380');
      expect(summary).toContain('主节点名称: mymaster');
      expect(summary).toContain('哨兵密码: 已配置');
    });

    it('应该显示集群配置摘要', () => {
      const config: RedisConfig = {
        mode: RedisMode.CLUSTER,
        host: 'localhost',
        port: 6379,
        password: 'test-password',
        db: 0,
        tls: false,
        maxRetries: 3,
        connectTimeout: 10000,
        idleTimeout: 30000,
        maxRetriesPerRequest: 3,
        enableReadyCheck: true,
        lazyConnect: true,
        keepAlive: 30000,
        persistenceMode: PersistenceMode.MIXED,
        saveEnabled: true,
        appendOnly: true,
        appendFsync: 'everysec',
        saveSeconds: 900,
        saveChanges: 1,
        maxMemory: 1073741824,
        maxMemoryPolicy: EvictionPolicy.VOLATILE_LRU,
        maxMemorySamples: 5,
        requirepass: false,
        bindAddresses: ['127.0.0.1'],
        protectedMode: false,
        renameCommands: {},
        slowlogLogSlowerThan: 10000,
        slowlogMaxLen: 128,
        latencyMonitorThreshold: 100,
        clusterNodes: [
          { host: '127.0.0.1', port: 7000 },
          { host: '127.0.0.1', port: 7001 },
          { host: '127.0.0.1', port: 7002 },
        ],
      };

      const summary = getConfigSummary(config);

      expect(summary).toContain('集群配置');
      expect(summary).toContain(
        '集群节点: 127.0.0.1:7000, 127.0.0.1:7001, 127.0.0.1:7002'
      );
    });
  });
});
