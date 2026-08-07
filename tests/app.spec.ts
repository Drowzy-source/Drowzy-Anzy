import { test, expect } from '@playwright/test';

test.describe('Timesheet App Auth & Basic Navigation', () => {
  test('homepage has expected title and login form', async ({ page }) => {
    await page.goto('/');

    // Should have "Manpower OS" in the body text
    await expect(page.locator('h1')).toHaveText('Manpower OS');

    // Should have "Secure Portal Login"
    await expect(page.locator('text=Secure Portal Login')).toBeVisible();

    // Should have email and password inputs
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();

    // Should have a submit button
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('timekeeper can login and see failed to fetch', async ({ page }) => {
    await page.goto('/');

    // Login as timekeeper
    await page.fill('input[type="email"]', 'timekeeper@example.com');
    await page.fill('input[type="password"]', 'password123');

    // We expect an error, but let's test that the UI responds to a failed login.
    await page.click('button[type="submit"]');

    // wait for network idle
    await page.waitForLoadState('networkidle');

    await expect(page.locator('p.text-rose-500')).toHaveText('Failed to fetch');
  });
});
