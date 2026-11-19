import { describe, expect, it } from 'vitest';
import { isValidHashtag, normalizeHashtag } from '../src/posts/hashtags.js';

describe('hashtags', () => {
  it('trims, drops the leading # and lowercases', () => {
    expect(normalizeHashtag('  #NodeJS ')).toBe('nodejs');
    expect(normalizeHashtag('##Express')).toBe('express');
  });

  it('accepts letters, digits and underscores in any alphabet', () => {
    expect(isValidHashtag('node_24')).toBe(true);
    expect(isValidHashtag('новини')).toBe(true);
  });

  it('rejects empty tags, spaces and punctuation', () => {
    expect(isValidHashtag('')).toBe(false);
    expect(isValidHashtag('two words')).toBe(false);
    expect(isValidHashtag('c++')).toBe(false);
    expect(isValidHashtag('a'.repeat(51))).toBe(false);
  });
});
