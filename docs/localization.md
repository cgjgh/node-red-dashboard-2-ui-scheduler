# Localization

The scheduler UI is translated into multiple languages to support international users.

## Supported Languages

| Flag | Language | Code |
| :--- | :--- | :--- |
| 🇬🇧 | English | `en` (Default) |
| 🇩🇪 | German | `de` |
| 🇫🇷 | French | `fr` |
| 🇮🇹 | Italian | `it` |
| 🇳🇱 | Dutch | `nl` |
| 🇪🇸 | Spanish | `es` |
| 🇵🇱 | Polish | `pl` |
| 🇨🇿 | Czech | `cs` |
| 🇨🇳 | Simplified Chinese | `zh-CN` |

---

## Changing the Language

### Method 1: Node Settings
In the **ui-scheduler** node editor, select your language from the **Language** dropdown.

### Method 2: Global Node-RED Setting
Edit your `settings.js` file:

```javascript
// ~/.node-red/settings.js
module.exports = {
    // ...
    lang: 'de', // Sets the language globally
    // ...
}
```

---

## Contributing a New Language

Adding support for a new language involves creating translation files in two locations.

### File Structure Overview

```
node-red-dashboard-2-ui-scheduler/
├── ui/
│   └── locales/
│       ├── en.json          # Dashboard UI translations
│       ├── de.json
│       └── {your-lang}.json  # <-- Create this
│
└── nodes/
    └── locales/
        ├── en-US/
        │   ├── ui-scheduler.json   # Node-RED editor translations
        │   └── ui-scheduler.html   # Help documentation
        ├── de/
        └── {your-lang}/            # <-- Create this folder
            ├── ui-scheduler.json
            └── ui-scheduler.html   # (Optional but recommended)
```

---

### Step 1: Create Dashboard UI Translation

Create a new file: `ui/locales/{lang-code}.json`

Copy the contents of `ui/locales/en.json` and translate all values.

**Example structure:**
```json
{
    "reportIssue": "Report An Issue",
    "featureRequest": "Feature Request",
    "buyCoffee": "Buy Me a Coffee",
    "updateAvailable": "Update Available",
    "checkForUpdates": "Check for Updates",
    "eventDetails": "Event Details",
    "topic": "Topic",
    // ... 140+ more keys
    "sunday": "Sunday",
    "monday": "Monday",
    // ... days, months, solar events, error messages
}
```

**Key categories to translate:**
| Category | Examples |
| :--- | :--- |
| UI Elements | `save`, `cancel`, `delete`, `close` |
| Schedule Types | `event`, `solar`, `cron`, `timespan` |
| Time Periods | `daily`, `weekly`, `monthly`, `yearly` |
| Days of Week | `sunday`, `monday`, ..., `saturday` |
| Months | `january`, `february`, ..., `december` |
| Solar Events | `sunrise`, `sunset`, `civilDawn`, `nadir` |
| Error Messages | `scheduleNameRequired`, `topicRequired` |

---

### Step 2: Create Node-RED Editor Translation

Create a new folder: `nodes/locales/{lang-code}/`

Create file: `nodes/locales/{lang-code}/ui-scheduler.json`

Copy from `nodes/locales/en-US/ui-scheduler.json` and translate.

**Example structure:**
```json
{
  "ui-scheduler": {
    "label": {
      "name": "Name",
      "group": "Group",
      "size": "Size",
      "language": "Language",
      "timeZone": "Timezone",
      // ... more labels
    },
    "days": {
      "sunday": "Sunday",
      "monday": "Monday",
      // ...
    },
    "months": {
      "january": "January",
      // ...
    },
    "solarEvents": {
      "sunrise": "Sunrise",
      "sunset": "Sunset",
      // ...
    },
    "error": {
      "scheduleNameRequired": "Schedule Name is required.",
      // ... error messages
    }
  }
}
```

---

### Step 3: Register the Language in Node Backend

Edit `nodes/ui-scheduler.js` and add your language code to the `availableLocales` array:

