import { expect, test } from '@playwright/test';

test('desktop loads with menu bar', async ({ page }) => {
	await page.goto('/');
	await expect(page.locator('.menubar')).toBeVisible();
	await expect(page.locator('.menubar')).toContainText('Finder');
});

test('first visit opens Welcome, not TV Guide', async ({ page }) => {
	await page.goto('/');
	await page.waitForTimeout(1500);
	await expect(page.locator('.window .title:has-text("Welcome")')).toBeVisible();
});

test('desktop icons render with alias badges', async ({ page }) => {
	await page.goto('/');
	await page.waitForTimeout(1000);
	const icons = page.locator('.desktop-icon');
	const count = await icons.count();
	expect(count).toBeGreaterThan(0);

	const aliasIcons = page.locator('.desktop-icon.alias');
	const aliasCount = await aliasIcons.count();
	expect(aliasCount).toBeGreaterThanOrEqual(5);

	const terminalHD = page.locator('.desktop-icon:has-text("Terminal HD")');
	await expect(terminalHD).not.toHaveClass(/alias/);

	const trash = page.locator('.desktop-icon:has-text("Trash")');
	await expect(trash).not.toHaveClass(/alias/);
});

test('no README.txt or Pricing.txt on desktop', async ({ page }) => {
	await page.goto('/');
	await page.waitForTimeout(1000);
	await expect(page.locator('.desktop-icon:has-text("README")')).not.toBeVisible();
	await expect(page.locator('.desktop-icon:has-text("Pricing")')).not.toBeVisible();
});

test('system menu shows System Preferences, not Tweaks', async ({ page }) => {
	await page.goto('/');
	await page.waitForTimeout(1000);
	await page.click('.apple.menu-item');
	await page.waitForTimeout(300);
	const dropdown = page.locator('.dropdown');
	await expect(dropdown).toBeVisible();
	await expect(dropdown).toContainText('System Preferences');
	await expect(dropdown).not.toContainText('Tweaks');
});

test('About This Terminal shows version', async ({ page }) => {
	await page.goto('/');
	await page.waitForTimeout(1000);
	await page.click('.apple.menu-item');
	await page.waitForTimeout(300);
	await page.click('.dropdown-item:has-text("About Terminal")');
	await page.waitForTimeout(500);
	const aboutWindow = page.locator('.about-terminal');
	await expect(aboutWindow).toBeVisible();
	await expect(aboutWindow).toContainText('Terminal');
	await expect(aboutWindow).toContainText('v1.0.0');
});

test('TV Guide grid has no reduced opacity on off-air shows', async ({ page }) => {
	await page.goto('/');
	await page.waitForTimeout(1000);
	await page.dblclick('.desktop-icon:has-text("TV Guide")');
	await page.waitForTimeout(1500);
	const cells = page.locator('.tvg-ep-cell');
	const count = await cells.count();
	if (count > 0) {
		for (let i = 0; i < Math.min(count, 5); i++) {
			const opacity = await cells.nth(i).evaluate((el) => window.getComputedStyle(el).opacity);
			expect(opacity).toBe('1');
		}
	}
});

test('Stickies render without title bar (chromeless)', async ({ page }) => {
	await page.goto('/');
	await page.waitForTimeout(1000);
	await page.dblclick('.desktop-icon:has-text("Stickies")');
	await page.waitForTimeout(500);
	const stickyWindows = page.locator('.window.chromeless');
	const count = await stickyWindows.count();
	expect(count).toBeGreaterThan(0);
	const first = stickyWindows.first();
	await expect(first).toBeVisible();
	await expect(first.locator('.window-titlebar')).not.toBeVisible();
	await expect(first.locator('.sticky-close')).toBeVisible();
});

test('Applications folder contains seeded apps', async ({ page }) => {
	await page.goto('/');
	await page.waitForTimeout(1000);
	await page.dblclick('.desktop-icon:has-text("Terminal HD")');
	await page.waitForTimeout(500);
	await page.dblclick('.finder-item:has-text("Applications")');
	await page.waitForTimeout(500);
	await expect(page.locator('.finder-item:has-text("TV Guide")')).toBeVisible();
	await expect(page.locator('.finder-item:has-text("Stickies")')).toBeVisible();
	await expect(page.locator('.finder-item:has-text("Camera")')).toBeVisible();
	await expect(page.locator('.finder-item:has-text("Stats")')).toBeVisible();
	await expect(page.locator('.finder-status')).toContainText('5 items');
});

