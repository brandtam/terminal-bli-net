import { expect, test, type Page } from '@playwright/test';

async function loadDesktop(page: Page) {
	await page.goto('/');
	await expect(page.locator('.menubar')).toBeVisible();
}

async function closeWelcome(page: Page) {
	const welcome = page.locator('.window:has(.title:has-text("Welcome"))');
	if (await welcome.isVisible()) {
		await welcome.locator('.window-btn.close').click();
	}
}

async function openTerminalHD(page: Page) {
	await page.dblclick('.desktop-icon:has-text("Terminal HD")');
	await expect(page.locator('.window .title:has-text("Terminal HD")')).toBeVisible();
}

async function openFinderFolder(page: Page, name: string) {
	await page.dblclick(`.finder-item:has-text("${name}")`);
	await expect(page.locator(`.window .title:has-text("${name}")`)).toBeVisible();
}

async function openComputerStore(page: Page) {
	await page.locator('.dock-item[title="Computer Store"]').click();
	await expect(page.locator('.window .title:has-text("Computer Store")')).toBeVisible();
}

async function openMyShelf(page: Page) {
	await page.locator('.dock-item[title="My Shelf"]').click();
	await expect(page.locator('.window .title:has-text("My Shelf")')).toBeVisible();
}

async function purchaseStoreApp(page: Page, appId: string, category: string) {
	await openComputerStore(page);
	await page.getByTestId(`store-hotspot-${category}`).click();
	await page.getByTestId(`store-box-${appId}`).first().click();
	await page.getByTestId(`store-add-${appId}`).click();
	await page.getByRole('button', { name: /CART/ }).click();
	await expect(page.getByTestId('store-ring-up')).toBeEnabled();
	await page.getByTestId('store-ring-up').click();
	await expect(page.getByTestId('store-receipt')).toBeVisible();
	await page.getByTestId('store-leave').click();
	await expect(page.locator('.window .title:has-text("Computer Store")')).not.toBeVisible();
}

async function installShelfApp(page: Page, appId: string) {
	await openMyShelf(page);
	await expect(page.getByTestId(`shelf-item-${appId}`)).toBeVisible();
	await page.getByTestId(`shelf-install-${appId}`).click();
	await expect(page.getByRole('alertdialog')).toContainText('Installing');
	await expect(page.getByRole('alertdialog')).not.toBeVisible({ timeout: 5000 });
	await expect(page.getByTestId(`shelf-uninstall-${appId}`)).toBeVisible();
}

async function waitForManifestText(page: Page, text: string) {
	await page.waitForFunction(
		(value) => window.localStorage.getItem('terminalos.manifest')?.includes(value),
		text,
		{ timeout: 5000 }
	);
}

test('desktop loads with menu bar', async ({ page }) => {
	await loadDesktop(page);
	await expect(page.locator('.menubar')).toContainText('Welcome');
});

test('first visit opens Welcome, not TV Guide', async ({ page }) => {
	await loadDesktop(page);
	await expect(page.locator('.window .title:has-text("Welcome")')).toBeVisible();
});

test('desktop icons render with alias badges', async ({ page }) => {
	await loadDesktop(page);
	await expect(page.locator('.desktop-icon:has-text("Terminal HD")')).toBeVisible();
	const icons = page.locator('.desktop-icon');
	const count = await icons.count();
	expect(count).toBeGreaterThan(0);

	const aliasIcons = page.locator('.desktop-icon.alias');
	const aliasCount = await aliasIcons.count();
	expect(aliasCount).toBeGreaterThanOrEqual(2);

	const terminalHD = page.locator('.desktop-icon:has-text("Terminal HD")');
	await expect(terminalHD).not.toHaveClass(/alias/);

	const trash = page.locator('.desktop-icon:has-text("Trash")');
	await expect(trash).not.toHaveClass(/alias/);
});

test('no README.txt or Pricing.txt on desktop', async ({ page }) => {
	await loadDesktop(page);
	await expect(page.locator('.desktop-icon:has-text("Terminal HD")')).toBeVisible();
	await expect(page.locator('.desktop-icon:has-text("README")')).not.toBeVisible();
	await expect(page.locator('.desktop-icon:has-text("Pricing")')).not.toBeVisible();
});

