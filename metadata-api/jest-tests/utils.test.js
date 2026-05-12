const { SHORT_KEY_REGEX, isValidShortKey } = require('../utils/shortKey');

describe('shortKey utils', () => {
  test('regex matches valid base62 keys', () => {
    expect(SHORT_KEY_REGEX.test('LqhpMNxYis2LLqhp')).toBe(true);
  });

  test('validator rejects invalid keys', () => {
    expect(isValidShortKey('')).toBe(false);
    expect(isValidShortKey('bad-key')).toBe(false);
  });
});
