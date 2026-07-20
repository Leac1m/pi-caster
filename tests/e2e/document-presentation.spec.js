import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

test.describe('Document Presentation with Remote Preview', () => {
  test('should upload PDF, sync to receiver, and render preview on remote', async ({ browser }) => {
    // 1. Create a dummy PDF file for testing
    const testPdfPath = './tests/e2e/test-dummy.pdf';
    if (!fs.existsSync(testPdfPath)) {
      // Create a minimal valid PDF file (1-page blank PDF)
      const dummyPdfContent = `%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources <<>> >>\nendobj\nxref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \ntrailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n203\n%%EOF`;
      fs.writeFileSync(testPdfPath, dummyPdfContent);
    }

    const receiverContext = await browser.newContext();
    const senderContext = await browser.newContext();

    const receiverPage = await receiverContext.newPage();
    const senderPage = await senderContext.newPage();

    // 2. Open Receiver and wait for it to be ready
    await receiverPage.goto('/receiver');
    await expect(receiverPage.locator('#waiting-overlay h1')).toContainText('PiProjector is Ready');

    // 3. Open Sender (Index) and upload PDF
    await senderPage.goto('/index');
    
    // Setup file chooser intercept before clicking
    const fileChooserPromise = senderPage.waitForEvent('filechooser');
    await senderPage.locator('text=Choose File').click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(testPdfPath);

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

    // Cleanup
    await receiverContext.close();
    await senderContext.close();
    if (fs.existsSync(testPdfPath)) {
        fs.unlinkSync(testPdfPath);
    }
  });

  test('should upload PPTX, sync to receiver, and render preview on remote', async ({ browser }) => {
    const testPptxPath = './tests/e2e/test-dummy.pptx';
    
    // We expect the dummy file to already exist, created via npm pptxgenjs script
    if (!fs.existsSync(testPptxPath)) {
      test.skip();
      return;
    }

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
});

