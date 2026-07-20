import { test, expect } from '@playwright/test';

test.describe('Captive Portal & Hotspot logic', () => {

  test('should display Captive Portal UI when in hotspot mode', async ({ page }) => {
    // 1. Intercept the API call to mock hotspot mode
    await page.route('/api/ip', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ip: '10.42.0.1', isHotspot: true })
      });
    });

    // 2. Intercept Wi-Fi Scan to provide mock networks
    await page.route('/api/wifi/scan', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, networks: ['Playwright_Network'] })
      });
    });

    // 3. Go to index and verify the Captive Portal UI loads instead of normal cards
    await page.goto('/index');
    await expect(page.locator('h1')).toHaveText('PiCaster Setup');
    await expect(page.locator('#wifi-select')).toContainText('Playwright_Network');

    // 4. Fill credentials and mock the connection POST request
    await page.route('/api/wifi/connect', async route => {
      const postData = JSON.parse(route.request().postData());
      expect(postData.ssid).toBe('Playwright_Network');
      expect(postData.password).toBe('secretpassword123');

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, message: 'Credentials saved. Applying new network configuration...' })
      });
    });

    await page.fill('#wifi-password', 'secretpassword123');
    await page.click('#wifi-connect-btn');
    await expect(page.locator('#wifi-status')).toHaveText('Credentials saved. Applying new network configuration...');
  });

  test('Receiver should hide QR code and show setup instructions in hotspot mode', async ({ page }) => {
    // Intercept the API call to mock hotspot mode
    await page.route('/api/ip', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ip: '10.42.0.1', isHotspot: true })
      });
    });

    await page.goto('/receiver');
    await expect(page.locator('#waiting-overlay h1')).toHaveText('Network Setup Required');
    // Ensure QR code container is hidden
    await expect(page.locator('#qrcode')).toBeHidden();
  });
});
