/**
 * 文档模板类型定义测试
 */

import {
  DocumentTemplateType,
  DocumentTemplateCategory,
  TemplateStatus,
  TemplateVariableType,
  type CreateDocumentTemplateInput,
  type UpdateDocumentTemplateInput,
  type DocumentTemplateDetail,
  type DocumentTemplateQueryParams,
  type DocumentTemplateListResponse,
  type GenerateDocumentInput,
  type GeneratedDocument,
  type TemplateValidationError,
  type TemplateValidationResult,
  type TemplateStatistics,
} from '@/types/document-template';

describe('DocumentTemplateType', () => {
  test('应该包含所有必需的类型值', () => {
    expect(DocumentTemplateType.INDICTMENT).toBe('INDICTMENT');
    expect(DocumentTemplateType.DEFENSE).toBe('DEFENSE');
    expect(DocumentTemplateType.APPEARANCE).toBe('APPEARANCE');
    expect(DocumentTemplateType.APPEAL).toBe('APPEAL');
    expect(DocumentTemplateType.OTHER).toBe('OTHER');
  });

  test('应该包含所有枚举键', () => {
    const keys = Object.keys(DocumentTemplateType);
    expect(keys).toContain('INDICTMENT');
    expect(keys).toContain('DEFENSE');
    expect(keys).toContain('APPEARANCE');
    expect(keys).toContain('APPEAL');
    expect(keys).toContain('OTHER');
    expect(keys).toHaveLength(5);
  });
});

describe('DocumentTemplateCategory', () => {
  test('应该包含所有必需的分类值', () => {
    expect(DocumentTemplateCategory.CIVIL).toBe('CIVIL');
    expect(DocumentTemplateCategory.CRIMINAL).toBe('CRIMINAL');
    expect(DocumentTemplateCategory.ADMINISTRATIVE).toBe('ADMINISTRATIVE');
    expect(DocumentTemplateCategory.COMMERCIAL).toBe('COMMERCIAL');
    expect(DocumentTemplateCategory.LABOR).toBe('LABOR');
    expect(DocumentTemplateCategory.INTELLECTUAL).toBe('INTELLECTUAL');
    expect(DocumentTemplateCategory.OTHER).toBe('OTHER');
  });

  test('应该包含所有枚举键', () => {
    const keys = Object.keys(DocumentTemplateCategory);
    expect(keys).toContain('CIVIL');
    expect(keys).toContain('CRIMINAL');
    expect(keys).toContain('ADMINISTRATIVE');
    expect(keys).toContain('COMMERCIAL');
    expect(keys).toContain('LABOR');
    expect(keys).toContain('INTELLECTUAL');
    expect(keys).toContain('OTHER');
    expect(keys).toHaveLength(7);
  });
});

describe('TemplateStatus', () => {
  test('应该包含所有必需的状态值', () => {
    expect(TemplateStatus.DRAFT).toBe('DRAFT');
    expect(TemplateStatus.PUBLISHED).toBe('PUBLISHED');
    expect(TemplateStatus.ARCHIVED).toBe('ARCHIVED');
  });

  test('应该包含所有枚举键', () => {
    const keys = Object.keys(TemplateStatus);
    expect(keys).toContain('DRAFT');
    expect(keys).toContain('PUBLISHED');
    expect(keys).toContain('ARCHIVED');
    expect(keys).toHaveLength(3);
  });
});

describe('TemplateVariableType', () => {
  test('应该包含所有必需的变量类型', () => {
    expect(TemplateVariableType.STRING).toBe('string');
    expect(TemplateVariableType.NUMBER).toBe('number');
    expect(TemplateVariableType.DATE).toBe('date');
    expect(TemplateVariableType.BOOLEAN).toBe('boolean');
    expect(TemplateVariableType.TEXT).toBe('text');
  });

  test('应该包含所有枚举键', () => {
    const keys = Object.keys(TemplateVariableType);
    expect(keys).toContain('STRING');
    expect(keys).toContain('NUMBER');
    expect(keys).toContain('DATE');
    expect(keys).toContain('BOOLEAN');
    expect(keys).toContain('TEXT');
    expect(keys).toHaveLength(5);
  });
});

