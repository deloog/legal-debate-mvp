/**
 * 差异识别器测试
 * 验证差异检测算法的正确性
 */

import { DiffDetector } from "../../../lib/debate/incremental/diff-detector";
import { Material } from "../../../lib/debate/incremental/types";

describe("DiffDetector", () => {
  let diffDetector: DiffDetector;

  beforeEach(() => {
    diffDetector = new DiffDetector();
  });

  describe("基于指纹的差异检测", () => {
    it("应正确识别新增资料", () => {
      const oldMaterials: Material[] = [
        {
          id: "1",
          type: "DOCUMENT",
          content: "旧文档内容",
          fingerprint: "old_hash",
          metadata: {
            source: "test",
            uploadTime: new Date(),
          },
        },
      ];

      const newMaterials: Material[] = [
        ...oldMaterials,
        {
          id: "2",
          type: "DOCUMENT",
          content: "新文档内容",
          fingerprint: "new_hash",
          metadata: {
            source: "test",
            uploadTime: new Date(),
          },
        },
      ];

      const result = diffDetector.detect(oldMaterials, newMaterials);

      expect(result.added).toHaveLength(1);
      expect(result.added[0].id).toBe("2");
      expect(result.unchanged).toHaveLength(1);
      expect(result.unchanged[0].id).toBe("1");
      expect(result.modified).toHaveLength(0);
      expect(result.deleted).toHaveLength(0);
    });

    it("应正确识别修改资料", () => {
      const oldMaterials: Material[] = [
        {
          id: "1",
          type: "DOCUMENT",
          content: "旧文档内容",
          fingerprint: "old_hash",
          metadata: {
            source: "test",
            uploadTime: new Date(),
          },
        },
      ];

      const newMaterials: Material[] = [
        {
          id: "1",
          type: "DOCUMENT",
          content: "修改后的文档内容",
          fingerprint: "new_hash",
          metadata: {
            source: "test",
            uploadTime: new Date(),
          },
        },
      ];

      const result = diffDetector.detect(oldMaterials, newMaterials);

      expect(result.modified).toHaveLength(1);
      expect(result.modified[0].id).toBe("1");
      expect(result.added).toHaveLength(0);
      expect(result.unchanged).toHaveLength(0);
      expect(result.deleted).toHaveLength(0);
    });

    it("应正确识别删除资料", () => {
      const oldMaterials: Material[] = [
        {
          id: "1",
          type: "DOCUMENT",
          content: "文档内容",
          fingerprint: "hash",
          metadata: {
            source: "test",
            uploadTime: new Date(),
          },
        },
      ];

      const newMaterials: Material[] = [];

      const result = diffDetector.detect(oldMaterials, newMaterials);

      expect(result.deleted).toHaveLength(1);
      expect(result.deleted[0].id).toBe("1");
      expect(result.added).toHaveLength(0);
      expect(result.modified).toHaveLength(0);
      expect(result.unchanged).toHaveLength(0);
    });

    it("应正确识别未变更资料", () => {
      const material: Material = {
        id: "1",
        type: "DOCUMENT",
        content: "相同内容",
        fingerprint: "same_hash",
        metadata: {
          source: "test",
          uploadTime: new Date(),
        },
      };

      const result = diffDetector.detect([material], [material]);

      expect(result.unchanged).toHaveLength(1);
      expect(result.unchanged[0].id).toBe("1");
      expect(result.added).toHaveLength(0);
      expect(result.modified).toHaveLength(0);
      expect(result.deleted).toHaveLength(0);
    });
  });

  describe("基于语义相似度的差异检测", () => {
    beforeEach(() => {
      diffDetector.updateConfig({
        algorithm: "semantic",
        similarityThreshold: 0.9,
      });
    });

    it("相似度低于阈值应识别为修改", () => {
      const oldMaterials: Material[] = [
        {
          id: "1",
          type: "DOCUMENT",
          content: "这是一段很长的文档内容，包含了大量的文字信息",
          fingerprint: "hash1",
          metadata: {
            source: "test",
            uploadTime: new Date(),
          },
        },
      ];

      const newMaterials: Material[] = [
        {
          id: "1",
          type: "DOCUMENT",
          content: "这是完全不同的文档内容，几乎没有相似之处",
          fingerprint: "hash2",
          metadata: {
            source: "test",
            uploadTime: new Date(),
          },
        },
      ];

      const result = diffDetector.detect(oldMaterials, newMaterials);

      expect(result.modified).toHaveLength(1);
    });

    it("相似度高于阈值应识别为未变更", () => {
      const content = "这是一段测试文档内容";
      const oldMaterials: Material[] = [
        {
          id: "1",
          type: "DOCUMENT",
          content,
          fingerprint: "hash1",
          metadata: {
            source: "test",
            uploadTime: new Date(),
          },
        },
      ];

      const newMaterials: Material[] = [
        {
          id: "1",
          type: "DOCUMENT",
          content: `${content}，这是新增的少量内容`,
          fingerprint: "hash2",
          metadata: {
            source: "test",
            uploadTime: new Date(),
          },
        },
      ];

      const result = diffDetector.detect(oldMaterials, newMaterials);

      expect(result.unchanged).toHaveLength(1);
    });
  });

  describe("混合算法差异检测", () => {
    beforeEach(() => {
      diffDetector.updateConfig({
        algorithm: "hybrid",
        similarityThreshold: 0.9,
      });
    });

    it("应先用指纹检测再用语义验证", () => {
      const oldMaterials: Material[] = [
        {
          id: "1",
          type: "DOCUMENT",
          content: "原始内容",
          fingerprint: "hash1",
          metadata: {
            source: "test",
            uploadTime: new Date(),
          },
        },
      ];

      const newMaterials: Material[] = [
        {
          id: "1",
          type: "DOCUMENT",
          content: "原始内容，仅少量修改",
          fingerprint: "hash2",
          metadata: {
            source: "test",
            uploadTime: new Date(),
          },
        },
      ];

      const result = diffDetector.detect(oldMaterials, newMaterials);

      // 虽然指纹不同，但内容相似度高，应视为未变更
      expect(result.unchanged).toHaveLength(1);
      expect(result.modified).toHaveLength(0);
    });
  });

  describe("配置管理", () => {
    it("应正确更新配置", () => {
      const newConfig = {
        enabled: false,
        algorithm: "semantic" as const,
        similarityThreshold: 0.8,
      };

      diffDetector.updateConfig(newConfig);
      const currentConfig = diffDetector.getConfig();

      expect(currentConfig.enabled).toBe(false);
      expect(currentConfig.algorithm).toBe("semantic");
      expect(currentConfig.similarityThreshold).toBe(0.8);
    });

    it("应正确获取当前配置", () => {
      const config = diffDetector.getConfig();

      expect(config).toHaveProperty("enabled");
      expect(config).toHaveProperty("algorithm");
      expect(config).toHaveProperty("similarityThreshold");
    });
  });

  describe("未启用差异检测", () => {
    beforeEach(() => {
      diffDetector.updateConfig({ enabled: false });
    });

    it("应假设所有新资料为新增", () => {
      const oldMaterials: Material[] = [
        {
          id: "1",
          type: "DOCUMENT",
          content: "旧内容",
          fingerprint: "hash1",
          metadata: {
            source: "test",
            uploadTime: new Date(),
          },
        },
      ];

      const newMaterials: Material[] = [
        {
          id: "1",
          type: "DOCUMENT",
          content: "新内容",
          fingerprint: "hash2",
          metadata: {
            source: "test",
            uploadTime: new Date(),
          },
        },
      ];

      const result = diffDetector.detect(oldMaterials, newMaterials);

      expect(result.added).toHaveLength(1);
      expect(result.modified).toHaveLength(0);
    });
  });
});
