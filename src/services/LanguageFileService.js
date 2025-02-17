const fs = require("fs/promises");
const path = require("path");
const yaml = require("js-yaml");
const toml = require("toml");
const { Logger } = require("../utils/Logger.js");

class LanguageFileService {
  /**
   * File Formate: YAML, YML, JSON and TOML.
   *
   * @param {string}
   * @returns {Promise<any|null>}
   */
  static async loadLanguageFile(filePath) {
    try {
      const fileContent = await fs.readFile(filePath, "utf8");
      const ext = path.extname(filePath).toLowerCase();
      let data;

      if (ext === ".yaml" || ext === ".yml") {
        data = yaml.load(fileContent);
      } else if (ext === ".json") {
        data = JSON.parse(fileContent);
      } else if (ext === ".toml") {
        data = toml.parse(fileContent);
      } else {
        throw new Error(`Nicht unterstütztes Dateiformat: ${ext}`);
      }
      return data;
    } catch (error) {
      Logger.error(
        `Fehler beim Laden der Datei ${path.basename(filePath)}: ${error.message}`
      );
      return null;
    }
  }
}

module.exports = { LanguageFileService };
