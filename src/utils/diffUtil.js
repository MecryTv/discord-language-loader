const { Logger } = require("./Logger.js");
const { diffLines } = require("diff");

/**
 * Vergleicht alten und neuen Dateiinhalt und gibt Zeilendifferenzen aus.
 * @param {string} oldContent
 * @param {string} newContent
 */
function printDiff(oldContent, newContent) {
  const diff = diffLines(oldContent, newContent);
  let oldLine = 1;
  let newLine = 1;

  diff.forEach((part) => {
    const lines = part.value.split("\n");
    if (lines[lines.length - 1] === "") lines.pop();

    if (part.added) {
      lines.forEach((line) => {
        Logger.info(`+ Zeile ${newLine}: ${line}`);
        newLine++;
      });
    } else if (part.removed) {
      lines.forEach((line) => {
        Logger.error(`- Zeile ${oldLine}: ${line}`);
        oldLine++;
      });
    } else {
      lines.forEach(() => {
        oldLine++;
        newLine++;
      });
    }
  });
}

module.exports = { printDiff };
