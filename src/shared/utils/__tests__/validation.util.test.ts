/**
 * Validation Utility Tests
 */

import {
  required,
  notEmpty,
  inRange,
  oneOf,
  isValidUrl,
  isValidEmail,
  isValidPath,
  notEmptyArray,
  minLength,
  maxLength,
  matchesPattern,
  validateAll,
  parseJSON,
} from '../validation.util';
import { ValidationError } from '../../errors';

describe('Validation Utility', () => {
  describe('required', () => {
    it('should return value when not null or undefined', () => {
      expect(required('test', 'field')).toBe('test');
      expect(required(0, 'field')).toBe(0);
      expect(required(false, 'field')).toBe(false);
      expect(required('', 'field')).toBe('');
    });

    it('should throw ValidationError when null', () => {
      expect(() => required(null, 'field')).toThrow(ValidationError);
      expect(() => required(null, 'field')).toThrow('field is required');
    });

    it('should throw ValidationError when undefined', () => {
      expect(() => required(undefined, 'field')).toThrow(ValidationError);
      expect(() => required(undefined, 'field')).toThrow('field is required');
    });
  });

  describe('notEmpty', () => {
    it('should return value when not empty', () => {
      expect(notEmpty('test', 'field')).toBe('test');
      expect(notEmpty('  test  ', 'field')).toBe('  test  ');
    });

    it('should throw ValidationError when empty string', () => {
      expect(() => notEmpty('', 'field')).toThrow(ValidationError);
      expect(() => notEmpty('', 'field')).toThrow('field cannot be empty');
    });

    it('should throw ValidationError when only whitespace', () => {
      expect(() => notEmpty('   ', 'field')).toThrow(ValidationError);
    });
  });

  describe('inRange', () => {
    it('should return value when in range', () => {
      expect(inRange(5, 1, 10, 'field')).toBe(5);
      expect(inRange(1, 1, 10, 'field')).toBe(1);
      expect(inRange(10, 1, 10, 'field')).toBe(10);
    });

    it('should throw ValidationError when below minimum', () => {
      expect(() => inRange(0, 1, 10, 'field')).toThrow(ValidationError);
      expect(() => inRange(0, 1, 10, 'field')).toThrow('must be between 1 and 10');
    });

    it('should throw ValidationError when above maximum', () => {
      expect(() => inRange(11, 1, 10, 'field')).toThrow(ValidationError);
    });
  });

  describe('oneOf', () => {
    it('should return value when in allowed list', () => {
      expect(oneOf('a', ['a', 'b', 'c'], 'field')).toBe('a');
      expect(oneOf(1, [1, 2, 3], 'field')).toBe(1);
    });

    it('should throw ValidationError when not in allowed list', () => {
      expect(() => oneOf('d', ['a', 'b', 'c'], 'field')).toThrow(ValidationError);
      expect(() => oneOf('d', ['a', 'b', 'c'], 'field')).toThrow('must be one of');
    });
  });

  describe('isValidUrl', () => {
    it('should return value for valid URLs', () => {
      expect(isValidUrl('https://example.com', 'field')).toBe('https://example.com');
      expect(isValidUrl('http://localhost:3000', 'field')).toBe('http://localhost:3000');
      expect(isValidUrl('https://example.com/path?query=1', 'field')).toBe('https://example.com/path?query=1');
    });

    it('should throw ValidationError for invalid URLs', () => {
      expect(() => isValidUrl('not a url', 'field')).toThrow(ValidationError);
      expect(() => isValidUrl('not a url', 'field')).toThrow('must be a valid URL');
    });

    it('should throw ValidationError for empty string', () => {
      expect(() => isValidUrl('', 'field')).toThrow(ValidationError);
    });
  });

  describe('isValidEmail', () => {
    it('should return value for valid emails', () => {
      expect(isValidEmail('test@example.com', 'field')).toBe('test@example.com');
      expect(isValidEmail('user+tag@domain.co.uk', 'field')).toBe('user+tag@domain.co.uk');
    });

    it('should throw ValidationError for invalid emails', () => {
      expect(() => isValidEmail('not an email', 'field')).toThrow(ValidationError);
      expect(() => isValidEmail('missing@domain', 'field')).toThrow(ValidationError);
      expect(() => isValidEmail('@example.com', 'field')).toThrow(ValidationError);
      expect(() => isValidEmail('test@', 'field')).toThrow(ValidationError);
    });
  });

  describe('isValidPath', () => {
    it('should return value for valid paths', () => {
      expect(isValidPath('/path/to/file', 'field')).toBe('/path/to/file');
      expect(isValidPath('relative/path', 'field')).toBe('relative/path');
    });

    it('should throw ValidationError for paths with ..', () => {
      expect(() => isValidPath('../../../etc/passwd', 'field')).toThrow(ValidationError);
      expect(() => isValidPath('/path/../file', 'field')).toThrow(ValidationError);
    });

    it('should throw ValidationError for paths with ~', () => {
      expect(() => isValidPath('~/file', 'field')).toThrow(ValidationError);
    });
  });

  describe('notEmptyArray', () => {
    it('should return value for non-empty arrays', () => {
      expect(notEmptyArray([1, 2, 3], 'field')).toEqual([1, 2, 3]);
      expect(notEmptyArray(['a'], 'field')).toEqual(['a']);
    });

    it('should throw ValidationError for empty arrays', () => {
      expect(() => notEmptyArray([], 'field')).toThrow(ValidationError);
      expect(() => notEmptyArray([], 'field')).toThrow('cannot be empty');
    });
  });

  describe('minLength', () => {
    it('should return value when length meets minimum', () => {
      expect(minLength('test', 3, 'field')).toBe('test');
      expect(minLength('test', 4, 'field')).toBe('test');
    });

    it('should throw ValidationError when length is below minimum', () => {
      expect(() => minLength('ab', 3, 'field')).toThrow(ValidationError);
      expect(() => minLength('ab', 3, 'field')).toThrow('must be at least 3 characters');
    });
  });

  describe('maxLength', () => {
    it('should return value when length is within maximum', () => {
      expect(maxLength('test', 5, 'field')).toBe('test');
      expect(maxLength('test', 4, 'field')).toBe('test');
    });

    it('should throw ValidationError when length exceeds maximum', () => {
      expect(() => maxLength('testing', 5, 'field')).toThrow(ValidationError);
      expect(() => maxLength('testing', 5, 'field')).toThrow('must be at most 5 characters');
    });
  });

  describe('matchesPattern', () => {
    it('should return value when matches pattern', () => {
      expect(matchesPattern('test123', /^[a-z]+\d+$/, 'field')).toBe('test123');
      expect(matchesPattern('ABC', /^[A-Z]+$/, 'field')).toBe('ABC');
    });

    it('should throw ValidationError when does not match pattern', () => {
      expect(() => matchesPattern('test', /^\d+$/, 'field')).toThrow(ValidationError);
    });

    it('should use custom error message when provided', () => {
      expect(() => matchesPattern('test', /^\d+$/, 'field', 'Must be numeric')).toThrow('Must be numeric');
    });
  });

  describe('validateAll', () => {
    it('should pass when all validations succeed', () => {
      const validators = [
        () => required('test', 'field1'),
        () => notEmpty('test', 'field2'),
        () => inRange(5, 1, 10, 'field3'),
      ];

      expect(() => validateAll(validators)).not.toThrow();
    });

    it('should collect all validation errors', () => {
      const validators = [
        () => required(null, 'field1'),
        () => notEmpty('', 'field2'),
        () => inRange(0, 1, 10, 'field3'),
      ];

      try {
        validateAll(validators);
        fail('Should have thrown ValidationError');
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError);
        const validationError = error as ValidationError;
        expect(validationError.issues).toHaveLength(3);
      }
    });

    it('should rethrow non-validation errors', () => {
      const validators = [
        () => { throw new Error('Not a validation error'); },
      ];

      expect(() => validateAll(validators)).toThrow('Not a validation error');
    });
  });

  describe('parseJSON', () => {
    it('should parse valid JSON', () => {
      const result = parseJSON('{"key": "value"}', 'field');
      expect(result).toEqual({ key: 'value' });
    });

    it('should apply validator when provided', () => {
      const validator = (data: any) => {
        if (!data.required) throw new ValidationError('Missing required field', []);
        return data;
      };

      expect(() => parseJSON('{"key": "value"}', 'field', validator)).toThrow(ValidationError);
      expect(parseJSON('{"required": true}', 'field', validator)).toEqual({ required: true });
    });

    it('should throw ValidationError for invalid JSON', () => {
      expect(() => parseJSON('not json', 'field')).toThrow(ValidationError);
      expect(() => parseJSON('not json', 'field')).toThrow('is not valid JSON');
    });

    it('should throw ValidationError for empty string', () => {
      expect(() => parseJSON('', 'field')).toThrow(ValidationError);
    });
  });
});
