import { test, expect } from '@playwright/test';

test.describe('Tool-use flows', () => {
  test('single tool-use returns flashcards sample', async ({ page }) => {
    await page.goto('/');
    await page.getByLabel('LV Text').fill('Sveiki! Es mācos latviešu valodu.');
    await page.getByRole('button', { name: 'Single Tool Use' }).click();
    await expect(page.getByText('Tool-use (single):')).toBeVisible();
    await expect(page.getByText(/flashcards = \d+/)).toBeVisible();
  });

  test('batch submit reaches ready with retries', async ({ page }) => {
    await page.goto('/');
    await page.getByLabel('LV Text').fill('Sveiks! Kā tev klājas? Es mācos latviešu valodu.');
    await page.getByRole('button', { name: 'Submit Text' }).click();
    // Wait until state shows done or progress 100%
    await expect(page.getByText(/state: ready/)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/done/)).toBeVisible();
  });
});

