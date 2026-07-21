import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

test.describe('Document Presentation with Remote Preview', () => {
  test('should upload PDF, sync to receiver, and render preview on remote', async ({ browser }) => {
    // Use a committed single-page PDF fixture (multi-page navigation is tested separately).
    const testPdfPath = path.resolve('tests/e2e/test-multipage.pdf');

    const receiverContext = await browser.newContext();
    const senderContext = await browser.newContext();

    const receiverPage = await receiverContext.newPage();
    const senderPage = await senderContext.newPage();

    // 2. Open Receiver and wait for it to be ready
    await receiverPage.goto('/receiver');
    await expect(receiverPage.locator('#waiting-overlay h1')).toContainText('PiProjector is Ready');

    // 3. Open Sender (Index) and upload PDF, capturing the served fileUrl
    await senderPage.goto('/index');

    // Setup file chooser intercept before clicking
    const fileChooserPromise = senderPage.waitForEvent('filechooser');
    await senderPage.locator('text=Choose File').click();
    const fileChooser = await fileChooserPromise;

    const [uploadResponse] = await Promise.all([
      senderPage.waitForResponse(resp => resp.url().includes('/upload') && resp.request().method() === 'POST'),
      fileChooser.setFiles(testPdfPath)
    ]);
    const { fileUrl } = await uploadResponse.json();

    // Wait for upload success and redirect to remote
    await expect(senderPage.locator('#upload-status')).toContainText('Success! Redirecting...');
    await senderPage.waitForURL('**/remote');

    // 4. Verify Remote UI (Sender is now Remote)
    await expect(senderPage.locator('.remote-header h2')).toContainText('Remote Control');

    // The preview loading text should disappear and the canvas should become visible
    await expect(senderPage.locator('#preview-loading')).toBeHidden();
    await expect(senderPage.locator('#pdf-preview')).toBeVisible();

    // 5. Verify Receiver UI
    // The waiting overlay should disappear and the pdf canvas should be visible
    await expect(receiverPage.locator('#waiting-overlay')).toHaveClass(/hidden/);
    await expect(receiverPage.locator('#pdf-render')).toBeVisible();

    // 6. Test accidental refresh recovery (No slide-next because dummy PDF is 1 page)

    // Simulate accidental refresh on the Remote
    await senderPage.reload();
    await expect(senderPage.locator('.remote-header h2')).toContainText('Remote Control');

    // Verify Remote instantly recovers the preview
    await expect(senderPage.locator('#preview-loading')).toBeHidden();
    await expect(senderPage.locator('#pdf-preview')).toBeVisible();

    // Verify Receiver was NOT stopped by the disconnect
    await expect(receiverPage.locator('#waiting-overlay')).toHaveClass(/hidden/);
    await expect(receiverPage.locator('#pdf-render')).toBeVisible();

    // Simulate accidental crash/refresh on the Receiver (Projector)
    await receiverPage.reload();
    await expect(receiverPage.locator('#waiting-overlay')).toHaveClass(/hidden/);
    await expect(receiverPage.locator('#pdf-render')).toBeVisible();

    // 7. Test stopping presentation
    await senderPage.locator('#btn-stop').click();
    await senderPage.waitForURL('**/index');

    // Receiver should reset to waiting screen
    await expect(receiverPage.locator('#waiting-overlay')).toBeVisible();
    await expect(receiverPage.locator('#pdf-render')).toBeHidden();

    // 8. Phase 1 regression: stopping must purge the uploaded file from the server
    const fileCheck = await senderPage.request.get(fileUrl);
    await expect(fileCheck.status()).toBe(404);

    // Cleanup
    await receiverContext.close();
    await senderContext.close();
  });

  test('should upload PPTX, sync to receiver, and render preview on remote', async ({ browser }) => {
    const testPptxPath = path.resolve('tests/e2e/test-dummy.pptx');

    // If the PPTX fixture is missing, mark as fixme rather than silently skipping.
    test.fixme(!fs.existsSync(testPptxPath), 'PPTX fixture missing — tracked in Phase 8');

    const receiverContext = await browser.newContext();
    const senderContext = await browser.newContext();

    const receiverPage = await receiverContext.newPage();
    const senderPage = await senderContext.newPage();

    senderPage.on('console', msg => console.log('Sender Console: ' + msg.text()));
    senderPage.on('pageerror', error => console.log('Sender Error: ' + error.message));
    receiverPage.on('console', msg => console.log('Receiver Console: ' + msg.text()));
    receiverPage.on('pageerror', error => console.log('Receiver Error: ' + error.message));

    // Open Receiver
    await receiverPage.goto('/receiver');
    await expect(receiverPage.locator('#waiting-overlay h1')).toContainText('PiProjector is Ready');

    // Open Sender (Index) and upload PPTX
    await senderPage.goto('/index');
    
    const fileChooserPromise = senderPage.waitForEvent('filechooser');
    await senderPage.locator('text=Choose File').click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(testPptxPath);

    await expect(senderPage.locator('#upload-status')).toContainText('Success! Redirecting...', { timeout: 10000 });
    await senderPage.waitForURL('**/remote');

    // Verify Remote UI
    await expect(senderPage.locator('.remote-header h2')).toContainText('Remote Control');
    
    // The PPTX loading div should become visible and loading text disappear
    await expect(senderPage.locator('#preview-loading')).toBeHidden({ timeout: 15000 });
    await expect(senderPage.locator('#pptx-preview')).toBeVisible();

    // Verify Receiver UI
    await expect(receiverPage.locator('#waiting-overlay')).toHaveClass(/hidden/, { timeout: 10000 });
    await expect(receiverPage.locator('#pptx-render')).toBeVisible();

    // Test stopping presentation
    await senderPage.locator('#btn-stop').click();
    await senderPage.waitForURL('**/index');

    // Receiver should reset
    await expect(receiverPage.locator('#waiting-overlay')).toBeVisible();
    await expect(receiverPage.locator('#pptx-render')).toBeHidden();

    // Cleanup
    await receiverContext.close();
    await senderContext.close();
  });

  test('PDF presentation with full cycle including stop purges the upload (security/regression)', async ({ browser }) => {
    // Security/regression test for Phase 1 purge() fix: after an explicit stop,
    // the uploaded file must no longer be reachable via its public URL.
    const testPdfPath = path.resolve('tests/e2e/test-multipage.pdf');

    const receiverContext = await browser.newContext();
    const senderContext = await browser.newContext();

    const receiverPage = await receiverContext.newPage();
    const senderPage = await senderContext.newPage();

    await receiverPage.goto('/receiver');
    await expect(receiverPage.locator('#waiting-overlay h1')).toContainText('PiProjector is Ready');

    await senderPage.goto('/index');

    const fileChooserPromise = senderPage.waitForEvent('filechooser');
    await senderPage.locator('text=Choose File').click();
    const fileChooser = await fileChooserPromise;

    const [uploadResponse] = await Promise.all([
      senderPage.waitForResponse(resp => resp.url().includes('/upload') && resp.request().method() === 'POST'),
      fileChooser.setFiles(testPdfPath)
    ]);
    const { fileUrl } = await uploadResponse.json();
    expect(fileUrl).toMatch(/\/uploads\//);

    await expect(senderPage.locator('#upload-status')).toContainText('Success! Redirecting...');
    await senderPage.waitForURL('**/remote');

    // Presentation is active on both remote and receiver
    await expect(senderPage.locator('#pdf-preview')).toBeVisible();
    await expect(receiverPage.locator('#waiting-overlay')).toHaveClass(/hidden/);
    await expect(receiverPage.locator('#pdf-render')).toBeVisible();

    // Stop the presentation
    await senderPage.locator('#btn-stop').click();
    await senderPage.waitForURL('**/index');

    // Receiver resets to waiting overlay (the #pdf-render hidden state is
    // covered by the earlier PDF test; here we focus on the security regression).
    await expect(receiverPage.locator('#waiting-overlay')).toBeVisible({ timeout: 10000 });

    // The originally uploaded file must be gone
    const fileCheck = await senderPage.request.get(fileUrl);
    await expect(fileCheck.status()).toBe(404);

    await receiverContext.close();
    await senderContext.close();
  });
});

