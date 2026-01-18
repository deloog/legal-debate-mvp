import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';

/**
 * CI/CD配置验证工具
 * 用于验证GitHub Actions工作流配置的正确性和完整性
 */

interface WorkflowTrigger {
  push?: {
    branches?: string[];
    tags?: string[];
  };
  workflow_dispatch?: {
    inputs?: Record<string, WorkflowInput>;
  };
}

interface WorkflowInput {
  description: string;
  required?: boolean;
  type: 'choice' | 'string' | 'boolean' | 'number' | 'environment';
  options?: string[];
}

interface WorkflowJob {
  name: string;
  runs_on: string | string[];
  needs?: string | string[];
  if?: string;
  environment?: {
    name: string;
    url?: string;
  };
  steps: WorkflowStep[];
}

interface WorkflowStep {
  name: string;
  uses?: string;
  with?: Record<string, unknown>;
  run?: string;
  env?: Record<string, string>;
  id?: string;
  if?: string;
  continue_on_error?: boolean;
}

interface WorkflowConfig {
  name: string;
  on?: WorkflowTrigger;
  jobs: Record<string, WorkflowJob>;
}

interface ValidationError {
  level: 'error' | 'warning' | 'info';
  message: string;
  context?: string;
}

class CIConfigValidator {
  private errors: ValidationError[] = [];
  private warnings: ValidationError[] = [];

  constructor(private configPath: string) {}

  /**
   * 规范化作业配置：将 GitHub Actions YAML 键名转换为 TypeScript 属性名
   * GitHub Actions YAML 使用连字符命名（如 runs-on），TypeScript 使用下划线（如 runs_on）
   */
  private normalizeJob(job: Record<string, unknown>): WorkflowJob {
    // 支持两种格式：runs-on (GitHub Actions) 和 runs_on (TypeScript)
    const runsOn =
      (job['runs-on'] as string | string[]) ||
      (job.runs_on as string | string[]) ||
      '';

    // 支持两种格式：continue-on-error (GitHub Actions) 和 continue_on_error (TypeScript)
    const steps: WorkflowStep[] = (job.steps as WorkflowStep[]) || [];
    for (const step of steps) {
      if (step['continue-on-error']) {
        step.continue_on_error = step['continue-on-error'] as boolean;
      }
    }

    const result: WorkflowJob = {
      name: (job.name as string) || '',
      runs_on: runsOn,
      needs: job.needs as string | string[] | undefined,
      if: job.if as string | undefined,
      environment: job.environment as
        | { name: string; url?: string }
        | undefined,
      steps,
    };
    return result;
  }

