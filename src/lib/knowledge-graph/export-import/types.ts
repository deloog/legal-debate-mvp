/**
 * 导出格式类型
 */
export type ExportFormat = 'graphml' | 'gml' | 'json-ld';

/**
 * 导入导出合并策略
 */
export type MergeStrategy = 'skip' | 'update' | 'replace';

/**
 * 导出过滤参数
 */
export interface ExportFilterOptions {
  format: ExportFormat;
  startDate?: Date;
  endDate?: Date;
  relationTypes?: string[];
  minStrength?: number;
  maxStrength?: number;
  verificationStatus?: string[];
  discoveryMethod?: string[];
}

/**
 * 图节点数据
 */
export interface GraphNode {
  id: string;
  label: string;
  lawName: string;
  articleNumber: string;
  lawType: string;
  category: string;
  tags: string[];
  fullText?: string;
  effectiveDate: Date;
  status: string;
}

/**
 * 图边数据
 */
export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  relationType: string;
  strength: number;
  confidence: number;
  description?: string;
  discoveryMethod: string;
  verificationStatus: string;
  verifiedBy?: string;
  verifiedAt?: Date;
  aiProvider?: string;
  aiModel?: string;
  aiConfidence?: number;
  createdAt: Date;
}

/**
 * 图数据
 */
export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  exportedAt: Date;
  totalCount: number;
}

/**
 * 导入验证错误
 */
export interface ImportError {
  type: 'NODE_NOT_FOUND' | 'INVALID_RELATION_TYPE' | 'MISSING_FIELD' | 'INVALID_DATA';
  entity: 'node' | 'edge';
  entityId?: string;
  field?: string;
  message: string;
  severity: 'error' | 'warning';
}

/**
 * 导入结果
 */
export interface ImportResult {
  success: boolean;
  importedNodes: number;
  importedEdges: number;
  skippedEdges: number;
  updatedEdges: number;
  errors: ImportError[];
  warnings: ImportError[];
  processingTime: number;
}

/**
 * 导出任务状态
 */
export interface ExportTaskStatus {
  taskId: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  progress: number;
  format: ExportFormat;
  filePath?: string;
  fileSize?: number;
  error?: string;
  createdAt: Date;
  completedAt?: Date;
}

/**
 * 导出选项
 */
export interface ExportOptions {
  format: ExportFormat;
  filter?: ExportFilterOptions;
  compress?: boolean; // 是否压缩
  async?: boolean; // 是否异步处理
}

/**
 * 导入选项
 */
export interface ImportOptions {
  format: ExportFormat;
  mergeStrategy: MergeStrategy;
  validate: boolean; // 是否执行完整验证
  dryRun?: boolean; // 仅验证不导入
}

/**
 * GraphML 格式的节点属性
 */
export interface GraphMLNodeAttributes {
  id: string;
  label: string;
  lawName: string;
  articleNumber: string;
  lawType: string;
  category: string;
  tags: string;
  fullText?: string;
  effectiveDate: string;
  status: string;
}

/**
 * GraphML 格式的边属性
 */
export interface GraphMLEdgeAttributes {
  id: string;
  relationType: string;
  strength: number;
  confidence: number;
  description?: string;
  discoveryMethod: string;
  verificationStatus: string;
  verifiedBy?: string;
  verifiedAt?: string;
  aiProvider?: string;
  aiModel?: string;
  aiConfidence?: number;
  createdAt: string;
}

/**
 * GML 格式的节点
 */
export interface GMLNode {
  id: string;
  label: string;
  lawName: string;
  articleNumber: string;
  lawType: string;
  category: string;
  tags: string[];
  fullText?: string;
  effectiveDate: string;
  status: string;
}

/**
 * GML 格式的边
 */
export interface GMLEdge {
  source: string;
  target: string;
  id: string;
  relationType: string;
  strength: number;
  confidence: number;
  description?: string;
  discoveryMethod: string;
  verificationStatus: string;
  verifiedBy?: string;
  verifiedAt?: string;
  aiProvider?: string;
  aiModel?: string;
  aiConfidence?: number;
  createdAt: string;
}

/**
 * JSON-LD 格式的图数据
 */
export interface JsonLdGraph {
  '@context': {
    node: string;
    edge: string;
    source: string;
    target: string;
    label: string;
    relationType: string;
    strength: string;
    confidence: string;
    discoveryMethod: string;
    verificationStatus: string;
    createdAt: string;
    xsd: string;
  };
  '@graph': Array<
    | {
        '@type': 'node';
        '@id': string;
        label: string;
        lawName: string;
        articleNumber: string;
        lawType: string;
        category: string;
        tags: string[];
        fullText?: string;
        effectiveDate: string;
        status: string;
      }
    | {
        '@type': 'edge';
        '@id': string;
        source: string;
        target: string;
        relationType: string;
        strength: number;
        confidence: number;
        description?: string;
        discoveryMethod: string;
        verificationStatus: string;
        verifiedBy?: string;
        verifiedAt?: string;
        aiProvider?: string;
        aiModel?: string;
        aiConfidence?: number;
        createdAt: string;
      }
  >;
  exportedAt: string;
}
