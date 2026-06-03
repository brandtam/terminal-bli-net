#!/usr/bin/env node

import { readFileSync } from 'node:fs';

const guide = readFileSync(new URL('../docs/start-here.md', import.meta.url), 'utf-8');

process.stdout.write(`${guide.trimEnd()}\n`);
