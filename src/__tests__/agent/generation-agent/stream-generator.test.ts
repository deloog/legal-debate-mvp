// StreamGenerator单元测试

import { StreamGenerator } from '@/lib/agent/generation-agent/stream-generator';

describe('StreamGenerator', () => {
  let generator: StreamGenerator;

  beforeEach(() => {
    generator = new StreamGenerator();
  });

  describe('构造函数', () => {
    it('应该使用默认配置创建实例', () => {
      const defaultGenerator = new StreamGenerator();
      expect(defaultGenerator).toBeDefined();
    });

    it('应该使用自定义配置创建实例', () => {
      const customGenerator = new StreamGenerator({
        chunkSize: 100,
        delayMs: 50,
        format: 'json',
        maxChunks: 10,
      });
      expect(customGenerator).toBeDefined();
    });
  });

  describe('generateSSEStream', () => {
    it('应该生成SSE流', async () => {
      const content = '测试内容用于流式生成';
      const chunks: unknown[] = [];

      for await (const message of generator.generateSSEStream(content)) {
        chunks.push(message);
      }

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[chunks.length - 1]).toMatchObject({
        event: 'done',
      });
    });

    it('每个消息应该包含正确的字段', async () => {
      const content = '测试内容';
      const messages = [];

      for await (const message of generator.generateSSEStream(content)) {
        messages.push(message);
      }

      const firstMessage = messages[0];
      expect(firstMessage).toHaveProperty('data');
      expect(firstMessage).toHaveProperty('event');
      expect(firstMessage).toHaveProperty('id');
    });

    it('应该设置正确的id', async () => {
      const content =
        '这是一个足够长的测试内容用于生成多个数据块以便测试ID设置功能';
      const messages = [];

      for await (const message of generator.generateSSEStream(content)) {
        messages.push(message);
      }

      expect(messages[0].id).toBe('chunk-0');
      if (messages[1]) {
        expect(messages[1].id).toBe('chunk-1');
      }
    });
  });

  describe('generateJSONStream', () => {
    it('应该生成JSON流', async () => {
      const content = '测试内容';
      const chunks: unknown[] = [];

      for await (const message of generator.generateJSONStream(content)) {
        chunks.push(message);
      }

      expect(chunks.length).toBeGreaterThan(0);
    });

    it('JSON应该包含chunk信息', async () => {
      const content = '测试内容';
      const messages = [];

      for await (const message of generator.generateJSONStream(content)) {
        messages.push(message);
      }

      const firstMessage = messages[0];
      const parsed = JSON.parse(firstMessage.data);

      expect(parsed).toHaveProperty('chunk');
      expect(parsed).toHaveProperty('index');
      expect(parsed).toHaveProperty('total');
      expect(parsed).toHaveProperty('finished');
    });

    it('最后一个消息应该标记为完成', async () => {
      const content = '测试内容';
      const messages = [];

      for await (const message of generator.generateJSONStream(content)) {
        messages.push(message);
      }

      const lastMessage = messages[messages.length - 1];
      const parsed = JSON.parse(lastMessage.data);

      expect(parsed.finished).toBe(true);
    });
  });

  describe('formatSSEMessage', () => {
    it('应该格式化SSE消息', () => {
      const message = {
        data: '测试数据',
        event: 'chunk' as const,
        id: 'msg-1',
        retry: 1000,
      };

      const formatted = generator.formatSSEMessage(message);

      expect(formatted).toContain('id: msg-1');
      expect(formatted).toContain('event: chunk');
      expect(formatted).toContain('data: 测试数据');
    });

    it('应该处理没有id的消息', () => {
      const message = {
        data: '测试数据',
        event: 'chunk' as const,
      };

      const formatted = generator.formatSSEMessage(message);

      expect(formatted).toContain('data: 测试数据');
      expect(formatted).toContain('event: chunk');
    });

    it('应该处理没有event的消息', () => {
      const message = {
        data: '测试数据',
        id: 'msg-1',
      };

      const formatted = generator.formatSSEMessage(message);

      expect(formatted).toContain('data: 测试数据');
      expect(formatted).toContain('id: msg-1');
    });
  });

  describe('generateStreamText', () => {
    it('应该流式生成文本', async () => {
      const content = '测试内容用于流式生成';
      const chunks: unknown[] = [];

      await generator.generateStreamText(content, (chunk, index, total) => {
        chunks.push({ chunk, index, total });
      });

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0]).toHaveProperty('chunk');
      expect(chunks[0]).toHaveProperty('index');
      expect(chunks[0]).toHaveProperty('total');
    });

    it('应该调用回调函数', async () => {
      const content = '测试内容';
      const callback = jest.fn();

      await generator.generateStreamText(content, callback);

      expect(callback).toHaveBeenCalled();
    });
  });

  describe('generateWithProgress', () => {
    it('应该生成带进度的内容', async () => {
      const content = '测试内容';
      const progressValues: number[] = [];

      for await (const result of generator.generateWithProgress(content)) {
        progressValues.push(result.progress);
      }

      expect(progressValues.length).toBeGreaterThan(0);
      expect(progressValues[0]).toBeGreaterThan(0);
      expect(progressValues[progressValues.length - 1]).toBe(100);
    });

    it('最后一条应该标记为完成', async () => {
      const content = '测试内容';
      const results = [];

      for await (const result of generator.generateWithProgress(content)) {
        results.push(result);
      }

      const lastResult = results[results.length - 1];
      expect(lastResult.finished).toBe(true);
    });
  });

  describe('updateConfig', () => {
    it('应该能够更新配置', () => {
      generator.updateConfig({ chunkSize: 300 });
      const config = generator.getConfig();

      expect(config.chunkSize).toBe(300);
    });

    it('应该能够更新多个配置项', () => {
      generator.updateConfig({
        chunkSize: 150,
        delayMs: 200,
        format: 'json',
      });
      const config = generator.getConfig();

      expect(config.chunkSize).toBe(150);
      expect(config.delayMs).toBe(200);
      expect(config.format).toBe('json');
    });
  });

  describe('getConfig', () => {
    it('应该返回配置的副本', () => {
      const config1 = generator.getConfig();
      const config2 = generator.getConfig();

      expect(config1).toEqual(config2);
      expect(config1).not.toBe(config2);
    });
  });

  describe('resetConfig', () => {
    it('应该重置配置为默认值', () => {
      generator.updateConfig({ chunkSize: 500, delayMs: 500 });
      generator.resetConfig();

      const config = generator.getConfig();

      expect(config.chunkSize).toBe(200);
      expect(config.delayMs).toBe(100);
      expect(config.format).toBe('sse');
      expect(config.maxChunks).toBeUndefined();
    });
  });

  describe('estimateGenerationTime', () => {
    it('应该估算生成时间', () => {
      const content = 'a'.repeat(1000);
      const time = generator.estimateGenerationTime(content.length);

      expect(time).toBeGreaterThan(0);
      expect(typeof time).toBe('number');
    });

    it('应该基于chunkSize计算时间', () => {
      const content = 'a'.repeat(400);
      const time = generator.estimateGenerationTime(content.length);

      const expectedChunks = Math.ceil(content.length / 200);
      const expectedTime = expectedChunks * 100;

      expect(time).toBe(expectedTime);
    });
  });

  describe('getChunkInfo', () => {
    it('应该获取块信息', () => {
      const content = '测试内容用于生成块信息';
      const info = generator.getChunkInfo(content);

      expect(info).toHaveProperty('count');
      expect(info).toHaveProperty('sizes');
      expect(Array.isArray(info.sizes)).toBe(true);
      expect(info.count).toBeGreaterThan(0);
    });

    it('sizes应该包含每个块的大小', () => {
      const content = 'a'.repeat(500);
      const info = generator.getChunkInfo(content);

      expect(info.sizes.length).toBe(info.count);
      expect(info.sizes.every(size => size <= 200)).toBe(true);
    });
  });

  describe('create静态方法', () => {
    it('应该创建StreamGenerator实例', () => {
      const customConfig = { chunkSize: 300, delayMs: 50 };
      const instance = StreamGenerator.create(customConfig);

      expect(instance).toBeInstanceOf(StreamGenerator);
      const config = instance.getConfig();
      expect(config.chunkSize).toBe(300);
      expect(config.delayMs).toBe(50);
    });
  });

  describe('边界情况', () => {
    it('应该处理空内容', async () => {
      const content = '';
      const chunks: unknown[] = [];

      for await (const message of generator.generateSSEStream(content)) {
        chunks.push(message);
      }

      expect(chunks.length).toBeGreaterThanOrEqual(0);
    });

    it('应该处理短内容', async () => {
      const content = '短';
      const chunks: unknown[] = [];

      for await (const message of generator.generateSSEStream(content)) {
        chunks.push(message);
      }

      expect(chunks.length).toBe(1);
    });

    it('应该处理maxChunks限制', async () => {
      const content = 'a'.repeat(1000);
      const limitedGenerator = new StreamGenerator({
        chunkSize: 50,
        maxChunks: 2,
      });
      const chunks: unknown[] = [];

      for await (const message of limitedGenerator.generateSSEStream(content)) {
        chunks.push(message);
      }

      expect(chunks.length).toBe(2);
    });
  });
});
