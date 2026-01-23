const { isValidShortKey } = require('../utils/shortKey');

describe('short key validation', () => {
  it('accepts valid 16-character base62 keys', () => {
    expect(isValidShortKey('LqhpMNxYis2LLqhp')).toBe(true);
    expect(isValidShortKey('0123456789ABCDEF')).toBe(true);
  });

  it('rejects invalid keys', () => {
    expect(isValidShortKey('short')).toBe(false);
    expect(isValidShortKey('toooolong0123456789')).toBe(false);
    expect(isValidShortKey('invalid-characters!!')).toBe(false);
    expect(isValidShortKey(null)).toBe(false);
  });
});
