import { describe, it, expect } from 'vitest';
import { normalizeMetadata, hasMeaningfulMetadata, validateExtractionResponse } from './pdfState';

describe('pdfState utils', () => {
  describe('normalizeMetadata', () => {
    it('trims strings and falls back to empty strings', () => {
      const result = normalizeMetadata({ title: ' Hello ', author: 123 });
      expect(result).toEqual({ title: 'Hello', author: '', subject: '' });
    });
  });

  describe('hasMeaningfulMetadata', () => {
    it('returns true if any field is truthy', () => {
      expect(hasMeaningfulMetadata({ title: 'A' })).toBe(true);
      expect(hasMeaningfulMetadata({ title: '', author: 'B' })).toBe(true);
    });

    it('returns false if all fields are empty', () => {
      expect(hasMeaningfulMetadata({ title: '  ', author: '' })).toBe(false);
      expect(hasMeaningfulMetadata({})).toBe(false);
    });
  });

  describe('validateExtractionResponse', () => {
    it('throws on invalid payload', () => {
      expect(() => validateExtractionResponse(null)).toThrow('invalid response payload');
      expect(() => validateExtractionResponse({})).toThrow('missing document_type');
    });

    it('passes valid payload', () => {
      const valid = {
        document_type: 'invoice',
        classification_confidence: 0.9,
        fields: [],
        pages: []
      };
      expect(validateExtractionResponse(valid)).toBe(valid);
    });
  });
});
