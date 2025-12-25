---
# https://vitepress.dev/reference/default-theme-home-page
layout: home

hero:
  name: "Node-RED Dashboard 2 UI Scheduler"
  text: "Official Documentation"
  tagline: A powerful scheduler widget for Node-RED Dashboard 2.0.
  image:
    src: /assets/overview.png
    alt: Scheduler Overview
  actions:
    - theme: brand
      text: Get Started
      link: /getting-started
    - theme: alt
      text: View Configuration
      link: /configuration

features:
  - title: 📅 Flexible Scheduling
    details: Create events, timespans, and complex cron schedules directly from the UI.
    link: /schedules
  - title: ☀️ Solar Events
    details: Automate based on sunrise, sunset, and other solar phases with offsets.
    link: /schedules#solar-events
  - title: 💾 Persistent Storage
    details: Ensure your schedules survive restarts with robust context store support.
    link: /persistence
---