test('system menu shows System Preferences, not Tweaks', async ({ page }) => {
	await loadDesktop(page);
	await page.click('.apple.menu-item');
	await page.waitForTimeout(300);
	const dropdown = page.locator('.dropdown');
	await expect(dropdown).toBeVisible();
	await expect(dropdown).toContainText('System Preferences');
	await expect(dropdown).not.toContainText('Tweaks');
});

test('About This Terminal shows version', async ({ page }) => {
	await loadDesktop(page);
	await page.click('.apple.menu-item');
	await page.waitForTimeout(300);
	await page.click('.dropdown-item:has-text("About Terminal")');
	await page.waitForTimeout(500);
	const aboutWindow = page.locator('.about-terminal');
	await expect(aboutWindow).toBeVisible();
	await expect(aboutWindow).toContainText('Terminal');
	await expect(aboutWindow).toContainText('v1.0.0');
});

test('Computer Store opens from the dock', async ({ page }) => {
	await loadDesktop(page);
	await page.getByRole('button', { name: '🏪 Computer Store' }).click();
	await expect(page.locator('.window .title:has-text("Computer Store")')).toBeVisible();
});

test('feature readiness: purchase, install, Desktop alias, and launch', async ({ page }) => {
	await loadDesktop(page);
	await closeWelcome(page);

	await purchaseStoreApp(page, 'tvguide', 'ent');
	await installShelfApp(page, 'tvguide');

	await expect(page.locator('.desktop-icon:has-text("TV Guide.app")')).toBeVisible();
	await page.dblclick('.desktop-icon:has-text("TV Guide.app")');
	await expect(page.locator('.window .title:has-text("TV Guide.app")')).toBeVisible();
});

test('feature readiness: uninstall removes installed surfaces but keeps ownership', async ({
	page
}) => {
	await loadDesktop(page);
	await closeWelcome(page);

	await purchaseStoreApp(page, 'tvguide', 'ent');
	await installShelfApp(page, 'tvguide');

	await page.getByTestId('shelf-uninstall-tvguide').click();
	const alert = page.getByRole('alertdialog');
	await expect(alert).toContainText('Uninstall TV Guide?');
	await alert.getByRole('button', { name: 'Uninstall' }).click();
	await expect(page.getByRole('alertdialog')).toContainText('Uninstalling');
	await expect(page.getByRole('alertdialog')).not.toBeVisible({ timeout: 5000 });

	await expect(page.getByTestId('shelf-item-tvguide')).toBeVisible();
	await expect(page.getByTestId('shelf-install-tvguide')).toBeVisible();
	await expect(page.locator('.desktop-icon:has-text("TV Guide.app")')).not.toBeVisible();
});

test('feature readiness: TextEdit document edits persist across reload', async ({ page }) => {
	await loadDesktop(page);
	await closeWelcome(page);

	await page.getByRole('button', { name: 'File' }).click();
	await page.locator('.dropdown-item:has-text("New Text Document")').click();
	await expect(page.locator('.window .title:has-text("Untitled.txt")')).toBeVisible();

	const content = `persisted text ${Date.now()}`;
	await page.locator('.textedit-area').fill(content);
	await waitForManifestText(page, content);

	await page.reload();
	await expect(page.locator('.menubar')).toBeVisible();
	await expect(page.locator('.textedit-area')).toHaveValue(content);
});

test('feature readiness: Finder opens text documents through TextEdit', async ({ page }) => {
	await loadDesktop(page);
	await closeWelcome(page);
	await openTerminalHD(page);
	await openFinderFolder(page, 'Documents');

	await page.dblclick('.finder-item:has-text("README.TXT")');
	await expect(page.locator('.window .title:has-text("README.TXT")')).toBeVisible();
	await expect(page.locator('.textedit-area')).toHaveValue(/Terminal is a desktop OS/);
});

