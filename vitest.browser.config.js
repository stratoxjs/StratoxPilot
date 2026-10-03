import { defineConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';

// Real-browser layer (roadmap 2.13, D-013): a few critical paths in Chromium, Firefox and WebKit.
// Run with `npm run test:browser`. `npm test` stays in Node and happy-dom.
export default defineConfig({
  test: {
    include: ['spec/browser/**/*.browser.js'],
    browser: {
      enabled: true,
      provider: playwright(),
      headless: true,
      instances: [
        { browser: 'chromium' },
        { browser: 'firefox' },
        { browser: 'webkit' },
      ],
    },
  },
});
