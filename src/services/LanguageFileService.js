const fs = require("fs");
const path = require("path");
const yaml = require("js-yaml");
const { Logger } = require("../utils/Logger.js");

class LanguageFileService {
  static loadLanguageFile(filePath) {
    try {
      const fileContent = fs.readFileSync(filePath, "utf8");
      return yaml.load(fileContent);
    } catch (error) {
      Logger.error(
        `Fehler beim Laden der Datei ${path.basename(filePath)}: ${
          error.message
        }`
      );
      return null;
    }
  }
}

module.exports = { LanguageFileService };