test('feature readiness: document aliases use the same handler route', async ({ page }) => {
	await loadDesktop(page);
	await closeWelcome(page);
	await openTerminalHD(page);
	await openFinderFolder(page, 'Documents');

	await page.locator('.finder-item:has-text("README.TXT")').click({ button: 'right' });
	await page.locator('.context-menu-item:has-text("Make Alias")').click();
	await expect(page.locator('.finder-item:has-text("README.TXT alias")')).toBeVisible();

	await page.dblclick('.finder-item:has-text("README.TXT alias")');
	await expect(page.locator('.window .title:has-text("README.TXT")')).toBeVisible();
	await expect(page.locator('.textedit-area')).toHaveValue(/Terminal is a desktop OS/);
});

test('feature readiness: blob-backed recording survives reload and opens in Player', async ({
	page
}) => {
	await loadDesktop(page);
	await closeWelcome(page);

	await purchaseStoreApp(page, 'recorder', 'ent');
	await installShelfApp(page, 'recorder');

	await page.dblclick('.desktop-icon:has-text("Camera.app")');
	await expect(page.locator('.window .title:has-text("Camera.app")')).toBeVisible();
	await page.getByLabel('Start recording').click();
	await expect(page.getByLabel('Stop recording')).toBeVisible();
	await page.waitForTimeout(1200);
	await page.getByLabel('Stop recording').click();
	await expect(page.locator('.rec-item-play')).toBeVisible({ timeout: 7000 });
	const clipName = (await page.locator('.rec-item-play').first().innerText()).trim();
	await waitForManifestText(page, 'indexeddb-blob');

	await page.reload();
	await expect(page.locator('.menubar')).toBeVisible();
	await closeWelcome(page);
	await openTerminalHD(page);
	await openFinderFolder(page, 'Recordings');
	await page.dblclick(`.finder-item:has-text("${clipName}")`);
	await expect(page.locator(`.window .title:has-text("${clipName}")`)).toBeVisible();
	await expect(page.locator('.player-video')).toBeVisible();
});

test('Stickies render without title bar (chromeless)', async ({ page }) => {
	await loadDesktop(page);
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
	await loadDesktop(page);
	await page.dblclick('.desktop-icon:has-text("Terminal HD")');
	await page.waitForTimeout(500);
	await page.dblclick('.finder-item:has-text("Applications")');
	await page.waitForTimeout(500);
	await expect(page.locator('.finder-item:has-text("Computer Store.app")')).toBeVisible();
	await expect(page.locator('.finder-item:has-text("My Shelf.app")')).toBeVisible();
	await expect(page.locator('.finder-item:has-text("Player.app")')).toBeVisible();
	await expect(page.locator('.finder-item:has-text("Stickies")')).toBeVisible();
	await expect(page.locator('.finder-item:has-text("TextEdit.app")')).toBeVisible();
	await expect(page.locator('.finder-status')).toContainText('5 items');
});

test('System folder contains AppData', async ({ page }) => {
	await loadDesktop(page);
	await page.dblclick('.desktop-icon:has-text("Terminal HD")');
	await page.waitForTimeout(500);
	await page.dblclick('.finder-item:has-text("System")');
	await page.waitForTimeout(500);
	await expect(page.locator('.finder-item:has-text("AppData")')).toBeVisible();
	await expect(page.locator('.finder-status')).toContainText('1 item');
});

test('right-click shows context menu with Make Alias for files', async ({ page }) => {
	await loadDesktop(page);
	await page.dblclick('.desktop-icon:has-text("Terminal HD")');
	await page.waitForTimeout(500);
	await page.dblclick('.finder-item:has-text("Applications")');
	await page.waitForTimeout(500);

	await page.locator('.finder-item:has-text("Player.app")').click({ button: 'right' });
	await page.waitForTimeout(300);
	const menu = page.locator('.context-menu');
	await expect(menu).toBeVisible();
	await expect(menu).toContainText('Open');
	await expect(menu).toContainText('Make Alias');
});

