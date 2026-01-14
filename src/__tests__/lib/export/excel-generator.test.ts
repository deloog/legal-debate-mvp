/**
 * Excel生成器单元测试
 */

import {
  ExcelGenerator,
  generateExportFilename,
} from '@/lib/export/excel-generator';
import { ExportFormat } from '@/types/stats';

// =============================================================================
// ExcelGenerator类测试
// =============================================================================

describe('ExcelGenerator', () => {
  const sampleData = [
    { id: '1', name: '张三', age: 30, score: 95.5 },
    { id: '2', name: '李四', age: 25, score: 88.0 },
    { id: '3', name: '王五', age: 35, score: 92.3 },
  ];

  const headers = ['id', 'name', 'age', 'score'];

  describe('构造函数', () => {
    it('应该正确初始化Excel生成器', () => {
      const generator = new ExcelGenerator(headers, sampleData, '测试数据');
      expect(generator).toBeInstanceOf(ExcelGenerator);
    });

    it('应该设置正确的属性', () => {
      const generator = new ExcelGenerator(headers, sampleData, '测试数据');
      expect(generator['headers']).toEqual(headers);
      expect(generator['data']).toEqual(sampleData);
      expect(generator['title']).toBe('测试数据');
    });

    it('应该使用默认标题', () => {
      const generator = new ExcelGenerator(headers, sampleData);
      expect(generator['title']).toBe('Export Data');
    });
  });

  describe('escapeField方法', () => {
    it('应该正确转义包含逗号的字段', () => {
      const data = [{ value: 'hello,world' }];
      const generator = new ExcelGenerator(['value'], data);
      const content = generator.generate();
      expect(content).toContain('"hello,world"');
    });

    it('应该正确转义包含双引号的字段', () => {
      const data = [{ value: 'say "hello"' }];
      const generator = new ExcelGenerator(['value'], data);
      const content = generator.generate();
      expect(content).toContain('"say ""hello"""');
    });

    it('应该正确转义包含换行符的字段', () => {
      const data = [{ value: 'line1\nline2' }];
      const generator = new ExcelGenerator(['value'], data);
      const content = generator.generate();
      expect(content).toContain('"line1\nline2"');
    });

    it('应该正确处理null和undefined值', () => {
      const data = [{ value: null }, { value: undefined }];
      const generator = new ExcelGenerator(['value'], data);
      const content = generator.generate();
      // 空值应该不会导致错误
      expect(content).toBeTruthy();
      expect(content).toContain('value');
    });

    it('应该正确处理数字值', () => {
      const data = [{ value: 123 }];
      const generator = new ExcelGenerator(['value'], data);
      const content = generator.generate();
      expect(content).toContain('123');
    });

    it('应该正确处理对象值（转为字符串）', () => {
      const data = [{ value: { nested: 'data' } }];
      const generator = new ExcelGenerator(['value'], data);
      const content = generator.generate();
      expect(content).toContain('[object Object]');
    });

    it('应该正确处理数组值（转为字符串）', () => {
      const data = [{ value: ['a', 'b', 'c'] }];
      const generator = new ExcelGenerator(['value'], data);
      const content = generator.generate();
      expect(content).toContain('"a,b,c"'); // 数组join后包含逗号，被转义
    });
  });

  describe('generate方法', () => {
    it('应该生成CSV格式内容', () => {
      const generator = new ExcelGenerator(headers, sampleData);
      const content = generator.generate();
      expect(content).toBeTruthy();
      expect(typeof content).toBe('string');
    });

    it('应该包含所有表头', () => {
      const generator = new ExcelGenerator(headers, sampleData);
      const content = generator.generate();
      headers.forEach(header => {
        expect(content).toContain(header);
      });
    });

    it('应该包含所有数据行', () => {
      const generator = new ExcelGenerator(headers, sampleData);
      const content = generator.generate();
      sampleData.forEach(row => {
        expect(content).toContain(row.id);
        expect(content).toContain(row.name);
      });
    });

    it('应该使用换行符分隔行', () => {
      const generator = new ExcelGenerator(headers, sampleData);
      const content = generator.generate();
      const lines = content.split('\n');
      expect(lines.length).toBeGreaterThan(sampleData.length + 2); // BOM + title + header + data
    });

    it('应该包含标题行', () => {
      const generator = new ExcelGenerator(headers, sampleData, '测试数据');
      const content = generator.generate();
      const lines = content.split('\n');
      // 标题在第二行（第一行是BOM）
      expect(lines[1]).toContain('测试数据');
    });
  });

  describe('toBlob方法', () => {
    it('应该返回Blob对象', () => {
      const generator = new ExcelGenerator(headers, sampleData);
      const blob = generator.toBlob();
      expect(blob).toBeInstanceOf(Blob);
    });

    it('应该设置正确的MIME类型', () => {
      const generator = new ExcelGenerator(headers, sampleData);
      const blob = generator.toBlob();
      expect(blob.type).toContain('text/csv');
    });

    it('应该设置正确的字符编码', () => {
      const generator = new ExcelGenerator(headers, sampleData);
      const blob = generator.toBlob();
      expect(blob.type).toContain('utf-8');
    });

    it('应该包含UTF-8 BOM', async () => {
      const generator = new ExcelGenerator(headers, sampleData);
      const content = generator.generate();
      expect(content.startsWith('\uFEFF')).toBe(true);
    });
  });

  describe('toDownloadUrl方法', () => {
    it('应该返回下载URL', () => {
      const generator = new ExcelGenerator(headers, sampleData);
      const url = generator.toDownloadUrl();
      expect(typeof url).toBe('string');
      expect(url).toBeTruthy();
      expect(url).toMatch(/^blob:/);
    });

    it('应该生成唯一的URL', () => {
      const generator1 = new ExcelGenerator(headers, sampleData);
      const generator2 = new ExcelGenerator(headers, sampleData);
      const url1 = generator1.toDownloadUrl();
      const url2 = generator2.toDownloadUrl();
      expect(url1).not.toBe(url2);
    });
  });

  describe('静态方法fromArray', () => {
    it('应该从对象数组创建Excel生成器', () => {
      const generator = ExcelGenerator.fromArray(sampleData);
      expect(generator).toBeInstanceOf(ExcelGenerator);
    });

    it('应该从第一个对象提取表头', () => {
      const generator = ExcelGenerator.fromArray(sampleData);
      expect(generator['headers']).toEqual(headers);
    });

    it('应该使用自定义表头', () => {
      const customHeaders = ['ID', 'Name', 'Age', 'Score'];
      const generator = ExcelGenerator.fromArray(sampleData, customHeaders);
      expect(generator['headers']).toEqual(customHeaders);
    });

    it('应该使用默认标题', () => {
      const generator = ExcelGenerator.fromArray(sampleData);
      expect(generator['title']).toBe('Export Data');
    });

    it('应该支持自定义标题', () => {
      const generator = ExcelGenerator.fromArray(
        sampleData,
        headers,
        '我的数据'
      );
      expect(generator['title']).toBe('我的数据');
    });
  });
});

