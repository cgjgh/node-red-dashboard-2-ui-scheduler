# Scheduler Node for Node-RED Dashboard

<div style="display: flex; justify-content: center; align-items: center;">

<img src="https://img.shields.io/github/stars/cgjgh/node-red-dashboard-2-ui-scheduler?style=social" alt="GitHub Stars"/>
<img src="https://img.shields.io/github/forks/cgjgh/node-red-dashboard-2-ui-scheduler?style=social" alt="GitHub Forks"/>
<img src="https://img.shields.io/github/issues/cgjgh/node-red-dashboard-2-ui-scheduler" alt="GitHub Issues"/>
<img src="https://img.shields.io/github/license/cgjgh/node-red-dashboard-2-ui-scheduler" alt="GitHub License"/>
</div>
<br/>
This repository contains a Scheduler Node for Node-RED Dashboard 2.0. This node allows you to schedule the injection of payloads from dashboard UI to start flows at specified times or intervals.

## Important Note
This node is still in beta and is not yet ready for production use. Any contribution or feedback is welcome.

## Features

- 🔌 **Integration with Node-RED Dashboard 2.0:** UI-based schedule management made effortless.
- ⏰ **Flexible Scheduling:** Define events by minute, hour, day, week, month, or yearly periods.
- 🌅 **Solar Events Support:** Incorporate natural cues like sunrise and sunset.
- 📝 **Cron Expressions & Builder:** Specify schedules seamlessly with cron expressions using the intuitive UI cron builder.
- 💾 **Persistent Storage:** Save schedules to your local file system or Node-RED context stores for reliability.
- ⏳ **Timespan & Duration Options:** Easily set timespans (e.g., from 10:00 AM to 12:00 PM) and durations (e.g., for 5 minutes).
- 🌞 **Solar with Time Integration:** Mix solar events with traditional time schedules (e.g., from 5:00 AM to Sunrise) for dynamic scheduling.
- 🔄 **Wrap-Around Schedules:** Support schedules that span across days (e.g., from 9:00 PM to 7:00 AM).
- 📡 **State Updates:** Optionally broadcast the current status of timespan or duration schedules at set intervals.
- 📦 **Custom Payloads:** Attach custom payloads to your schedules for tailored automation.
- 🌐 **Multi-Language Translations:** Available in multiple languages:
  - 🇬🇧 English
  - 🇩🇪 Deutsch
  - 🇫🇷 Français
  - 🇮🇹 Italiano
  - 🇳🇱 Nederlands
  - 🇪🇸 Español
  - 🇵🇱 Polski
  - 🇨🇿 Čeština
  - 🇨🇳 简体中文

![Overview](https://github.com/cgjgh/node-red-dashboard-2-ui-scheduler/blob/40658aef518f54a6068e5eb9bfc79029e86b4c16/assets/overview.png?raw=true)

<div style="display: flex; justify-content: space-evenly;">
  <img src="https://github.com/cgjgh/node-red-dashboard-2-ui-scheduler/blob/40658aef518f54a6068e5eb9bfc79029e86b4c16/assets/details.png?raw=true" alt="Details" style="width: 45%!important; margin: 0 10px;"/>
  <img src="https://github.com/cgjgh/node-red-dashboard-2-ui-scheduler/blob/40658aef518f54a6068e5eb9bfc79029e86b4c16/assets/newSchedule.gif?raw=true" alt="Adding New Schedule" style="width: 45%!important; margin: 0 10px;"/>
</div>


## 📦Installation

You can install this node directly from the "Manage Palette" menu in the Node-RED interface.

Alternatively, run the following command in your Node-RED user directory - typically `~/.node-red` on Linux or `%HOMEPATH%\.nodered` on Windows:

    npm install @cgjgh/node-red-dashboard-2-ui-scheduler

## 🤝 Support my Node-RED Dashboard development
Finding this useful? By supporting my Node-RED Dashboard development, you’ll help drive new features, enhancements, and updates. Your encouragement means everything—thank you for considering!

<a href="https://www.buymeacoffee.com/cgjgh" target="_blank"><img src="https://cdn.buymeacoffee.com/buttons/v2/arial-blue.png" alt="Buy Me A Coffee" style="height: 60px !important;width: 217px !important;" ></a>

## 💡Usage

- Add a scheduler node to your flow.
- Open the node's configuration dialog and optionally configure the timezone, location from map, and persistence options.
- Open the dashboard and you will see an empty scheduler. 
- Click the plus sign at the top right corner of the node to create a new schedule.

## 🌐 Setting Language
 - Edit <code>~/.node-red/settings.js</code> and add/uncomment the following line: <code>lang: 'en'</code> Available languages codes are: <code>en</code>, <code>de</code>, <code>fr</code>, <code>it</code>, <code>nl</code>, <code>es</code>, <code>pl</code>, <code>cs</code>, <code>zh-CN</code>
 - Open the node's configuration dialog and set the desired language for scheduler in the Dashboard 2.0 UI

## 🙏 Acknowledgements

Inspired by: [node-red-contrib-ui-time-scheduler](https://flows.nodered.org/node/node-red-contrib-ui-time-scheduler)

This node draws heavily on the work of [node-red-contrib-cron-plus](https://flows.nodered.org/node/node-red-contrib-cron-plus) by [Steve-Mcl](https://github.com/Steve-Mcl). Tremendous thanks for the outstanding work on this.