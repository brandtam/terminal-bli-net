import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { afterEach, describe, expect, it } from 'vitest';
import {
	assertCanArchiveChangesets,
	bumpVersion,
	consumeChangesetsAndBumpVersion,
	createChangesetFile,
	generateChangelogEntry,
	getHighestBumpType,
	parseChangeset,
	prependToChangelog,
	previewVersionBump,
	readPendingChangesets,
	validatePendingChangesets
} from './changesets.js';

const createdRoots = [];

function tempRoot() {
	const root = mkdtempSync(join(tmpdir(), 'terminal-changesets-'));
	createdRoots.push(root);
	writeFileSync(
		join(root, 'package.json'),
		JSON.stringify({ name: 'terminal-bli-net', version: '1.0.0', private: true }, null, '\t') +
			'\n',
		'utf-8'
	);
	return root;
}

afterEach(() => {
	while (createdRoots.length) {
		rmSync(createdRoots.pop(), { recursive: true, force: true });
	}
});

function git(root, args) {
	const result = spawnSync('git', args, {
		cwd: root,
		stdio: 'pipe',
		encoding: 'utf-8'
	});

	if (result.status !== 0) {
		throw new Error(result.stderr || `git ${args.join(' ')} failed`);
	}
}

function initGitRepo(root) {
	git(root, ['init', '--initial-branch=main']);
	git(root, ['config', 'user.email', 'terminal@example.com']);
	git(root, ['config', 'user.name', 'Terminal Tests']);
	git(root, ['add', 'package.json']);
	git(root, ['commit', '-m', 'initial']);
	git(root, ['checkout', '-b', 'feature/changesets']);
}

async function writeChangeset(root, filename, content) {
	await mkdir(join(root, '.changeset'), { recursive: true });
	await writeFile(join(root, '.changeset', filename), content, 'utf-8');
}

describe('parseChangeset', () => {
	it('parses frontmatter, summary, details, and optional links', () => {
		const result = parseChangeset(
			'add-finder-routing.md',
			`---
type: minor
category: Added
link: #12
---

Add folder-addressable Finder windows
- Desktop folder aliases preserve their target folder
`
		);

		expect(result.errors).toEqual([]);
		expect(result.changeset).toMatchObject({
			filename: 'add-finder-routing.md',
			type: 'minor',
			category: 'Added',
			link: '#12',
			summary: 'Add folder-addressable Finder windows',
			body: '- Desktop folder aliases preserve their target folder'
		});
	});

	it('reports invalid type, category, filename, and missing summary', () => {
		const result = parseChangeset(
			'Bad Name.md',
			`---
type: feature
category: Misc
---

`
		);

		expect(result.errors).toEqual([
			'Bad Name.md: filename must be kebab-case markdown',
			'Bad Name.md: type must be major, minor, or patch',
			'Bad Name.md: category must be one of Added, Changed, Deprecated, Removed, Fixed, Security, Migration Notes, App Author Notes, Known Issues, Upgrade Notes',
			'Bad Name.md: body must start with a one-line summary'
		]);
	});
});

describe('pending changesets', () => {
	it('reads direct markdown files and ignores README plus released archives', async () => {
		const root = tempRoot();
		await writeChangeset(
			root,
			'fix-alert.md',
			`---
type: patch
---

Fix alert focus order
`
		);
		await writeChangeset(root, 'README.md', '# docs');
		await mkdir(join(root, '.changeset', 'released', '1.0.0'), { recursive: true });
		await writeFile(join(root, '.changeset', 'released', '1.0.0', 'old.md'), 'old', 'utf-8');

		const results = readPendingChangesets({ root });

		expect(results).toHaveLength(1);
		expect(results[0].changeset.filename).toBe('fix-alert.md');
		expect(validatePendingChangesets({ root })).toEqual([]);
	});

	it('branch-only reads committed, staged, and untracked changesets', async () => {
		const root = tempRoot();
		initGitRepo(root);

		await writeChangeset(
			root,
			'committed-change.md',
			`---
type: minor
---

Add committed change
`
		);
		git(root, ['add', '.changeset/committed-change.md']);
		git(root, ['commit', '-m', 'add committed changeset']);

		await writeChangeset(
			root,
			'staged-change.md',
			`---
type: patch
---

Fix staged change
`
		);
		git(root, ['add', '.changeset/staged-change.md']);

		await writeChangeset(
			root,
			'untracked-change.md',
			`---
type: patch
---

Fix untracked change
`
		);
		await mkdir(join(root, '.changeset', 'released', '1.0.0'), { recursive: true });
		await writeFile(
			join(root, '.changeset', 'released', '1.0.0', 'archived-change.md'),
			'old',
			'utf-8'
		);

		const names = readPendingChangesets({ root, branchOnly: true, since: 'main' }).map(
			(result) => result.changeset.filename
		);

		expect(names).toEqual(['committed-change.md', 'staged-change.md', 'untracked-change.md']);
	});

	it('branch-only fails closed when the base ref is invalid', () => {
		const root = tempRoot();
		initGitRepo(root);
		mkdirSync(join(root, '.changeset'), { recursive: true });

		expect(() => readPendingChangesets({ root, branchOnly: true, since: 'missing-ref' })).toThrow(
			/Could not determine branch changesets/
		);
	});

	it('can require at least one pending changeset', () => {
		const root = tempRoot();

		expect(validatePendingChangesets({ root, requirePending: true })).toEqual([
			'No pending changesets found.'
		]);
	});
});

