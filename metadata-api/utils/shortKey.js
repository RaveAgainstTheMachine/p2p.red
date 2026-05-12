const SHORT_KEY_REGEX = /^[a-zA-Z0-9]{16}$/;

const isValidShortKey = (key) => typeof key === 'string' && SHORT_KEY_REGEX.test(key);

module.exports = {
  SHORT_KEY_REGEX,
  isValidShortKey,
};
