# Outputs & Dynamic Input

## Node Outputs

When a schedule triggers, the node sends a `msg` object to the flow.

### Standard Output
The structure depends on your schedule configuration (custom payloads can be defined in the UI):

- **msg.payload**: The value you configured (Boolean, String, JSON, Number).
- **msg.topic**: The topic of the schedule that triggered.
- **msg.scheduledEvent**: `true` when the message is from a scheduled event (not a command response).
- **msg.commandResponse**: `true` when the message is a response to a control command.

### Output Configuration
In node settings, you can configure how outputs are handled:
- **1 output**: All messages (schedules + command responses) go to output 1.
- **2 outputs**: Command responses to output 1, schedule messages to output 2.
- **Fan out**: Separate outputs for command messages and each topic.

You can also customize the **Output property** (e.g., `data.value` means `msg.data.value` will contain the payload).

### State Updates
For **Timespan** schedules, the node can broadcast state periodically. This is grouped by topic:
- If two schedules for the same topic are both "active", one message with payload `true` is sent.
- If one is active and one inactive, one message with payload `true` is sent.
- If both are inactive, one message with payload `false` is sent.

---

## Dynamic Input (Control Commands)

You can control the scheduler programmatically by sending messages to its input.

### Command Methods

**Method 1: Topic Command**
```json
{
    "topic": "trigger",
    "payload": "schedule1"
}
```

**Method 2: Payload Command**
```json
{
    "payload": {
        "command": "trigger",
        "name": "schedule1"
    }
}
```

### Available Commands

| Command | Description |
| :--- | :--- |
| `trigger` | Manually fires a schedule (payload = schedule name). |
| `status` | Returns config and status of a schedule. |
| `export` | Returns the config of a schedule as JSON. |
| `start` | (Re)starts all schedules. Paused schedules resume. |
| `pause` | Pauses a schedule without resetting its counter. |
| `stop` | Stops a schedule and resets its counter. |
| `remove` / `delete` | Removes a schedule permanently. |
| `next` | Returns information about the next scheduled event. |
| `clear` | Removes all schedules. |

### Command Filters (Suffixes)
Append these suffixes to batch-operate on multiple schedules:

| Suffix | Description |
| :--- | :--- |
| `-all` | All schedules (e.g., `status-all`). |
| `-all-dynamic` | Only dynamically added schedules. |
| `-all-static` | Only statically defined schedules. |
| `-topic` | Schedules matching a topic (pass `{ "topic": "..." }` in payload). |
| `-active` | Only currently active schedules. |
| `-active-dynamic` | Active dynamic schedules. |
| `-active-static` | Active static schedules. |
| `-inactive` | Only inactive schedules. |
| `-inactive-dynamic` | Inactive dynamic schedules. |
| `-inactive-static` | Inactive static schedules. |

### Examples
```json
// Trigger a specific schedule
{ "topic": "trigger", "payload": "schedule1" }

// Export all dynamic schedules
{ "topic": "export-all-dynamic" }

// Start all schedules for a specific topic
{ "topic": "start-topic", "payload": { "topic": "Topic 1" } }

// Pause all schedules
{ "payload": { "command": "pause-all" } }

// Remove all inactive dynamic schedules
{ "topic": "remove-inactive-dynamic" }
```

---

## Describe Command (Advanced)

Use the `describe` command to get human-readable information about expressions.

### Describe a Cron Expression
```json
{
    "command": "describe",
    "expressionType": "cron",
    "expression": "0 */5 * * * MON *",
    "timeZone": "Europe/London"
}
```

### Describe Solar Events
```json
{
    "command": "describe",
    "expressionType": "solar",
    "location": "54.9992500,-1.4170300",
    "solarType": "all",
    "timeZone": "Europe/London"
}
```

### Describe Specific Solar Events at a Point in Time
```json
{
    "command": "describe",
    "expressionType": "solar",
    "time": "2020-03-22 18:40",
    "location": "54.9992500,-1.4170300",
    "solarType": "selected",
    "solarEvents": "civilDawn,sunrise,sunset,civilDusk",
    "timeZone": "Europe/London"
}
```

---

## Adding Schedules Dynamically

You can add schedules programmatically:

```json
{
    "payload": {
        "command": "add",
        "schedule": [
            {
                "name": "Daily Schedule",
                "topic": "Topic 1",
                "enabled": true,
                "scheduleType": "time",
                "period": "daily",
                "time": "08:00",
                "days": ["monday", "tuesday", "wednesday", "thursday", "friday"],
                "payloadType": "boolean",
                "payloadValue": true
            }
        ]
    }
}
```

> [!NOTE]
> Adding a schedule with the same name as an existing one will **replace** the existing schedule.
