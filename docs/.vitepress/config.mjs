import { defineConfig } from 'vitepress'

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: "Node-RED Dashboard 2 UI Scheduler",
  description: "Official documentation for Node-RED Dashboard 2 UI Scheduler",
  base: '/node-red-dashboard-2-ui-scheduler/',
  themeConfig: {
    // https://vitepress.dev/reference/default-theme-config
    nav: [
      { text: 'Home', link: '/Home' },
      { text: 'Features', link: '/Features' },
      { text: 'Installation', link: '/Installation' },
      { text: 'Usage', link: '/Usage' },
    ],

    sidebar: [
      {
        text: 'Guide',
        items: [
          { text: 'Getting Started', link: '/getting-started' },
          { text: 'Configuration', link: '/configuration' }
        ]
      },
      {
        text: 'Scheduling',
        items: [
          { text: 'Schedule Types', link: '/schedules' }
        ]
      },
      {
        text: 'Advanced',
        items: [
          { text: 'Outputs & Dynamic Input', link: '/outputs' },
          { text: 'Persistence', link: '/persistence' },
          { text: 'Localization', link: '/localization' }
        ]
      },
      {
        text: 'Reference',
        items: [
          { text: 'Development', link: '/Development' },
          { text: 'License', link: '/License' }
        ]
      }
    ],

    socialLinks: [
      { icon: 'github', link: 'https://github.com/cgjgh/node-red-dashboard-2-ui-scheduler' }
    ]
  }
})
