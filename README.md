# Discord Language Loader

_This Library was my first Library I've ever made. Hope you enjour with her_

* For Ideas or Feedback you can you my [Discord Server]()

## Table of contents

- [Installations](#installation)
- [Supported File Formats](#unterstützte-dateiformate)
- [Usage](#usage)
  - [Example](#example)
  - [Funktions](#funktions)
- [Features](#features)
- [License](#license)

## Installations

This is a [Node.js](https://nodejs.org/en/) module which is mainly intended for [Discord.JS](https://www.npmjs.com/package/discord.js?activeTab=readme) Discord bots

Before installing, [download and install Node.js](https://nodejs.org/en/download/).
Node.js 18 or higher is required.

Before you [install Node.js](https://nodejs.org/en/download/) this you should have at least Node.Js version 21 or higher

Before you start creating a new project, please execute this command [`npm init or npm init -y` command](https://docs.npmjs.com/creating-a-package-json-file) to initialize the Node.JS project. 
A `package.json` will be created where everything will be included

Installation is done using the
[`npm install` command](https://docs.npmjs.com/getting-started/installing-npm-packages-locally):

```bash
npm install discord-language-loader
```

## Supported File Formats

First you create a folder where your language files are located.

In this folder you create the language files you want,
but note that the following format must be observed.

### YML (e.g. en_UK.yml)

```yml
welcome:
  message: "Welcome to the Discord server!"
  info: "This is an info message."
```

### TOML (e.g. en_UK.toml)

```toml
[welcome]
message = "¡Bienvenido al servidor de Discord!"
info = "Este es un mensaje informativo."
```

### JSON (e.g. en_UK.json)

```json
{
  "welcome": {
    "message": "Bienvenue sur le serveur Discord!",
    "info": "Ceci est un message d'information."
  }
}
```

## Usage

This must also be written to the main file of the Discord bot

```js
const { LanguageLoader, Extension } = require("discord-language-loader");

const loader = new LanguageLoader({
  folderLang: folderPath,
  defaultLang: defaultLanguage,
  fallbackLang: fallbackLanguage,
  extensions: [],
  debug: <True/False>,
});
```

### Example

```js
const { LanguageLoader, Extension } = require("discord-language-loader");

const loader = new LanguageLoader({
  folderLang: '../src/languages',
  defaultLang: 'en_UK',
  fallbackLang: 'en_UK'
  extensions: [Extension.JSON],
  debug: False,
});
```

### Funktions

- LoadLang Example

```bash
loader.loadLang("en_UK")
```

- LoadLangMSG Example

```bash
loader.loadLangMSG("en_UK", "welcome.message")
```

## Features

- **Hot Reloading & Caching**  
  - Update language files during operation without restarting the bot

- **Expandability**
  -  Support for more file formats, future extensions and other cool things

- **Easy Implement**
  - It is easy to understand and requires little time and effort to implement

## License

This project is licensed under the [MIT](LICENSE)