"use strict";
/**
 * 图数据库评估类型定义
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.BenchmarkType = exports.DatabaseType = void 0;
/**
 * 候选数据库类型
 */
var DatabaseType;
(function (DatabaseType) {
    DatabaseType["POSTGRESQL"] = "postgresql";
    DatabaseType["NEO4J"] = "neo4j";
    DatabaseType["ARANGODB"] = "arangodb";
})(DatabaseType || (exports.DatabaseType = DatabaseType = {}));
/**
 * 基准测试类型
 */
var BenchmarkType;
(function (BenchmarkType) {
    // 单跳查询
    BenchmarkType["SINGLE_HOP_QUERY"] = "single_hop_query";
    // 多跳路径查询
    BenchmarkType["MULTI_HOP_PATH"] = "multi_hop_path";
    // 邻居查询
    BenchmarkType["NEIGHBOR_QUERY"] = "neighbor_query";
    // PageRank中心性
    BenchmarkType["PAGERANK_CENTRALITY"] = "pagerank_centrality";
    // 连通分量
    BenchmarkType["CONNECTED_COMPONENTS"] = "connected_components";
    // 批量插入
    BenchmarkType["BATCH_INSERT"] = "batch_insert";
    // 批量更新
    BenchmarkType["BATCH_UPDATE"] = "batch_update";
    // 复杂过滤查询
    BenchmarkType["COMPLEX_FILTER_QUERY"] = "complex_filter_query";
    // 聚合查询
    BenchmarkType["AGGREGATION_QUERY"] = "aggregation_query";
})(BenchmarkType || (exports.BenchmarkType = BenchmarkType = {}));
