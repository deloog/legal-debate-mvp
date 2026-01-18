import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import {
  CIConfigValidator,
  WorkflowConfig,
  WorkflowJob,
  WorkflowStep,
  main as validateMain,
} from '../../../scripts/validate-cicd-config';

/**
 * CI/CD配置验证工具的单元测试
 */

describe('CIConfigValidator', () => {
  const tempDir = path.join(__dirname, 'temp-cicd-config');
  const testConfigPath = path.join(tempDir, 'test-deploy.yml');

  beforeEach(() => {
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
  });

  afterEach(() => {
    if (fs.existsSync(testConfigPath)) {
      fs.unlinkSync(testConfigPath);
    }
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  /**
   * 辅助函数：创建测试配置文件
   */
  function createTestConfig(config: Partial<WorkflowConfig>): void {
    const fullConfig: WorkflowConfig = {
      name: config.name || 'Test Workflow',
      on: config.on || { push: { branches: ['develop'] } },
      jobs: config.jobs || {},
    };
    fs.writeFileSync(
      testConfigPath,
      yaml.dump(fullConfig, { skipInvalid: false }),
      'utf-8'
    );
  }

  describe('构造函数', () => {
    test('应该正确初始化验证器', () => {
      const validator = new CIConfigValidator(testConfigPath);
      expect(validator).toBeDefined();
      expect(validator).toBeInstanceOf(CIConfigValidator);
    });
  });

  describe('validateWorkflowStructure', () => {
    test('应该通过完整的配置结构验证', async () => {
      createTestConfig({
        name: 'Test Workflow',
        on: { push: { branches: ['develop'] } },
        jobs: {
          test: {
            name: 'Test Job',
            runs_on: 'ubuntu-latest',
            steps: [{ name: 'Test Step', run: 'echo test' }],
          },
        },
      });

      const validator = new CIConfigValidator(testConfigPath);
      const result = await validator.validate();

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('应该检测到缺少的workflow名称', async () => {
      const config: Partial<WorkflowConfig> = {
        on: { push: { branches: ['develop'] } },
        jobs: {},
      };
      fs.writeFileSync(testConfigPath, yaml.dump(config), 'utf-8');

      const validator = new CIConfigValidator(testConfigPath);
      const result = await validator.validate();

      expect(result.valid).toBe(false);
      expect(
        result.errors.some(
          error => error.message === 'Workflow name is missing'
        )
      ).toBe(true);
    });

    test('应该检测到缺少的触发器', async () => {
      const config: Partial<WorkflowConfig> = {
        name: 'Test Workflow',
        on: {},
        jobs: {},
      };
      fs.writeFileSync(testConfigPath, yaml.dump(config), 'utf-8');

      const validator = new CIConfigValidator(testConfigPath);
      const result = await validator.validate();

      expect(result.valid).toBe(false);
      expect(
        result.errors.some(
          error => error.message === 'Workflow triggers are not defined'
        )
      ).toBe(true);
    });

    test('应该检测到缺少的作业', async () => {
      const config: Partial<WorkflowConfig> = {
        name: 'Test Workflow',
        on: { push: { branches: ['develop'] } },
        jobs: {},
      };
      fs.writeFileSync(testConfigPath, yaml.dump(config), 'utf-8');

      const validator = new CIConfigValidator(testConfigPath);
      const result = await validator.validate();

      expect(result.valid).toBe(false);
      expect(
        result.errors.some(
          error => error.message === 'Workflow jobs are not defined'
        )
      ).toBe(true);
    });
  });

  describe('validateTriggers', () => {
    test('应该检测到develop分支不在push触发器中', async () => {
      createTestConfig({
        on: { push: { branches: ['main'] } },
        jobs: {
          test: {
            name: 'Test Job',
            runs_on: 'ubuntu-latest',
            steps: [{ name: 'Test Step', run: 'echo test' }],
          },
        },
      });

      const validator = new CIConfigValidator(testConfigPath);
      const result = await validator.validate();

      expect(
        result.warnings.some(
          warning =>
            warning.message === 'develop branch is not in push triggers' &&
            warning.context === 'triggers.push.branches'
        )
      ).toBe(true);
    });

    test('应该通过develop分支触发器验证', async () => {
      createTestConfig({
        on: { push: { branches: ['develop'] } },
        jobs: {
          test: {
            name: 'Test Job',
            runs_on: 'ubuntu-latest',
            steps: [{ name: 'Test Step', run: 'echo test' }],
          },
        },
      });

      const validator = new CIConfigValidator(testConfigPath);
      const result = await validator.validate();

      expect(
        result.warnings.some(
          warning =>
            warning.message === 'develop branch is not in push triggers'
        )
      ).toBe(false);
    });

    test('应该检测到workflow_dispatch没有输入参数', async () => {
      createTestConfig({
        on: {
          workflow_dispatch: {},
        },
        jobs: {
          test: {
            name: 'Test Job',
            runs_on: 'ubuntu-latest',
            steps: [{ name: 'Test Step', run: 'echo test' }],
          },
        },
      });

      const validator = new CIConfigValidator(testConfigPath);
      const result = await validator.validate();

      expect(
        result.warnings.some(
          warning =>
            warning.message ===
              'workflow_dispatch has no input parameters defined' &&
            warning.context === 'triggers.workflow_dispatch'
        )
      ).toBe(true);
    });
  });

  describe('validateJobs', () => {
    test('应该检测到缺少的作业名称', async () => {
      const config: Partial<WorkflowConfig> = {
        name: 'Test Workflow',
        on: { push: { branches: ['develop'] } },
        jobs: {
          test: {
            runs_on: 'ubuntu-latest',
            steps: [{ name: 'Test Step', run: 'echo test' }],
          } as unknown as WorkflowJob,
        },
      };
      fs.writeFileSync(testConfigPath, yaml.dump(config), 'utf-8');

      const validator = new CIConfigValidator(testConfigPath);
      const result = await validator.validate();

      expect(result.valid).toBe(false);
      expect(
        result.errors.some(
          error => error.message === 'Job "test" is missing a name'
        )
      ).toBe(true);
    });

    test('应该检测到缺少的runs_on配置', async () => {
      const config: Partial<WorkflowConfig> = {
        name: 'Test Workflow',
        on: { push: { branches: ['develop'] } },
        jobs: {
          test: {
            name: 'Test Job',
            steps: [{ name: 'Test Step', run: 'echo test' }],
          } as unknown as WorkflowJob,
        },
      };
      fs.writeFileSync(testConfigPath, yaml.dump(config), 'utf-8');

      const validator = new CIConfigValidator(testConfigPath);
      const result = await validator.validate();

      expect(result.valid).toBe(false);
      expect(
        result.errors.some(
          error =>
            error.message === 'Job "test" is missing runs_on configuration'
        )
      ).toBe(true);
    });

    test('应该检测到没有步骤的作业', async () => {
      createTestConfig({
        jobs: {
          test: {
            name: 'Test Job',
            runs_on: 'ubuntu-latest',
            steps: [],
          },
        },
      });

      const validator = new CIConfigValidator(testConfigPath);
      const result = await validator.validate();

      expect(result.valid).toBe(false);
      expect(
        result.errors.some(
          error => error.message === 'Job "test" has no steps defined'
        )
      ).toBe(true);
    });

    test('应该检测到不存在的作业依赖', async () => {
      createTestConfig({
        jobs: {
          job1: {
            name: 'Job 1',
            runs_on: 'ubuntu-latest',
            steps: [{ name: 'Test Step', run: 'echo test' }],
          },
          job2: {
            name: 'Job 2',
            runs_on: 'ubuntu-latest',
            needs: ['job3'], // 不存在的作业
            steps: [{ name: 'Test Step', run: 'echo test' }],
          },
        },
      });

      const validator = new CIConfigValidator(testConfigPath);
      const result = await validator.validate();

      expect(result.valid).toBe(false);
      expect(
        result.errors.some(
          error =>
            error.message === 'Job "job2" depends on non-existent job "job3"'
        )
      ).toBe(true);
    });

    test('应该检测到缺少的步骤名称', async () => {
      createTestConfig({
        jobs: {
          test: {
            name: 'Test Job',
            runs_on: 'ubuntu-latest',
            steps: [{ run: 'echo test' } as unknown as WorkflowStep],
          },
        },
      });

      const validator = new CIConfigValidator(testConfigPath);
      const result = await validator.validate();

      expect(result.valid).toBe(false);
      expect(
        result.errors.some(
          error => error.message === `Step in job "test" is missing a name`
        )
      ).toBe(true);
    });

    test('应该检测到没有uses或run的步骤', async () => {
      createTestConfig({
        jobs: {
          test: {
            name: 'Test Job',
            runs_on: 'ubuntu-latest',
            steps: [{ name: 'Test Step' } as unknown as WorkflowStep],
          },
        },
      });

      const validator = new CIConfigValidator(testConfigPath);
      const result = await validator.validate();

      expect(result.valid).toBe(false);
      expect(
        result.errors.some(
          error =>
            error.message ===
            'Step "Test Step" must have either "uses" or "run"'
        )
      ).toBe(true);
    });
  });

  describe('validateEnvironmentSeparation', () => {
    test('应该警告没有环境保护的作业', async () => {
      createTestConfig({
        jobs: {
          test: {
            name: 'Test Job',
            runs_on: 'ubuntu-latest',
            steps: [{ name: 'Test Step', run: 'echo test' }],
          },
        },
      });

      const validator = new CIConfigValidator(testConfigPath);
      const result = await validator.validate();

      expect(
        result.warnings.some(
          warning =>
            warning.message ===
              'No jobs have environment protection configured' &&
            warning.context === 'environment'
        )
      ).toBe(true);
    });

    test('应该通过环境保护验证', async () => {
      createTestConfig({
        jobs: {
          test: {
            name: 'Test Job',
            runs_on: 'ubuntu-latest',
            environment: { name: 'production' },
            steps: [{ name: 'Test Step', run: 'echo test' }],
          },
        },
      });

      const validator = new CIConfigValidator(testConfigPath);
      const result = await validator.validate();

      expect(
        result.warnings.some(
          warning =>
            warning.message === 'No jobs have environment protection configured'
        )
      ).toBe(false);
    });
  });

  describe('validateSecurity', () => {
    test('应该检测到硬编码的密钥', async () => {
      createTestConfig({
        jobs: {
          test: {
            name: 'Test Job',
            runs_on: 'ubuntu-latest',
            steps: [
              {
                name: 'Test Step',
                run: 'echo test',
                env: { SECRET_KEY: 'hardcoded_secret' },
              } as unknown as WorkflowStep,
            ],
          },
        },
      });

      const validator = new CIConfigValidator(testConfigPath);
      const result = await validator.validate();

      expect(
        result.errors.some(
          error =>
            error.message ===
            'Step "Test Step" contains hardcoded secret "SECRET_KEY"'
        )
      ).toBe(true);
    });

    test('应该通过GitHub Secrets验证', async () => {
      createTestConfig({
        jobs: {
          test: {
            name: 'Test Job',
            runs_on: 'ubuntu-latest',
            steps: [
              {
                name: 'Test Step',
                run: 'echo test',
                env: { SECRET_KEY: '${{ secrets.TEST_SECRET }}' },
              },
            ],
          },
        },
      });

      const validator = new CIConfigValidator(testConfigPath);
      const result = await validator.validate();

      expect(
        result.errors.some(
          error =>
            error.message ===
            'Step "Test Step" contains hardcoded secret "SECRET_KEY"'
        )
      ).toBe(false);
    });
  });

  describe('validateBestPractices', () => {
    test('应该警告没有健康检查的部署作业', async () => {
      createTestConfig({
        jobs: {
          deploy: {
            name: 'Deploy Job',
            runs_on: 'ubuntu-latest',
            steps: [
              { name: 'Deploy', run: 'echo deploy' },
              { name: 'Test', run: 'echo test' },
            ],
          },
        },
      });

      const validator = new CIConfigValidator(testConfigPath);
      const result = await validator.validate();

      expect(
        result.warnings.some(
          warning =>
            warning.message ===
              'Deploy job "deploy" does not include a health check step' &&
            warning.context === 'jobs.deploy'
        )
      ).toBe(true);
    });

    test('应该通过健康检查验证', async () => {
      createTestConfig({
        jobs: {
          deploy: {
            name: 'Deploy Job',
            runs_on: 'ubuntu-latest',
            steps: [
              { name: 'Deploy', run: 'echo deploy' },
              { name: 'Health check', run: 'echo health' },
            ],
          },
        },
      });

      const validator = new CIConfigValidator(testConfigPath);
      const result = await validator.validate();

      expect(
        result.warnings.some(
          warning =>
            warning.message ===
            'Deploy job "deploy" does not include a health check step'
        )
      ).toBe(false);
    });

    test('应该警告没有配置缓存的setup-node', async () => {
      createTestConfig({
        jobs: {
          test: {
            name: 'Test Job',
            runs_on: 'ubuntu-latest',
            steps: [
              {
                name: 'Setup Node',
                uses: 'actions/setup-node@v4',
                with: { 'node-version': '20.x' },
              },
              { name: 'Test', run: 'echo test' },
            ],
          },
        },
      });

      const validator = new CIConfigValidator(testConfigPath);
      const result = await validator.validate();

      expect(
        result.warnings.some(
          warning =>
            warning.message ===
              'Job "test" uses setup-node but does not configure caching' &&
            warning.context === 'jobs.test'
        )
      ).toBe(true);
    });

    test('应该通过缓存配置验证', async () => {
      createTestConfig({
        jobs: {
          test: {
            name: 'Test Job',
            runs_on: 'ubuntu-latest',
            steps: [
              {
                name: 'Setup Node',
                uses: 'actions/setup-node@v4',
                with: { 'node-version': '20.x', cache: 'npm' },
              },
              { name: 'Test', run: 'echo test' },
            ],
          },
        },
      });

      const validator = new CIConfigValidator(testConfigPath);
      const result = await validator.validate();

      expect(
        result.warnings.some(
          warning =>
            warning.message ===
            'Job "test" uses setup-node but does not configure caching'
        )
      ).toBe(false);
    });
  });

  describe('集成测试', () => {
    test('应该正确验证完整的deploy.yml配置', async () => {
      const deployConfigPath = path.join(
        process.cwd(),
        '.github',
        'workflows',
        'deploy.yml'
      );

      if (fs.existsSync(deployConfigPath)) {
        const validator = new CIConfigValidator(deployConfigPath);
        const result = await validator.validate();

        // 输出错误和警告信息用于调试
        if (result.errors.length > 0) {
          console.error('\nErrors found in deploy.yml:');
          result.errors.forEach(error => {
            console.error(`  - ${error.message} ${error.context || ''}`);
          });
        }
        if (result.warnings.length > 0) {
          console.warn('\nWarnings found in deploy.yml:');
          result.warnings.forEach(warning => {
            console.warn(`  - ${warning.message} ${warning.context || ''}`);
          });
        }

        // deploy.yml应该通过验证（可能有警告）
        // 预期：只有警告（如pre-deploy-checks没有health check），没有错误
        expect(result.errors).toHaveLength(0);
      } else {
        // 如果文件不存在，跳过测试
        console.warn('deploy.yml not found, skipping integration test');
      }
    });
  });

  describe('完整配置示例测试', () => {
    test('应该通过完整的生产环境配置验证', async () => {
      createTestConfig({
        name: 'Production Deploy',
        on: {
          push: { branches: ['develop'] },
          workflow_dispatch: {
            inputs: {
              environment: {
                description: 'Deployment environment',
                required: true,
                type: 'choice',
                options: ['staging', 'production'],
              },
            },
          },
        },
        jobs: {
          'pre-deploy-checks': {
            name: 'Pre-Deploy Checks',
            runs_on: 'ubuntu-latest',
            steps: [
              { name: 'Checkout', uses: 'actions/checkout@v4' },
              {
                name: 'Setup Node',
                uses: 'actions/setup-node@v4',
                with: { 'node-version': '20.x', cache: 'npm' },
              },
              { name: 'Install', run: 'npm ci' },
              { name: 'Lint', run: 'npm run lint:check' },
              { name: 'Type Check', run: 'npm run type-check' },
            ],
          },
          deploy: {
            name: 'Deploy to Production',
            runs_on: 'ubuntu-latest',
            needs: ['pre-deploy-checks'],
            if: "github.event_name == 'workflow_dispatch' && github.event.inputs.environment == 'production'",
            environment: { name: 'production' },
            steps: [
              { name: 'Checkout', uses: 'actions/checkout@v4' },
              {
                name: 'Setup Node',
                uses: 'actions/setup-node@v4',
                with: { 'node-version': '20.x', cache: 'npm' },
              },
              { name: 'Install', run: 'npm ci' },
              { name: 'Build', run: 'npm run build' },
              { name: 'Deploy', run: 'echo deploy' },
              { name: 'Health check', run: 'curl -f http://example.com' },
            ],
          },
        },
      });

      const validator = new CIConfigValidator(testConfigPath);
      const result = await validator.validate();

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('错误处理', () => {
    test('应该正确处理无效的YAML语法', async () => {
      fs.writeFileSync(testConfigPath, 'invalid yaml: [', 'utf-8');

      const validator = new CIConfigValidator(testConfigPath);
      const result = await validator.validate();

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(
        result.errors.some(error =>
          error.message.includes('Failed to parse YAML file')
        )
      ).toBe(true);
    });
  });

  describe('性能测试', () => {
    test('应该在合理时间内完成验证', async () => {
      createTestConfig({
        jobs: {
          job1: {
            name: 'Job 1',
            runs_on: 'ubuntu-latest',
            steps: Array(50).fill({ name: 'Step', run: 'echo test' }),
          },
          job2: {
            name: 'Job 2',
            runs_on: 'ubuntu-latest',
            needs: ['job1'],
            steps: Array(50).fill({ name: 'Step', run: 'echo test' }),
          },
          job3: {
            name: 'Job 3',
            runs_on: 'ubuntu-latest',
            needs: ['job1', 'job2'],
            steps: Array(50).fill({ name: 'Step', run: 'echo test' }),
          },
        },
      });

      const startTime = Date.now();
      const validator = new CIConfigValidator(testConfigPath);
      await validator.validate();
      const endTime = Date.now();

      // 验证应该在500ms内完成
      expect(endTime - startTime).toBeLessThan(500);
    });
  });

  describe('main函数测试', () => {
    test('应该正确验证有效配置', async () => {
      createTestConfig({
        name: 'Valid Workflow',
        on: { push: { branches: ['develop'] } },
        jobs: {
          test: {
            name: 'Test Job',
            runs_on: 'ubuntu-latest',
            steps: [{ name: 'Test Step', run: 'echo test' }],
          },
        },
      });

      const result = await validateMain(testConfigPath);
      expect(result).toBe(0);
    });

    test('应该返回错误代码当配置无效', async () => {
      createTestConfig({
        name: 'Invalid Workflow',
        on: { push: { branches: ['develop'] } },
        jobs: {
          test: {
            name: 'Test Job',
            runs_on: 'ubuntu-latest',
            steps: [{ name: 'Test Step' } as unknown as WorkflowStep],
          },
        },
      });

      const result = await validateMain(testConfigPath);
      expect(result).toBe(1);
    });

    test('应该返回错误代码当文件不存在', async () => {
      const result = await validateMain(path.join(tempDir, 'non-existent.yml'));
      expect(result).toBe(1);
    });
  });
});
