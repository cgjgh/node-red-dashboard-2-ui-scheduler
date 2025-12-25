# Localization

The scheduler UI is translated into multiple languages to support international users.

## Supported Languages

- 🇬🇧 **English** (`en`) - Default
- 🇩🇪 **German** (`de`)
- 🇫🇷 **French** (`fr`)
- 🇮🇹 **Italian** (`it`)
- 🇳🇱 **Dutch** (`nl`)
- 🇪🇸 **Spanish** (`es`)
- 🇵🇱 **Polish** (`pl`)
- 🇨🇿 **Czech** (`cs`)
- 🇨🇳 **Simplified Chinese** (`zh-CN`)

## Changing the Language

You can set the language in two ways:

### 1. Global Node-RED Setting
Edit your `settings.js` file and set the `lang` property:

```javascript
// ~/.node-red/settings.js
module.exports = {
   // ...
   lang: 'de', // Sets the entire interface to German
   // ...
}
```

### 2. Dashboard Configuration
Specific language settings for the dashboard itself can sometimes override or complement the core Node-RED language, depending on your Dashboard 2.0 configuration.

## Contributing Translations
If your language is missing or you find an error, detailed contributions are welcome!
Translation files are located in the `ui/locales/` directory of the repository.
