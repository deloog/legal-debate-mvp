import { NextRequest } from 'next/server';
import { ValidationError } from '@/app/api/lib/errors/api-error';
import {
  validatePagination,
  validateUUID,
  validateFileType,
  validateFileSize,
  validateEmail,
  validatePassword,
} from '@/app/api/lib/validation/utils';

describe('Validation Utils', () => {
  describe('validatePagination', () => {
    let mockRequest: NextRequest;

    beforeEach(() => {
      mockRequest = new NextRequest('http://localhost:3000/api/test', {
        method: 'GET',
      });
    });

    it('should validate correct pagination parameters', () => {
      const url = new URL('http://localhost:3000/api/test?page=1&limit=10');
      const request = new NextRequest(url);

      const result = validatePagination(request);

      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
    });

    it('should handle default pagination values', () => {
      const url = new URL('http://localhost:3000/api/test');
      const request = new NextRequest(url);

      const result = validatePagination(request);

      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
    });

    it('should throw error for invalid page number', () => {
      const url = new URL('http://localhost:3000/api/test?page=0');
      const request = new NextRequest(url);

      expect(() => validatePagination(request)).toThrow(ValidationError);
    });

    it('should throw error for invalid limit', () => {
      const url = new URL('http://localhost:3000/api/test?limit=0');
      const request = new NextRequest(url);

      expect(() => validatePagination(request)).toThrow(ValidationError);
    });

    it('should throw error for limit exceeding maximum', () => {
      const url = new URL('http://localhost:3000/api/test?limit=101');
      const request = new NextRequest(url);

      expect(() => validatePagination(request)).toThrow(ValidationError);
    });

    it('should handle string pagination parameters', () => {
      const url = new URL('http://localhost:3000/api/test?page=2&limit=5');
      const request = new NextRequest(url);

      const result = validatePagination(request);

      expect(result.page).toBe(2);
      expect(result.limit).toBe(5);
    });
  });

  describe('validateUUID', () => {
    it('should validate correct UUID format', () => {
      const validUUID = '550e8400-e29b-41d4-a716-446655440000';
      const result = validateUUID(validUUID);

      expect(result).toBe(validUUID);
    });

    it('should validate UUID with different characters', () => {
      const validUUID = '550e8400-e29b-41d4-a716-44665544abcd';
      const result = validateUUID(validUUID);

      expect(result).toBe(validUUID);
    });

    it('should throw error for invalid UUID format', () => {
      const invalidUUID = 'invalid-uuid-format';

      expect(() => validateUUID(invalidUUID)).toThrow(ValidationError);
    });

    it('should throw error for UUID with wrong length', () => {
      const shortUUID = '550e8400-e29b-41d4-a716';

      expect(() => validateUUID(shortUUID)).toThrow(ValidationError);
    });

    it('should use custom parameter name in error message', () => {
      const invalidUUID = 'invalid-uuid';

      expect(() => validateUUID(invalidUUID, 'CaseID')).toThrow(
        'Invalid CaseID format'
      );
    });

    it('should handle case insensitive UUID', () => {
      const upperCaseUUID = '550E8400-E29B-41D4-A716-446655440000';
      const result = validateUUID(upperCaseUUID);

      expect(result).toBe(upperCaseUUID);
    });
  });

  describe('validateFileType', () => {
    const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf'];

    it('should validate allowed file types', () => {
      expect(validateFileType('image/jpeg', allowedTypes)).toBe(true);
      expect(validateFileType('image/png', allowedTypes)).toBe(true);
      expect(validateFileType('application/pdf', allowedTypes)).toBe(true);
    });

    it('should reject disallowed file types', () => {
      expect(validateFileType('text/plain', allowedTypes)).toBe(false);
      expect(validateFileType('application/msword', allowedTypes)).toBe(false);
      expect(validateFileType('video/mp4', allowedTypes)).toBe(false);
    });

    it('should handle case insensitive file type comparison', () => {
      expect(validateFileType('IMAGE/JPEG', allowedTypes)).toBe(true);
      expect(validateFileType('Image/Png', allowedTypes)).toBe(true);
      expect(validateFileType('APPLICATION/PDF', allowedTypes)).toBe(true);
    });

    it('should handle empty allowed types array', () => {
      expect(validateFileType('image/jpeg', [])).toBe(false);
      expect(validateFileType('text/plain', [])).toBe(false);
    });

    it('should handle duplicate entries in allowed types', () => {
      const duplicatedTypes = ['image/jpeg', 'image/jpeg', 'image/png'];
      expect(validateFileType('image/jpeg', duplicatedTypes)).toBe(true);
      expect(validateFileType('image/png', duplicatedTypes)).toBe(true);
    });
  });

  describe('validateFileSize', () => {
    it('should allow valid file size', () => {
      const maxSize = 1024 * 1024; // 1MB

      expect(() => validateFileSize(512 * 1024, maxSize)).not.toThrow();
      expect(() => validateFileSize(maxSize, maxSize)).not.toThrow();
    });

    it('should throw error for file size exceeding limit', () => {
      const maxSize = 1024 * 1024; // 1MB
      const oversizedFile = 2 * 1024 * 1024; // 2MB

      expect(() => validateFileSize(oversizedFile, maxSize)).toThrow(
        ValidationError
      );
    });

    it('should include file size in error message', () => {
      const maxSize = 1024;

      expect(() => validateFileSize(2048, maxSize)).toThrow(
        'File size exceeds maximum allowed size of 1024 bytes'
      );
    });

    it('should handle zero file size', () => {
      expect(() => validateFileSize(0, 1024)).not.toThrow();
    });

    it('should handle negative file size', () => {
      expect(() => validateFileSize(-1, 1024)).toThrow(ValidationError);
    });

    it('should handle very large max size', () => {
      const hugeMaxSize = Number.MAX_SAFE_INTEGER;
      expect(() => validateFileSize(1024, hugeMaxSize)).not.toThrow();
    });
  });

  describe('validateEmail', () => {
    it('should validate correct email formats', () => {
      expect(validateEmail('user@example.com')).toBe(true);
      expect(validateEmail('test.email+tag@domain.co.uk')).toBe(true);
      expect(validateEmail('user123@test-domain.org')).toBe(true);
      expect(validateEmail('firstname.lastname@company.io')).toBe(true);
    });

    it('should reject invalid email formats', () => {
      expect(validateEmail('invalid-email')).toBe(false);
      expect(validateEmail('@domain.com')).toBe(false);
      expect(validateEmail('user@')).toBe(false);
      expect(validateEmail('user..name@domain.com')).toBe(false);
      expect(validateEmail('user@domain')).toBe(false);
    });

    it('should handle edge cases', () => {
      expect(validateEmail('a@b.c')).toBe(true);
      expect(validateEmail('user@localhost')).toBe(false);
      expect(validateEmail('user@123.456.789.0')).toBe(false);
    });

    it('should handle emails with special characters', () => {
      expect(validateEmail('user+tag@example.com')).toBe(true);
      expect(validateEmail('user_underscore@example.com')).toBe(true);
      expect(validateEmail('user-dash@example.com')).toBe(true);
    });

    it('should reject emails with spaces', () => {
      expect(validateEmail('user @example.com')).toBe(false);
      expect(validateEmail('user@ example.com')).toBe(false);
      expect(validateEmail(' user@example.com ')).toBe(false);
    });

    it('should handle empty string', () => {
      expect(validateEmail('')).toBe(false);
    });

    it('should handle very long email', () => {
      const longEmail = 'a'.repeat(50) + '@example.com';
      expect(validateEmail(longEmail)).toBe(true);
    });
  });

  describe('validatePassword', () => {
    it('should validate strong passwords', () => {
      const strongPassword = 'StrongP@ssw0rd!';
      const result = validatePassword(strongPassword);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject passwords that are too short', () => {
      const shortPassword = 'Short1!';
      const result = validatePassword(shortPassword);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Password must be at least 8 characters long'
      );
    });

    it('should reject passwords without uppercase letters', () => {
      const noUpperPassword = 'lowercase1!';
      const result = validatePassword(noUpperPassword);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Password must contain at least one uppercase letter'
      );
    });

    it('should reject passwords without lowercase letters', () => {
      const noLowerPassword = 'UPPERCASE1!';
      const result = validatePassword(noLowerPassword);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Password must contain at least one lowercase letter'
      );
    });

    it('should reject passwords without numbers', () => {
      const noNumberPassword = 'NoNumbers!';
      const result = validatePassword(noNumberPassword);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Password must contain at least one number'
      );
    });

    it('should reject passwords without special characters', () => {
      const noSpecialPassword = 'NoSpecial123';
      const result = validatePassword(noSpecialPassword);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Password must contain at least one special character'
      );
    });

    it('should handle multiple validation errors', () => {
      const weakPassword = 'weak';
      const result = validatePassword(weakPassword);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);
      expect(result.errors).toContain(
        'Password must be at least 8 characters long'
      );
      expect(result.errors).toContain(
        'Password must contain at least one uppercase letter'
      );
      expect(result.errors).toContain(
        'Password must contain at least one number'
      );
      expect(result.errors).toContain(
        'Password must contain at least one special character'
      );
    });

    it('should accept passwords with various special characters', () => {
      const specialPasswords = [
        'Password@123',
        'Password#123',
        'Password$123',
        'Password%123',
        'Password^123',
        'Password&123',
        'Password*123',
        'Password(123)',
        'Password)123',
        'Password!123',
        'Password?123',
        'Password.123',
        'Password,123',
        'Password:123',
        'Password;123',
        'Password"123',
        'Password{123}',
        'Password|123',
        'Password<>123',
      ];

      specialPasswords.forEach(password => {
        const result = validatePassword(password);
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });
    });

    it('should handle edge case special characters', () => {
      const edgeCasePassword = 'Pass[word]123';
      const result = validatePassword(edgeCasePassword);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle empty password', () => {
      const result = validatePassword('');

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should handle password with exactly 8 characters', () => {
      const exactPassword = 'Passw0rd!';
      const result = validatePassword(exactPassword);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should maintain error order consistency', () => {
      const weakPassword = '1';
      const result = validatePassword(weakPassword);

      expect(result.errors[0]).toBe(
        'Password must be at least 8 characters long'
      );
      expect(result.errors[1]).toBe(
        'Password must contain at least one uppercase letter'
      );
      expect(result.errors[2]).toBe(
        'Password must contain at least one lowercase letter'
      );
      expect(result.errors[3]).toBe(
        'Password must contain at least one special character'
      );
    });
  });

  describe('Integration Tests', () => {
    it('should handle validation pipeline for user creation', () => {
      const userData = {
        email: 'user@example.com',
        password: 'SecureP@ss123',
        file: {
          type: 'image/jpeg',
          size: 1024 * 512, // 512KB
        },
      };

      // Email validation
      expect(validateEmail(userData.email)).toBe(true);

      // Password validation
      const passwordResult = validatePassword(userData.password);
      expect(passwordResult.isValid).toBe(true);

      // File type validation
      const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf'];
      expect(validateFileType(userData.file.type, allowedTypes)).toBe(true);

      // File size validation (1MB max)
      expect(() =>
        validateFileSize(userData.file.size, 1024 * 1024)
      ).not.toThrow();
    });

    it('should handle validation failures in pipeline', () => {
      const invalidUserData = {
        email: 'invalid-email',
        password: 'weak',
        file: {
          type: 'text/plain',
          size: 5 * 1024 * 1024, // 5MB
        },
      };

      // Email validation
      expect(validateEmail(invalidUserData.email)).toBe(false);

      // Password validation
      const passwordResult = validatePassword(invalidUserData.password);
      expect(passwordResult.isValid).toBe(false);
      expect(passwordResult.errors.length).toBeGreaterThan(0);

      // File type validation
      const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf'];
      expect(validateFileType(invalidUserData.file.type, allowedTypes)).toBe(
        false
      );

      // File size validation (1MB max)
      expect(() =>
        validateFileSize(invalidUserData.file.size, 1024 * 1024)
      ).toThrow(ValidationError);
    });
  });
});
