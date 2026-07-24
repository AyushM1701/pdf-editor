import { describe, it, expect } from 'vitest';
import { sanitizeFileStem, ensureFileExtension } from './download';

describe('download utils', () => {
  describe('sanitizeFileStem', () => {
    it('removes extension', () => {
      expect(sanitizeFileStem('test.pdf')).toBe('test');
    });
    
    it('replaces invalid characters with hyphens', () => {
      expect(sanitizeFileStem('my<file>name:1.pdf')).toBe('my-file-name-1');
    });

    it('returns fallback if empty', () => {
      expect(sanitizeFileStem('', 'fallback')).toBe('fallback');
      expect(sanitizeFileStem('<>:', 'fallback')).toBe('fallback');
    });
  });

  describe('ensureFileExtension', () => {
    it('adds extension if missing', () => {
      expect(ensureFileExtension('file', '.pdf')).toBe('file.pdf');
    });

    it('does not add extension if present', () => {
      expect(ensureFileExtension('file.pdf', '.pdf')).toBe('file.pdf');
    });
    
    it('handles case insensitivity', () => {
      expect(ensureFileExtension('file.PDF', '.pdf')).toBe('file.PDF');
    });
  });
});
