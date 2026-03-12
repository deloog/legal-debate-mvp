/**
 * Docker Compose 配置验证工具
 */

import type {
  DockerComposeConfig,
  DockerComposeService,
  DockerComposeValidationResult,
} from '@/types/docker-compose';

/**
 * 验证 Docker Compose 配置
 */
export function validateDockerComposeConfig(
  config: unknown
): DockerComposeValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 检查是否为对象
  if (typeof config !== 'object' || config === null) {
    return {
      valid: false,
      errors: ['配置必须是一个对象'],
      warnings: [],
    };
  }

  const composeConfig = config as Partial<DockerComposeConfig>;

  // 检查版本
  if (typeof composeConfig.version !== 'string') {
    errors.push('缺少或无效的 version 字段');
  }

  // 检查服务
  if (
    typeof composeConfig.services !== 'object' ||
    composeConfig.services === null
  ) {
    errors.push('缺少或无效的 services 字段');
  } else {
    const services = Object.entries(composeConfig.services);

    if (services.length === 0) {
      errors.push('services 不能为空');
    }

    // 验证每个服务
    for (const [serviceName, service] of services) {
      const serviceValidation = validateService(serviceName, service);
      errors.push(...serviceValidation.errors);
      warnings.push(...serviceValidation.warnings);
    }
  }

  // 验证必需的服务
  const requiredServices = ['postgres', 'redis', 'app'];
  const definedServices = Object.keys(composeConfig.services || {});
  const missingServices = requiredServices.filter(
    s => !definedServices.includes(s)
  );

  if (missingServices.length > 0) {
    warnings.push(`缺少必需的服务: ${missingServices.join(', ')}`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * 验证服务配置
 */
function validateService(
  serviceName: string,
  service: unknown
): DockerComposeValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (typeof service !== 'object' || service === null) {
    return {
      valid: false,
      errors: [`服务 ${serviceName} 必须是一个对象`],
      warnings: [],
    };
  }

  const serviceConfig = service as DockerComposeService;

  // 检查 image 或 build
  if (!serviceConfig.image && !serviceConfig.build) {
    errors.push(`服务 ${serviceName} 必须指定 image 或 build`);
  }

  // 检查 container_name
  if (serviceConfig.container_name) {
    if (typeof serviceConfig.container_name !== 'string') {
      errors.push(`服务 ${serviceName} 的 container_name 必须是字符串`);
    }
  }

  // 检查 restart
  if (serviceConfig.restart) {
    const validRestartValues = ['no', 'always', 'on-failure', 'unless-stopped'];
    if (!validRestartValues.includes(serviceConfig.restart)) {
      warnings.push(
        `服务 ${serviceName} 的 restart 值无效: ${serviceConfig.restart}`
      );
    }
  }

  // 检查环境变量
  if ('environment' in serviceConfig) {
    if (
      typeof serviceConfig.environment !== 'object' ||
      serviceConfig.environment === null
    ) {
      errors.push(`服务 ${serviceName} 的 environment 必须是一个对象`);
    }
  }

  // 检查端口
  if ('ports' in serviceConfig) {
    if (!Array.isArray(serviceConfig.ports)) {
      errors.push(`服务 ${serviceName} 的 ports 必须是一个数组`);
    } else {
      serviceConfig.ports.forEach((port, index) => {
        if (typeof port !== 'string') {
          errors.push(`服务 ${serviceName} 的端口 ${index} 必须是字符串`);
        }
      });
    }
  }

  // 检查健康检查
  if ('healthcheck' in serviceConfig) {
    const healthcheck = serviceConfig.healthcheck;
    if (!healthcheck) {
      errors.push(`服务 ${serviceName} 的 healthcheck 配置无效`);
    } else if (!Array.isArray(healthcheck.test)) {
      errors.push(`服务 ${serviceName} 的 healthcheck.test 必须是一个数组`);
    } else if (typeof healthcheck.interval !== 'string') {
      errors.push(`服务 ${serviceName} 的 healthcheck.interval 必须是字符串`);
    } else if (typeof healthcheck.timeout !== 'string') {
      errors.push(`服务 ${serviceName} 的 healthcheck.timeout 必须是字符串`);
    } else if (typeof healthcheck.retries !== 'number') {
      errors.push(`服务 ${serviceName} 的 healthcheck.retries 必须是数字`);
    }
  }

  // 检查依赖
  if (serviceConfig.depends_on) {
    if (
      typeof serviceConfig.depends_on !== 'object' ||
      serviceConfig.depends_on === null
    ) {
      errors.push(`服务 ${serviceName} 的 depends_on 必须是一个对象`);
    } else {
      for (const [depName, depCondition] of Object.entries(
        serviceConfig.depends_on
      )) {
        if (typeof depCondition !== 'object' || depCondition === null) {
          errors.push(`服务 ${serviceName} 的依赖 ${depName} 条件无效`);
        } else if (!('condition' in depCondition)) {
          warnings.push(`服务 ${serviceName} 的依赖 ${depName} 缺少 condition`);
        }
      }
    }
  }

  // 检查资源限制
  if (serviceConfig.deploy?.resources) {
    const resources = serviceConfig.deploy.resources;

    if (resources.limits) {
      if (!validateResourceLimit(resources.limits)) {
        errors.push(`服务 ${serviceName} 的资源限制配置无效`);
      }
    }

    if (resources.reservations) {
      if (!validateResourceLimit(resources.reservations)) {
        errors.push(`服务 ${serviceName} 的资源预留配置无效`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * 验证资源限制配置
 */
function validateResourceLimit(limit: {
  cpus: string;
  memory: string;
}): boolean {
  const { cpus, memory } = limit;

  // 验证 CPU 格式
  const cpuPattern = /^[\d.]+$/;
  if (!cpuPattern.test(cpus)) {
    return false;
  }

  // 验证内存格式
  const memoryPattern = /^\d+(\.\d+)?(B|KB|MB|GB|TB)?$/i;
  if (!memoryPattern.test(memory)) {
    return false;
  }

  return true;
}

/**
 * 验证端口格式
 */
export function validatePortFormat(port: string): boolean {
  const patterns = [
    /^\d+$/, // 单个端口
    /^\d+:\d+$/, // 端口映射
    /^\d+:\d+\/(tcp|udp)$/i, // 带协议的端口映射
  ];

  return patterns.some(pattern => pattern.test(port));
}

/**
 * 验证环境变量格式
 */
export function validateEnvVariableFormat(key: string): boolean {
  // 键必须是非空字符串
  if (!key || typeof key !== 'string') {
    return false;
  }

  // 键不能包含空格
  if (/\s/.test(key)) {
    return false;
  }

  return true;
}

/**
 * 生成配置摘要
 */
export function generateConfigSummary(config: DockerComposeConfig): string {
  const lines: string[] = [];

  lines.push('Docker Compose 配置摘要:');
  lines.push(`版本: ${config.version}`);
  lines.push('');

  lines.push('服务:');
  for (const [serviceName, service] of Object.entries(config.services)) {
    lines.push(`  - ${serviceName}`);
    if (service.image) {
      lines.push(`    镜像: ${service.image}`);
    }
    if (service.build) {
      lines.push(
        `    构建: ${service.build.context}/${service.build.dockerfile}`
      );
    }
    if (service.container_name) {
      lines.push(`    容器名: ${service.container_name}`);
    }
    if (service.restart) {
      lines.push(`    重启策略: ${service.restart}`);
    }
    if (service.healthcheck) {
      lines.push(`    健康检查: 启用`);
    }
    if (service.ports && service.ports.length > 0) {
      lines.push(`    端口: ${service.ports.join(', ')}`);
    }
  }

  if (config.networks) {
    lines.push('');
    lines.push('网络:');
    for (const [networkName, network] of Object.entries(config.networks)) {
      lines.push(`  - ${networkName} (${network.driver})`);
    }
  }

  if (config.volumes) {
    lines.push('');
    lines.push('数据卷:');
    for (const [volumeName, volume] of Object.entries(config.volumes)) {
      lines.push(`  - ${volumeName} (${volume.driver})`);
    }
  }

  return lines.join('\n');
}
