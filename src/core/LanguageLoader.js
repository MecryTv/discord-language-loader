const fs = require("fs").promises;
const path = require("path");
const chokidar = require("chokidar"); 
const { EventEmitter } = require("events");
const { Logger } = require("../utils/Logger.js");
const { printDiff } = require("../utils/diffUtil.js");
const { isValidLanguageKey } = require("../utils/validationUtils.js");
const { LanguageFileService } = require("../services/LanguageFileService.js");

class LanguageLoader extends EventEmitter {
  /**
   * @typedef {Object} LanguageLoaderOptions
   * @property {string} folderLang
   * @property {string} defaultLang
   * @property {string} fallbackLang
   * @property {boolean} [debug]
   */

  /**
   * @param {LanguageLoaderOptions} options
   */
  constructor({ folderLang, defaultLang, fallbackLang, debug = false }) {
    super();
    this.folder = folderLang;
    this.defaultLanguage = defaultLang;
    this.fallbackLanguage = fallbackLang;
    this.debug = debug;
    this.languages = new Map();
    this.fileContents = new Map();

    if (!isValidLanguageKey(this.defaultLanguage)) {
      Logger.error(
        `Default Key "${this.defaultLanguage}" is unvalible. Use Format "en_UK".`
      );
      return;
    }
    if (!isValidLanguageKey(this.fallbackLanguage)) {
      Logger.error(
        `Fallback-Key "${this.fallbackLanguage}" is invalible. Use Format "en_UK".`
      );
      return;
    }
    this.loadLanguages();
    this.watchLanguageFiles();
  }
  
  async loadLanguages() {
    try {
      const files = await fs.readdir(this.folder);
      let loadedCount = 0;
      for (const file of files) {
        const ext = path.extname(file).toLowerCase();
        if ([".yaml", ".yml", ".json", ".toml"].includes(ext)) {
          const filePath = path.join(this.folder, file);
          const langData = await LanguageFileService.loadLanguageFile(filePath);
          if (langData) {
            const langName = path.basename(file, ext);
            if (!isValidLanguageKey(langName)) {
              Logger.error(
                `Skip File "${file}" – Invalible Language Key. Use Format "en_UK".`
              );
              continue;
            }
            let fileContent;
            try {
              fileContent = await fs.readFile(filePath, "utf8");
            } catch (error) {
              Logger.error(
                `Error in ${file}: ${error.message}`
              );
              continue;
            }
            this.languages.set(langName, langData);
            this.fileContents.set(langName, fileContent);
            loadedCount++;
            if (this.debug) {
              Logger.info(`Language "${langName}" loaded.`);
            }
          }
        }
      }
      if (!this.languages.has(this.defaultLanguage)) {
        Logger.error(
          `Default Language "${this.defaultLanguage}" not found!`
        );
      } else {
        Logger.info(`Succesfully load ${loadedCount} Languages.`);
      }
    } catch (error) {
      Logger.error(`Error with folderLang: ${error.message}`);
    }
  }

  
  watchLanguageFiles() {
    const watcher = chokidar.watch(this.folder, {
      awaitWriteFinish: {
        stabilityThreshold: 500,
        pollInterval: 100,
      },
      ignoreInitial: true,
    });

    watcher.on("change", async (filePath) => {
      const filename = path.basename(filePath);
      const ext = path.extname(filename).toLowerCase();
      if (![".yaml", ".yml", ".json", ".toml"].includes(ext)) return;

      let newFileContent;
      try {
        newFileContent = await fs.readFile(filePath, "utf8");
      } catch (error) {
        Logger.error(
          `Error with read file ${filename}: ${error.message}`
        );
        return;
      }

      const langName = path.basename(filename, ext);
      if (!isValidLanguageKey(langName)) {
        Logger.error(
          `Unvalible key "${filename}". Use Format "en_UK".`
        );
        return;
      }

      const oldFileContent = this.fileContents.get(langName);
      if (oldFileContent === undefined) {
        const langData = await LanguageFileService.loadLanguageFile(filePath);
        if (langData === null) {
          Logger.error(
            `Load Error in ${filename}: File format wrong.`
          );
        } else {
          Logger.update(`Languagefile "${langName}" loaded.`);
          this.languages.set(langName, langData);
          this.fileContents.set(langName, newFileContent);
          this.emit("languageLoaded", { langName, langData });
        }
        return;
      }

      if (oldFileContent !== newFileContent) {
        const langData = await LanguageFileService.loadLanguageFile(filePath);
        if (langData === null) {
          Logger.error(
            `Load Error in ${filename}: File format wrong.`
          );
        } else {
          if (this.debug) {
            Logger.update(`Änderungen in "${langName}" festgestellt:`);
            printDiff(oldFileContent, newFileContent);
          } else {
            Logger.update(`Sprachdatei "${langName}" wurde geändert.`);
          }
          this.languages.set(langName, langData);
          this.fileContents.set(langName, newFileContent);
          this.emit("languageUpdated", { langName, langData });
        }
      }
    });
  }

