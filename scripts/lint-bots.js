#!/usr/bin/env node

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, resolve } from 'path';

const BOTS_DIR = resolve(import.meta.dirname, '..', 'bots');
const REQUIRED_SECTIONS = ['# Character', '# Voice', '# Examples', '# Format'];
const REQUIRED_FIELDS = ['id', 'group', 'name', 'occupation', 'image', 'greeting', 'bio', 'prompt'];

let errorCount = 0;
let botCount = 0;
const ids = new Set();

function lint(filePath, bot) {
	const errors = [];

	for (const field of REQUIRED_FIELDS) {
		if (!bot[field]) {
			errors.push(`Missing required field "${field}"`);
		}
	}

	if (bot.prompt) {
		for (const section of REQUIRED_SECTIONS) {
			if (!bot.prompt.includes(section)) {
				errors.push(`Missing section "${section}" in prompt`);
			}
		}

		const exIdx = bot.prompt.indexOf('# Examples');
		const fmtIdx = bot.prompt.indexOf('# Format');
		if (exIdx !== -1 && fmtIdx !== -1) {
			const block = bot.prompt.slice(exIdx + '# Examples'.length, fmtIdx).trim();
			if (!block.includes('User:')) {
				errors.push('Examples block has no "User:" exchanges');
			}
		}
	}

	if (ids.has(bot.id)) {
		errors.push(`Duplicate bot id "${bot.id}"`);
	}
	ids.add(bot.id);

	const dirName = filePath.split('/').at(-2);
	if (bot.group && bot.group !== dirName) {
		errors.push(`Bot group "${bot.group}" does not match directory "${dirName}"`);
	}

	return errors;
}

try {
	const groups = readdirSync(BOTS_DIR).filter((d) => statSync(join(BOTS_DIR, d)).isDirectory());

	for (const group of groups) {
		const groupDir = join(BOTS_DIR, group);
		const files = readdirSync(groupDir).filter((f) => f.endsWith('.json') && f !== '_meta.json');

		for (const file of files) {
			const filePath = join(groupDir, file);
			const bot = JSON.parse(readFileSync(filePath, 'utf-8'));
			botCount++;

			const errors = lint(filePath, bot);
			if (errors.length > 0) {
				console.error(`\n❌ ${group}/${file}:`);
				for (const err of errors) {
					console.error(`   - ${err}`);
				}
				errorCount += errors.length;
			}
		}

		const metaPath = join(groupDir, '_meta.json');
		try {
			const meta = JSON.parse(readFileSync(metaPath, 'utf-8'));
			if (!meta.slug || !meta.name || !meta.schedule || !Array.isArray(meta.schedule)) {
				console.error(`\n❌ ${group}/_meta.json: Missing required fields (slug, name, schedule)`);
				errorCount++;
			}
		} catch {
			console.error(`\n❌ ${group}/_meta.json: File missing or invalid JSON`);
			errorCount++;
		}
	}

	console.log(`\n${botCount} bots checked.`);

	if (errorCount > 0) {
		console.error(`${errorCount} error(s) found.`);
		process.exit(1);
	} else {
		console.log('All bots pass lint. ✓');
	}
} catch (e) {
	console.error('Failed to lint bots:', e.message);
	process.exit(1);
}