// =============================================================================
// 辅助函数测试
// =============================================================================

describe('generateExportFilename', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2024-01-15T10:30:00Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('应该生成包含数据类型的文件名', () => {
    const filename = generateExportFilename('cases', ExportFormat.CSV);
    expect(filename).toContain('cases');
  });

  it('应该生成包含时间戳的文件名', () => {
    const filename = generateExportFilename('cases', ExportFormat.CSV);
    expect(filename).toContain('2024-01-15');
  });

  it('应该使用正确的文件扩展名', () => {
    const csvFilename = generateExportFilename('cases', ExportFormat.CSV);
    expect(csvFilename).toMatch(/\.csv$/i);

    const excelFilename = generateExportFilename('cases', ExportFormat.EXCEL);
    expect(excelFilename).toMatch(/\.csv$/i);

    const jsonFilename = generateExportFilename('cases', ExportFormat.JSON);
    expect(jsonFilename).toMatch(/\.json$/i);

    const pdfFilename = generateExportFilename('cases', ExportFormat.PDF);
    expect(pdfFilename).toMatch(/\.pdf$/i);
  });

  it('应该使用下划线分隔各部分', () => {
    const filename = generateExportFilename('cases', ExportFormat.CSV);
    const parts = filename.replace(/\.[^.]+$/, '').split('_');
    expect(parts).toHaveLength(3);
    expect(parts[0]).toBe('cases');
    expect(parts[1]).toContain('2024');
    expect(parts[2]).toMatch(/^\d{6}$/);
  });

  it('应该使用下划线分隔日期时间', () => {
    const filename = generateExportFilename('cases', ExportFormat.CSV);
    const datetimePart = filename.split('_').slice(1).join('_').split('.')[0];
    expect(datetimePart).toMatch(/^\d{4}-\d{2}-\d{2}_\d{6}$/);
  });

  it('应该正确处理长数据类型名', () => {
    const filename = generateExportFilename(
      'PERFORMANCE_ERROR_RATE',
      ExportFormat.CSV
    );
    expect(filename).toContain('PERFORMANCE_ERROR_RATE');
  });

  it('应该生成唯一的文件名', () => {
    const filename1 = generateExportFilename('cases', ExportFormat.CSV);
    jest.advanceTimersByTime(1000);
    const filename2 = generateExportFilename('cases', ExportFormat.CSV);

    expect(filename1).not.toBe(filename2);
  });

  it('应该生成可读的文件名', () => {
    const filename = generateExportFilename('cases', ExportFormat.CSV);
    expect(filename).toMatch(/^[a-zA-Z0-9_-]+\.csv$/i);
  });
});
