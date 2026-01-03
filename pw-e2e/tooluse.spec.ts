import { expect, test } from '@playwright/test';

test.describe('Tool-use flows', () => {
  test.describe('Single mode', () => {
    test('returns flashcards via single tool-use', async ({ page }) => {
      await page.goto('/');

      // Ensure Single mode is selected (default)
      const singleRadio = page.getByLabel('Single');
      await expect(singleRadio).toBeChecked();

      // Fill text and submit
      await page.getByLabel('Latvian Text').fill('Sveiki! Es mācos latviešu valodu.');
      await page.getByRole('button', { name: 'Submit' }).click();

      // Wait for flashcards to load
      await expect(page.getByText(/Flashcards:/)).toBeVisible({ timeout: 30_000 });
      await expect(page.getByText(/cards loaded/)).toBeVisible();
    });
  });

  test.describe('Mock Batch mode', () => {
    test('submit reaches ready with retries', async ({ page }) => {
      await page.goto('/');

      // Select Mock Batch mode
      await page.getByLabel('Mock Batch').click();
      await expect(page.getByLabel('Mock Batch')).toBeChecked();

      // Fill text and submit
      await page
        .getByLabel('Latvian Text')
        .fill('Sveiks! Kā tev klājas? Es mācos latviešu valodu.');
      await page.getByRole('button', { name: 'Submit' }).click();

      // Wait for flashcards to load (mock batch uses API which can take time)
      await expect(page.getByText(/Flashcards:/)).toBeVisible({ timeout: 60_000 });
      await expect(page.getByText(/cards loaded/)).toBeVisible({ timeout: 5_000 });
    });
  });

  test.describe('Message Batches mode', () => {
    test('UI shows Message Batches option with 50% off badge', async ({ page }) => {
      await page.goto('/');

      // Check that Message Batches option is visible
      const messageBatchesLabel = page.locator('label').filter({ hasText: 'Message Batches' });
      await expect(messageBatchesLabel).toBeVisible();

      // Check 50% off badge is shown
      await expect(messageBatchesLabel.getByText('50% off')).toBeVisible();
    });

    test('selecting Message Batches mode shows batch history panel', async ({ page }) => {
      await page.goto('/');

      // Initially, batch history should not be visible
      await expect(page.getByText('Batch History')).not.toBeVisible();

      // Select Message Batches mode
      await page.getByLabel('Message Batches').click();
      await expect(page.getByLabel('Message Batches')).toBeChecked();

      // Now batch history should be visible
      await expect(page.getByText('Batch History')).toBeVisible();
      await expect(page.getByText('No batches sent yet')).toBeVisible();
    });

    test('Submit button changes to Submit Batch in Message Batches mode', async ({ page }) => {
      await page.goto('/');

      // Initially Submit button shows "Submit" text
      const submitBtn = page.getByRole('button', { name: 'Submit' });
      await expect(submitBtn).toContainText('Submit');

      // Select Message Batches mode
      await page.getByLabel('Message Batches').click();

      // Button text should change to "Submit Batch"
      await expect(submitBtn).toContainText('Submit Batch');
    });

    test('submitting batch shows processing, completes, and loads flashcards', async ({ page }) => {
      await page.goto('/');

      // Select Message Batches mode
      await page.getByLabel('Message Batches').click();

      // Fill text and submit
      await page.getByLabel('Latvian Text').fill('Sveiki! Es mācos latviešu valodu.');
      await page.getByRole('button', { name: 'Submit' }).click();

      // Status line should show processing
      await expect(page.getByText(/Status:.*processing/i)).toBeVisible({ timeout: 10_000 });

      // Current Batch panel should appear with batch ID
      await expect(page.getByText('Current Batch')).toBeVisible({ timeout: 5_000 });
      await expect(page.getByText(/ID: msgbatch_/)).toBeVisible({ timeout: 5_000 });

      // Wait for batch to complete (up to 10 minutes) - use first() for multiple matches
      await expect(page.getByText('Status: complete').first()).toBeVisible({ timeout: 600_000 });

      // Should have flashcards loaded
      await expect(page.getByText(/Flashcards:/)).toBeVisible({ timeout: 10_000 });
      await expect(page.getByText(/cards loaded/)).toBeVisible();
    });

    test('cancel button is enabled during processing', async ({ page }) => {
      await page.goto('/');

      // Select Message Batches mode
      await page.getByLabel('Message Batches').click();

      // Fill text and submit
      await page.getByLabel('Latvian Text').fill('Sveiki! Es mācos latviešu valodu.');

      // Main cancel button (with aria-label) should be disabled initially
      const cancelBtn = page.getByLabel('Cancel');
      await expect(cancelBtn).toBeDisabled();

      // Submit batch
      await page.getByRole('button', { name: 'Submit' }).click();

      // Wait for processing to start
      await expect(page.getByText(/Status:.*processing/i)).toBeVisible({ timeout: 10_000 });

      // Cancel should become enabled while processing
      await expect(cancelBtn).not.toBeDisabled();

      // Batch history should show cancel button for the batch
      await expect(page.locator('.bg-white').getByRole('button', { name: 'Cancel' })).toBeVisible();
    });

    test('batch history displays status badges correctly', async ({ page }) => {
      await page.goto('/');

      // Select Message Batches mode
      await page.getByLabel('Message Batches').click();

      // Submit a batch
      await page.getByLabel('Latvian Text').fill('Labdien!');
      await page.getByRole('button', { name: 'Submit' }).click();

      // Wait for batch to appear in history with in_progress status (use first() for multiple matches)
      await expect(
        page.locator('.bg-blue-100').filter({ hasText: 'Processing' }).first(),
      ).toBeVisible({
        timeout: 10_000,
      });

      // Wait for completion (up to 10 minutes)
      await expect(
        page.locator('.bg-green-100').filter({ hasText: 'Completed' }).first(),
      ).toBeVisible({
        timeout: 600_000,
      });
    });
  });
});
