#!/usr/bin/env node

import { existsSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { spawnSync } from 'node:child_process';
import {
	CHANGELOG_CATEGORIES,
	CHANGESET_TYPES,
	consumeChangesetsAndBumpVersion,
	createChangesetFile,
	previewVersionBump,
	slugify,
	validatePendingChangesets
} from './lib/changesets.js';

const args = process.argv.slice(2);
const command = args[0] ?? 'help';

function printHelp() {
	process.stdout.write(`Terminal changeset tools

Usage:
  pnpm changeset add
  pnpm changeset status [--branch-only] [--since <ref>]
  pnpm changeset validate [--branch-only] [--require-pending] [--since <ref>]
  pnpm changeset version --dry-run
  pnpm changeset version --yes

Lifecycle:
  Feature PRs add one .changeset/*.md file.
  Releases consume pending changesets into CHANGELOG.md and archive them under .changeset/released/<version>/.
`);
}

function hasFlag(flag) {
	return args.includes(flag);
}

function getOption(name, fallback) {
	const index = args.indexOf(name);
	if (index === -1) return fallback;
	const value = args[index + 1];
	return value && !value.startsWith('--') ? value : fallback;
}

function printValidationErrors(errors) {
	for (const error of errors) {
		console.error(`- ${error}`);
	}
}

function ensureCleanWorkingTree() {
	const result = spawnSync('git', ['status', '--porcelain'], {
		stdio: 'pipe',
		encoding: 'utf-8'
	});

	if (result.error || result.status !== 0) {
		throw new Error('Could not inspect git working tree');
	}

	if (result.stdout.trim()) {
		throw new Error('Working tree must be clean before consuming changesets');
	}
}

async function addChangeset() {
	const rl = createInterface({ input, output });

	try {
		const type = (await rl.question(`Type (${CHANGESET_TYPES.join('/')}): `)).trim().toLowerCase();
		const categoryAnswer = (
			await rl.question(`Category (${CHANGELOG_CATEGORIES.join(', ')}): `)
		).trim();
		const summary = (await rl.question('Summary: ')).trim();
		const link = (await rl.question('Link (PR, issue, optional): ')).trim();
		const bodyLines = [];

		output.write('Details, one line at a time. Submit an empty line when done.\n');
		while (true) {
			const line = await rl.question('> ');
			if (!line.trim()) break;
			bodyLines.push(line);
		}

		const defaultFilename = `${slugify(summary) || 'changeset'}.md`;
		const filenameAnswer = (await rl.question(`Filename (${defaultFilename}): `)).trim();
		const filename = filenameAnswer || defaultFilename;
		const category = categoryAnswer || undefined;

		const filePath = createChangesetFile({
			filename,
			type,
			category,
			link,
			summary,
			body: bodyLines.join('\n')
		});

		console.log(`Created ${filePath}`);
	} finally {
		rl.close();
	}
}

function validate() {
	const errors = validatePendingChangesets({
		branchOnly: hasFlag('--branch-only'),
		requirePending: hasFlag('--require-pending'),
		since: getOption('--since', 'origin/main')
	});

	if (errors.length > 0) {
		console.error('Invalid changesets:');
		printValidationErrors(errors);
		process.exit(1);
	}

	console.log('Changesets are valid.');
}

function status() {
	const preview = previewVersionBump({
		branchOnly: hasFlag('--branch-only'),
		since: getOption('--since', 'origin/main')
	});

	if (preview.changesets.length === 0) {
		console.log('No pending changesets.');
		return;
	}

	console.log(`Pending changesets: ${preview.changesets.length}`);
	for (const changeset of preview.changesets) {
		console.log(`- [${changeset.type}/${changeset.category}] ${changeset.filename}`);
	}

	console.log('');
	console.log(
		`Version bump: ${preview.currentVersion} -> ${preview.newVersion} (${preview.bumpType})`
	);
	console.log('');
	console.log(preview.changelogEntry.trimEnd());
}

function version() {
	if (hasFlag('--branch-only') || args.includes('--since')) {
		console.error(
			'--branch-only and --since are not valid for version; releases consume every pending changeset.'
		);
		process.exit(1);
	}

	if (!hasFlag('--dry-run') && !hasFlag('--yes')) {
		console.error('Refusing to mutate files without --yes. Use --dry-run to preview.');
		process.exit(1);
	}

	if (hasFlag('--dry-run')) {
		status();
		return;
	}

	if (!hasFlag('--no-clean-check')) {
		ensureCleanWorkingTree();
	}

	const result = consumeChangesetsAndBumpVersion();
	if (!result) {
		console.log('No pending changesets.');
		return;
	}

	console.log(`Version bumped: ${result.currentVersion} -> ${result.newVersion}`);
	console.log(`Archived ${result.archived.length} changeset(s).`);
}

try {
	if (command === 'help' || command === '--help' || command === '-h') {
		printHelp();
	} else if (!existsSync('package.json')) {
		console.error('Run this command from the repository root.');
		process.exit(1);
	} else if (command === 'add') {
		await addChangeset();
	} else if (command === 'validate') {
		validate();
	} else if (command === 'status') {
		status();
	} else if (command === 'version') {
		version();
	} else {
		console.error(`Unknown command: ${command}`);
		printHelp();
		process.exit(1);
	}
} catch (error) {
	console.error(error instanceof Error ? error.message : String(error));
	process.exit(1);
}
