/**
 * Chart Utils Tests
 */

import {
  calculatePieSliceAngles,
  calculatePieSliceCoordinates,
  calculateMaxValue,
  calculateYAxisTicks,
  calculateDataRange,
  calculateLinePointY,
  calculateLinePointX,
  formatPercentage,
  formatNumber,
  calculateTotal,
  calculatePercentage,
  generateColors,
} from '@/components/analytics/utils/chart-utils';

describe('Chart Utils', () => {
  describe('calculatePieSliceAngles', () => {
    it('应该正确计算第一个扇区的角度', () => {
      const data = [
        { label: 'A', value: 30 },
        { label: 'B', value: 70 },
      ];
      const result = calculatePieSliceAngles(0, 100, data);
      expect(result.startAngle).toBe(-90);
      expect(result.endAngle).toBe(18);
    });

    it('应该正确计算第二个扇区的角度', () => {
      const data = [
        { label: 'A', value: 30 },
        { label: 'B', value: 70 },
      ];
      const result = calculatePieSliceAngles(1, 100, data);
      expect(result.startAngle).toBe(18);
      expect(result.endAngle).toBe(270);
    });

    it('应该处理单个扇区', () => {
      const data = [{ label: 'A', value: 100 }];
      const result = calculatePieSliceAngles(0, 100, data);
      expect(result.startAngle).toBe(-90);
      expect(result.endAngle).toBe(270);
    });
  });

  describe('calculatePieSliceCoordinates', () => {
    it('应该正确计算饼图扇区坐标', () => {
      const result = calculatePieSliceCoordinates(100, 100, 50, 0, 90);
      expect(result.x1).toBeCloseTo(150);
      expect(result.y1).toBeCloseTo(100);
      expect(result.x2).toBeCloseTo(100);
      expect(result.y2).toBeCloseTo(150);
      expect(result.largeArc).toBe(0);
    });

    it('应该正确标记大角度扇区', () => {
      const result = calculatePieSliceCoordinates(100, 100, 50, 0, 200);
      expect(result.largeArc).toBe(1);
    });
  });

  describe('calculateMaxValue', () => {
    it('应该正确计算最大值', () => {
      const data = [{ value: 10 }, { value: 20 }, { value: 30 }];
      expect(calculateMaxValue(data)).toBe(30);
    });

    it('应该处理空数组', () => {
      expect(calculateMaxValue([])).toBe(0);
    });
  });

  describe('calculateYAxisTicks', () => {
    it('应该正确计算Y轴刻度', () => {
      const ticks = calculateYAxisTicks(100, 5);
      expect(ticks).toEqual([0, 20, 40, 60, 80, 100]);
    });

    it('应该正确处理非整除的数值', () => {
      const ticks = calculateYAxisTicks(97, 5);
      expect(ticks).toEqual([0, 20, 40, 60, 80, 100]);
    });
  });

  describe('calculateDataRange', () => {
    it('应该正确计算数据范围', () => {
      const data = [
        { label: 'A', value: 10 },
        { label: 'B', value: 50 },
        { label: 'C', value: 30 },
      ];
      const result = calculateDataRange(data);
      expect(result.minValue).toBe(10);
      expect(result.maxValue).toBe(50);
    });

    it('应该处理空数组', () => {
      const result = calculateDataRange([]);
      expect(result.minValue).toBe(0);
      expect(result.maxValue).toBe(100);
    });
  });

  describe('calculateLinePointY', () => {
    it('应该正确计算Y坐标', () => {
      const y = calculateLinePointY(50, 0, 100, 300, { top: 20, bottom: 40 });
      expect(y).toBeCloseTo(140);
    });

    it('应该处理最大值', () => {
      const y = calculateLinePointY(100, 0, 100, 300, { top: 20, bottom: 40 });
      expect(y).toBeCloseTo(20);
    });

    it('应该处理最小值', () => {
      const y = calculateLinePointY(0, 0, 100, 300, { top: 20, bottom: 40 });
      expect(y).toBeCloseTo(260);
    });
  });

  describe('calculateLinePointX', () => {
    it('应该正确计算X坐标', () => {
      const x = calculateLinePointX(0, 3, 400, { left: 50, right: 50 });
      expect(x).toBe(50);
    });

    it('应该正确计算最后一个点的X坐标', () => {
      const x = calculateLinePointX(2, 3, 400, { left: 50, right: 50 });
      expect(x).toBe(350);
    });
  });

  describe('formatPercentage', () => {
    it('应该正确格式化百分比', () => {
      expect(formatPercentage(50.123)).toBe('50.1%');
      expect(formatPercentage(75.567, 2)).toBe('75.57%');
    });

    it('应该处理整数', () => {
      expect(formatPercentage(100)).toBe('100.0%');
    });
  });

  describe('formatNumber', () => {
    it('应该正确格式化千分位', () => {
      expect(formatNumber(1000)).toBe('1,000');
      expect(formatNumber(1000000)).toBe('1,000,000');
      expect(formatNumber(1234567.89)).toBe('1,234,567.89');
    });
  });

  describe('calculateTotal', () => {
    it('应该正确计算总和', () => {
      const data = [{ value: 10 }, { value: 20 }, { value: 30 }];
      expect(calculateTotal(data)).toBe(60);
    });

    it('应该处理空数组', () => {
      expect(calculateTotal([])).toBe(0);
    });
  });

  describe('calculatePercentage', () => {
    it('应该正确计算百分比', () => {
      expect(calculatePercentage(50, 100)).toBe(50);
      expect(calculatePercentage(25, 100)).toBe(25);
    });

    it('应该处理除零', () => {
      expect(calculatePercentage(50, 0)).toBe(0);
    });
  });

  describe('generateColors', () => {
    it('应该生成指定数量的颜色', () => {
      const colors = generateColors(5);
      expect(colors).toHaveLength(5);
      expect(colors[0]).toBeDefined();
      expect(colors[4]).toBeDefined();
    });

    it('应该处理超过基础颜色的数量', () => {
      const colors = generateColors(10);
      expect(colors).toHaveLength(10);
      expect(colors[0]).toBe(colors[6]);
    });
  });
});
