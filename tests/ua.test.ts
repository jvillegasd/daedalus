import { describe, expect, test } from 'bun:test';
import { uaRule, uaRuleId } from '../src/ua';

describe('ua', () => {
  test('rules are tab-scoped and removable by stable id', () => {
    const r = uaRule(42, 'UA');
    expect(r.condition.tabIds).toEqual([42]);
    expect(r.id).toBe(uaRuleId(42));
    expect(uaRuleId(42)).not.toBe(uaRuleId(43));
  });
});
