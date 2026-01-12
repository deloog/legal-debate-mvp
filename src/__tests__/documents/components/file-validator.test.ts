import {
  FileValidator,
  VALIDATION_RULES,
} from '@/app/documents/components/file-validator';

describe('FileValidator', () => {
  describe('validateFile', () => {
    it('应该验证通过有效的PDF文件', () => {
      const file = new File(['content'], 'test.pdf', {
        type: 'application/pdf',
      });

      const result = FileValidator.validateFile(file);

      expect(result).toBeNull();
    });

    it('应该验证通过有效的Word文档', () => {
      const docFile = new File(['content'], 'test.doc', {
        type: 'application/msword',
      });
      const docxFile = new File(['content'], 'test.docx', {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });

      expect(FileValidator.validateFile(docFile)).toBeNull();
      expect(FileValidator.validateFile(docxFile)).toBeNull();
    });

    it('应该验证通过有效的TXT文件', () => {
      const file = new File(['content'], 'test.txt', {
        type: 'text/plain',
      });

      const result = FileValidator.validateFile(file);

      expect(result).toBeNull();
    });

    it('应该拒绝超出大小限制的文件', () => {
      const largeFile = new File(
        [new Array(11 * 1024 * 1024).fill('a').join('')],
        'large.pdf',
        {
          type: 'application/pdf',
        }
      );

      const result = FileValidator.validateFile(largeFile);

      expect(result).not.toBeNull();
      expect(result?.code).toBe('FILE_TOO_LARGE');
      expect(result?.message).toContain('超过最大限制');
    });

    it('应该拒绝不支持的文件类型', () => {
      const invalidFile = new File(['content'], 'test.exe', {
        type: 'application/x-msdownload',
      });

      const result = FileValidator.validateFile(invalidFile);

      expect(result).not.toBeNull();
      expect(result?.code).toBe('INVALID_TYPE');
      expect(result?.message).toContain('不支持的文件类型');
    });

    it('应该拒绝无效的MIME类型', () => {
      const file = new File(['content'], 'test.pdf', {
        type: 'invalid/mime',
      });

      const result = FileValidator.validateFile(file);

      expect(result).not.toBeNull();
      expect(result?.code).toBe('INVALID_MIME');
    });
  });

  describe('validateFiles', () => {
    it('应该验证通过多个有效文件', () => {
      const files = [
        new File(['content1'], 'test1.pdf', { type: 'application/pdf' }),
        new File(['content2'], 'test2.doc', { type: 'application/msword' }),
        new File(['content3'], 'test3.txt', { type: 'text/plain' }),
      ];

      const result = FileValidator.validateFiles(files);

      expect(result).toHaveLength(0);
    });

    it('应该拒绝超出数量限制的文件', () => {
      const files = Array.from(
        { length: VALIDATION_RULES.maxFiles + 1 },
        (_, i) =>
          new File([`content${i}`], `test${i}.pdf`, {
            type: 'application/pdf',
          })
      );

      const result = FileValidator.validateFiles(files);

      expect(result).toHaveLength(1);
      expect(result[0].code).toBe('TOO_MANY_FILES');
    });

    it('应该返回所有验证错误', () => {
      const files = [
        new File(['content1'], 'test1.pdf', { type: 'application/pdf' }),
        new File(
          [new Array(11 * 1024 * 1024).fill('a').join('')],
          'large.pdf',
          {
            type: 'application/pdf',
          }
        ),
        new File(['content2'], 'test.exe', {
          type: 'application/x-msdownload',
        }),
      ];

      const result = FileValidator.validateFiles(files);

      expect(result.length).toBeGreaterThan(0);
      expect(result.some(r => r.code === 'FILE_TOO_LARGE')).toBeTruthy();
      expect(result.some(r => r.code === 'INVALID_TYPE')).toBeTruthy();
    });
  });

  describe('formatFileSize', () => {
    it('应该正确格式化字节', () => {
      expect(FileValidator.formatFileSize(0)).toBe('0 B');
      expect(FileValidator.formatFileSize(500)).toBe('500 B');
    });

    it('应该正确格式化KB', () => {
      expect(FileValidator.formatFileSize(1024)).toBe('1 KB');
      expect(FileValidator.formatFileSize(1024 * 5)).toBe('5 KB');
    });

    it('应该正确格式化MB', () => {
      expect(FileValidator.formatFileSize(1024 * 1024)).toBe('1 MB');
      expect(FileValidator.formatFileSize(5 * 1024 * 1024)).toBe('5 MB');
    });

    it('应该正确格式化GB', () => {
      expect(FileValidator.formatFileSize(1024 * 1024 * 1024)).toBe('1 GB');
    });
  });

  describe('getFileTypeDescription', () => {
    it('应该正确描述PDF文件', () => {
      const file = new File(['content'], 'test.pdf', {
        type: 'application/pdf',
      });

      const description = FileValidator.getFileTypeDescription(file);

      expect(description).toBe('PDF 文档');
    });

    it('应该正确描述Word文件', () => {
      const docFile = new File(['content'], 'test.doc', {
        type: 'application/msword',
      });
      const docxFile = new File(['content'], 'test.docx', {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });

      expect(FileValidator.getFileTypeDescription(docFile)).toBe('Word 文档');
      expect(FileValidator.getFileTypeDescription(docxFile)).toBe('Word 文档');
    });

    it('应该正确描述TXT文件', () => {
      const file = new File(['content'], 'test.txt', {
        type: 'text/plain',
      });

      const description = FileValidator.getFileTypeDescription(file);

      expect(description).toBe('纯文本');
    });
  });

  describe('isImageFile', () => {
    it('应该识别图片文件', () => {
      const jpgFile = new File(['content'], 'test.jpg', { type: 'image/jpeg' });
      const pngFile = new File(['content'], 'test.png', { type: 'image/png' });

      expect(FileValidator.isImageFile(jpgFile)).toBeTruthy();
      expect(FileValidator.isImageFile(pngFile)).toBeTruthy();
    });

    it('应该识别非图片文件', () => {
      const pdfFile = new File(['content'], 'test.pdf', {
        type: 'application/pdf',
      });
      const txtFile = new File(['content'], 'test.txt', { type: 'text/plain' });

      expect(FileValidator.isImageFile(pdfFile)).toBeFalsy();
      expect(FileValidator.isImageFile(txtFile)).toBeFalsy();
    });
  });
});
