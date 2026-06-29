import { expect, test } from '@playwright/test';

test('homepage loads and shows tagline', async ({ page }) => {
  await page.goto('/');
  await expect(
    page.getByText('Privacy-first file sharing with true peer-to-peer transfer')
  ).toBeVisible();
});
