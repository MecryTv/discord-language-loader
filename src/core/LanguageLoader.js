const fs = require("fs");
const path = require("path");
const { Logger } = require("../utils/Logger.js");
const { LanguageFileService } = require("../services/LanguageFileService.js");
const { diffLines } = require("diff");

/**
 * @typedef {Object} LanguageLoaderOptions
 * @property {string} folder           - Pfad zum Ordner mit den Sprachdateien
 * @property {string} defaultLanguage  - Name der Hauptsprache (z.B. "de_DE" oder "en_UK")
 * @property {boolean} [debug]         - Optionaler Debug-Modus
 */

class LanguageLoader {
  constructor(options) {
    this.folder = options.folder;
    this.defaultLanguage = options.defaultLanguage; // statt mainLang
    this.debug = options.debug ?? false;
    this.languages = new Map();
    this.fileContents = new Map();

    if (!this.isValidLanguageKey(this.defaultLanguage)) {
      Logger.error(
        `Hauptsprachen-Schlüssel "${this.defaultLanguage}" ist ungültig. Erwarte Format wie "de_DE".`
      );
      return;
    }
    this.loadLanguages();
    this.watchLanguageFiles();
  }

  /**
   * Überprüft, ob der Sprachschlüssel dem Format "xx_XX" entspricht.
   * @param {string} key - Der zu überprüfende Schlüssel
   * @returns {boolean}
   */
  isValidLanguageKey(key) {
    return /^[a-z]{2}_[A-Z]{2}$/.test(key);
  }

  /**
   * Lädt alle YAML-Dateien aus dem angegebenen Ordner.
   * Überspringt Dateien, deren Name nicht dem erwarteten Sprachformat entspricht.
   */
  loadLanguages() {
    fs.readdir(this.folder, (err, files) => {
      if (err) {
        Logger.error(`Fehler beim Lesen des Sprachordners: ${err.message}`);
        return;
      }
      let loadedCount = 0;
      files.forEach((file) => {
        if (file.endsWith(".yml") || file.endsWith(".yaml")) {
          const filePath = path.join(this.folder, file);
          let fileContent;
          try {
            fileContent = fs.readFileSync(filePath, "utf8");
          } catch (error) {
            Logger.error(
              `Fehler beim Lesen der Datei ${file}: ${error.message}`
            );
            return;
          }

          const langData = LanguageFileService.loadLanguageFile(filePath);
          if (langData) {
            // Verwende den Dateinamen ohne Endung als Sprachidentifier
            const langName = path.basename(file, path.extname(file));
            if (!this.isValidLanguageKey(langName)) {
              Logger.error(
                `Überspringe Datei "${file}" – ungültiger Sprachschlüssel. Erwarte Format wie "de_DE".`
              );
              return;
            }
            this.languages.set(langName, langData);
            this.fileContents.set(langName, fileContent);
            loadedCount++;
            if (this.debug) {
              Logger.info(`Sprache "${langName}" erfolgreich geladen.`);
            }
          }
        }
      });
      if (!this.languages.has(this.defaultLanguage)) {
        Logger.error(
          `Hauptsprache "${this.defaultLanguage}" wurde nicht gefunden!`
        );
      } else {
        Logger.info(`Erfolgreich ${loadedCount} Sprachen geladen.`);
      }
    });
  }

