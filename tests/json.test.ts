import { describe, expect, test } from 'bun:test';
import { highlight } from '../src/json';

describe('json highlighting', () => {
  test('keys, strings, numbers and literals get their own class', () => {
    const html = highlight('{\n  "a": "b",\n  "n": -1.5e3,\n  "t": true\n}');
    expect(html).toContain('<span class="j-k">&quot;a&quot;:</span>');
    expect(html).toContain('<span class="j-s">&quot;b&quot;</span>');
    expect(html).toContain('<span class="j-n">-1.5e3</span>');
    expect(html).toContain('<span class="j-b">true</span>');
  });

  test('markup in the document is escaped, inside tokens and out', () => {
    expect(highlight('{"x": "<img src=x onerror=1>"}')).not.toContain('<img');
    expect(highlight('<not json>')).toBe('&lt;not json&gt;');
  });

  test('a number inside a string stays part of the string', () => {
    expect(highlight('"12"')).toBe('<span class="j-s">&quot;12&quot;</span>');
  });
});
