/**
 * Logstash 管道配置单元测试
 * 验证 Logstash 管道配置文件的正确性和完整性
 */

import { promises as fs } from 'fs';
import path from 'path';

describe('Logstash Pipeline Configuration', () => {
  const configDir = path.join(process.cwd(), 'config', 'logstash', 'pipelines');
  const mainConfigPath = path.join(configDir, 'main.conf');
  const errorLogsPath = path.join(configDir, 'error-logs.conf');
  const actionLogsPath = path.join(configDir, 'action-logs.conf');
  const systemLogsPath = path.join(configDir, 'system-logs.conf');
  const applicationLogsPath = path.join(configDir, 'application-logs.conf');

  beforeAll(async () => {
    const configPaths = [
      mainConfigPath,
      errorLogsPath,
      actionLogsPath,
      systemLogsPath,
      applicationLogsPath,
    ];

    for (const configPath of configPaths) {
      try {
        await fs.access(configPath);
      } catch {
        throw new Error(`Logstash configuration file not found: ${configPath}`);
      }
    }
  });

  describe('主管道配置验证', () => {
    it('主管道配置文件应该存在', async () => {
      await expect(fs.access(mainConfigPath)).resolves.toBeUndefined();
    });

    it('应该配置 Beats 输入', async () => {
      const content = await fs.readFile(mainConfigPath, 'utf8');
      expect(content).toContain('beats {');
      expect(content).toContain('port => 5044');
      expect(content).toContain('type => "main"');
    });

    it('应该配置路由到子管道', async () => {
      const content = await fs.readFile(mainConfigPath, 'utf8');
      expect(content).toContain('route {');
      expect(content).toContain('pipeline_id => "error-logs"');
      expect(content).toContain('pipeline_id => "action-logs"');
      expect(content).toContain('pipeline_id => "system-logs"');
      expect(content).toContain('pipeline_id => "application-logs"');
    });

    it('应该使用 Unix 域套接字', async () => {
      const content = await fs.readFile(mainConfigPath, 'utf8');
      expect(content).toContain('unix:///tmp/logstash-');
    });

    it('应该配置 Elasticsearch 输出', async () => {
      const content = await fs.readFile(mainConfigPath, 'utf8');
      expect(content).toContain('elasticsearch {');
      expect(content).toContain('ELASTICSEARCH_HOST');
      expect(content).toContain('logs-main-');
    });
  });

  describe('错误日志管道验证', () => {
    it('错误日志管道配置文件应该存在', async () => {
      await expect(fs.access(errorLogsPath)).resolves.toBeUndefined();
    });

    it('应该解析 JSON 日志', async () => {
      const content = await fs.readFile(errorLogsPath, 'utf8');
      expect(content).toContain('json {');
      expect(content).toContain('source => "message"');
      expect(content).toContain('target => "json_data"');
    });

    it('应该提取错误信息', async () => {
      const content = await fs.readFile(errorLogsPath, 'utf8');
      expect(content).toContain('error_stack');
      expect(content).toContain('error_message');
      expect(content).toContain('error_type');
      expect(content).toContain('error_severity');
    });

    it('应该提取用户和案件信息', async () => {
      const content = await fs.readFile(errorLogsPath, 'utf8');
      expect(content).toContain('user_id');
      expect(content).toContain('case_id');
      expect(content).toContain('request_id');
    });

    it('应该发送严重错误告警', async () => {
      const content = await fs.readFile(errorLogsPath, 'utf8');
      expect(content).toContain('ALERTMANAGER_WEBHOOK_URL');
      expect(content).toContain('error_severity');
      expect(content).toContain('CRITICAL');
      expect(content).toContain('HIGH');
    });

    it('应该输出到错误索引', async () => {
      const content = await fs.readFile(errorLogsPath, 'utf8');
      expect(content).toContain('logs-error-');
    });
  });

  describe('操作日志管道验证', () => {
    it('操作日志管道配置文件应该存在', async () => {
      await expect(fs.access(actionLogsPath)).resolves.toBeUndefined();
    });

    it('应该提取操作信息', async () => {
      const content = await fs.readFile(actionLogsPath, 'utf8');
      expect(content).toContain('action_type');
      expect(content).toContain('action_category');
      expect(content).toContain('resource_type');
      expect(content).toContain('resource_id');
    });

    it('应该提取 IP 地址和地理位置', async () => {
      const content = await fs.readFile(actionLogsPath, 'utf8');
      expect(content).toContain('ip_address');
      expect(content).toContain('geoip {');
    });

    it('应该解析 User-Agent', async () => {
      const content = await fs.readFile(actionLogsPath, 'utf8');
      expect(content).toContain('user_agent');
      expect(content).toContain('useragent {');
      expect(content).toContain('target => "ua"');
    });

    it('应该计算性能等级', async () => {
      const content = await fs.readFile(actionLogsPath, 'utf8');
      expect(content).toContain('execution_time_ms');
      expect(content).toContain('performance_tier');
      expect(content).toContain('fast');
      expect(content).toContain('normal');
      expect(content).toContain('slow');
      expect(content).toContain('very_slow');
    });

    it('应该检测异常操作', async () => {
      const content = await fs.readFile(actionLogsPath, 'utf8');
      expect(content).toContain('failed-login');
      expect(content).toContain('destructive-action');
      expect(content).toContain('slow-operation');
    });

    it('应该输出到操作索引', async () => {
      const content = await fs.readFile(actionLogsPath, 'utf8');
      expect(content).toContain('logs-action-');
    });
  });

  describe('系统日志管道验证', () => {
    it('系统日志管道配置文件应该存在', async () => {
      await expect(fs.access(systemLogsPath)).resolves.toBeUndefined();
    });

    it('应该提取 Agent 信息', async () => {
      const content = await fs.readFile(systemLogsPath, 'utf8');
      expect(content).toContain('agent_name');
      expect(content).toContain('task_type');
    });

    it('应该检测系统错误', async () => {
      const content = await fs.readFile(systemLogsPath, 'utf8');
      expect(content).toContain('system-fatal');
      expect(content).toContain('system-error');
    });

    it('应该发送系统致命错误告警', async () => {
      const content = await fs.readFile(systemLogsPath, 'utf8');
      expect(content).toContain('SystemFatalError');
      expect(content).toContain('system-fatal');
    });

    it('应该输出到系统索引', async () => {
      const content = await fs.readFile(systemLogsPath, 'utf8');
      expect(content).toContain('logs-system-');
    });
  });

  describe('应用日志管道验证', () => {
    it('应用日志管道配置文件应该存在', async () => {
      await expect(fs.access(applicationLogsPath)).resolves.toBeUndefined();
    });

    it('应该提取应用日志字段', async () => {
      const content = await fs.readFile(applicationLogsPath, 'utf8');
      expect(content).toContain('user_id');
      expect(content).toContain('case_id');
      expect(content).toContain('request_id');
      expect(content).toContain('agent_name');
      expect(content).toContain('task_type');
    });

    it('应该检测应用错误', async () => {
      const content = await fs.readFile(applicationLogsPath, 'utf8');
      expect(content).toContain('application-error');
    });

    it('应该发送应用致命错误告警', async () => {
      const content = await fs.readFile(applicationLogsPath, 'utf8');
      expect(content).toContain('ApplicationFatalError');
      expect(content).toContain('application-error');
    });

    it('应该输出到应用索引', async () => {
      const content = await fs.readFile(applicationLogsPath, 'utf8');
      expect(content).toContain('logs-application-');
    });
  });

  describe('配置一致性验证', () => {
    it('所有管道应该使用相同的环境变量', async () => {
      const [
        mainContent,
        errorContent,
        actionContent,
        systemContent,
        appContent,
      ] = await Promise.all([
        fs.readFile(mainConfigPath, 'utf8'),
        fs.readFile(errorLogsPath, 'utf8'),
        fs.readFile(actionLogsPath, 'utf8'),
        fs.readFile(systemLogsPath, 'utf8'),
        fs.readFile(applicationLogsPath, 'utf8'),
      ]);

      const envVar = 'ELASTICSEARCH_HOST';
      expect(mainContent).toContain(envVar);
      expect(errorContent).toContain(envVar);
      expect(actionContent).toContain(envVar);
      expect(systemContent).toContain(envVar);
      expect(appContent).toContain(envVar);
    });

    it('所有管道应该使用相同的告警端点', async () => {
      const [errorContent, actionContent, systemContent, appContent] =
        await Promise.all([
          fs.readFile(errorLogsPath, 'utf8'),
          fs.readFile(actionLogsPath, 'utf8'),
          fs.readFile(systemLogsPath, 'utf8'),
          fs.readFile(applicationLogsPath, 'utf8'),
        ]);

      const alertWebhook = 'ALERTMANAGER_WEBHOOK_URL';
      expect(errorContent).toContain(alertWebhook);
      expect(actionContent).toContain(alertWebhook);
      expect(systemContent).toContain(alertWebhook);
      expect(appContent).toContain(alertWebhook);
    });
  });

  describe('安全配置验证', () => {
    it('应该使用环境变量配置敏感信息', async () => {
      const configPaths = [mainConfigPath, errorLogsPath, actionLogsPath];
      for (const configPath of configPaths) {
        const content = await fs.readFile(configPath, 'utf8');
        expect(content).toContain('${');
        expect(content).toContain('ELASTICSEARCH_');
      }
    });

    it('不应该硬编码密码或密钥', async () => {
      const configPaths = [mainConfigPath, errorLogsPath, actionLogsPath];
      for (const configPath of configPaths) {
        const content = await fs.readFile(configPath, 'utf8');
        expect(content).not.toMatch(/password:\s*['"][^'"]+['"]/);
        expect(content).not.toMatch(/secret:\s*['"][^'"]+['"]/);
        expect(content).not.toMatch(/key:\s*['"][^'"]+['"]/);
      }
    });

    it('应该配置 SSL 选项', async () => {
      const [mainContent] = await Promise.all([
        fs.readFile(mainConfigPath, 'utf8'),
      ]);
      expect(mainContent).toContain('ELASTICSEARCH_SSL');
      expect(mainContent).toContain('ssl_certificate_verification');
    });
  });

  describe('配置完整性验证', () => {
    it('所有配置文件应该包含注释', async () => {
      const configPaths = [
        mainConfigPath,
        errorLogsPath,
        actionLogsPath,
        systemLogsPath,
        applicationLogsPath,
      ];

      for (const configPath of configPaths) {
        const content = await fs.readFile(configPath, 'utf8');
        expect(content).toMatch(/#/);
      }
    });

    it('配置文件大小应该合理', async () => {
      const [mainStats, errorStats, actionStats, systemStats, appStats] =
        await Promise.all([
          fs.stat(mainConfigPath),
          fs.stat(errorLogsPath),
          fs.stat(actionLogsPath),
          fs.stat(systemLogsPath),
          fs.stat(applicationLogsPath),
        ]);

      const minSize = 500; // 最小 500 字节
      const maxSize = 10240; // 最大 10KB

      expect(mainStats.size).toBeGreaterThan(minSize);
      expect(mainStats.size).toBeLessThan(maxSize);

      expect(errorStats.size).toBeGreaterThan(minSize);
      expect(errorStats.size).toBeLessThan(maxSize);

      expect(actionStats.size).toBeGreaterThan(minSize);
      expect(actionStats.size).toBeLessThan(maxSize);

      expect(systemStats.size).toBeGreaterThan(minSize);
      expect(systemStats.size).toBeLessThan(maxSize);

      expect(appStats.size).toBeGreaterThan(minSize);
      expect(appStats.size).toBeLessThan(maxSize);
    });
  });

  describe('索引命名规范验证', () => {
    it('错误日志应该使用 logs-error- 索引', async () => {
      const content = await fs.readFile(errorLogsPath, 'utf8');
      expect(content).toContain('logs-error-');
    });

    it('操作日志应该使用 logs-action- 索引', async () => {
      const content = await fs.readFile(actionLogsPath, 'utf8');
      expect(content).toContain('logs-action-');
    });

    it('系统日志应该使用 logs-system- 索引', async () => {
      const content = await fs.readFile(systemLogsPath, 'utf8');
      expect(content).toContain('logs-system-');
    });

    it('应用日志应该使用 logs-application- 索引', async () => {
      const content = await fs.readFile(applicationLogsPath, 'utf8');
      expect(content).toContain('logs-application-');
    });

    it('索引应该使用日期模式', async () => {
      const [errorContent, actionContent] = await Promise.all([
        fs.readFile(errorLogsPath, 'utf8'),
        fs.readFile(actionLogsPath, 'utf8'),
      ]);

      // Logstash 使用 %{+YYYY.MM.dd} 格式的日期模式
      expect(errorContent).toContain('%{+YYYY.MM.dd}');
      expect(actionContent).toContain('%{+YYYY.MM.dd}');
    });
  });
});
