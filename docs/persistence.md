# Persistence & Storage

By default, schedules may be lost when Node-RED restarts. To ensure persistence, configure storage appropriately.

## Storage Options

The scheduler provides three storage methods:

### 1. None (No Persistence)
- Schedules are **lost** when the node is redeployed or Node-RED restarts.
- Useful for testing or temporary schedules.

### 2. Local File System (Recommended)
- Schedules are saved to a directory called `schedulerdata/` under your Node-RED folder.
- **Pros**: Simple setup, survives restarts.
- **Cons**: Data is local to the server.

### 3. Node Context Stores
- Uses Node-RED's context storage mechanism.
- Stores are automatically loaded from your `settings.js` file.
- See [Node-RED Contexts](https://nodered.org/docs/user-guide/context) for setup.

---

## Configuring Context Stores

If you want to use Node-RED context stores, configure `contextStorage` in your `settings.js`:

```javascript
contextStorage: {
    default: {
        module: "memory"
    },
    storeToFile: {
        module: "localfilesystem"
    }
}
```

Then in the **ui-scheduler** node settings:
1. Go to **Storage Settings**.
2. Select `storeToFile` (or your custom store name) from the dropdown.

---

## Dynamic vs Static Schedules

Understanding the difference is important for storage and management:

| Type | Description | Storage |
| :--- | :--- | :--- |
| **Static** | Defined in the node configuration editor. | Always persisted with the flow. |
| **Dynamic** | Added at runtime via `msg.payload` commands. | Persisted based on storage setting. |

Commands like `remove-all-dynamic` or `export-all-static` use these distinctions.
