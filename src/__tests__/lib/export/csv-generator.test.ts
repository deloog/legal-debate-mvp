/**
 * CSV生成器单元测试
 */

import {
  CsvGenerator,
  flattenObject,
  formatDate,
  formatNumber,
} from '@/lib/export/csv-generator';

// =============================================================================
// CsvGenerator类测试
// =============================================================================

describe('CsvGenerator', () => {
  const sampleData = [
    { id: '1', name: '张三', age: 30, score: 95.5 },
    { id: '2', name: '李四', age: 25, score: 88.0 },
    { id: '3', name: '王五', age: 35, score: 92.3 },
  ];

  const headers = ['id', 'name', 'age', 'score'];

  describe('构造函数', () => {
    it('应该正确初始化CSV生成器', () => {
      const generator = new CsvGenerator(headers, sampleData);
      expect(generator).toBeInstanceOf(CsvGenerator);
    });

    it('应该使用默认逗号作为分隔符', () => {
      const generator = new CsvGenerator(headers, sampleData);
      const content = generator.generate();
      expect(content).toContain(',');
    });

    it('应该支持自定义分隔符', () => {
      const generator = new CsvGenerator(headers, sampleData, ';');
      const content = generator.generate();
      expect(content).toContain(';');
    });
  });

  describe('escapeField方法', () => {
    it('应该正确转义包含逗号的字段', () => {
      const data = [{ value: 'hello,world' }];
      const generator = new CsvGenerator(['value'], data);
      const content = generator.generate();
      expect(content).toContain('"hello,world"');
    });

    it('应该正确转义包含双引号的字段', () => {
      const data = [{ value: 'say "hello"' }];
      const generator = new CsvGenerator(['value'], data);
      const content = generator.generate();
      expect(content).toContain('"say ""hello"""');
    });

    it('应该正确转义包含换行符的字段', () => {
      const data = [{ value: 'line1\nline2' }];
      const generator = new CsvGenerator(['value'], data);
      const content = generator.generate();
      expect(content).toContain('"line1\nline2"');
    });

    it('应该正确处理null和undefined值', () => {
      const data = [{ value: null }, { value: undefined }];
      const generator = new CsvGenerator(['value'], data);
      const content = generator.generate();
      const _lines = content.split('\n');
      // 不应该有错误，但空值会导致数据行变为空字符串
      expect(content).toBeTruthy();
      // 应该包含表头
      expect(content).toContain('value');
    });

    it('应该正确处理数字值', () => {
      const data = [{ value: 123 }];
      const generator = new CsvGenerator(['value'], data);
      const content = generator.generate();
      expect(content).toContain('123');
    });
  });

  describe('generate方法', () => {
    it('应该生成包含BOM的CSV内容', () => {
      const generator = new CsvGenerator(headers, sampleData);
      const content = generator.generate();
      expect(content.startsWith('\uFEFF')).toBe(true);
    });

    it('应该包含所有表头', () => {
      const generator = new CsvGenerator(headers, sampleData);
      const content = generator.generate();
      headers.forEach(header => {
        expect(content).toContain(header);
      });
    });

    it('应该包含所有数据行', () => {
      const generator = new CsvGenerator(headers, sampleData);
      const content = generator.generate();
      sampleData.forEach(row => {
        expect(content).toContain(row.id);
        expect(content).toContain(row.name);
      });
    });

    it('应该使用换行符分隔行', () => {
      const generator = new CsvGenerator(headers, sampleData);
      const content = generator.generate();
      const lines = content.split('\n');
      expect(lines.length).toBeGreaterThan(sampleData.length);
    });
  });

  describe('toBlob方法', () => {
    it('应该返回Blob对象', () => {
      const generator = new CsvGenerator(headers, sampleData);
      const blob = generator.toBlob();
      expect(blob).toBeInstanceOf(Blob);
    });

    it('应该设置正确的MIME类型', () => {
      const generator = new CsvGenerator(headers, sampleData);
      const blob = generator.toBlob();
      expect(blob.type).toContain('text/csv');
    });

    it('应该设置正确的字符编码', () => {
      const generator = new CsvGenerator(headers, sampleData);
      const blob = generator.toBlob();
      expect(blob.type).toContain('utf-8');
    });
  });

  describe('toDownloadUrl方法', () => {
    it('应该返回下载URL', () => {
      const generator = new CsvGenerator(headers, sampleData);
      const url = generator.toDownloadUrl();
      expect(typeof url).toBe('string');
      expect(url).toBeTruthy();
      expect(url).toMatch(/^blob:/);
    });
  });

  describe('静态方法fromArray', () => {
    it('应该从对象数组创建CSV生成器', () => {
      const generator = CsvGenerator.fromArray(sampleData);
      expect(generator).toBeInstanceOf(CsvGenerator);
    });

    it('应该从第一个对象提取表头', () => {
      const generator = CsvGenerator.fromArray(sampleData);
      const content = generator.generate();
      headers.forEach(header => {
        expect(content).toContain(header);
      });
    });

    it('应该使用自定义表头', () => {
      const customHeaders = ['ID', 'Name', 'Age', 'Score'];
      const generator = CsvGenerator.fromArray(sampleData, customHeaders);
      const content = generator.generate();
      customHeaders.forEach(header => {
        expect(content).toContain(header);
      });
    });
  });
});

