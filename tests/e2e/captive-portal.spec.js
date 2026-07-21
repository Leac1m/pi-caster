import { test, expect } from '@playwright/test';

test.describe('Phase 9: Standalone Network & Captive Portal', () => {

  test('captive.html content: Wi-Fi join instructions and PiProjector branding', async ({ page }) => {
    // Per Phase 2 plan: assert the actual captive-portal landing page served at /captive.
    // UA-aware captive detection is tracked as a Phase 9 / P1 feature (unimplemented).
    await page.goto('/captive');

    // The portal should greet the user and reference the PiCaster network
    await expect(page.locator('h1')).toContainText('Wi-Fi Connected!');
    await expect(page.locator('.instructions').first()).toContainText('PiCaster network');

    // The portal should tell users to navigate to cast.pi and offer a launch button
    await expect(page.locator('.domain-box')).toHaveText('cast.pi');
    await expect(page.locator('a.btn')).toHaveAttribute('href', 'http://cast.pi');
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