test('System folder contains System Preferences and About', async ({ page }) => {
	await page.goto('/');
	await page.waitForTimeout(1000);
	await page.dblclick('.desktop-icon:has-text("Terminal HD")');
	await page.waitForTimeout(500);
	await page.dblclick('.finder-item:has-text("System")');
	await page.waitForTimeout(500);
	await expect(page.locator('.finder-item:has-text("System Preferences")')).toBeVisible();
	await expect(page.locator('.finder-item:has-text("About This Terminal")')).toBeVisible();
	await expect(page.locator('.finder-status')).toContainText('2 items');
});

test('right-click shows context menu with Make Alias for files', async ({ page }) => {
	await page.goto('/');
	await page.waitForTimeout(1000);
	await page.dblclick('.desktop-icon:has-text("Terminal HD")');
	await page.waitForTimeout(500);
	await page.dblclick('.finder-item:has-text("Applications")');
	await page.waitForTimeout(500);

	await page.locator('.finder-item:has-text("Stats")').click({ button: 'right' });
	await page.waitForTimeout(300);
	const menu = page.locator('.context-menu');
	await expect(menu).toBeVisible();
	await expect(menu).toContainText('Open');
	await expect(menu).toContainText('Make Alias');
});

test('right-click on folder shows Open only, no Make Alias', async ({ page }) => {
	await page.goto('/');
	await page.waitForTimeout(1000);
	await page.dblclick('.desktop-icon:has-text("Terminal HD")');
	await page.waitForTimeout(500);

	await page.locator('.finder-item:has-text("System")').click({ button: 'right' });
	await page.waitForTimeout(300);
	const menu = page.locator('.context-menu');
	await expect(menu).toBeVisible();
	await expect(menu).toContainText('Open');
	await expect(menu).not.toContainText('Make Alias');
});

test('Make Alias creates alias file in the same folder', async ({ page }) => {
	await page.goto('/');
	await page.waitForTimeout(1000);
	await page.dblclick('.desktop-icon:has-text("Terminal HD")');
	await page.waitForTimeout(500);
	await page.dblclick('.finder-item:has-text("Applications")');
	await page.waitForTimeout(500);

	// Count items before
	const statusBefore = page.locator('.finder-status');
	await expect(statusBefore).toContainText('5 items');

	// Right-click Stats.app and Make Alias
	await page.locator('.finder-item:has-text("Stats.app")').click({ button: 'right' });
	await page.waitForTimeout(300);
	await page.locator('.context-menu-item:has-text("Make Alias")').click();
	await page.waitForTimeout(500);

	// Alias should appear in the same folder with "alias" suffix
	await expect(page.locator('.finder-item:has-text("Stats.app alias")')).toBeVisible();
	await expect(statusBefore).toContainText('6 items');

	// Alias should have the alias class on the icon
	const aliasItem = page.locator('.finder-item:has-text("Stats.app alias")');
	await expect(aliasItem.locator('.finder-item-icon.alias')).toBeVisible();
});

test('alias file opens the same app as the original', async ({ page }) => {
	await page.goto('/');
	await page.waitForTimeout(1000);
	await page.dblclick('.desktop-icon:has-text("Terminal HD")');
	await page.waitForTimeout(500);
	await page.dblclick('.finder-item:has-text("Applications")');
	await page.waitForTimeout(500);

	// Create alias of TV Guide
	await page.locator('.finder-item:has-text("TV Guide.app")').click({ button: 'right' });
	await page.waitForTimeout(300);
	await page.locator('.context-menu-item:has-text("Make Alias")').click();
	await page.waitForTimeout(500);

	// Double-click the alias — should open the TV Guide window
	await page.dblclick('.finder-item:has-text("TV Guide.app alias")');
	await page.waitForTimeout(500);
	await expect(page.locator('.window .title:has-text("TV Guide")')).toBeVisible();
});
