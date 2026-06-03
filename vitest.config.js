import { defineConfig } from 'vitest/config'
import { playwright } from '@vitest/browser-playwright'

const browserInstances = [{ browser: 'chromium' }]

if (process.platform === 'darwin') {
  browserInstances.push({ browser: 'webkit' })
}

if (process.platform !== 'win32') {
  // Firefox tests time out on Windows CI runners
  // (https://github.com/microsoft/playwright/issues/34586).
  browserInstances.push({ browser: 'firefox' })
}

export default defineConfig({
  test: {
    coverage: {
      provider: 'istanbul',
      include: ['index.js'],
      reporter: ['text', 'lcov'],
    },
    projects: [
      {
        test: {
          name: 'node',
          environment: 'node',
          include: ['test.js'],
        },
      },
      {
        test: {
          name: 'browser',
          include: ['test.js'],
          browser: {
            enabled: true,
            headless: true,
            screenshotFailures: false,
            provider: playwright(),
            instances: browserInstances,
          },
        },
      },
    ],
  },
})
