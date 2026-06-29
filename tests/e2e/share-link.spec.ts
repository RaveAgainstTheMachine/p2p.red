import { expect, test } from '@playwright/test';

test('renders share mode dropzone', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Drop files or folders here')).toBeVisible();
  await expect(page.getByText('or click to browse')).toBeVisible();
});
