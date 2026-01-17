/**
 * load-env 模块单元测试
 */

import {
  getStringEnv,
  getNumberEnv,
  getBooleanEnv,
  getJsonEnv,
  getArrayEnv,
  getUrlEnv,
  getDurationEnv,
  checkRequiredEnvVars,
} from '../../../config/load-env';

describe('load-env', () => {
  describe('getStringEnv', () => {
    it('should return value when env var exists', () => {
      process.env.TEST_STRING = 'hello';
      expect(getStringEnv('TEST_STRING')).toBe('hello');
    });

    it('should return default value when env var does not exist', () => {
      expect(getStringEnv('NON_EXISTENT_VAR')).toBe('');
      expect(getStringEnv('NON_EXISTENT_VAR', 'default')).toBe('default');
    });

    it('should return value when env var is empty string', () => {
      process.env.TEST_EMPTY = '';
      expect(getStringEnv('TEST_EMPTY', 'default')).toBe('');
    });
  });

  describe('getNumberEnv', () => {
    it('should return number when env var exists and is valid', () => {
      process.env.TEST_NUMBER = '42';
      expect(getNumberEnv('TEST_NUMBER')).toBe(42);
    });

    it('should return default value when env var does not exist', () => {
      expect(getNumberEnv('NON_EXISTENT_VAR')).toBe(0);
      expect(getNumberEnv('NON_EXISTENT_VAR', 10)).toBe(10);
    });

    it('should return default value when env var is invalid number', () => {
      process.env.TEST_INVALID_NUMBER = 'not-a-number';
      expect(getNumberEnv('TEST_INVALID_NUMBER')).toBe(0);
      expect(getNumberEnv('TEST_INVALID_NUMBER', 10)).toBe(10);
    });

    it('should handle negative numbers', () => {
      process.env.TEST_NEGATIVE = '-10';
      expect(getNumberEnv('TEST_NEGATIVE')).toBe(-10);
    });

    it('should handle zero', () => {
      process.env.TEST_ZERO = '0';
      expect(getNumberEnv('TEST_ZERO')).toBe(0);
    });

    it('should handle decimal numbers (truncated)', () => {
      process.env.TEST_DECIMAL = '3.14';
      expect(getNumberEnv('TEST_DECIMAL')).toBe(3);
    });
  });

  describe('getBooleanEnv', () => {
    it('should return true when env var is "true"', () => {
      process.env.TEST_BOOL_TRUE = 'true';
      expect(getBooleanEnv('TEST_BOOL_TRUE')).toBe(true);
    });

    it('should return true when env var is "1"', () => {
      process.env.TEST_BOOL_ONE = '1';
      expect(getBooleanEnv('TEST_BOOL_ONE')).toBe(true);
    });

    it('should return false when env var is "false"', () => {
      process.env.TEST_BOOL_FALSE = 'false';
      expect(getBooleanEnv('TEST_BOOL_FALSE')).toBe(false);
    });

    it('should return false when env var is "0"', () => {
      process.env.TEST_BOOL_ZERO = '0';
      expect(getBooleanEnv('TEST_BOOL_ZERO')).toBe(false);
    });

    it('should return default value when env var does not exist', () => {
      expect(getBooleanEnv('NON_EXISTENT_VAR')).toBe(false);
      expect(getBooleanEnv('NON_EXISTENT_VAR', true)).toBe(true);
    });

    it('should return false for any other value', () => {
      process.env.TEST_BOOL_OTHER = 'yes';
      expect(getBooleanEnv('TEST_BOOL_OTHER')).toBe(false);
    });
  });

  describe('getJsonEnv', () => {
    it('should return parsed object when env var exists and is valid JSON', () => {
      process.env.TEST_JSON = '{"key":"value","number":42}';
      const result = getJsonEnv('TEST_JSON', { key: 'default' });
      expect(result).toEqual({ key: 'value', number: 42 });
    });

    it('should return parsed array when env var is valid JSON array', () => {
      process.env.TEST_JSON_ARRAY = '[1,2,3]';
      const result = getJsonEnv('TEST_JSON_ARRAY', []);
      expect(result).toEqual([1, 2, 3]);
    });

    it('should return default value when env var does not exist', () => {
      const defaultValue = { key: 'default' };
      expect(getJsonEnv('NON_EXISTENT_VAR', defaultValue)).toEqual(
        defaultValue
      );
    });

    it('should return default value when env var is invalid JSON', () => {
      process.env.TEST_INVALID_JSON = '{invalid json}';
      const defaultValue = { key: 'default' };
      expect(getJsonEnv('TEST_INVALID_JSON', defaultValue)).toEqual(
        defaultValue
      );
    });
  });

  describe('getArrayEnv', () => {
    it('should return array when env var exists', () => {
      process.env.TEST_ARRAY = 'a,b,c';
      expect(getArrayEnv('TEST_ARRAY')).toEqual(['a', 'b', 'c']);
    });

    it('should trim array elements', () => {
      process.env.TEST_ARRAY_TRIM = ' a , b , c ';
      expect(getArrayEnv('TEST_ARRAY_TRIM')).toEqual(['a', 'b', 'c']);
    });

    it('should handle single element', () => {
      process.env.TEST_ARRAY_SINGLE = 'single';
      expect(getArrayEnv('TEST_ARRAY_SINGLE')).toEqual(['single']);
    });

    it('should return default value when env var does not exist', () => {
      expect(getArrayEnv('NON_EXISTENT_VAR')).toEqual([]);
      expect(getArrayEnv('NON_EXISTENT_VAR', ['default'])).toEqual(['default']);
    });

    it('should handle empty string', () => {
      process.env.TEST_ARRAY_EMPTY = '';
      expect(getArrayEnv('TEST_ARRAY_EMPTY')).toEqual(['']);
    });
  });

  describe('getUrlEnv', () => {
    it('should return URL when env var is valid', () => {
      process.env.TEST_URL = 'https://example.com';
      expect(getUrlEnv('TEST_URL')).toBe('https://example.com');
    });

    it('should return URL with port when env var is valid', () => {
      process.env.TEST_URL_PORT = 'https://example.com:8080';
      expect(getUrlEnv('TEST_URL_PORT')).toBe('https://example.com:8080');
    });

    it('should return URL with path when env var is valid', () => {
      process.env.TEST_URL_PATH = 'https://example.com/api/v1';
      expect(getUrlEnv('TEST_URL_PATH')).toBe('https://example.com/api/v1');
    });

    it('should return default value when env var does not exist', () => {
      expect(getUrlEnv('NON_EXISTENT_VAR')).toBe('');
      expect(getUrlEnv('NON_EXISTENT_VAR', 'https://default.com')).toBe(
        'https://default.com'
      );
    });

    it('should return value even when URL is invalid (with warning)', () => {
      process.env.TEST_URL_INVALID = 'not-a-url';
      expect(getUrlEnv('TEST_URL_INVALID')).toBe('not-a-url');
    });
  });

  describe('getDurationEnv', () => {
    it('should return value when env var is valid duration', () => {
      process.env.TEST_DURATION = '7d';
      expect(getDurationEnv('TEST_DURATION')).toBe('7d');
    });

    it('should handle seconds', () => {
      process.env.TEST_DURATION_SECONDS = '30s';
      expect(getDurationEnv('TEST_DURATION_SECONDS')).toBe('30s');
    });

    it('should handle minutes', () => {
      process.env.TEST_DURATION_MINUTES = '60m';
      expect(getDurationEnv('TEST_DURATION_MINUTES')).toBe('60m');
    });

    it('should handle hours', () => {
      process.env.TEST_DURATION_HOURS = '24h';
      expect(getDurationEnv('TEST_DURATION_HOURS')).toBe('24h');
    });

    it('should return default value when env var does not exist', () => {
      expect(getDurationEnv('NON_EXISTENT_VAR')).toBe('7d');
      expect(getDurationEnv('NON_EXISTENT_VAR', '30d')).toBe('30d');
    });

    it('should return value even when duration is invalid (with warning)', () => {
      process.env.TEST_DURATION_INVALID = 'invalid';
      expect(getDurationEnv('TEST_DURATION_INVALID')).toBe('invalid');
    });
  });

  describe('checkRequiredEnvVars', () => {
    beforeEach(() => {
      // Clear all env vars
      process.env.REQUIRED_VAR_1 = undefined;
      process.env.REQUIRED_VAR_2 = undefined;
      process.env.REQUIRED_VAR_3 = undefined;
    });

    it('should not throw when all required vars exist', () => {
      process.env.REQUIRED_VAR_1 = 'value1';
      process.env.REQUIRED_VAR_2 = 'value2';
      process.env.REQUIRED_VAR_3 = 'value3';

      expect(() => {
        checkRequiredEnvVars([
          'REQUIRED_VAR_1',
          'REQUIRED_VAR_2',
          'REQUIRED_VAR_3',
        ]);
      }).not.toThrow();
    });

    it('should throw error when required vars are missing', () => {
      process.env.REQUIRED_VAR_1 = 'value1';
      process.env.REQUIRED_VAR_2 = 'value2';
      // REQUIRED_VAR_3 is missing - explicitly delete it
      delete process.env.REQUIRED_VAR_3;

      expect(() => {
        checkRequiredEnvVars([
          'REQUIRED_VAR_1',
          'REQUIRED_VAR_2',
          'REQUIRED_VAR_3',
        ]);
      }).toThrow('缺少必需的环境变量: REQUIRED_VAR_3');
    });

    it('should throw error when multiple required vars are missing', () => {
      // All vars are missing - explicitly delete them
      delete process.env.REQUIRED_VAR_1;
      delete process.env.REQUIRED_VAR_2;
      delete process.env.REQUIRED_VAR_3;

      expect(() => {
        checkRequiredEnvVars([
          'REQUIRED_VAR_1',
          'REQUIRED_VAR_2',
          'REQUIRED_VAR_3',
        ]);
      }).toThrow(/缺少必需的环境变量:/);
    });

    it('should throw error when required var is empty string', () => {
      process.env.REQUIRED_VAR_1 = 'value1';
      process.env.REQUIRED_VAR_2 = '';
      process.env.REQUIRED_VAR_3 = 'value3';

      expect(() => {
        checkRequiredEnvVars([
          'REQUIRED_VAR_1',
          'REQUIRED_VAR_2',
          'REQUIRED_VAR_3',
        ]);
      }).toThrow('缺少必需的环境变量: REQUIRED_VAR_2');
    });

    it('should return empty array when all required vars exist', () => {
      process.env.REQUIRED_VAR_1 = 'value1';
      process.env.REQUIRED_VAR_2 = 'value2';
      process.env.REQUIRED_VAR_3 = 'value3';

      const missing = checkRequiredEnvVars([
        'REQUIRED_VAR_1',
        'REQUIRED_VAR_2',
        'REQUIRED_VAR_3',
      ]);
      expect(missing).toEqual([]);
    });
  });
});
