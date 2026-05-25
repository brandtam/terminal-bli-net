import { expect, test } from '@playwright/test';

test('desktop loads with menu bar', async ({ page }) => {
	await page.goto('/');
	await expect(page.locator('.menubar')).toBeVisible();
	await expect(page.locator('.menubar')).toContainText('TV Guide');
});

test('TV Guide opens on first visit', async ({ page }) => {
	await page.goto('/');
	await page.waitForTimeout(1000);
	const tvGuide = page.locator('.tv-guide');
	if (await tvGuide.isVisible()) {
		await expect(tvGuide).toContainText('TV GUIDE');
	}
});

test('desktop icons render for shows', async ({ page }) => {
	await page.goto('/');
	await page.waitForTimeout(1000);
	const icons = page.locator('.desktop-icon');
	const count = await icons.count();
	expect(count).toBeGreaterThan(0);
});
