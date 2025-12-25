# Getting Started

## Installation

### Option 1: Node-RED Palette Manager (Recommended)
1. Open your Node-RED instance.
2. Click the **Menu** (top right) → **Manage palette**.
3. Go to the **Install** tab.
4. Search for `@cgjgh/node-red-dashboard-2-ui-scheduler`.
5. Click **Install**.

### Option 2: NPM (Manual)
Run the following command in your Node-RED user directory (typically `~/.node-red`):

```bash
npm install @cgjgh/node-red-dashboard-2-ui-scheduler
```

> [!NOTE]
> Ensure you are running **Node.js 14+** and **Node-RED 3.0+**.

---

## Basic Usage

Once installed, the **ui-scheduler** node will be available in your palette under the **dashboard** category.

### 1. Add the Node
Drag the `ui-scheduler` node into your flow.

### 2. Configure the Node
Double-click the node to open its properties:
- **Group**: Select the Dashboard 2.0 group where the scheduler should appear.
- **Name**: Give it a label (e.g., "Sprinkler Schedule").
- **Size**: Adjust the widget dimensions if necessary.

### 3. Deploy
Click the **Deploy** button in Node-RED to save your changes.

---

## Your First Schedule

Now that the node is deployed, open your Node-RED Dashboard (usually at `/dashboard`).

1. Locate the generic scheduler widget.
2. Click the **+ (Plus)** icon in the top-right corner to open the creation dialog.
3. **Name your schedule** (e.g., "Daily Light").
4. Choose a **Type** (e.g., "Event" or "Timespan").
5. Set the **Time** or **Cron Expression**.
6. Click **Save**.

![Adding a New Schedule](/assets/newSchedule.gif)

You should now see your schedule listed in the widget!
