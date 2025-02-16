# discord-language-loader

## Supported File Formats

First you create a folder where your language files are located. 

In this folder you create the language files you want, 
but note that the following format must be observed.

### YAML/YML (e.g. en_UK.yml)
```yaml
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

```js
const { LanguageLoader } = require("discord-language-loader");

const loader = new LanguageLoader({
  folderLang: folderPath,
  defaultLang: defaultLanguage,
  fallbackLang: fallbackLanguage,
  debug: <True/False>,
});
```
