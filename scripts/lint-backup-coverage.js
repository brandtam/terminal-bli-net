#!/usr/bin/env node

/**
 * Verifies every persistence key in persistence.ts is listed in the
 * BACKUP COVERAGE REGISTRY in backup.ts. Fails if a key is missing,
 * forcing a conscious decision about whether it should be backed up.
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(import.meta.dirname, '..');
const PERSISTENCE_PATH = resolve(ROOT, 'src/lib/persistence.ts');
const BACKUP_PATH = resolve(ROOT, 'src/lib/terminalos/filesystem/backup.ts');

let errors = 0;

// --- Extract keys from persistence.ts ---

const persistenceSrc = readFileSync(PERSISTENCE_PATH, 'utf-8');
const keysBlockMatch = persistenceSrc.match(/const KEYS\s*=\s*\{([^}]+)\}/);
if (!keysBlockMatch) {
	console.error('Could not find KEYS constant in persistence.ts');
	process.exit(1);
}

const keyEntries = [...keysBlockMatch[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
if (keyEntries.length === 0) {
	console.error('No keys found in KEYS constant');
	process.exit(1);
}

// --- Extract registry entries from backup.ts ---

const backupSrc = readFileSync(BACKUP_PATH, 'utf-8');
const registryMatch = backupSrc.match(/BACKUP COVERAGE REGISTRY[\s\S]*?\*\//);
if (!registryMatch) {
	console.error('Could not find BACKUP COVERAGE REGISTRY comment block in backup.ts');
	process.exit(1);
}

const registry = registryMatch[0];

// --- Check each key appears in the registry ---

for (const key of keyEntries) {
	if (!registry.includes(key)) {
		console.error(
			`Missing from BACKUP COVERAGE REGISTRY: "${key}"\n` +
				`  Add it to the registry in backup.ts with a backup status (Yes/No) and reason.`
		);
		errors++;
	}
}

// --- Also check for the manifest key ---

if (!registry.includes('terminalos.manifest')) {
	console.error(
		'Missing from BACKUP COVERAGE REGISTRY: "terminalos.manifest"\n' +
			'  The filesystem manifest must be listed in the registry.'
	);
	errors++;
}

// --- Report ---

console.log(`${keyEntries.length} persistence keys checked against backup registry.`);

if (errors > 0) {
	console.error(
		`${errors} key(s) not covered. Add them to the BACKUP COVERAGE REGISTRY in backup.ts.`
	);
	process.exit(1);
} else {
	console.log('All persistence keys are covered in backup registry.');
}