describe('CreateDocumentTemplateInput', () => {
  test('应该接受有效的输入', () => {
    const input: CreateDocumentTemplateInput = {
      name: '测试模板',
      type: DocumentTemplateType.INDICTMENT,
      category: DocumentTemplateCategory.CIVIL,
      content: '模板内容',
      variables: [
        {
          name: 'plaintiff',
          type: TemplateVariableType.STRING,
          description: '原告姓名',
          required: true,
        },
      ],
      version: '1.0',
      isSystem: false,
      isPublic: false,
      createdBy: 'user123',
      status: TemplateStatus.DRAFT,
      metadata: {
        description: '测试模板元数据',
      },
    };

    expect(input.name).toBe('测试模板');
    expect(input.type).toBe(DocumentTemplateType.INDICTMENT);
    expect(input.category).toBe(DocumentTemplateCategory.CIVIL);
    expect(input.content).toBe('模板内容');
    expect(input.variables).toHaveLength(1);
    expect(input.version).toBe('1.0');
    expect(input.isSystem).toBe(false);
    expect(input.isPublic).toBe(false);
    expect(input.createdBy).toBe('user123');
    expect(input.status).toBe(TemplateStatus.DRAFT);
    expect(input.metadata).toBeDefined();
  });

  test('应该接受最小必需的输入', () => {
    const input: CreateDocumentTemplateInput = {
      name: '简单模板',
      type: DocumentTemplateType.DEFENSE,
      content: '内容',
      variables: [],
      createdBy: 'user456',
    };

    expect(input.name).toBe('简单模板');
    expect(input.type).toBe(DocumentTemplateType.DEFENSE);
    expect(input.content).toBe('内容');
    expect(input.variables).toEqual([]);
    expect(input.createdBy).toBe('user456');
    expect(input.version).toBeUndefined();
    expect(input.isSystem).toBeUndefined();
    expect(input.isPublic).toBeUndefined();
    expect(input.status).toBeUndefined();
    expect(input.category).toBeUndefined();
  });
});

describe('UpdateDocumentTemplateInput', () => {
  test('应该接受部分更新', () => {
    const input: UpdateDocumentTemplateInput = {
      name: '更新的模板',
      status: TemplateStatus.PUBLISHED,
    };

    expect(input.name).toBe('更新的模板');
    expect(input.status).toBe(TemplateStatus.PUBLISHED);
    expect(input.type).toBeUndefined();
    expect(input.content).toBeUndefined();
  });

  test('应该接受完整更新', () => {
    const input: UpdateDocumentTemplateInput = {
      name: '完整更新',
      type: DocumentTemplateType.APPEAL,
      category: DocumentTemplateCategory.CRIMINAL,
      content: '新内容',
      variables: [],
      version: '2.0',
      isPublic: true,
      status: TemplateStatus.PUBLISHED,
    };

    expect(input.name).toBe('完整更新');
    expect(input.type).toBe(DocumentTemplateType.APPEAL);
    expect(input.category).toBe(DocumentTemplateCategory.CRIMINAL);
    expect(input.content).toBe('新内容');
    expect(input.version).toBe('2.0');
    expect(input.isPublic).toBe(true);
    expect(input.status).toBe(TemplateStatus.PUBLISHED);
  });
});