```javascript
// Around line 28
const availableLocales = ['en', 'de', 'fr', 'it', 'nl', 'es', 'pl', 'cs', 'zh-CN', 'your-lang']
```

---

### Step 4: Update the Vue Component

The Dashboard UI component needs to import and register your translation.

Edit `ui/components/UIScheduler.vue`:

**4a. Add the import statement (around line 1204):**
```javascript
// Import translations
import cs from '../locales/cs.json'
import de from '../locales/de.json'
import en from '../locales/en.json'
import es from '../locales/es.json'
import fr from '../locales/fr.json'
import it from '../locales/it.json'
import nl from '../locales/nl.json'
import pl from '../locales/pl.json'
import zhCN from '../locales/zh-CN.json'
import yourLang from '../locales/your-lang.json'  // <-- Add this
```

**4b. Add a case to the `localeMessages` switch statement (around line 1567):**
```javascript
localeMessages () {
    let baseMessages

    switch (this.locale) {
    case 'de':
        baseMessages = de
        break
    case 'es':
        baseMessages = es
        break
    // ... other cases ...
    case 'your-lang':           // <-- Add this case
        baseMessages = yourLang
        break
    case 'en':
    default:
        baseMessages = en
        break
    }
    return baseMessages
}
```

---

### Step 5: (Optional) Translate Help Documentation

Copy `nodes/locales/en-US/ui-scheduler.html` to your language folder and translate the content.

> [!NOTE]
> The help file is HTML with embedded markdown. Focus on translating the text content, not the HTML structure.

---

## Contributing to enhanced-ms

The scheduler uses the [`enhanced-ms`](https://www.npmjs.com/package/enhanced-ms) npm package for time formatting (e.g., "in 5 minutes", "2 hours ago").

If your language is not yet supported, you should also contribute translations to this package:

1. Visit the [enhanced-ms repository](https://github.com/Simonify/enhanced-ms).
2. Add your language's time unit translations.
3. Submit a Pull Request there first.
4. Once merged, the ui-scheduler can use the updated package.

> [!IMPORTANT]
> Without enhanced-ms support, relative time strings like "in 5 minutes" will display in English even if the rest of the UI is translated.

---

## Translation Guidelines

1. **Keep placeholders intact**: Strings like `{time}`, `{period}`, `{day}` are replaced at runtime.
   ```json
   "future": "in {time}",        // ✅ Correct
   "future": "in {tiempo}",      // ❌ Wrong - don't translate placeholder
   ```

2. **Maintain JSON structure**: Don't change keys, only values.

3. **Use native terminology**: Use terms familiar to native speakers (e.g., "Solar Noon" might have a specific astronomical term in your language).

4. **Test your translation**: Run the development build and verify UI rendering.

---

## Testing Your Translation

1. Install dependencies:
   ```bash
   npm install
   ```

2. Build the project:
   ```bash
   npm run build
   ```

3. Start Node-RED with your language:
   ```bash
   # Edit settings.js and set lang: 'your-lang'
   node-red
   ```

4. Verify the Dashboard UI and Node-RED editor show your translations.

---

## Complete Checklist

Before submitting your translation, ensure you have:

- [ ] Created `ui/locales/{lang-code}.json`
- [ ] Created `nodes/locales/{lang-code}/ui-scheduler.json`
- [ ] (Optional) Created `nodes/locales/{lang-code}/ui-scheduler.html`
- [ ] Added language code to `availableLocales` in `nodes/ui-scheduler.js`
- [ ] Added import statement in `ui/components/UIScheduler.vue`
- [ ] Added switch case in `localeMessages` in `ui/components/UIScheduler.vue`
- [ ] (Optional) Contributed to `enhanced-ms` package for time formatting

---

## Submitting Your Translation

1. Fork the repository.
2. Create a branch: `git checkout -b add-language-{lang-code}`
3. Add your translation files.
4. Submit a Pull Request with:
   - Description of the language added
   - Any cultural considerations or alternative terminology choices

