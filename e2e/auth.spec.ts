import { test, expect } from '@playwright/test';

test('anonymous and forged sessions cannot access the owner panel', async ({ page, context }) => {
  await page.goto('/ru/admin');
  await expect(page).toHaveURL(/\/ru\/admin\/login$/);
  await context.addCookies([{ name: 'better-auth.session_token', value: 'forged', url: 'http://127.0.0.1:3100' }]);
  await page.goto('/ru/admin');
  await expect(page).toHaveURL(/\/ru\/admin\/login$/);
  await expect(page.getByRole('button', { name: 'Войти', exact: true })).toBeVisible();
});

test('owner logs in and logs out on mobile without overflow or runtime errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto('/ru/admin/login');
  await page.getByLabel('Электронная почта').fill('owner@example.test');
  await page.getByLabel('Пароль', { exact: true }).fill('Test-only-password-2026!');
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await expect(page).toHaveURL(/\/ru\/admin$/);
  await expect(page.getByRole('heading', { name: 'Панель автора', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Выйти', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Выйти', exact: true }).click();
  await expect(page).toHaveURL(/\/ru\/admin\/login$/);
  await page.goto('/ru/admin');
  await expect(page).toHaveURL(/\/ru\/admin\/login$/);
  expect(errors).toEqual([]);
});

test('public registration is rejected through the HTTP route', async ({ request }) => {
  const response = await request.post('/api/auth/sign-up/email', {
    headers: { Origin: 'http://127.0.0.1:3100' },
    data: { email: 'outsider@example.test', name: 'Outsider', password: 'Test-only-password-2026!' },
  });
  expect(response.status()).toBeGreaterThanOrEqual(400);
});