  /**
   * Gibt das Sprachobjekt für den angegebenen Sprachschlüssel zurück.
   * Falls nicht vorhanden, wird fallbackLanguage genutzt.
   * @param {string} languageKey – z.B. "en_UK"
   */
  loadlang(languageKey) {
    if (!isValidLanguageKey(languageKey)) {
      Logger.error(
        `Ungültiger Sprachschlüssel "${languageKey}". Erwarte Format wie "de_DE".`
      );
      return this.languages.get(this.fallbackLanguage);
    }
    return this.languages.has(languageKey)
      ? this.languages.get(languageKey)
      : this.languages.get(this.fallbackLanguage);
  }

  /**
   * Gibt einen spezifischen Nachrichtenwert zurück (z. B. "welcome.message").
   * Falls Sprache oder Schlüssel nicht existieren, wird fallbackLanguage genutzt.
   */
  loadlangmsg(langKey, messageKey) {
    if (!isValidLanguageKey(langKey)) {
      Logger.error(
        `Ungültiger Sprachschlüssel "${langKey}". Erwarte Format wie "de_DE".`
      );
      return `Ungültiger Sprachschlüssel "${langKey}".`;
    }
    let langData = this.languages.get(langKey);
    if (!langData) {
      Logger.error(
        `Sprache "${langKey}" nicht gefunden. Verwende Fallback "${this.fallbackLanguage}".`
      );
      langData = this.languages.get(this.fallbackLanguage);
      if (!langData) {
        return `Weder "${langKey}" noch Fallback "${this.fallbackLanguage}" vorhanden.`;
      }
    }
    const keys = messageKey.split(".");
    let result = langData;
    for (const key of keys) {
      if (result && typeof result === "object" && key in result) {
        result = result[key];
      } else {
        return `Message key "${messageKey}" nicht gefunden in "${langKey}".`;
      }
    }
    return result;
  }

  /**
   * Aktualisiert eine Sprachdatei dynamisch.
   * Falls kein filePath angegeben wird, sucht sie anhand des Sprachcodes im Ordner.
   */
  async updateLanguage(langKey, filePath = null) {
    if (!isValidLanguageKey(langKey)) {
      Logger.error(`Ungültiger Sprachschlüssel "${langKey}".`);
      return;
    }
    if (!filePath) {
      const files = await fs.readdir(this.folder);
      const file = files.find(
        (f) =>
          path.basename(f, path.extname(f)) === langKey &&
          [".yaml", ".yml", ".json", ".toml"].includes(
            path.extname(f).toLowerCase()
          )
      );
      if (!file) {
        Logger.error(`Datei für Sprachschlüssel "${langKey}" nicht gefunden.`);
        return;
      }
      filePath = path.join(this.folder, file);
    }
    let newFileContent;
    try {
      newFileContent = await fs.readFile(filePath, "utf8");
    } catch (error) {
      Logger.error(
        `Fehler beim Lesen der Datei für ${langKey}: ${error.message}`
      );
      return;
    }
    const langData = await LanguageFileService.loadLanguageFile(filePath);
    this.languages.set(langKey, langData);
    this.fileContents.set(langKey, newFileContent);
    Logger.info(`Sprache "${langKey}" wurde dynamisch aktualisiert.`);
    this.emit("languageUpdated", { langKey, langData });
  }
}

module.exports = { LanguageLoader };
