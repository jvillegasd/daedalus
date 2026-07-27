import { describe, expect, test } from 'bun:test';
import { escape } from '../src/html';
import { parseTags } from '../src/tags';

describe('tags', () => {
  test('splits, trims, and drops the empties a trailing comma leaves', () => {
    expect(parseTags('a, b ,, c,')).toEqual(['a', 'b', 'c']);
    expect(parseTags('   ')).toEqual([]);
    expect(parseTags('')).toEqual([]);
  });

  test('a single value with no comma is one tag', () => {
    expect(parseTags('reading')).toEqual(['reading']);
  });

  test('returns only what is new, so a caller can append', () => {
    expect(parseTags('a, b', ['a'])).toEqual(['b']);
    expect(parseTags('a', ['a'])).toEqual([]);
  });

  test('a value repeated within one field is added once', () => {
    expect(parseTags('a, a, b')).toEqual(['a', 'b']);
  });
});

describe('escape', () => {
  test('neutralises the characters that would end an attribute or open a tag', () => {
    expect(escape('<img src=x onerror="alert(1)">')).toBe('&lt;img src=x onerror=&quot;alert(1)&quot;&gt;');
    expect(escape('a & b')).toBe('a &amp; b');
    expect(escape('plain title')).toBe('plain title');
  });
});
