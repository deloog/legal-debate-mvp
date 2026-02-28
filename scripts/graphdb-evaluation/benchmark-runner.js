"use strict";
/**
 * 基准测试运行器
 * 用于图数据库性能评估
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.BenchmarkRunner = exports.BenchmarkQueryType = void 0;
/**
 * 基准查询类型
 */
var BenchmarkQueryType;
(function (BenchmarkQueryType) {
    BenchmarkQueryType["SINGLE_NODE"] = "SINGLE_NODE";
    BenchmarkQueryType["MULTI_NODE"] = "MULTI_NODE";
    BenchmarkQueryType["PATH_QUERY"] = "PATH_QUERY";
    BenchmarkQueryType["MULTI_HOP"] = "MULTI_HOP";
    BenchmarkQueryType["AGGREGATION"] = "AGGREGATION";
    BenchmarkQueryType["LIMIT_QUERY"] = "LIMIT_QUERY";
    BenchmarkQueryType["COMPLEX"] = "COMPLEX";
    BenchmarkQueryType["SLOW_QUERY"] = "SLOW_QUERY";
})(BenchmarkQueryType || (exports.BenchmarkQueryType = BenchmarkQueryType = {}));
/**
 * 基准测试运行器类
 */
class BenchmarkRunner {
    constructor(verbose = false) {
        this.connection = null;
        this.verbose = false;
        this.verbose = verbose;
    }
    /**
     * 设置数据库连接
     */
    setConnection(connection) {
        this.connection = connection;
    }
    /**
     * 运行基准测试
     */
    async runBenchmarks(queries, config = {}) {
        const finalConfig = {
            warmupRuns: config.warmupRuns ?? 3,
            benchmarkRuns: config.benchmarkRuns ?? 10,
            recordDetailedRuns: config.recordDetailedRuns ?? false,
            recordPercentiles: config.recordPercentiles ?? true,
            timeoutMs: config.timeoutMs ?? 30000,
            verbose: config.verbose ?? this.verbose,
        };
        const results = [];
        for (const query of queries) {
            if (this.verbose) {
                console.log(`\n运行基准测试: ${query.name}`);
                console.log(`查询类型: ${query.type}`);
                console.log(`预热运行: ${finalConfig.warmupRuns}次`);
                console.log(`基准运行: ${finalConfig.benchmarkRuns}次`);
            }
            try {
                const result = await this.runSingleBenchmark(query, finalConfig);
                results.push(result);
                if (this.verbose) {
                    this.logResult(result);
                }
            }
            catch (error) {
                if (error instanceof Error) {
                    console.error(`基准测试失败: ${query.name}`, error.message);
                }
                throw error;
            }
        }
        return results;
    }
    /**
     * 运行单个基准测试
     */
    async runSingleBenchmark(query, config) {
        // 预热运行
        if (config.warmupRuns > 0) {
            await this.runWarmup(query, config.warmupRuns);
        }
        // 基准运行
        const runResults = [];
        let lastError = null;
        for (let i = 0; i < config.benchmarkRuns; i++) {
            try {
                const result = await this.runSingleQuery(query, config.timeoutMs);
                runResults.push(result);
                if (config.verbose) {
                    console.log(`  运行 ${i + 1}/${config.benchmarkRuns}: ${result.time}ms`);
                }
            }
            catch (error) {
                lastError = error instanceof Error ? error : new Error(String(error));
                runResults.push({
                    time: 0,
                    resultCount: 0,
                    error: lastError.message,
                });
            }
        }
        // 计算统计指标
        const successfulRuns = runResults.filter(r => !r.error);
        // 如果所有运行都失败，抛出最后一个错误
        if (successfulRuns.length === 0 && lastError) {
            throw lastError;
        }
        const times = successfulRuns.map(r => r.time);
        const resultCounts = successfulRuns.map(r => r.resultCount);
        return {
            name: query.name,
            type: query.type,
            query: query.query,
            meanTime: this.mean(times),
            minTime: Math.min(...times),
            maxTime: Math.max(...times),
            medianTime: this.median(times),
            stdDev: this.stdDev(times),
            p50: config.recordPercentiles ? this.percentile(times, 50) : undefined,
            p90: config.recordPercentiles ? this.percentile(times, 90) : undefined,
            p95: config.recordPercentiles ? this.percentile(times, 95) : undefined,
            p99: config.recordPercentiles ? this.percentile(times, 99) : undefined,
            totalRuns: config.benchmarkRuns,
            successRuns: successfulRuns.length,
            failedRuns: runResults.length - successfulRuns.length,
            avgResultCount: resultCounts.length > 0 ? this.mean(resultCounts) : 0,
            detailedRuns: config.recordDetailedRuns ? runResults : undefined,
            timestamp: new Date().toISOString(),
        };
    }
    /**
     * 预热运行
     */
    async runWarmup(query, warmupRuns) {
        for (let i = 0; i < warmupRuns; i++) {
            try {
                await this.runSingleQuery(query, 5000); // 5秒超时
            }
            catch (error) {
                // 预热失败不影响基准测试
                if (this.verbose) {
                    console.warn(`预热运行 ${i + 1} 失败:`, error);
                }
            }
        }
        if (this.verbose) {
            console.log(`预热完成 (${warmupRuns}次)`);
        }
    }
    /**
     * 运行单个查询
     */
    async runSingleQuery(query, timeoutMs) {
        if (!this.connection) {
            throw new Error('数据库连接未设置，请先调用 setConnection()');
        }
        const startTime = performance.now();
        try {
            const result = await Promise.race([
                this.connection.executeQuery(query.query, query.params),
                this.timeout(timeoutMs),
            ]);
            const endTime = performance.now();
            const executionTime = endTime - startTime;
            return {
                time: executionTime,
                resultCount: result.records.length,
            };
        }
        catch (error) {
            const endTime = performance.now();
            const executionTime = endTime - startTime;
            if (this.verbose) {
                console.error(`查询执行失败: ${query.name}`, error);
            }
            throw error;
        }
    }
    /**
     * 超时处理
     */
    timeout(ms) {
        return new Promise((_, reject) => {
            setTimeout(() => reject(new Error(`查询超时 (${ms}ms)`)), ms);
        });
    }
    /**
     * 计算平均值
     */
    mean(values) {
        if (values.length === 0)
            return 0;
        const sum = values.reduce((acc, val) => acc + val, 0);
        return sum / values.length;
    }
    /**
     * 计算中位数
     */
    median(values) {
        if (values.length === 0)
            return 0;
        const sorted = [...values].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        return sorted.length % 2 === 0
            ? (sorted[mid - 1] + sorted[mid]) / 2
            : sorted[mid];
    }
    /**
     * 计算标准差
     */
    stdDev(values) {
        if (values.length === 0)
            return 0;
        const avg = this.mean(values);
        const squareDiffs = values.map(value => Math.pow(value - avg, 2));
        const avgSquareDiff = this.mean(squareDiffs);
        return Math.sqrt(avgSquareDiff);
    }
    /**
     * 计算百分位数
     */
    percentile(values, p) {
        if (values.length === 0)
            return 0;
        const sorted = [...values].sort((a, b) => a - b);
        const index = (p / 100) * (sorted.length - 1);
        const lower = Math.floor(index);
        const upper = Math.ceil(index);
        const weight = index - lower;
        return sorted[lower] * (1 - weight) + sorted[upper] * weight;
    }
    /**
     * 输出结果
     */
    logResult(result) {
        console.log('\n=== 基准测试结果 ===');
        console.log(`查询名称: ${result.name}`);
        console.log(`查询类型: ${result.type}`);
        console.log(`\n时间指标:`);
        console.log(`  平均时间: ${result.meanTime.toFixed(2)}ms`);
        console.log(`  最小时间: ${result.minTime.toFixed(2)}ms`);
        console.log(`  最大时间: ${result.maxTime.toFixed(2)}ms`);
        console.log(`  中位数时间: ${result.medianTime.toFixed(2)}ms`);
        console.log(`  标准差: ${result.stdDev.toFixed(2)}ms`);
        if (result.p50) {
            console.log(`\n百分位数:`);
            console.log(`  P50: ${result.p50.toFixed(2)}ms`);
            console.log(`  P90: ${result.p90?.toFixed(2)}ms`);
            console.log(`  P95: ${result.p95?.toFixed(2)}ms`);
            console.log(`  P99: ${result.p99?.toFixed(2)}ms`);
        }
        console.log(`\n执行信息:`);
        console.log(`  总运行次数: ${result.totalRuns}`);
        console.log(`  成功运行: ${result.successRuns}`);
        console.log(`  失败运行: ${result.failedRuns}`);
        console.log(`  平均返回结果数: ${result.avgResultCount}`);
    }
    /**
     * 关闭连接
     */
    async close() {
        if (this.connection) {
            await this.connection.close();
            this.connection = null;
        }
    }
    /**
     * 比较两个基准测试结果
     */
    compareResults(result1, result2) {
        if (result1.meanTime === 0) {
            return { speedup: 0, improvement: '无法比较（平均时间为0）' };
        }
        const speedup = result2.meanTime / result1.meanTime;
        const improvement = speedup > 1
            ? `快 ${(speedup - 1) * 100}%`
            : `慢 ${(1 - speedup) * 100}%`;
        return { speedup, improvement };
    }
    /**
     * 生成Markdown报告
     */
    generateMarkdownReport(results) {
        let report = '# 图数据库性能基准测试报告\n\n';
        report += `生成时间: ${new Date().toLocaleString('zh-CN')}\n\n`;
        // 摘要
        report += '## 测试摘要\n\n';
        report += '| 查询名称 | 类型 | 平均时间 | 最小时间 | 最大时间 | 标准差 |\n';
        report += '|---------|------|---------|---------|---------|--------|\n';
        for (const result of results) {
            report += `| ${result.name} | ${result.type} | ${result.meanTime.toFixed(2)}ms | ${result.minTime.toFixed(2)}ms | ${result.maxTime.toFixed(2)}ms | ${result.stdDev.toFixed(2)}ms |\n`;
        }
        // 详细结果
        report += '\n## 详细结果\n\n';
        for (const result of results) {
            report += `### ${result.name}\n\n`;
            report += `- **查询类型**: ${result.type}\n`;
            report += `- **查询语句**:\n`;
            report += '```cypher\n';
            report += result.query;
            report += '\n```\n\n';
            report += `- **平均时间**: ${result.meanTime.toFixed(2)}ms\n`;
            report += `- **最小时间**: ${result.minTime.toFixed(2)}ms\n`;
            report += `- **最大时间**: ${result.maxTime.toFixed(2)}ms\n`;
            report += `- **中位数时间**: ${result.medianTime.toFixed(2)}ms\n`;
            report += `- **标准差**: ${result.stdDev.toFixed(2)}ms\n`;
            report += `- **成功运行**: ${result.successRuns}/${result.totalRuns}\n`;
            report += `- **平均返回结果数**: ${result.avgResultCount}\n`;
            if (result.p50) {
                report += `\n**百分位数**:\n`;
                report += `- P50: ${result.p50.toFixed(2)}ms\n`;
                report += `- P90: ${result.p90?.toFixed(2)}ms\n`;
                report += `- P95: ${result.p95?.toFixed(2)}ms\n`;
                report += `- P99: ${result.p99?.toFixed(2)}ms\n`;
            }
            report += '\n';
        }
        return report;
    }
    /**
     * 生成JSON报告
     */
    generateJsonReport(results) {
        const report = {
            timestamp: new Date().toISOString(),
            results,
        };
        return JSON.stringify(report, null, 2);
    }
}
exports.BenchmarkRunner = BenchmarkRunner;
