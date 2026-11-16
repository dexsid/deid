import { test, expect } from '@playwright/test';

test('archive exposes published revisions, filters Unicode tags and opens articles', async ({ page }) => {
  await page.goto('/ru/publications');
  await expect(page.getByRole('link', { name: 'Заметки об обучении', exact: true })).toBeVisible();
  await expect(page.getByText('Секретное изменение')).toHaveCount(0);
  await expect(page.getByText('Секретный черновик')).toHaveCount(0);
  await page.getByRole('main').getByRole('searchbox').fill('ЗАМЕТКИ');
  await page.getByRole('main').getByLabel('Тег', { exact: true }).fill('Әдет');
  await page.getByRole('main').getByRole('button', { name: 'Найти', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Заметки об обучении', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Заметки об обучении', exact: true }).click();
  await expect(page).toHaveURL(/\/ru\/publications\/learning-notes$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Заметки об обучении');
  await expect(page.getByText('Короткое резюме.', { exact: true })).toBeVisible();
  await expect(page.getByText('Публичный текст статьи.', { exact: true })).toBeVisible();
  await expect(page.getByText('Непубличная редакция')).toHaveCount(0);
});

test('language switch preserves article and displays the published original with lang metadata', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto('/ru/publications/learning-notes');
  await page.getByRole('link', { name: 'EN', exact: true }).click();
  await expect(page).toHaveURL(/\/en\/publications\/learning-notes$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Learning notes');
  await expect(page.getByRole('article').first()).toHaveAttribute('lang', 'en');
  await page.getByRole('link', { name: 'KZ', exact: true }).click();
  await expect(page).toHaveURL(/\/kk\/publications\/learning-notes$/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'kk');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Заметки об обучении');
  await expect(page.getByRole('article').first()).toHaveAttribute('lang', 'ru');
  await expect(page.getByText('Аударма әлі қолжетімсіз. Түпнұсқа тілі:', { exact: false })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});

test('direct draft URLs are not public', async ({ page }) => {
  const response = await page.goto('/ru/publications/private-draft');
  expect(response?.status()).toBe(404);
  await expect(page.getByText('Секретный черновик')).toHaveCount(0);
});

test('overlong search parameters stay usable and unknown articles return 404', async ({ page }) => {
  const response = await page.goto(`/ru/publications?${new URLSearchParams({ q: 'я'.repeat(201), tag: 'ә'.repeat(61) })}`);
  expect(response?.status()).toBe(200);
  await expect(page.getByRole('main').getByRole('searchbox')).toHaveValue('я'.repeat(200));
  await expect(page.getByRole('main').getByLabel('Тег', { exact: true })).toHaveValue('ә'.repeat(60));
  const missing = await page.goto('/ru/publications/unknown-article');
  expect(missing?.status()).toBe(404);
});
