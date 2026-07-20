import { test, expect } from '@playwright/test';

test.describe('WebRTC Screen Sharing', () => {
  test('should establish WebRTC connection between Sender and Receiver', async ({ browser }) => {
    // 1. Setup multi-context (simulating two different browsers/users)
    const receiverContext = await browser.newContext();
    const senderContext = await browser.newContext();

    const receiverPage = await receiverContext.newPage();
    const senderPage = await senderContext.newPage();

    // 2. Open Receiver and ensure it connects
    await receiverPage.goto('/receiver');
    await expect(receiverPage.locator('#waiting-overlay h1')).toContainText('PiProjector is Ready');
    
    // The video element exists but is empty initially
    const remoteVideo = receiverPage.locator('#remote-video');

    // 3. Open Sender
    await senderPage.goto('/sender');
    await expect(senderPage.locator('#status-label')).toContainText('Ready to share');

    // 4. Initiate Screen Share
    // Thanks to our Chromium flags, clicking this won't trigger a browser permission prompt,
    // it will automatically stream a fake spinning pattern video.
    const shareBtn = senderPage.locator('#share-btn');
    await expect(shareBtn).toContainText('Share Screen');
    await shareBtn.click();

    // The share button should hide and stop button should show
    const stopBtn = senderPage.locator('#stop-btn');
    await expect(stopBtn).toBeVisible();
    await expect(shareBtn).toBeHidden();
    // The WebRTC connection might take a second to negotiate
    await expect(remoteVideo).toBeVisible({ timeout: 5000 });
    
    // Wait until the video is actually playing (readyState >= 2 means HAVE_CURRENT_DATA)
    await expect(async () => {
      const readyState = await remoteVideo.evaluate((vid) => vid.readyState);
      expect(readyState).toBeGreaterThanOrEqual(2);
    }).toPass({ timeout: 10000 });

    // 6. Cleanup
    await receiverContext.close();
    await senderContext.close();
  });
});
