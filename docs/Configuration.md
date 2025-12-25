# Configuration

The Scheduler node offers global settings that apply to all schedules within that specific node instance.

## Basic Properties

| Property | Description |
| :--- | :--- |
| **Name** | The label displayed in the Node-RED editor. |
| **Group** | The Dashboard 2.0 UI group this widget belongs to. |
| **Size** | The dimensions of the widget on the dashboard. |
| **Label** | A label displayed on the widget in the UI. |

---

## Localization Settings

### Language
Select the language for the scheduler interface. You can also set this globally in `settings.js`:

```javascript
// ~/.node-red/settings.js
lang: 'de' // Sets the language
```

### Timezone
Specify the timezone for schedule calculations:
- **Blank**: Uses the server's system timezone.
- **UTC**: Forces Coordinated Universal Time.
- **Region/Area**: e.g., `Europe/Berlin`, `America/New_York`. See [timezone list](https://en.wikipedia.org/wiki/List_of_tz_database_time_zones).

### 24-Hour Format
Toggle between 24-hour (`14:00`) and 12-hour (`2:00 PM`) time formats.

---

## Location Settings

For **Solar Events** to work correctly, you must configure the geographical location.

- **Location**: Set as latitude,longitude (e.g., `54.9992500,-1.4170300`).
- Can be a fixed value or an environment variable.

---

## Output Settings

### Command Response Output
Choose how outputs are routed:
- **1 output**: All messages (schedules + command responses) to output 1.
- **2 outputs**: Command responses to output 1, schedule messages to output 2.
- **Fan out**: Separate outputs for command messages and each topic.

### Output Property
Specify where the payload is stored in the message object:
- Default: `msg.payload`
- Custom: e.g., `data.value` → `msg.data.value`

---

## State Broadcasting

Configure periodic state updates for timespan schedules:
- **Interval**: How often to broadcast state (in seconds).
- **Send Active/Inactive**: Whether to send state updates.

This is useful for ensuring new dashboard clients receive the current state immediately.

---

## Storage Settings

Choose where schedule data is persisted:

| Option | Description |
| :--- | :--- |
| **None** | Schedules are lost when the node is redeployed. |
| **Local File System** | Persists to `schedulerdata/` directory under your Node-RED folder. |
| **Node Context Stores** | Uses Node-RED context stores defined in `settings.js`. See [Node-RED Contexts](https://nodered.org/docs/user-guide/context). |

> [!IMPORTANT]
> For true persistence across restarts, use **Local File System** or configure a file-based context store.

---

## Topics

Define topics to categorize and manage schedules:
- Topics can be selected when creating schedules in the Dashboard UI.
- In **Fan Out** output mode, messages are routed to separate outputs per topic.

---

## Custom Payloads

Define reusable payloads that can be selected when creating schedules:
- Supports String, Number, Boolean, and JSON types.
- Changing a payload value here automatically updates all schedules using it.

---

## Advanced Settings

### Use New Time Picker
Enable or disable the modern time picker interface in the Dashboard UI.