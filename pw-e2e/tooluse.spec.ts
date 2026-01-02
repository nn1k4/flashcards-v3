import { expect, test } from '@playwright/test';

test.describe('Tool-use flows', () => {
  test('single tool-use returns flashcards sample', async ({ page }) => {
    await page.goto('/');
    await page.getByLabel('LV Text').fill('Sveiki! Es mācos latviešu valodu.');
    await page.getByRole('button', { name: 'Single Tool Use' }).click();
    // Wait for flashcards to load
    await expect(page.getByText(/Flashcards:/)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/cards loaded/)).toBeVisible();
  });

  test('batch submit reaches ready with retries', async ({ page }) => {
    await page.goto('/');
    await page.getByLabel('LV Text').fill('Sveiks! Kā tev klājas? Es mācos latviešu valodu.');
    await page.getByRole('button', { name: 'Submit Text' }).click();
    // Wait until state shows done or progress 100%
    await expect(page.getByText(/state: ready/)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/done/)).toBeVisible();
    // Check that flashcards loaded
    await expect(page.getByText(/Flashcards:/)).toBeVisible();
    await expect(page.getByText(/cards loaded/)).toBeVisible();
  });
});
