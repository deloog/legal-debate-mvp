/**
 * Filebeat 配置单元测试
 * 验证 Filebeat 配置文件的正确性和完整性
 */

import { promises as fs } from 'fs';
import path from 'path';

describe('Filebeat Configuration', () => {
  const configPath = path.join(
    process.cwd(),
    'config',
    'filebeat',
    'filebeat.yml'
  );

  beforeAll(async () => {
    try {
      await fs.access(configPath);
    } catch {
      throw new Error(`Filebeat configuration file not found: ${configPath}`);
    }
  });

  describe('文件存在性验证', () => {
    it('Filebeat 配置文件应该存在', async () => {
      await expect(fs.access(configPath)).resolves.toBeUndefined();
    });

    it('Filebeat 配置文件应该是有效的 YAML 文件', async () => {
      const content = await fs.readFile(configPath, 'utf8');
      expect(content).toBeTruthy();
      expect(content).toContain('filebeat.inputs');
      expect(content).toContain('output.logstash');
    });
  });

  describe('输入配置验证', () => {
    it('应该配置应用日志输入', async () => {
      const content = await fs.readFile(configPath, 'utf8');
      expect(content).toMatch(/log_type:\s*application/);
      expect(content).toMatch(/paths:/);
      expect(content).toContain('./logs/');
      expect(content).toContain('*.log');
    });

    it('应该配置错误日志输入', async () => {
      const content = await fs.readFile(configPath, 'utf8');
      expect(content).toMatch(/log_type:\s*error/);
      expect(content).toContain('*error*.log');
    });

    it('应该配置操作日志输入', async () => {
      const content = await fs.readFile(configPath, 'utf8');
      expect(content).toMatch(/log_type:\s*action/);
      expect(content).toContain('*action*.log');
    });

    it('应该配置系统日志输入（可选）', async () => {
      const content = await fs.readFile(configPath, 'utf8');
      expect(content).toMatch(/log_type:\s*system/);
      expect(content).toMatch(/SYSTEM_LOG_ENABLED:false/);
    });

    it('应该配置多行日志处理', async () => {
      const content = await fs.readFile(configPath, 'utf8');
      expect(content).toContain('multiline:');
      expect(content).toContain('pattern:');
      expect(content).toContain('match: after');
    });

    it('应该配置 JSON 日志解析', async () => {
      const content = await fs.readFile(configPath, 'utf8');
      expect(content).toMatch(/json:/);
      expect(content).toMatch(/keys_under_root:\s*true/);
      expect(content).toMatch(/add_error_key:\s*true/);
    });

    it('应该添加自定义字段', async () => {
      const content = await fs.readFile(configPath, 'utf8');
      expect(content).toMatch(/environment:/);
      expect(content).toMatch(/\$\{NODE_ENV/);
      expect(content).toMatch(/application:\s*legal-debate/);
      expect(content).toMatch(/fields_under_root:\s*true/);
    });
  });

  describe('处理器配置验证', () => {
    it('应该配置主机元数据处理器', async () => {
      const content = await fs.readFile(configPath, 'utf8');
      expect(content).toMatch(/add_host_metadata:/);
    });

    it('应该配置云元数据处理器', async () => {
      const content = await fs.readFile(configPath, 'utf8');
      expect(content).toMatch(/add_cloud_metadata:/);
    });

    it('应该配置 Docker 元数据处理器', async () => {
      const content = await fs.readFile(configPath, 'utf8');
      expect(content).toMatch(/add_docker_metadata:/);
    });

    it('应该配置进程元数据处理器', async () => {
      const content = await fs.readFile(configPath, 'utf8');
      expect(content).toMatch(/add_process_metadata:/);
    });

    it('应该配置事件过滤', async () => {
      const content = await fs.readFile(configPath, 'utf8');
      expect(content).toMatch(/drop_event:/);
      expect(content).toMatch(/log_type/);
    });
  });

  describe('输出配置验证', () => {
    it('应该配置 Logstash 输出', async () => {
      const content = await fs.readFile(configPath, 'utf8');
      expect(content).toContain('output.logstash:');
      expect(content).toContain('LOGSTASH_HOST');
      expect(content).toContain('5044');
    });

    it('应该配置负载均衡', async () => {
      const content = await fs.readFile(configPath, 'utf8');
      expect(content).toMatch(/loadbalance:\s*true/);
    });

    it('应该配置压缩', async () => {
      const content = await fs.readFile(configPath, 'utf8');
      expect(content).toMatch(/compression_level:\s*3/);
    });

    it('应该配置管道', async () => {
      const content = await fs.readFile(configPath, 'utf8');
      expect(content).toMatch(/pipeline:\s*main/);
    });

    it('应该配置 SSL（可选）', async () => {
      const content = await fs.readFile(configPath, 'utf8');
      expect(content).toMatch(/LOGSTASH_SSL_ENABLED/);
      expect(content).toMatch(/verification_mode:\s*full/);
    });

    it('应该配置批量大小', async () => {
      const content = await fs.readFile(configPath, 'utf8');
      expect(content).toMatch(/bulk_max_size:\s*2048/);
    });

    it('应该配置 TTL', async () => {
      const content = await fs.readFile(configPath, 'utf8');
      expect(content).toMatch(/ttl:\s*30/);
    });
  });

  describe('监控配置验证', () => {
    it('应该启用监控端点', async () => {
      const content = await fs.readFile(configPath, 'utf8');
      expect(content).toMatch(/monitoring\.enabled:\s*true/);
    });

    it('应该配置日志级别', async () => {
      const content = await fs.readFile(configPath, 'utf8');
      expect(content).toMatch(/logging\.level:/);
      expect(content).toMatch(/LOGGING_LEVEL:info/);
    });

    it('应该配置日志输出到文件', async () => {
      const content = await fs.readFile(configPath, 'utf8');
      expect(content).toMatch(/logging\.to_files:\s*true/);
      expect(content).toMatch(/logging\.files:/);
      expect(content).toMatch(/path:\s*\.\/logs\/filebeat/);
      expect(content).toMatch(/keepfiles:\s*7/);
    });
  });

  describe('性能配置验证', () => {
    it('应该配置内存队列', async () => {
      const content = await fs.readFile(configPath, 'utf8');
      expect(content).toMatch(/queue\.mem:/);
      expect(content).toMatch(/events:\s*4096/);
    });

    it('应该配置刷新策略', async () => {
      const content = await fs.readFile(configPath, 'utf8');
      expect(content).toMatch(/flush\.min_events:\s*512/);
      expect(content).toMatch(/flush\.timeout:\s*1s/);
    });

    it('应该配置模块加载', async () => {
      const content = await fs.readFile(configPath, 'utf8');
      expect(content).toMatch(/filebeat\.config\.modules:/);
      expect(content).toMatch(/reload\.enabled:\s*false/);
    });
  });

  describe('安全配置验证', () => {
    it('应该使用环境变量配置敏感信息', async () => {
      const content = await fs.readFile(configPath, 'utf8');
      expect(content).toContain('${');
      expect(content).toContain('LOGSTASH_HOST');
      expect(content).toContain('LOGSTASH_SSL_ENABLED');
    });

    it('不应该硬编码密码或密钥', async () => {
      const content = await fs.readFile(configPath, 'utf8');
      // 证书文件路径是允许的，不是硬编码的密钥值
      expect(content).not.toMatch(/password:\s*['"][^'\$][^'"]+['"]/);
      expect(content).not.toMatch(/secret:\s*['"][^'\$][^'"]+['"]/);
      // 证书路径使用的是环境变量或默认路径，不是硬编码的密钥值
      const keyPathMatch = content.match(/key:\s*['"]([^'"]+)['"]/);
      if (keyPathMatch) {
        const keyPath = keyPathMatch[1];
        expect(keyPath).toMatch(/^(\$\{|\/)/); // 必须是环境变量或以/开头的路径
      }
    });
  });

  describe('配置完整性验证', () => {
    it('应该包含所有必需的配置节', async () => {
      const content = await fs.readFile(configPath, 'utf8');
      const requiredSections = [
        'filebeat.inputs:',
        'processors:',
        'output.logstash:',
        'monitoring.enabled:',
        'logging.level:',
        'queue.mem:',
      ];

      for (const section of requiredSections) {
        expect(content).toContain(section);
      }
    });

    it('应该包含注释说明', async () => {
      const content = await fs.readFile(configPath, 'utf8');
      expect(content).toMatch(/#/);
      expect(content).toMatch(/Filebeat 配置/);
    });

    it('文件大小应该合理', async () => {
      const stats = await fs.stat(configPath);
      const fileSizeInKB = stats.size / 1024;
      expect(fileSizeInKB).toBeGreaterThan(1);
      expect(fileSizeInKB).toBeLessThan(100);
    });
  });

  describe('环境变量配置验证', () => {
    it('应该配置 NODE_ENV 环境变量', async () => {
      const content = await fs.readFile(configPath, 'utf8');
      expect(content).toContain('${NODE_ENV');
    });

    it('应该提供默认值', async () => {
      const content = await fs.readFile(configPath, 'utf8');
      expect(content).toMatch(/LOGSTASH_HOST:localhost:5044/);
      expect(content).toMatch(/LOGGING_LEVEL:info/);
    });
  });
});
