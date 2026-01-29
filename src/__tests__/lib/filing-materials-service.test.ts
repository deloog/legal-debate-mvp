/**
 * 立案材料服务测试
 */

import { describe, it, expect } from '@jest/globals';
import { filingMaterialsService } from '@/lib/case/filing-materials-service';

describe('Filing Materials Service Tests', () => {
  describe('getFilingMaterials', () => {
    it('should return materials for labor dispute case', () => {
      const result = filingMaterialsService.getFilingMaterials(
        'LABOR_DISPUTE',
        '基层'
      );

      expect(result.caseType).toBe('LABOR_DISPUTE');
      expect(result.courtLevel).toBe('基层');
      expect(result.materials.length).toBeGreaterThan(0);
      expect(result.notes.length).toBeGreaterThan(0);

      // 验证必须材料
      const requiredMaterials = result.materials.filter(m => m.required);
      expect(requiredMaterials.length).toBeGreaterThan(0);

      // 验证材料结构
      const firstMaterial = result.materials[0];
      expect(firstMaterial).toHaveProperty('id');
      expect(firstMaterial).toHaveProperty('name');
      expect(firstMaterial).toHaveProperty('description');
      expect(firstMaterial).toHaveProperty('required');
      expect(firstMaterial).toHaveProperty('copies');
      expect(firstMaterial).toHaveProperty('category');
    });

    it('should return materials for contract dispute case', () => {
      const result = filingMaterialsService.getFilingMaterials(
        'CONTRACT_DISPUTE',
        '基层'
      );

      expect(result.caseType).toBe('CONTRACT_DISPUTE');
      expect(result.materials.length).toBeGreaterThan(0);

      // 验证包含合同原件
      const contractMaterial = result.materials.find(
        m => m.name === '合同原件'
      );
      expect(contractMaterial).toBeDefined();
      expect(contractMaterial?.required).toBe(true);
    });

    it('should return materials for marriage family case', () => {
      const result = filingMaterialsService.getFilingMaterials(
        'MARRIAGE_FAMILY',
        '基层'
      );

      expect(result.caseType).toBe('MARRIAGE_FAMILY');
      expect(result.materials.length).toBeGreaterThan(0);

      // 验证包含结婚证
      const marriageCert = result.materials.find(m => m.name === '结婚证');
      expect(marriageCert).toBeDefined();
      expect(marriageCert?.required).toBe(true);
    });

    it('should return materials for tort liability case', () => {
      const result = filingMaterialsService.getFilingMaterials(
        'TORT_LIABILITY',
        '基层'
      );

      expect(result.caseType).toBe('TORT_LIABILITY');
      expect(result.materials.length).toBeGreaterThan(0);

      // 验证包含侵权事实证明
      const tortProof = result.materials.find(
        m => m.name === '侵权事实证明'
      );
      expect(tortProof).toBeDefined();
      expect(tortProof?.required).toBe(true);
    });

    it('should return default materials for unknown case type', () => {
      const result = filingMaterialsService.getFilingMaterials(
        'UNKNOWN_TYPE',
        '基层'
      );

      expect(result.caseType).toBe('UNKNOWN_TYPE');
      expect(result.materials.length).toBeGreaterThan(0);

      // 验证包含基本材料
      const complaint = result.materials.find(m => m.name === '起诉状');
      expect(complaint).toBeDefined();
    });

    it('should add appeal materials for intermediate court', () => {
      const result = filingMaterialsService.getFilingMaterials(
        'LABOR_DISPUTE',
        '中级'
      );

      expect(result.courtLevel).toBe('中级');

      // 验证包含上诉材料
      const firstTrialJudgment = result.materials.find(
        m => m.name === '一审判决书'
      );
      expect(firstTrialJudgment).toBeDefined();
      expect(firstTrialJudgment?.required).toBe(true);
    });

    it('should add appeal materials for high court', () => {
      const result = filingMaterialsService.getFilingMaterials(
        'CONTRACT_DISPUTE',
        '高级'
      );

      expect(result.courtLevel).toBe('高级');

      // 验证包含上诉材料
      const deliveryProof = result.materials.find(m => m.name === '送达证明');
      expect(deliveryProof).toBeDefined();
    });
  });

  describe('getSupportedCaseTypes', () => {
    it('should return list of supported case types', () => {
      const caseTypes = filingMaterialsService.getSupportedCaseTypes();

      expect(Array.isArray(caseTypes)).toBe(true);
      expect(caseTypes.length).toBeGreaterThan(0);

      // 验证结构
      const firstType = caseTypes[0];
      expect(firstType).toHaveProperty('code');
      expect(firstType).toHaveProperty('name');

      // 验证包含常见案件类型
      const laborDispute = caseTypes.find(t => t.code === 'LABOR_DISPUTE');
      expect(laborDispute).toBeDefined();
      expect(laborDispute?.name).toBe('劳动争议');
    });
  });

  describe('Material Categories', () => {
    it('should categorize materials correctly', () => {
      const result = filingMaterialsService.getFilingMaterials(
        'LABOR_DISPUTE',
        '基层'
      );

      const categories = new Set(result.materials.map(m => m.category));

      expect(categories.has('identity')).toBe(true);
      expect(categories.has('legal')).toBe(true);
      expect(categories.has('evidence')).toBe(true);
    });

    it('should have identity materials', () => {
      const result = filingMaterialsService.getFilingMaterials(
        'CONTRACT_DISPUTE',
        '基层'
      );

      const identityMaterials = result.materials.filter(
        m => m.category === 'identity'
      );

      expect(identityMaterials.length).toBeGreaterThan(0);
    });

    it('should have legal materials', () => {
      const result = filingMaterialsService.getFilingMaterials(
        'MARRIAGE_FAMILY',
        '基层'
      );

      const legalMaterials = result.materials.filter(
        m => m.category === 'legal'
      );

      expect(legalMaterials.length).toBeGreaterThan(0);

      // 起诉状应该是法律文书
      const complaint = legalMaterials.find(m => m.name === '起诉状');
      expect(complaint).toBeDefined();
    });

    it('should have evidence materials', () => {
      const result = filingMaterialsService.getFilingMaterials(
        'TORT_LIABILITY',
        '基层'
      );

      const evidenceMaterials = result.materials.filter(
        m => m.category === 'evidence'
      );

      expect(evidenceMaterials.length).toBeGreaterThan(0);
    });
  });

  describe('Material Properties', () => {
    it('should have template URLs for some materials', () => {
      const result = filingMaterialsService.getFilingMaterials(
        'LABOR_DISPUTE',
        '基层'
      );

      const materialsWithTemplates = result.materials.filter(
        m => m.templateUrl
      );

      expect(materialsWithTemplates.length).toBeGreaterThan(0);

      // 起诉状应该有模板
      const complaint = result.materials.find(m => m.name === '起诉状');
      expect(complaint?.templateUrl).toBeDefined();
    });

    it('should specify correct number of copies', () => {
      const result = filingMaterialsService.getFilingMaterials(
        'CONTRACT_DISPUTE',
        '基层'
      );

      result.materials.forEach(material => {
        expect(material.copies).toBeGreaterThan(0);
        expect(Number.isInteger(material.copies)).toBe(true);
      });
    });

    it('should have clear descriptions', () => {
      const result = filingMaterialsService.getFilingMaterials(
        'MARRIAGE_FAMILY',
        '基层'
      );

      result.materials.forEach(material => {
        expect(material.description).toBeTruthy();
        expect(material.description.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Notes', () => {
    it('should provide case-specific notes', () => {
      const result = filingMaterialsService.getFilingMaterials(
        'LABOR_DISPUTE',
        '基层'
      );

      expect(result.notes.length).toBeGreaterThan(0);

      // 劳动争议应该提到仲裁
      const hasArbitrationNote = result.notes.some(note =>
        note.includes('仲裁')
      );
      expect(hasArbitrationNote).toBe(true);
    });

    it('should provide default notes for unknown case types', () => {
      const result = filingMaterialsService.getFilingMaterials(
        'UNKNOWN_TYPE',
        '基层'
      );

      expect(result.notes.length).toBeGreaterThan(0);
    });
  });
});
