/**
 * Prüft, ob ein Sprachschlüssel dem Format "xx_XX" entspricht.
 * @param {string} key - z. B. "de_DE"
 * @returns {boolean}
 */
function isValidLanguageKey(key) {
  return /^[a-z]{2}_[A-Z]{2}$/.test(key);
}

module.exports = { isValidLanguageKey };
