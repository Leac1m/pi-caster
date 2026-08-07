import { test, expect } from '@playwright/test';

test.describe('Phase 9: Standalone Network & Captive Portal', () => {

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

    // The waiting overlay is shown immediately (server can be offline).
    await expect(page.locator('#waiting-overlay')).toBeVisible();

    // Verify background image is set to AEROBEAMpages.svg (which contains the static QR and credentials)
    const backgroundImage = await page.locator('#waiting-overlay').evaluate(el => window.getComputedStyle(el).backgroundImage);
    expect(backgroundImage).toContain('AEROBEAMpages.svg');
  });
});
