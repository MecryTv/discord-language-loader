const fs = require("fs/promises");
const path = require("path");
const yaml = require("js-yaml");
const toml = require("toml");
const { Logger } = require("../utils/Logger.js");

class LanguageFileService {
  /**
   * Lädt eine Sprachdatei asynchron und parst den Inhalt abhängig vom Dateiformat.
   * Unterstützte Formate: YAML, YML, JSON und TOML.
   *
   * @param {string} filePath - Der Pfad zur Sprachdatei
   * @returns {Promise<any|null>} Parsed Inhalt der Datei oder null bei Fehlern
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
