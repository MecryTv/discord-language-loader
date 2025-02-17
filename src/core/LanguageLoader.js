const fs = require("fs").promises; // für asynchrone Operationen
const path = require("path");
const chokidar = require("chokidar"); // Watcher-Library
const { EventEmitter } = require("events");
const { Logger } = require("../utils/Logger.js");
const { printDiff } = require("../utils/diffUtil.js");
const { isValidLanguageKey } = require("../utils/validationUtils.js");
const { LanguageFileService } = require("../services/LanguageFileService.js");
const Extension = require("../utils/Extensions.js");

class LanguageLoader extends EventEmitter {
  /**
   * @typedef {Object} LanguageLoaderOptions
   * @property {string} folderLang
   * @property {string} defaultLang
   * @property {string} fallbackLang
   * @property {string[]} extensions
   * @property {boolean} [debug]
   */

  /**
   * @param {LanguageLoaderOptions} options
   */
  constructor({ folderLang, defaultLang, fallbackLang, extensions, debug = false }) {
    super();
    this.folder = folderLang;
    this.defaultLanguage = defaultLang;
    this.fallbackLanguage = fallbackLang;
    this.extensions = extensions;
    this.debug = debug;
    this.languages = new Map();
    this.fileContents = new Map();

    if (!isValidLanguageKey(this.defaultLanguage)) {
      Logger.error(
        `Default Language Key "${this.defaultLanguage}" is unvalible. Please use Format "en_UK".Please use Format "en_UK".`
      );
      return;
    }
    if (!isValidLanguageKey(this.fallbackLanguage)) {
      Logger.error(
        `Fallback Language Key "${this.fallbackLanguage}" is unvalible. Please use Format "en_UK".`
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
        if (this.extensions.includes(ext)) {
          const filePath = path.join(this.folder, file);
          const langData = await LanguageFileService.loadLanguageFile(filePath);
          if (langData) {
            const langName = path.basename(file, ext);
            if (!isValidLanguageKey(langName)) {
              Logger.error(
                `Skip file "${file}" – invalid Language Key. Please use Format "en_UK".`
              );
              continue;
            }
            let fileContent;
            try {
              fileContent = await fs.readFile(filePath, "utf8");
            } catch (error) {
              Logger.error(
                `Error while reading ${file}: ${error.message}`
              );
              continue;
            }
            this.languages.set(langName, langData);
            this.fileContents.set(langName, fileContent);
            loadedCount++;
            if (this.debug) {
              Logger.info(`Language "${langName}" loaded successfully.`);
            }
          }
        }
      }
      if (!this.languages.has(this.defaultLanguage)) {
        Logger.error(
          `Default Language "${this.defaultLanguage}" not found in folder.`
        );
      } else {
        Logger.info(`Succesfully load ${loadedCount} languages.`);
      }
    } catch (error) {
      Logger.error(`Error while reading folder: ${error.message}`);
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
      if (!this.extensions.includes(ext)) return;

      let newFileContent;
      try {
        newFileContent = await fs.readFile(filePath, "utf8");
      } catch (error) {
        Logger.error(
          `Error while reading ${filename}: ${error.message}`
        );
        return;
      }

      const langName = path.basename(filename, ext);
      if (!isValidLanguageKey(langName)) {
        Logger.error(
          `Unvalible language Key in "${filename}". Please use Format "en_UK".`
        );
        return;
      }

      const oldFileContent = this.fileContents.get(langName);
      if (oldFileContent === undefined) {
        const langData = await LanguageFileService.loadLanguageFile(filePath);
        if (langData === null) {
          Logger.error(
            `Error while loading ${filename}: File does not match the requirements.`
          );
        } else {
          Logger.update(`Language "${langName}" has been added.`);
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
            `Error while reading ${filename}: File does not match the requirements.`
          );
        } else {
          if (this.debug) {
            Logger.update(`Update in "${langName}" detected:`);
            printDiff(oldFileContent, newFileContent);
          } else {
            Logger.update(`Language file "${langName}" has been updated.`);
          }
          this.languages.set(langName, langData);
          this.fileContents.set(langName, newFileContent);
          this.emit("languageUpdated", { langName, langData });
        }
      }
    });
  }

  /**
   * @param {string} languageKey
   */
  loadLang(languageKey) {
    if (!isValidLanguageKey(languageKey)) {
      Logger.error(
        `Unvalible Language Key "${languageKey}". Please use Format "en_UK".`
      );
      return this.languages.get(this.fallbackLanguage);
    }
    return this.languages.has(languageKey)
      ? this.languages.get(languageKey)
      : this.languages.get(this.fallbackLanguage);
  }

  loadLangMSG(langKey, messageKey) {
    if (!isValidLanguageKey(langKey)) {
      Logger.error(
        `Unvalible Language Key "${langKey}". Please use Format "en_UK".`
      );
      return `Unvalible Language Key "${langKey}".`;
    }
    let langData = this.languages.get(langKey);
    if (!langData) {
      Logger.error(
        `language "${langKey}" not found. Please use the fallback Language "${this.fallbackLanguage}".`
      );
      langData = this.languages.get(this.fallbackLanguage);
      if (!langData) {
        return `Default Language "${langKey}" and Fallback "${this.fallbackLanguage}" not found.`;
      }
    }
    const keys = messageKey.split(".");
    let result = langData;
    for (const key of keys) {
      if (result && typeof result === "object" && key in result) {
        result = result[key];
      } else {
        return `Message key "${messageKey}" not found in "${langKey}".`;
      }
    }
    return result;
  }

  async updateLanguage(langKey, filePath = null) {
    if (!isValidLanguageKey(langKey)) {
      Logger.error(`Unvalible Language key "${langKey}".`);
      return;
    }
    if (!filePath) {
      const files = await fs.readdir(this.folder);
      const file = files.find(
        (f) =>
          path.basename(f, path.extname(f)) === langKey &&
          this.extensions.includes(
            path.extname(f).toLowerCase()
          )
      );
      if (!file) {
        Logger.error(`File for Language Key "${langKey}" not found.`);
        return;
      }
      filePath = path.join(this.folder, file);
    }
    let newFileContent;
    try {
      newFileContent = await fs.readFile(filePath, "utf8");
    } catch (error) {
      Logger.error(
        `Error while reading file ${langKey}: ${error.message}`
      );
      return;
    }
    const langData = await LanguageFileService.loadLanguageFile(filePath);
    this.languages.set(langKey, langData);
    this.fileContents.set(langKey, newFileContent);
    Logger.info(`Language "${langKey}" updated dynamically.`);
    this.emit("languageUpdated", { langKey, langData });
  }
}

module.exports = { LanguageLoader, Extension };