describe('version bumping', () => {
	it('selects the highest bump type and bumps SemVer', () => {
		expect(getHighestBumpType([{ type: 'patch' }, { type: 'minor' }])).toBe('minor');
		expect(getHighestBumpType([{ type: 'patch' }, { type: 'major' }])).toBe('major');
		expect(bumpVersion('1.2.3', 'patch')).toBe('1.2.4');
		expect(bumpVersion('1.2.3', 'minor')).toBe('1.3.0');
		expect(bumpVersion('1.2.3', 'major')).toBe('2.0.0');
	});

	it('previews a release without writing files', async () => {
		const root = tempRoot();
		await writeChangeset(
			root,
			'add-store-flow.md',
			`---
type: minor
category: Added
---

Add store install release checks
`
		);

		const preview = previewVersionBump({ root, date: '2026-06-03' });

		expect(preview).toMatchObject({
			currentVersion: '1.0.0',
			newVersion: '1.1.0',
			bumpType: 'minor'
		});
		expect(preview.changelogEntry).toContain('## 1.1.0 - 2026-06-03');
		expect(readFileSync(join(root, 'package.json'), 'utf-8')).toContain('"version": "1.0.0"');
	});
});

describe('changelog generation', () => {
	it('groups entries by changelog category in stable order', () => {
		const entry = generateChangelogEntry(
			'1.1.0',
			[
				{
					filename: 'fix.md',
					type: 'patch',
					category: 'Fixed',
					summary: 'Fix unknown document alerts',
					body: '',
					link: ''
				},
				{
					filename: 'add.md',
					type: 'minor',
					category: 'Added',
					summary: 'Add release tooling',
					body: '- Archives consumed changesets',
					link: ''
				}
			],
			{ date: '2026-06-03' }
		);

		expect(entry).toBe(`## 1.1.0 - 2026-06-03

### Added

**Add release tooling**

- Archives consumed changesets

### Fixed

**Fix unknown document alerts**
`);
	});

	it('inserts a new entry before existing version sections', () => {
		const root = tempRoot();
		writeFileSync(
			join(root, 'CHANGELOG.md'),
			`# Changelog

All notable changes to Terminal will be documented in this file.

## 1.0.0 - 2026-06-03

### Added

**Initial release**
`,
			'utf-8'
		);

		prependToChangelog(
			`## 1.1.0 - 2026-06-04

### Fixed

**Fix menus**`,
			{ root }
		);

		expect(readFileSync(join(root, 'CHANGELOG.md'), 'utf-8')).toBe(`# Changelog

All notable changes to Terminal will be documented in this file.

## 1.1.0 - 2026-06-04

### Fixed

**Fix menus**

## 1.0.0 - 2026-06-03

### Added

**Initial release**
`);
	});
});

describe('consumeChangesetsAndBumpVersion', () => {
	it('updates package.json, prepends changelog, and archives pending changesets', async () => {
		const root = tempRoot();
		writeFileSync(
			join(root, 'CHANGELOG.md'),
			`# Changelog

All notable changes to Terminal will be documented in this file.

## 1.0.0 - 2026-06-03

### Added

**Initial release**
`,
			'utf-8'
		);
		await writeChangeset(
			root,
			'add-release-tooling.md',
			`---
type: minor
category: Added
---

Add archived changeset release tooling
- Keep release-intent files after they are consumed
`
		);

		const result = consumeChangesetsAndBumpVersion({ root, date: '2026-06-04' });

		expect(result.newVersion).toBe('1.1.0');
		expect(JSON.parse(await readFile(join(root, 'package.json'), 'utf-8')).version).toBe('1.1.0');
		expect(await readFile(join(root, 'CHANGELOG.md'), 'utf-8')).toContain('## 1.1.0 - 2026-06-04');
		expect(existsSync(join(root, '.changeset', 'add-release-tooling.md'))).toBe(false);
		expect(
			existsSync(join(root, '.changeset', 'released', '1.1.0', 'add-release-tooling.md'))
		).toBe(true);
		expect(await readdir(join(root, '.changeset', 'released', '1.1.0'))).toEqual([
			'add-release-tooling.md'
		]);
	});

	it('creates a valid changeset file with defaults', async () => {
		const root = tempRoot();
		createChangesetFile(
			{
				filename: 'fix-menu-focus.md',
				type: 'patch',
				summary: 'Fix menu focus after closing windows'
			},
			{ root }
		);

		const content = await readFile(join(root, '.changeset', 'fix-menu-focus.md'), 'utf-8');
		expect(content).toBe(`---
type: patch
category: Fixed
---

Fix menu focus after closing windows
`);
	});

	it('preflights archive conflicts before mutating release files', async () => {
		const root = tempRoot();
		writeFileSync(
			join(root, 'CHANGELOG.md'),
			`# Changelog

All notable changes to Terminal will be documented in this file.
`,
			'utf-8'
		);
		await writeChangeset(
			root,
			'fix-release.md',
			`---
type: patch
---

Fix release flow
`
		);
		await mkdir(join(root, '.changeset', 'released', '1.0.1'), { recursive: true });
		await writeFile(
			join(root, '.changeset', 'released', '1.0.1', 'fix-release.md'),
			'old',
			'utf-8'
		);

		const changesets = previewVersionBump({ root, date: '2026-06-04' }).changesets;

		expect(() => assertCanArchiveChangesets('1.0.1', changesets, { root })).toThrow(
			/Cannot archive changesets/
		);
		expect(() => consumeChangesetsAndBumpVersion({ root, date: '2026-06-04' })).toThrow(
			/Cannot archive changesets/
		);
		expect(JSON.parse(await readFile(join(root, 'package.json'), 'utf-8')).version).toBe('1.0.0');
		expect(await readFile(join(root, 'CHANGELOG.md'), 'utf-8')).toBe(`# Changelog

All notable changes to Terminal will be documented in this file.
`);
		expect(existsSync(join(root, '.changeset', 'fix-release.md'))).toBe(true);
	});
});
