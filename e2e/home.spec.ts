import { test, expect } from '@playwright/test';

for (const width of [320, 1280]) {
  test(`home at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByText('Опубликованных материалов пока нет.', { exact: false })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: 'К содержимому' })).toBeFocused();
    expect(errors).toEqual([]);
  });
}