  /**
   * Überwacht den Sprachordner auf Änderungen und lädt betroffene Dateien neu.
   * Bei aktivem Debug-Modus wird ein Diff der Datei (vorher vs. nachher) mit Zeilennummern ausgegeben.
   */
  watchLanguageFiles() {
    fs.watch(this.folder, (eventType, filename) => {
      if (
        filename &&
        (filename.endsWith(".yml") || filename.endsWith(".yaml"))
      ) {
        const filePath = path.join(this.folder, filename);
        let newFileContent;
        try {
          newFileContent = fs.readFileSync(filePath, "utf8");
        } catch (error) {
          Logger.error(
            `Fehler beim Lesen der Datei ${filename}: ${error.message}`
          );
          return;
        }

        const langData = LanguageFileService.loadLanguageFile(filePath);
        const langName = path.basename(filename, path.extname(filename));
        if (!this.isValidLanguageKey(langName)) {
          Logger.error(
            `Ungültiger Sprachschlüssel in Datei "${filename}". Erwarte Format wie "de_DE".`
          );
          return;
        }

        const oldFileContent = this.fileContents.get(langName);
        // Wenn bisher noch kein Inhalt gespeichert wurde, speichern wir ihn und loggen ggf. eine Initialmeldung.
        if (oldFileContent === undefined) {
          Logger.update(`Sprachdatei "${langName}" wurde initial geladen.`);
          this.languages.set(langName, langData);
          this.fileContents.set(langName, newFileContent);
          return;
        }

        // Wenn der Inhalt sich geändert hat...
        if (oldFileContent !== newFileContent) {
          if (this.debug) {
            Logger.update(`Änderungen in "${langName}" festgestellt:`);
            this.printDiff(oldFileContent, newFileContent);
          } else {
            Logger.update(`Sprachdatei "${langName}" wurde geändert.`);
          }
          // Aktualisiere den internen Zustand, sodass zukünftige Änderungen korrekt diffbar sind.
          this.languages.set(langName, langData);
          this.fileContents.set(langName, newFileContent);
        }
      }
    });
  }

  /**
   * Gibt das komplette Sprachobjekt für den angegebenen languageKey zurück.
   * Falls die Sprache nicht vorhanden ist, wird die Hauptsprache als Fallback genutzt.
   * @param {string} languageKey - Der Sprachcode (z.B. "de_DE" oder "en_UK")
   * @returns {any}
   */
  loadlang(languageKey) {
    if (!this.isValidLanguageKey(languageKey)) {
      Logger.error(
        `Ungültiger Sprachschlüssel "${languageKey}". Erwarte Format wie "de_DE".`
      );
      return this.languages.get(this.defaultLanguage);
    }
    return this.languages.has(languageKey)
      ? this.languages.get(languageKey)
      : this.languages.get(this.defaultLanguage);
  }

  /**
   * Gibt den spezifischen Nachrichtenwert für den angegebenen messageKey zurück.
   * Nutzt dabei die Punktnotation, um verschachtelte Werte zu erreichen (z.B. "message.welcome").
   * @param {string} langKey - Der Sprachcode (z.B. "de_DE" oder "en_UK")
   * @param {string} messageKey - Der Nachrichtenschlüssel (z.B. "message.welcome")
   * @returns {any}
   */
  loadlangmsg(langKey, messageKey) {
    if (!this.isValidLanguageKey(langKey)) {
      Logger.error(
        `Ungültiger Sprachschlüssel "${langKey}". Erwarte Format wie "de_DE".`
      );
      return `Ungültiger Sprachschlüssel "${langKey}".`;
    }
    const langData = this.loadlang(langKey);
    if (!langData) {
      return `Sprache "${langKey}" nicht gefunden.`;
    }
    const keys = messageKey.split(".");
    let result = langData;
    for (const key of keys) {
      if (result && typeof result === "object" && key in result) {
        result = result[key];
      } else {
        return `Message key "${messageKey}" nicht gefunden in Sprache "${langKey}".`;
      }
    }
    return result;
  }

  /**
   * Vergleicht den alten und den neuen Dateiinhalt und gibt die Unterschiede
   * mit Zeilennummern aus.
   * @param {string} oldContent - Alter Dateiinhalt
   * @param {string} newContent - Neuer Dateiinhalt
   */
  printDiff(oldContent, newContent) {
    const diff = diffLines(oldContent, newContent);
    let oldLine = 1;
    let newLine = 1;

    diff.forEach((part) => {
      const lines = part.value.split("\n");
      // Entferne einen möglichen leeren Eintrag am Ende
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
        // Unveränderte Zeilen: beide Zeilenzähler fortführen
        lines.forEach(() => {
          oldLine++;
          newLine++;
        });
      }
    });
  }
}

module.exports = { LanguageLoader };