// =============================================================================
// 辅助函数测试
// =============================================================================

describe('flattenObject', () => {
  it('应该正确展平嵌套对象', () => {
    const obj = {
      user: {
        name: '张三',
        age: 30,
        address: {
          city: '北京',
          country: '中国',
        },
      },
    };
    const result = flattenObject(obj);
    expect(result['user.name']).toBe('张三');
    expect(result['user.age']).toBe(30);
    expect(result['user.address.city']).toBe('北京');
    expect(result['user.address.country']).toBe('中国');
  });

  it('应该正确处理数组', () => {
    const obj = {
      items: ['a', 'b', 'c'],
    };
    const result = flattenObject(obj);
    expect(result['items']).toEqual(['a', 'b', 'c']);
  });

  it('应该正确处理null和undefined值', () => {
    const obj = {
      a: null,
      b: undefined,
      c: 'value',
    };
    const result = flattenObject(obj);
    expect(result['a']).toBe(null);
    expect(result['b']).toBe(undefined);
    expect(result['c']).toBe('value');
  });

  it('应该支持前缀', () => {
    const obj = {
      name: '张三',
      age: 30,
    };
    const result = flattenObject(obj, 'user');
    expect(result['user.name']).toBe('张三');
    expect(result['user.age']).toBe(30);
  });
});

describe('formatDate', () => {
  it('应该正确格式化Date对象', () => {
    const date = new Date('2024-01-15T10:30:00Z');
    const result = formatDate(date);
    expect(result).toBe('2024-01-15');
  });

  it('应该正确格式化ISO字符串', () => {
    const result = formatDate('2024-01-15T10:30:00Z');
    expect(result).toBe('2024-01-15');
  });

  it('应该处理无效日期', () => {
    const result = formatDate('invalid-date');
    expect(result).toBe('Invalid Date');
  });
});

describe('formatNumber', () => {
  it('应该正确格式化数字为字符串', () => {
    const result = formatNumber(123.456);
    expect(result).toBe('123.46');
  });

  it('应该使用默认小数位数2', () => {
    const result = formatNumber(123);
    expect(result).toBe('123.00');
  });

  it('应该支持自定义小数位数', () => {
    const result = formatNumber(123.456, 4);
    expect(result).toBe('123.4560');
  });

  it('应该正确处理整数', () => {
    const result = formatNumber(123, 0);
    expect(result).toBe('123');
  });

  it('应该正确处理小数', () => {
    const result = formatNumber(123.789, 1);
    expect(result).toBe('123.8');
  });
});
