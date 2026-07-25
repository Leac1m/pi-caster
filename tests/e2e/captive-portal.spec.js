import { test, expect } from '@playwright/test';

test.describe('Phase 9: Standalone Network & Captive Portal', () => {

  test('captive.html content: Wi-Fi join instructions and AeroBeam branding', async ({ page }) => {
    // Per Phase 2 plan: assert the actual captive-portal landing page served at /captive.
    // UA-aware captive detection is tracked as a Phase 9 / P1 feature (unimplemented).
    await page.goto('/captive');

    // The portal should greet the user and reference the AeroBeam network
    await expect(page.locator('h1')).toContainText('Wi-Fi Connected!');
    await expect(page.locator('.instructions').first()).toContainText('AeroBeam network');

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

    // The waiting overlay is shown immediately (server can be offline).
    await expect(page.locator('#waiting-overlay')).toBeVisible();

    // Verify background image is set to AEROBEAMpages.svg (which contains the static QR and credentials)
    const backgroundImage = await page.locator('#waiting-overlay').evaluate(el => window.getComputedStyle(el).backgroundImage);
    expect(backgroundImage).toContain('AEROBEAMpages.svg');
  });
});