  /**
   * 验证CI/CD配置文件
   */
  async validate(): Promise<{
    valid: boolean;
    errors: ValidationError[];
    warnings: ValidationError[];
  }> {
    try {
      const fileContent = fs.readFileSync(this.configPath, 'utf-8');
      const rawConfig = yaml.load(fileContent) as Record<string, unknown>;

      // 规范化配置
      const config: WorkflowConfig = {
        name: rawConfig.name as string,
        on: rawConfig.on as WorkflowTrigger | undefined,
        jobs: {} as Record<string, WorkflowJob>,
      };

      // 规范化作业
      if (rawConfig.jobs) {
        for (const jobName of Object.keys(
          rawConfig.jobs as Record<string, unknown>
        )) {
          const job = (rawConfig.jobs as Record<string, unknown>)[jobName];
          config.jobs[jobName] = this.normalizeJob(
            job as Record<string, unknown>
          );
        }
      }

      this.validateWorkflowStructure(config);
      this.validateTriggers(config);
      this.validateJobs(config);
      this.validateEnvironmentSeparation(config);
      this.validateSecurity(config);
      this.validateBestPractices(config);

      return {
        valid: this.errors.length === 0,
        errors: this.errors,
        warnings: this.warnings,
      };
    } catch (error) {
      this.errors.push({
        level: 'error',
        message: `Failed to parse YAML file: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
      return {
        valid: false,
        errors: this.errors,
        warnings: this.warnings,
      };
    }
  }

  /**
   * 验证工作流基本结构
   */
  private validateWorkflowStructure(config: WorkflowConfig): void {
    if (!config.name) {
      this.errors.push({
        level: 'error',
        message: 'Workflow name is missing',
      });
    }

    if (!config.on || Object.keys(config.on).length === 0) {
      this.errors.push({
        level: 'error',
        message: 'Workflow triggers are not defined',
      });
    }

    if (!config.jobs || Object.keys(config.jobs).length === 0) {
      this.errors.push({
        level: 'error',
        message: 'Workflow jobs are not defined',
      });
    }
  }

  /**
   * 验证触发器配置
   */
  private validateTriggers(config: WorkflowConfig): void {
    const triggers = config.on;

    if (triggers?.push && triggers.push.branches) {
      if (!triggers.push.branches.includes('develop')) {
        this.warnings.push({
          level: 'warning',
          message: 'develop branch is not in push triggers',
          context: 'triggers.push.branches',
        });
      }
    }

    if (triggers?.workflow_dispatch) {
      if (
        !triggers.workflow_dispatch.inputs ||
        Object.keys(triggers.workflow_dispatch.inputs).length === 0
      ) {
        this.warnings.push({
          level: 'warning',
          message: 'workflow_dispatch has no input parameters defined',
          context: 'triggers.workflow_dispatch',
        });
      }
    }
  }

  /**
   * 验证作业配置
   */
  private validateJobs(config: WorkflowConfig): void {
    const jobs = config.jobs;
    const jobNames = Object.keys(jobs);

    for (const jobName of jobNames) {
      const job = jobs[jobName];

      if (!job.name) {
        this.errors.push({
          level: 'error',
          message: `Job "${jobName}" is missing a name`,
          context: `jobs.${jobName}`,
        });
      }

      if (!job.runs_on) {
        this.errors.push({
          level: 'error',
          message: `Job "${jobName}" is missing runs_on configuration`,
          context: `jobs.${jobName}`,
        });
      }

      if (!job.steps || job.steps.length === 0) {
        this.errors.push({
          level: 'error',
          message: `Job "${jobName}" has no steps defined`,
          context: `jobs.${jobName}.steps`,
        });
      }

      // 检查作业依赖关系
      if (job.needs) {
        const needsList = Array.isArray(job.needs) ? job.needs : [job.needs];
        for (const dependency of needsList) {
          if (!jobNames.includes(dependency)) {
            this.errors.push({
              level: 'error',
              message: `Job "${jobName}" depends on non-existent job "${dependency}"`,
              context: `jobs.${jobName}.needs`,
            });
          }
        }
      }

      // 验证步骤配置
      this.validateSteps(jobName, job.steps);
    }
  }

  /**
   * 验证作业步骤配置
   */
  private validateSteps(jobName: string, steps: WorkflowStep[]): void {
    for (const step of steps) {
      if (!step.name) {
        this.errors.push({
          level: 'error',
          message: `Step in job "${jobName}" is missing a name`,
          context: `jobs.${jobName}.steps`,
        });
      }

      if (!step.uses && !step.run) {
        this.errors.push({
          level: 'error',
          message: `Step "${step.name}" must have either "uses" or "run"`,
          context: `jobs.${jobName}.steps.${step.name}`,
        });
      }

      // 检查GitHub Actions版本
      if (step.uses) {
        const versionMatch = step.uses.match(/@v?(\d+)$/);
        if (!versionMatch) {
          this.warnings.push({
            level: 'warning',
            message: `Step "${step.name}" does not specify a version pin`,
            context: `jobs.${jobName}.steps.${step.name}.uses`,
          });
        } else {
          const majorVersion = parseInt(versionMatch[1], 10);
          if (majorVersion < 3) {
            this.warnings.push({
              level: 'warning',
              message: `Step "${step.name}" uses an old major version: ${majorVersion}`,
              context: `jobs.${jobName}.steps.${step.name}.uses`,
            });
          }
        }
      }
    }
  }

  /**
   * 验证环境分离
   */
  private validateEnvironmentSeparation(config: WorkflowConfig): void {
    const jobs = config.jobs;
    const environmentJobs: string[] = [];

    for (const jobName of Object.keys(jobs)) {
      const job = jobs[jobName];
      if (job.environment?.name) {
        environmentJobs.push(jobName);
      }
    }

    if (environmentJobs.length === 0) {
      this.warnings.push({
        level: 'warning',
        message: 'No jobs have environment protection configured',
        context: 'environment',
      });
    }
  }

  /**
   * 验证安全配置
   */
  private validateSecurity(config: WorkflowConfig): void {
    const jobs = config.jobs;

    for (const jobName of Object.keys(jobs)) {
      const job = jobs[jobName];
      const jobSteps = job.steps;

      // 检查是否使用了敏感信息
      for (const step of jobSteps) {
        if (step.env) {
          for (const envKey of Object.keys(step.env)) {
            if (
              envKey.toLowerCase().includes('secret') ||
              envKey.toLowerCase().includes('password')
            ) {
              // 检查是否使用了GitHub Secrets
              if (!step.env[envKey].toString().includes('${{ secrets.')) {
                this.errors.push({
                  level: 'error',
                  message: `Step "${step.name}" contains hardcoded secret "${envKey}"`,
                  context: `jobs.${jobName}.steps.${step.name}.env.${envKey}`,
                });
              }
            }
          }
        }

        if (step.with) {
          for (const withKey of Object.keys(step.with)) {
            if (
              withKey.toLowerCase().includes('secret') ||
              withKey.toLowerCase().includes('password')
            ) {
              // 检查是否使用了GitHub Secrets
              if (!step.with[withKey].toString().includes('${{ secrets.')) {
                this.errors.push({
                  level: 'error',
                  message: `Step "${step.name}" contains hardcoded secret in with parameter "${withKey}"`,
                  context: `jobs.${jobName}.steps.${step.name}.with.${withKey}`,
                });
              }
            }
          }
        }
      }
    }
  }

  /**
   * 验证最佳实践
   */
  private validateBestPractices(config: WorkflowConfig): void {
    const jobs = config.jobs;

    // 检查是否有健康检查步骤
    for (const jobName of Object.keys(jobs)) {
      const job = jobs[jobName];
      const hasHealthCheck = job.steps.some(step =>
        step.name?.toLowerCase().includes('health check')
      );

      if (jobName.includes('deploy') && !hasHealthCheck) {
        this.warnings.push({
          level: 'warning',
          message: `Deploy job "${jobName}" does not include a health check step`,
          context: `jobs.${jobName}`,
        });
      }
    }

    // 检查是否配置了缓存
    for (const jobName of Object.keys(jobs)) {
      const job = jobs[jobName];
      const hasSetupNode = job.steps.some(step =>
        step.uses?.includes('actions/setup-node@')
      );

      if (hasSetupNode) {
        const setupNodeStep = job.steps.find(step =>
          step.uses?.includes('actions/setup-node@')
        );
        if (setupNodeStep && !setupNodeStep.with?.['cache']) {
          this.warnings.push({
            level: 'warning',
            message: `Job "${jobName}" uses setup-node but does not configure caching`,
            context: `jobs.${jobName}`,
          });
        }
      }
    }
  }
}

/**
 * 主函数：验证CI/CD配置文件
 */
export async function main(configPath?: string): Promise<number> {
  const filePath =
    configPath ||
    path.join(process.cwd(), '.github', 'workflows', 'deploy.yml');

  if (!fs.existsSync(filePath)) {
    console.error(`❌ Config file not found: ${filePath}`);
    return 1;
  }

  console.log('🔍 Validating CI/CD configuration...');
  console.log(`📁 File: ${filePath}\n`);

  const validator = new CIConfigValidator(filePath);
  const result = await validator.validate();

  // 显示错误
  if (result.errors.length > 0) {
    console.log('\n❌ Errors found:\n');
    for (const error of result.errors) {
      const context = error.context ? ` [${error.context}]` : '';
      console.log(`  🔴 ${error.message}${context}`);
    }
  }

  // 显示警告
  if (result.warnings.length > 0) {
    console.log('\n⚠️  Warnings:\n');
    for (const warning of result.warnings) {
      const context = warning.context ? ` [${warning.context}]` : '';
      console.log(`  🟡 ${warning.message}${context}`);
    }
  }

  // 显示结果
  console.log('\n' + '='.repeat(60));
  if (result.valid) {
    console.log('✅ Configuration is valid!');
    if (result.warnings.length > 0) {
      console.log(`\n⚠️  ${result.warnings.length} warning(s) found`);
    } else {
      console.log('\n🎉 No warnings found!');
    }
    return 0;
  } else {
    console.log(`❌ ${result.errors.length} error(s) found`);
    if (result.warnings.length > 0) {
      console.log(`\n⚠️  ${result.warnings.length} warning(s) found`);
    }
    return 1;
  }
}

// 导出类型和函数供测试使用
export type { WorkflowConfig, WorkflowJob, WorkflowStep };
export { CIConfigValidator };

// 运行主函数（仅当直接执行时）
if (require.main === module) {
  main().catch((error: unknown) => {
    console.error('\n❌ Unexpected error:', error);
    process.exit(1);
  });
}
