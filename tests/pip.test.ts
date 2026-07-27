import { describe, expect, test } from 'bun:test';
import { pipFailed, pipMessage, reducePip, type PipResult } from '../src/pip';

describe('pip', () => {
  // The usual page: one frame with the video, several ads and embeds without.
  test('one frame that floated outweighs every empty one', () => {
    expect(reducePip(['no-video', 'entered', 'no-video'])).toBe('entered');
    expect(reducePip(['no-video', 'exited'])).toBe('exited');
  });

  test('a real failure outranks an empty frame, so the reason survives', () => {
    expect(reducePip(['no-video', { error: 'NotAllowedError: blocked' }, 'no-video']))
      .toEqual({ error: 'NotAllowedError: blocked' });
  });

  test('floating wins over a failure elsewhere on the page', () => {
    expect(reducePip([{ error: 'NotAllowedError: blocked' }, 'entered'])).toBe('entered');
  });

  test('only an entirely empty page is no-video', () => {
    expect(reducePip(['no-video', 'no-video'])).toBe('no-video');
    expect(reducePip([])).toBe('no-video');
  });

  // A frame the injection could not reach reports undefined rather than a result.
  test('frames that answered nothing are ignored', () => {
    expect(reducePip([undefined, 'entered'])).toBe('entered');
    expect(reducePip([undefined, undefined])).toBe('no-video');
  });

  test('pipFailed is true only when the viewer got nothing', () => {
    expect(pipFailed('entered')).toBe(false);
    expect(pipFailed('exited')).toBe(false);
    expect(pipFailed('no-video')).toBe(true);
    expect(pipFailed({ error: 'boom' })).toBe(true);
  });

  test('an error reports itself rather than a generic sentence', () => {
    const results: PipResult[] = ['entered', 'exited', 'no-video', { error: 'NotAllowedError: blocked' }];
    expect(results.map(pipMessage)).toEqual([
      'Floating the largest video on this tab.',
      'Closed the floating window.',
      'No video on this page.',
      'NotAllowedError: blocked',
    ]);
  });
});
