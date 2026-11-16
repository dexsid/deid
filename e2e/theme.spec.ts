import { test, expect } from '@playwright/test';

test('theme follows system and preserves explicit choice across reload and language', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto('/ru');
  await expect(page.getByLabel('Оформление')).toHaveValue('system');
  await expect(page.locator('html')).toHaveCSS('color-scheme', 'dark');
  await page.getByLabel('Оформление').selectOption('light');
  await expect(page.locator('html')).toHaveCSS('color-scheme', 'light');
  await page.reload();
  await expect(page.getByLabel('Оформление')).toHaveValue('light');
  await page.getByRole('link', { name: 'KZ', exact: true }).click();
  await expect(page.getByLabel('Көрініс')).toHaveValue('light');
  await page.getByLabel('Көрініс').selectOption('dark');
  await expect(page.locator('html')).toHaveCSS('color-scheme', 'dark');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('theme choice works when browser storage is unavailable', async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.getItem = () => { throw new Error('Storage unavailable'); };
    Storage.prototype.setItem = () => { throw new Error('Storage unavailable'); };
  });
  await page.goto('/en');
  await page.getByLabel('Appearance').selectOption('dark');
  await expect(page.locator('html')).toHaveCSS('color-scheme', 'dark');
});