describe('DocumentTemplateDetail', () => {
  test('应该包含所有必需的字段', () => {
    const detail: DocumentTemplateDetail = {
      id: 'tpl123',
      name: '详细模板',
      type: DocumentTemplateType.APPEARANCE,
      category: DocumentTemplateCategory.LABOR,
      content: '详细内容',
      variables: [
        {
          name: 'defendant',
          type: TemplateVariableType.STRING,
          description: '被告姓名',
          required: true,
        },
      ],
      version: '1.0',
      isSystem: false,
      isPublic: true,
      createdBy: 'user789',
      status: TemplateStatus.PUBLISHED,
      metadata: null,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-02'),
      creatorName: '测试用户',
    };

    expect(detail.id).toBe('tpl123');
    expect(detail.name).toBe('详细模板');
    expect(detail.type).toBe(DocumentTemplateType.APPEARANCE);
    expect(detail.category).toBe(DocumentTemplateCategory.LABOR);
    expect(detail.content).toBe('详细内容');
    expect(detail.variables).toHaveLength(1);
    expect(detail.version).toBe('1.0');
    expect(detail.isSystem).toBe(false);
    expect(detail.isPublic).toBe(true);
    expect(detail.createdBy).toBe('user789');
    expect(detail.status).toBe(TemplateStatus.PUBLISHED);
    expect(detail.createdAt).toEqual(new Date('2024-01-01'));
    expect(detail.updatedAt).toEqual(new Date('2024-01-02'));
    expect(detail.creatorName).toBe('测试用户');
  });

  test('应该支持可选的category和creatorName字段', () => {
    const detail: DocumentTemplateDetail = {
      id: 'tpl456',
      name: '可选字段模板',
      type: DocumentTemplateType.OTHER,
      category: null,
      content: '内容',
      variables: [],
      version: '1.0',
      isSystem: false,
      isPublic: false,
      createdBy: 'user999',
      status: TemplateStatus.DRAFT,
      metadata: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    expect(detail.category).toBeNull();
    expect(detail.creatorName).toBeUndefined();
  });

  test('应该支持软删除标记', () => {
    const detail: DocumentTemplateDetail = {
      id: 'tpl789',
      name: '已删除模板',
      type: DocumentTemplateType.INDICTMENT,
      category: DocumentTemplateCategory.CIVIL,
      content: '内容',
      variables: [],
      version: '1.0',
      isSystem: false,
      isPublic: false,
      createdBy: 'user111',
      status: TemplateStatus.DRAFT,
      metadata: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: new Date(),
    };

    expect(detail.deletedAt).toBeDefined();
    expect(detail.deletedAt).toBeInstanceOf(Date);
  });
});

describe('DocumentTemplateQueryParams', () => {
  test('应该接受查询参数', () => {
    const params: DocumentTemplateQueryParams = {
      userId: 'user123',
      type: DocumentTemplateType.INDICTMENT,
      category: DocumentTemplateCategory.CIVIL,
      status: TemplateStatus.PUBLISHED,
      isPublic: true,
      isSystem: false,
      search: '起诉',
      page: 1,
      limit: 10,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    };

    expect(params.userId).toBe('user123');
    expect(params.type).toBe(DocumentTemplateType.INDICTMENT);
    expect(params.category).toBe(DocumentTemplateCategory.CIVIL);
    expect(params.status).toBe(TemplateStatus.PUBLISHED);
    expect(params.isPublic).toBe(true);
    expect(params.isSystem).toBe(false);
    expect(params.search).toBe('起诉');
    expect(params.page).toBe(1);
    expect(params.limit).toBe(10);
    expect(params.sortBy).toBe('createdAt');
    expect(params.sortOrder).toBe('desc');
  });

  test('应该接受空查询参数', () => {
    const params: DocumentTemplateQueryParams = {};

    expect(params.userId).toBeUndefined();
    expect(params.type).toBeUndefined();
    expect(params.page).toBeUndefined();
    expect(params.limit).toBeUndefined();
  });
});

describe('DocumentTemplateListResponse', () => {
  test('应该包含列表响应字段', () => {
    const response: DocumentTemplateListResponse = {
      templates: [
        {
          id: 'tpl1',
          name: '模板1',
          type: DocumentTemplateType.INDICTMENT,
          category: DocumentTemplateCategory.CIVIL,
          content: '内容1',
          variables: [],
          version: '1.0',
          isSystem: false,
          isPublic: true,
          createdBy: 'user1',
          status: TemplateStatus.PUBLISHED,
          metadata: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      total: 1,
      page: 1,
      limit: 10,
      totalPages: 1,
    };

    expect(response.templates).toHaveLength(1);
    expect(response.total).toBe(1);
    expect(response.page).toBe(1);
    expect(response.limit).toBe(10);
    expect(response.totalPages).toBe(1);
  });
});

describe('GenerateDocumentInput', () => {
  test('应该接受生成文档输入', () => {
    const input: GenerateDocumentInput = {
      templateId: 'tpl123',
      variables: {
        plaintiff: '张三',
        defendant: '李四',
        amount: 100000,
      },
      caseId: 'case456',
    };

    expect(input.templateId).toBe('tpl123');
    expect(input.variables).toEqual({
      plaintiff: '张三',
      defendant: '李四',
      amount: 100000,
    });
    expect(input.caseId).toBe('case456');
  });

  test('应该接受没有caseId的输入', () => {
    const input: GenerateDocumentInput = {
      templateId: 'tpl789',
      variables: {
        name: '测试',
      },
    };

    expect(input.templateId).toBe('tpl789');
    expect(input.variables.name).toBe('测试');
    expect(input.caseId).toBeUndefined();
  });
});

describe('GeneratedDocument', () => {
  test('应该包含生成文档输出字段', () => {
    const output: GeneratedDocument = {
      content: '这是生成的文档内容...',
      templateName: '民事起诉状模板',
      generatedAt: new Date(),
      variables: {
        plaintiff: '王五',
        defendant: '赵六',
      },
    };

    expect(output.content).toBe('这是生成的文档内容...');
    expect(output.templateName).toBe('民事起诉状模板');
    expect(output.generatedAt).toBeInstanceOf(Date);
    expect(output.variables.plaintiff).toBe('王五');
    expect(output.variables.defendant).toBe('赵六');
  });
});

describe('TemplateValidationError', () => {
  test('应该包含验证错误字段', () => {
    const error: TemplateValidationError = {
      field: 'name',
      message: '模板名称不能为空',
    };

    expect(error.field).toBe('name');
    expect(error.message).toBe('模板名称不能为空');
  });
});

describe('TemplateValidationResult', () => {
  test('应该表示有效验证结果', () => {
    const result: TemplateValidationResult = {
      isValid: true,
      errors: [],
    };

    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test('应该表示无效验证结果', () => {
    const result: TemplateValidationResult = {
      isValid: false,
      errors: [
        {
          field: 'content',
          message: '模板内容不能为空',
        },
      ],
    };

    expect(result.isValid).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].field).toBe('content');
  });
});

describe('TemplateStatistics', () => {
  test('应该包含统计信息字段', () => {
    const stats: TemplateStatistics = {
      totalTemplates: 100,
      templatesByType: {
        INDICTMENT: 30,
        DEFENSE: 25,
        APPEARANCE: 20,
        APPEAL: 15,
        OTHER: 10,
      },
      templatesByCategory: {
        CIVIL: 40,
        CRIMINAL: 30,
        ADMINISTRATIVE: 10,
        COMMERCIAL: 10,
        LABOR: 5,
        INTELLECTUAL: 3,
        OTHER: 2,
      },
      templatesByStatus: {
        DRAFT: 20,
        PUBLISHED: 70,
        ARCHIVED: 10,
      },
      publicTemplates: 50,
      privateTemplates: 45,
      systemTemplates: 5,
      userTemplates: 95,
      recentTemplates: [],
    };

    expect(stats.totalTemplates).toBe(100);
    expect(stats.templatesByType.INDICTMENT).toBe(30);
    expect(stats.templatesByCategory.CIVIL).toBe(40);
    expect(stats.templatesByStatus.PUBLISHED).toBe(70);
    expect(stats.publicTemplates).toBe(50);
    expect(stats.privateTemplates).toBe(45);
    expect(stats.systemTemplates).toBe(5);
    expect(stats.userTemplates).toBe(95);
    expect(stats.recentTemplates).toEqual([]);
  });
});
