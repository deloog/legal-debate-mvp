/**
 * Docker Compose 配置验证单元测试
 */

import {
  validateDockerComposeConfig,
  validatePortFormat,
  validateEnvVariableFormat,
  generateConfigSummary,
} from '@/lib/docker/validate-config';
import type { DockerComposeConfig } from '@/types/docker-compose';

describe('validateDockerComposeConfig', () => {
  it('应该验证有效的配置', () => {
    const config: unknown = {
      version: '3.8',
      services: {
        postgres: {
          image: 'postgres:15',
        },
        redis: {
          image: 'redis:7',
        },
        app: {
          build: { context: '..', dockerfile: 'Dockerfile' },
        },
      },
    };

    const result = validateDockerComposeConfig(config);

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('应该拒绝无效的配置类型', () => {
    const result = validateDockerComposeConfig(null);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('配置必须是一个对象');
  });

  it('应该拒绝缺少版本的配置', () => {
    const config: unknown = {
      services: {
        postgres: {
          image: 'postgres:15',
        },
      },
    };

    const result = validateDockerComposeConfig(config);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('缺少或无效的 version 字段');
  });

  it('应该拒绝缺少服务的配置', () => {
    const config: unknown = {
      version: '3.8',
    };

    const result = validateDockerComposeConfig(config);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('缺少或无效的 services 字段');
  });

  it('应该拒绝空服务列表', () => {
    const config: unknown = {
      version: '3.8',
      services: {},
    };

    const result = validateDockerComposeConfig(config);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('services 不能为空');
  });

  it('应该警告缺少必需的服务', () => {
    const config: unknown = {
      version: '3.8',
      services: {
        postgres: {
          image: 'postgres:15',
        },
      },
    };

    const result = validateDockerComposeConfig(config);

    expect(result.valid).toBe(true);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0]).toContain('缺少必需的服务');
  });

  it('应该验证服务配置', () => {
    const config: unknown = {
      version: '3.8',
      services: {
        app: {},
      },
    };

    const result = validateDockerComposeConfig(config);

    expect(result.valid).toBe(false);
    const hasImageBuildError = result.errors.some(error =>
      error.includes('必须指定 image 或 build')
    );
    expect(hasImageBuildError).toBe(true);
  });

  it('应该验证环境变量', () => {
    const config: unknown = {
      version: '3.8',
      services: {
        postgres: {
          image: 'postgres:15',
          environment: null,
        },
      },
    };

    const result = validateDockerComposeConfig(config);

    expect(result.valid).toBe(false);
    const hasEnvError = result.errors.some(error =>
      error.includes('environment 必须是一个对象')
    );
    expect(hasEnvError).toBe(true);
  });

  it('应该验证端口配置', () => {
    const config: unknown = {
      version: '3.8',
      services: {
        postgres: {
          image: 'postgres:15',
          ports: null,
        },
      },
    };

    const result = validateDockerComposeConfig(config);

    expect(result.valid).toBe(false);
    const hasPortsError = result.errors.some(error =>
      error.includes('ports 必须是一个数组')
    );
    expect(hasPortsError).toBe(true);
  });

  it('应该验证健康检查配置', () => {
    const config: unknown = {
      version: '3.8',
      services: {
        postgres: {
          image: 'postgres:15',
          healthcheck: {
            test: 'invalid',
            interval: '10s',
            timeout: '5s',
            retries: 5,
          },
        },
      },
    };

    const result = validateDockerComposeConfig(config);

    expect(result.valid).toBe(false);
    const hasHealthcheckError = result.errors.some(error =>
      error.includes('healthcheck.test 必须是一个数组')
    );
    expect(hasHealthcheckError).toBe(true);
  });
});

describe('validatePortFormat', () => {
  it('应该接受单个端口', () => {
    expect(validatePortFormat('8080')).toBe(true);
  });

  it('应该接受端口映射', () => {
    expect(validatePortFormat('8080:3000')).toBe(true);
  });

  it('应该接受带协议的端口映射', () => {
    expect(validatePortFormat('8080:3000/tcp')).toBe(true);
    expect(validatePortFormat('8080:3000/udp')).toBe(true);
  });

  it('应该拒绝无效的端口格式', () => {
    expect(validatePortFormat('invalid')).toBe(false);
    expect(validatePortFormat('8080:')).toBe(false);
    expect(validatePortFormat(':3000')).toBe(false);
    expect(validatePortFormat('8080:3000/ftp')).toBe(false);
  });
});

describe('validateEnvVariableFormat', () => {
  it('应该接受有效的环境变量键', () => {
    expect(validateEnvVariableFormat('NODE_ENV')).toBe(true);
    expect(validateEnvVariableFormat('DATABASE_URL')).toBe(true);
    expect(validateEnvVariableFormat('REDIS_HOST')).toBe(true);
  });

  it('应该拒绝空键', () => {
    expect(validateEnvVariableFormat('')).toBe(false);
    expect(validateEnvVariableFormat(null as unknown as string)).toBe(false);
  });

  it('应该拒绝包含空格的键', () => {
    expect(validateEnvVariableFormat('NODE ENV')).toBe(false);
    expect(validateEnvVariableFormat(' DATABASE_URL')).toBe(false);
  });

  it('应该拒绝非字符串键', () => {
    expect(validateEnvVariableFormat(123 as unknown as string)).toBe(false);
    expect(validateEnvVariableFormat(undefined as unknown as string)).toBe(
      false
    );
  });
});

describe('generateConfigSummary', () => {
  it('应该生成配置摘要', () => {
    const config: DockerComposeConfig = {
      version: '3.8',
      services: {
        postgres: {
          image: 'postgres:15',
          container_name: 'postgres',
          restart: 'always',
          ports: ['5432:5432'],
          healthcheck: {
            test: ['CMD-SHELL', 'pg_isready'],
            interval: '10s',
            timeout: '5s',
            retries: 5,
          },
        },
        redis: {
          image: 'redis:7',
        },
        app: {
          build: { context: '..', dockerfile: 'Dockerfile' },
          container_name: 'app',
        },
      },
      networks: {
        backend: { driver: 'bridge' },
      },
      volumes: {
        postgres_data: { driver: 'local' },
      },
    };

    const summary = generateConfigSummary(config);

    expect(summary).toContain('Docker Compose 配置摘要:');
    expect(summary).toContain('版本: 3.8');
    expect(summary).toContain('服务:');
    expect(summary).toContain('  - postgres');
    expect(summary).toContain('    镜像: postgres:15');
    expect(summary).toContain('    容器名: postgres');
    expect(summary).toContain('    重启策略: always');
    expect(summary).toContain('    端口: 5432:5432');
    expect(summary).toContain('    健康检查: 启用');
    expect(summary).toContain('  - redis');
    expect(summary).toContain('  - app');
    expect(summary).toContain('    构建: ../Dockerfile');
    expect(summary).toContain('网络:');
    expect(summary).toContain('  - backend (bridge)');
    expect(summary).toContain('数据卷:');
    expect(summary).toContain('  - postgres_data (local)');
  });

  it('应该处理没有网络和数据卷的配置', () => {
    const config: DockerComposeConfig = {
      version: '3.8',
      services: {
        app: {
          image: 'app:latest',
        },
      },
    };

    const summary = generateConfigSummary(config);

    expect(summary).toContain('Docker Compose 配置摘要:');
    expect(summary).toContain('服务:');
    expect(summary).not.toContain('网络:');
    expect(summary).not.toContain('数据卷:');
  });
});
