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
   * @property {string} folderLang   - Pfad zum Ordner mit den Sprachdateien
   * @property {string} defaultLang  - Primäre Sprache (z.B. "de_DE")
   * @property {string} fallbackLang
   * @property {boolean} [debug]
   */

  /**
   * Konstruktor mit den neuen Property-Namen.
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
        `Hauptsprachen-Schlüssel "${this.defaultLanguage}" ist ungültig. Erwarte Format wie "de_DE".`
      );
      return;
    }
    if (!isValidLanguageKey(this.fallbackLanguage)) {
      Logger.error(
        `Fallback-Schlüssel "${this.fallbackLanguage}" ist ungültig. Erwarte Format wie "de_DE".`
      );
      return;
    }
    this.loadLanguages();
    this.watchLanguageFiles();
  }

  /**
   * Lädt alle Sprachdateien asynchron.
   * Unterstützt Dateien mit den Endungen: .yaml, .yml, .json, .toml.
   */
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
                `Überspringe Datei "${file}" – ungültiger Sprachschlüssel. Erwarte Format wie "de_DE".`
              );
              continue;
            }
            let fileContent;
            try {
              fileContent = await fs.readFile(filePath, "utf8");
            } catch (error) {
              Logger.error(
                `Fehler beim Lesen der Datei ${file}: ${error.message}`
              );
              continue;
            }
            this.languages.set(langName, langData);
            this.fileContents.set(langName, fileContent);
            loadedCount++;
            if (this.debug) {
              Logger.info(`Sprache "${langName}" erfolgreich geladen.`);
            }
          }
        }
      }
      if (!this.languages.has(this.defaultLanguage)) {
        Logger.error(
          `Hauptsprache "${this.defaultLanguage}" wurde nicht gefunden!`
        );
      } else {
        Logger.info(`Erfolgreich ${loadedCount} Sprachen geladen.`);
      }
    } catch (error) {
      Logger.error(`Fehler beim Lesen des Sprachordners: ${error.message}`);
    }
  }

  /**
   * Beobachtet den Ordner mit chokidar auf Änderungen.
   * Der awaitWriteFinish-Mechanismus stellt sicher, dass das Event erst nach Abschluss der Änderung ausgelöst wird.
   */
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
          `Fehler beim Lesen der Datei ${filename}: ${error.message}`
        );
        return;
      }

      const langName = path.basename(filename, ext);
      if (!isValidLanguageKey(langName)) {
        Logger.error(
          `Ungültiger Sprachschlüssel in Datei "${filename}". Erwarte Format wie "de_DE".`
        );
        return;
      }

      const oldFileContent = this.fileContents.get(langName);
      // Falls noch kein alter Zustand existiert:
      if (oldFileContent === undefined) {
        const langData = await LanguageFileService.loadLanguageFile(filePath);
        if (langData === null) {
          // Hier erst den Fehler anzeigen, wenn der Schreibvorgang abgeschlossen ist
          Logger.error(
            `Fehler beim Laden der Datei ${filename}: Datei entspricht nicht den Vorschriften.`
          );
        } else {
          Logger.update(`Sprachdatei "${langName}" wurde initial geladen.`);
          this.languages.set(langName, langData);
          this.fileContents.set(langName, newFileContent);
          this.emit("languageLoaded", { langName, langData });
        }
        return;
      }

      if (oldFileContent !== newFileContent) {
        const langData = await LanguageFileService.loadLanguageFile(filePath);
        if (langData === null) {
          // Nur einmalige Fehlermeldung anzeigen, wenn der Inhalt nach Abschluss immer noch fehlerhaft ist
          Logger.error(
            `Fehler beim Laden der Datei ${filename}: Datei entspricht nicht den Vorschriften.`
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
