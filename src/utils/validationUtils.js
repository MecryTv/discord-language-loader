/**
 * @param {string} key
 * @returns {boolean}
 */
function isValidLanguageKey(key) {
  return /^[a-z]{2}_[A-Z]{2}$/.test(key);
}

module.exports = { isValidLanguageKey };