test('right-click on folder shows Open only, no Make Alias', async ({ page }) => {
	await loadDesktop(page);
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
	await loadDesktop(page);
	await page.dblclick('.desktop-icon:has-text("Terminal HD")');
	await page.waitForTimeout(500);
	await page.dblclick('.finder-item:has-text("Applications")');
	await page.waitForTimeout(500);

	// Count items before
	const statusBefore = page.locator('.finder-status');
	await expect(statusBefore).toContainText('5 items');

	// Right-click Player.app and Make Alias
	await page.locator('.finder-item:has-text("Player.app")').click({ button: 'right' });
	await page.waitForTimeout(300);
	await page.locator('.context-menu-item:has-text("Make Alias")').click();
	await page.waitForTimeout(500);

	// Alias should appear in the same folder with "alias" suffix
	await expect(page.locator('.finder-item:has-text("Player.app alias")')).toBeVisible();
	await expect(statusBefore).toContainText('6 items');

	// Alias should have the alias class on the icon
	const aliasItem = page.locator('.finder-item:has-text("Player.app alias")');
	await expect(aliasItem.locator('.finder-item-icon.alias')).toBeVisible();
});

test('alias file opens the same app as the original', async ({ page }) => {
	await loadDesktop(page);
	await page.dblclick('.desktop-icon:has-text("Terminal HD")');
	await page.waitForTimeout(500);
	await page.dblclick('.finder-item:has-text("Applications")');
	await page.waitForTimeout(500);

	// Create alias of Player
	await page.locator('.finder-item:has-text("Player.app")').click({ button: 'right' });
	await page.waitForTimeout(300);
	await page.locator('.context-menu-item:has-text("Make Alias")').click();
	await page.waitForTimeout(500);

	// Double-click the alias — should open Player
	await page.dblclick('.finder-item:has-text("Player.app alias")');
	await page.waitForTimeout(500);
	await expect(page.locator('.window .title:has-text("Player")')).toBeVisible();
});

test('drag and drop moves a Finder alias through Desktop and Trash', async ({ page }) => {
	await loadDesktop(page);
	await closeWelcome(page);
	await page.dblclick('.desktop-icon:has-text("Terminal HD")');
	await page.waitForTimeout(500);
	await page.dblclick('.finder-item:has-text("Applications")');
	await page.waitForTimeout(500);

	await page.locator('.finder-item:has-text("Player.app")').click({ button: 'right' });
	await page.waitForTimeout(300);
	await page.locator('.context-menu-item:has-text("Make Alias")').click();
	await page.waitForTimeout(500);

	const finderAlias = page.locator('.finder-item:has-text("Player.app alias")');
	await expect(finderAlias).toBeVisible();
	await finderAlias.dragTo(page.locator('.desktop'), { targetPosition: { x: 1000, y: 460 } });
	await page.waitForTimeout(500);
	await expect(finderAlias).not.toBeVisible();

	const desktopAlias = page.locator('.desktop-icon:has-text("Player.app alias")');
	await expect(desktopAlias).toBeVisible();
	await desktopAlias.dragTo(page.locator('.finder-grid'), { targetPosition: { x: 40, y: 40 } });
	await page.waitForTimeout(500);
	await expect(desktopAlias).not.toBeVisible();
	await expect(finderAlias).toBeVisible();

	await finderAlias.dragTo(page.locator('.desktop-icon:has-text("Trash")'));
	await page.waitForTimeout(500);
	await expect(finderAlias).not.toBeVisible();
	await page.dblclick('.desktop-icon:has-text("Trash")');
	await page.waitForTimeout(500);
	await expect(page.locator('.window .title:has-text("Trash")')).toBeVisible();
	await expect(page.locator('.finder-item:has-text("Player.app alias")')).toBeVisible();
});

test('drag and drop moves a Desktop alias onto a Finder folder', async ({ page }) => {
	await loadDesktop(page);
	await closeWelcome(page);
	await page.dblclick('.desktop-icon:has-text("Terminal HD")');
	await page.waitForTimeout(500);

	const shelfAlias = page.locator('.desktop-icon:has-text("My Shelf.app")');
	await expect(shelfAlias).toBeVisible();
	await shelfAlias.dragTo(page.locator('.finder-item:has-text("Documents")'));
	await page.waitForTimeout(500);
	await expect(shelfAlias).not.toBeVisible();

	await page.dblclick('.finder-item:has-text("Documents")');
	await page.waitForTimeout(500);
	await expect(page.locator('.finder-item:has-text("My Shelf.app")')).toBeVisible();
});
