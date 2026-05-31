import { test, expect } from '@playwright/test';
import path from 'path';

// Resolves to `screenshots/` relative to the Playwright working directory,
// which is:
//   - Inside Docker: /tests/screenshots  (bind-mounted to client-tests/screenshots/ on the host)
//   - Local run:     <repo>/client-tests/screenshots/
const SCREENSHOT_DIR = path.resolve('./screenshots');

test.describe('Nitro Client – smoke tests', () => {
  /**
   * Verifies that the client's HTTP server returns a successful response.
   * This is the fastest check: it doesn't wait for any JavaScript to execute.
   */
  test('page returns HTTP 200', async ({ page }) => {
    const response = await page.goto('/', { waitUntil: 'commit' });
    expect(response?.status()).toBe(200);
  });

  /**
   * Loads the client with the default SSO demo ticket, waits for the React
   * root element to mount, then captures a full-page screenshot.
   * Tagged @screenshot so it can be run in isolation with:
   *   npx playwright test --grep @screenshot
   */
  test('loads the client and captures a screenshot @screenshot', async ({ page }) => {
    await page.goto('/?sso=123', { waitUntil: 'domcontentloaded' });

    // The React root element must be present in the DOM.
    await expect(page.locator('#root')).toBeAttached({ timeout: 30_000 });

    // Save a full-page screenshot to the shared volume so it is available
    // on the host machine after the container exits.
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'client-initial.png'),
      fullPage: true,
    });
  });

  /**
   * Confirms the page contains the Nitro React app shell (index.html).
   */
  test('page contains expected HTML structure', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    // Vite injects a <script type="module"> tag; assert it exists.
    const scriptTag = page.locator('script[type="module"]');
    await expect(scriptTag).toBeAttached({ timeout: 10_000 });
  });
});
