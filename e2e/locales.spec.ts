import { test, expect } from '@playwright/test';

for (const [locale, menu, publications] of [['ru', 'Меню', 'Публикации'], ['en', 'Menu', 'Publications'], ['kk', 'Мәзір', 'Жарияланымдар']]) {
  test(`${locale}: mobile navigation and localized sections`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 740 });
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    for (const section of ['', '/publications', '/goals', '/experiments', '/about']) {
      const response = await page.goto(`/${locale}${section}`);
      expect(response?.status()).toBe(200);
      await expect(page.locator('html')).toHaveAttribute('lang', locale);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
    await page.locator('summary').filter({ hasText: menu }).click();
    await page.locator('details').getByRole('link', { name: publications, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/${locale}/publications$`));
    await expect(page.locator('details')).not.toHaveAttribute('open', '');
    expect(errors).toEqual([]);
  });
}

test('language switch preserves section and Unicode query', async ({ page }) => {
  const query = 'Әлем білім & заметки';
  await page.goto(`/ru/publications?${new URLSearchParams({ q: query, tag: 'reading' })}`);
  await page.getByRole('link', { name: 'KZ', exact: true }).click();
  await expect(page).toHaveURL(url => url.pathname === '/kk/publications' && url.searchParams.get('q') === query && url.searchParams.get('tag') === 'reading');
  await expect(page.locator('html')).toHaveAttribute('lang', 'kk');
  await expect(page.getByRole('main').getByRole('searchbox')).toHaveValue(query);
  await page.getByRole('link', { name: 'EN', exact: true }).click();
  await expect(page).toHaveURL(url => url.pathname === '/en/publications' && url.searchParams.get('q') === query);
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
});

test('search submits a GET query and renders markup as text', async ({ page }) => {
  await page.goto('/kk/publications');
  const query = '<script>alert(1)</script> қазақ';
  const main = page.getByRole('main');
  await main.getByRole('searchbox').fill(query);
  await main.getByRole('button', { name: 'Іздеу', exact: true }).click();
  await expect(page).toHaveURL(url => url.pathname === '/kk/publications' && url.searchParams.get('q') === query);
  await expect(main.getByRole('searchbox')).toHaveValue(query);
  await expect(main.getByText(`Іздеу сұрауы: «${query}»`, { exact: true })).toBeVisible();
  await main.getByRole('link', { name: 'Іздеуді тазалау', exact: true }).click();
  await expect(page).toHaveURL(/\/kk\/publications$/);
  await expect(main.getByRole('searchbox')).toHaveValue('');
});
