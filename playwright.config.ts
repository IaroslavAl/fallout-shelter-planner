import { defineConfig, devices } from '@playwright/test'

const local = 'http://127.0.0.1:4173/fallout-shelter-planner/'
const remote = process.env.PLANNER_URL
export default defineConfig({
  testDir:'tests',
  testMatch:'**/*.spec.ts',
  use:{baseURL:remote || local, locale:'en-US'},
  webServer:remote?undefined:{command:'npm run preview -- --host 127.0.0.1',url:local,reuseExistingServer:!process.env.CI},
  projects:[
    {name:'chromium',use:{...devices['Desktop Chrome']}},
    {name:'touch-webkit',use:{...devices['iPhone 14']}},
  ],
})
