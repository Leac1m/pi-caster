import { test, expect } from '@playwright/test';

test.describe('Phase 9: Standalone Network & Captive Portal', () => {

  test('Index UI should show Captive Portal warning when CaptiveNetwork is in User Agent', async ({ page }) => {
    // Override the user agent in the browser context to simulate iOS Captive Network Assistant
    const context = page.context();
    const pageWithCustomUA = await context.newPage();
    
    // We can't change the UA on an existing page easily without recreating the context in a single test,
    // but we can use page.addInitScript to override navigator.userAgent
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (iPhone) AppleWebKit/605.1.15 CaptiveNetwork/1.0',
        writable: false
      });
    });

    await page.goto('/');
    
    // The main heading should still be PiProjector
    await expect(page.locator('h1')).toHaveText('PiProjector');
    
    // The "Captive Portal Detected" message should be visible
    const liveScreenCard = page.locator('.card').nth(1);
    await expect(liveScreenCard).toContainText('Captive Portal Detected');
    await expect(liveScreenCard).toContainText('https://10.42.0.1');

    // The share button should be hidden
    await expect(liveScreenCard.locator('.btn')).toBeHidden();
  });

  test('Index UI should allow screen sharing in a normal browser', async ({ page }) => {
    // Normal desktop Chrome browser is the default in Playwright
    await page.goto('/');
    
    const liveScreenCard = page.locator('.card').nth(1);
    
    // The share button should be visible
    await expect(liveScreenCard.locator('.btn')).toBeVisible();
    await expect(liveScreenCard.locator('.btn')).toHaveText('Share Screen');
    
    // Captive Portal warning should not exist
    await expect(liveScreenCard).not.toContainText('Captive Portal Detected');
  });

  test('Receiver UI should always display Wi-Fi join instructions and QR code', async ({ page }) => {
    await page.goto('/receiver');
    
    // Check updated text content
    await expect(page.locator('#waiting-overlay h1')).toHaveText('PiProjector is Ready');
    await expect(page.locator('#waiting-overlay p').first()).toHaveText('Scan to join PiCaster Wi-Fi and start casting');
    await expect(page.locator('#ip-text')).toContainText("Or manually join 'PiCaster' Wi-Fi");

    // Ensure QR code container is visible
    await expect(page.locator('#qrcode')).toBeVisible();
  });
});
