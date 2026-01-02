import { expect, test } from '@playwright/test';

test.describe('Flashcards UI', () => {
  // Helper to load flashcards by submitting text
  async function loadFlashcards(page: import('@playwright/test').Page) {
    await page.goto('/');
    await page.getByLabel('LV Text').fill('Sveiki! Es mācos latviešu valodu.');
    await page.getByRole('button', { name: 'Single Tool Use' }).click();
    // Wait for flashcards to load - they auto-show after tool-use completes
    await expect(page.getByText(/Flashcards:/)).toBeVisible({ timeout: 30_000 });
    // FlashcardsView is automatically shown after tool-use, so wait for it
    await expect(page.locator('.flashcards-view')).toBeVisible({ timeout: 5_000 });
  }

  test('displays flashcard with front side initially', async ({ page }) => {
    await loadFlashcards(page);

    // Should see the card container
    await expect(page.locator('.flashcards-view')).toBeVisible();
    // Should see navigation
    await expect(page.locator('.flashcards-navigation')).toBeVisible();
    // Should show card count
    await expect(page.locator('.nav-indicator')).toContainText('/');
  });

  test('flips card on click', async ({ page }) => {
    await loadFlashcards(page);

    const card = page.locator('.card-container');
    await expect(card).toBeVisible();

    // Initially not flipped
    const cardInner = page.locator('.card');
    await expect(cardInner).not.toHaveClass(/is-flipped/);

    // Click to flip
    await card.click();
    await expect(cardInner).toHaveClass(/is-flipped/);

    // Click again to flip back
    await card.click();
    await expect(cardInner).not.toHaveClass(/is-flipped/);
  });

  test('flips card with Space key', async ({ page }) => {
    await loadFlashcards(page);

    const cardInner = page.locator('.card');
    await expect(cardInner).not.toHaveClass(/is-flipped/);

    // Press Space to flip
    await page.keyboard.press('Space');
    await expect(cardInner).toHaveClass(/is-flipped/);

    // Press Space again to flip back
    await page.keyboard.press('Space');
    await expect(cardInner).not.toHaveClass(/is-flipped/);
  });

  test('flips card with ArrowUp/ArrowDown', async ({ page }) => {
    await loadFlashcards(page);

    const cardInner = page.locator('.card');
    await expect(cardInner).not.toHaveClass(/is-flipped/);

    // Press ArrowUp to flip
    await page.keyboard.press('ArrowUp');
    await expect(cardInner).toHaveClass(/is-flipped/);

    // Press ArrowDown to flip back
    await page.keyboard.press('ArrowDown');
    await expect(cardInner).not.toHaveClass(/is-flipped/);
  });

  test('navigates with ArrowLeft/ArrowRight', async ({ page }) => {
    await loadFlashcards(page);

    const indicator = page.locator('.nav-indicator');
    const initialText = await indicator.textContent();

    // If there's more than 1 card, test navigation
    if (initialText && !initialText.startsWith('1 / 1')) {
      // Press ArrowRight to go to next card
      await page.keyboard.press('ArrowRight');
      const afterRight = await indicator.textContent();
      expect(afterRight).not.toBe(initialText);

      // Press ArrowLeft to go back
      await page.keyboard.press('ArrowLeft');
      const afterLeft = await indicator.textContent();
      expect(afterLeft).toBe(initialText);
    }
  });

  test('navigation resets flip state', async ({ page }) => {
    await loadFlashcards(page);

    const cardInner = page.locator('.card');
    const indicator = page.locator('.nav-indicator');
    const initialText = await indicator.textContent();

    // Flip the card first
    await page.keyboard.press('Space');
    await expect(cardInner).toHaveClass(/is-flipped/);

    // If there's more than 1 card, navigate and check flip resets
    if (initialText && !initialText.startsWith('1 / 1')) {
      await page.keyboard.press('ArrowRight');
      // After navigation, card should not be flipped
      await expect(cardInner).not.toHaveClass(/is-flipped/);
    }
  });

  test('navigation buttons work', async ({ page }) => {
    await loadFlashcards(page);

    const nextBtn = page.locator('.nav-next');
    const prevBtn = page.locator('.nav-prev');
    const indicator = page.locator('.nav-indicator');

    // Prev should be disabled on first card
    await expect(prevBtn).toBeDisabled();

    const initialText = await indicator.textContent();
    if (initialText && !initialText.startsWith('1 / 1')) {
      // Click next
      await nextBtn.click();
      const afterNext = await indicator.textContent();
      expect(afterNext).not.toBe(initialText);

      // Now prev should be enabled
      await expect(prevBtn).not.toBeDisabled();

      // Click prev
      await prevBtn.click();
      const afterPrev = await indicator.textContent();
      expect(afterPrev).toBe(initialText);
    }
  });

  test('hide button toggles visibility', async ({ page }) => {
    await loadFlashcards(page);

    // Check if Hide button exists when showing flashcards
    const hideBtn = page.getByRole('button', { name: 'Hide' });
    await expect(hideBtn).toBeVisible();

    // Click Hide
    await hideBtn.click();

    // FlashcardsView should be hidden
    await expect(page.locator('.flashcards-view')).not.toBeVisible();

    // Show button should appear
    const showBtn = page.getByRole('button', { name: 'Show' });
    await expect(showBtn).toBeVisible();
  });
});
