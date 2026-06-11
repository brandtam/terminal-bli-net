#!/usr/bin/env node
// Generate original pixel-art avatars for every bot + group icon.
//
// These are deliberately ORIGINAL, archetype-based pixel faces — a hairstyle, a
// pair of glasses, a visor, a moustache — not photographic likenesses of any
// actor. That keeps them parody-safe (see the disclaimer in README) while still
// reading as "the bald starship captain" or "the guy with the big hair".
//
// Output: 16x16 crisp SVG, one per bot, written next to where the JSON expects
// them under static/bots/<group>/<id>.svg (+ group-icon.svg per show).
//
// Run: node scripts/generate-bot-avatars.mjs

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(ROOT, 'static/bots');
const SIZE = 16;

// ── palette ────────────────────────────────────────────────────────────────
const SKIN = {
	light: '#f1c9a5',
	mid: '#d99c6a',
	tan: '#c68642',
	deep: '#8d5524',
	gold: '#e6d6a8', // Data — synthetic
	worf: '#b9824e'
};
const HAIR = {
	black: '#1c1c1c',
	darkBrown: '#3a2415',
	brown: '#5a3a1e',
	auburn: '#7a3b1f',
	blonde: '#d7a73f',
	gray: '#9a9a9a',
	white: '#e6e6e6'
};
const INK = '#1a1414';

// ── grid helpers ─────────────────────────────────────────────────────────────
const newGrid = () => Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
function px(g, x, y, c) {
	if (x < 0 || y < 0 || x >= SIZE || y >= SIZE || !c) return;
	g[y][x] = c;
}
function rect(g, x0, y0, x1, y1, c) {
	for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) px(g, x, y, c);
}

// Face mask: x-range of skin per row, giving a rounded head.
const FACE_ROWS = {
	4: [6, 9],
	5: [5, 10],
	6: [5, 10],
	7: [4, 11],
	8: [4, 11],
	9: [4, 11],
	10: [4, 11],
	11: [5, 10],
	12: [5, 10],
	13: [6, 9]
};

function drawHead(g, skin, cloth) {
	for (const [y, [a, b]] of Object.entries(FACE_ROWS)) rect(g, a, +y, b, +y, skin);
	// shoulders + neck
	rect(g, 2, 15, 13, 15, cloth);
	rect(g, 3, 14, 12, 14, cloth);
	rect(g, 7, 14, 8, 14, skin); // neck
}

function drawEyes(g, mode = 'normal', color = INK) {
	px(g, 6, 8, color);
	px(g, 9, 8, color);
	if (mode === 'wide') {
		px(g, 6, 7, color);
		px(g, 9, 7, color);
	}
}

function drawMouth(g, expr = 'flat', color = '#7a3b2f') {
	if (expr === 'smile') {
		rect(g, 7, 11, 8, 11, color);
		px(g, 6, 10, color);
		px(g, 9, 10, color);
	} else if (expr === 'grin') {
		rect(g, 6, 11, 9, 11, color);
		px(g, 6, 10, color);
		px(g, 9, 10, color);
	} else if (expr === 'smirk') {
		rect(g, 7, 11, 9, 11, color);
		px(g, 6, 10, color);
	} else if (expr === 'worried') {
		rect(g, 7, 11, 8, 11, color);
		px(g, 9, 11, color);
	} else {
		rect(g, 7, 11, 8, 11, color); // flat
	}
}

// hairlines drawn over the top of the head
function drawHair(g, style, color) {
	switch (style) {
		case 'bald':
			return; // dome stays skin
		case 'receding':
			rect(g, 4, 6, 5, 8, color); // sides only
			rect(g, 10, 6, 11, 8, color);
			return;
		case 'short':
			rect(g, 5, 3, 10, 4, color);
			px(g, 4, 5, color);
			px(g, 11, 5, color);
			rect(g, 5, 5, 10, 5, color);
			rect(g, 4, 6, 4, 7, color);
			rect(g, 11, 6, 11, 7, color);
			return;
		case 'sidepart':
			rect(g, 5, 3, 10, 4, color);
			rect(g, 5, 5, 10, 5, color);
			px(g, 8, 5, SKIN.__part || null); // part handled by caller skin overlay
			rect(g, 4, 6, 4, 7, color);
			rect(g, 11, 6, 11, 7, color);
			return;
		case 'flattop':
			rect(g, 4, 2, 11, 4, color);
			rect(g, 4, 5, 4, 7, color);
			rect(g, 11, 5, 11, 7, color);
			return;
		case 'long': // shoulder-length, frames the face
			rect(g, 4, 3, 11, 5, color);
			rect(g, 3, 6, 4, 13, color);
			rect(g, 11, 6, 12, 13, color);
			rect(g, 5, 5, 10, 5, color);
			return;
		case 'bangs':
			rect(g, 4, 3, 11, 5, color);
			rect(g, 3, 6, 4, 12, color);
			rect(g, 11, 6, 12, 12, color);
			rect(g, 5, 6, 10, 6, color); // fringe across forehead
			return;
		case 'updo':
			rect(g, 5, 1, 10, 2, color); // bun on top
			rect(g, 4, 3, 11, 5, color);
			rect(g, 4, 6, 4, 8, color);
			rect(g, 11, 6, 11, 8, color);
			return;
		case 'big': // tall wild hair
			rect(g, 4, 0, 11, 1, color);
			rect(g, 3, 2, 12, 3, color);
			rect(g, 4, 4, 11, 5, color);
			px(g, 3, 4, color);
			px(g, 12, 4, color);
			rect(g, 4, 6, 4, 8, color);
			rect(g, 11, 6, 11, 8, color);
			return;
		case 'curly':
			rect(g, 4, 2, 11, 3, color);
			px(g, 3, 3, color);
			px(g, 12, 3, color);
			rect(g, 4, 4, 11, 5, color);
			rect(g, 3, 6, 3, 9, color);
			rect(g, 12, 6, 12, 9, color);
			return;
		case 'slick':
			rect(g, 5, 3, 10, 4, color);
			rect(g, 5, 5, 10, 5, color);
			rect(g, 11, 5, 11, 7, color);
			rect(g, 4, 5, 4, 7, color);
			return;
		default:
			return;
	}
}

function drawGlasses(g, color = INK) {
	// Two bold lens bars joined by a bridge — reads clearly as glasses at 16px.
	rect(g, 4, 8, 6, 8, color); // left lens
	rect(g, 9, 8, 11, 8, color); // right lens
	rect(g, 7, 8, 8, 8, color); // bridge
	px(g, 4, 7, color); // temple hints
	px(g, 11, 7, color);
	// glass glint inside each lens
	px(g, 5, 8, '#cfe6f0');
	px(g, 10, 8, '#cfe6f0');
}

function drawVisor(g, color = '#d4af37') {
	// Geordi's band across the eyes, with temple anchors
	rect(g, 4, 7, 11, 8, color);
	px(g, 3, 8, INK);
	px(g, 12, 8, INK);
	// highlight
	rect(g, 5, 7, 10, 7, '#f3e08a');
}

function drawMoustache(g, color) {
	rect(g, 6, 10, 9, 10, color);
}

function drawBeard(g, color) {
	rect(g, 5, 11, 10, 11, color);
	rect(g, 5, 12, 10, 12, color);
	rect(g, 6, 13, 9, 13, color);
	// re-open the mouth
	px(g, 7, 11, '#7a3b2f');
	px(g, 8, 11, '#7a3b2f');
}

function drawStubble(g, color) {
	px(g, 5, 12, color);
	px(g, 10, 12, color);
	rect(g, 6, 13, 9, 13, color);
}

function drawRidges(g, color) {
	// Worf forehead — a subtle darker V
	px(g, 6, 5, color);
	px(g, 9, 5, color);
	px(g, 7, 6, color);
	px(g, 8, 6, color);
}

function drawCap(g, color, brim = '#2a2a1a') {
	// soft military cap over the hairline
	rect(g, 4, 2, 11, 3, color);
	rect(g, 5, 1, 10, 1, color);
	rect(g, 4, 4, 11, 4, brim); // brim
}

// ── per-character specs ──────────────────────────────────────────────────────
// cloth = shirt/uniform color shown on the shoulders.
const C = (o) => o;
const SPEC = {
	office: {
		jim: C({
			skin: SKIN.light,
			hair: 'short',
			hairColor: HAIR.brown,
			cloth: '#6b7a99',
			mouth: 'smile'
		}),
		michael: C({
			skin: SKIN.light,
			hair: 'sidepart',
			hairColor: HAIR.darkBrown,
			cloth: '#2f3b66',
			mouth: 'grin'
		}),
		dwight: C({
			skin: SKIN.light,
			hair: 'short',
			hairColor: HAIR.darkBrown,
			cloth: '#9c7a2e',
			glasses: true,
			mouth: 'flat'
		}),
		pam: C({
			skin: SKIN.light,
			hair: 'long',
			hairColor: HAIR.brown,
			cloth: '#b9806b',
			mouth: 'smile'
		})
	},
	seinfeld: {
		jerry: C({
			skin: SKIN.light,
			hair: 'short',
			hairColor: HAIR.black,
			cloth: '#3f6fa3',
			mouth: 'smirk'
		}),
		george: C({
			skin: SKIN.light,
			hair: 'receding',
			hairColor: HAIR.gray,
			cloth: '#a98b5b',
			mouth: 'worried'
		}),
		elaine: C({
			skin: SKIN.light,
			hair: 'curly',
			hairColor: HAIR.darkBrown,
			cloth: '#5b4a6b',
			mouth: 'smile'
		}),
		kramer: C({
			skin: SKIN.light,
			hair: 'big',
			hairColor: HAIR.darkBrown,
			cloth: '#b08d57',
			mouth: 'flat',
			eyes: 'wide'
		})
	},
	mash: {
		hawkeye: C({
			skin: SKIN.light,
			hair: 'short',
			hairColor: HAIR.darkBrown,
			cloth: '#5d6b3a',
			cap: '#4a5a2a',
			mouth: 'smirk'
		}),
		radar: C({
			skin: SKIN.light,
			hair: 'short',
			hairColor: HAIR.brown,
			cloth: '#5d6b3a',
			cap: '#4a5a2a',
			glasses: true,
			mouth: 'flat'
		}),
		sidney: C({
			skin: SKIN.light,
			hair: 'receding',
			hairColor: HAIR.gray,
			cloth: '#5d6b3a',
			glasses: true,
			mouth: 'flat'
		})
	},
	'star-trek-tng': {
		picard: C({ skin: SKIN.light, hair: 'bald', cloth: '#9c2b2b', mouth: 'flat' }), // command red
		riker: C({
			skin: SKIN.light,
			hair: 'short',
			hairColor: HAIR.darkBrown,
			cloth: '#9c2b2b',
			beard: HAIR.darkBrown,
			mouth: 'flat'
		}),
		data: C({
			skin: SKIN.gold,
			hair: 'sidepart',
			hairColor: HAIR.black,
			cloth: '#c2a14a',
			eyes: 'normal',
			eyeColor: '#caa92f',
			mouth: 'flat'
		}), // ops gold
		geordi: C({
			skin: SKIN.deep,
			hair: 'short',
			hairColor: HAIR.black,
			cloth: '#c2a14a',
			visor: true
		}),
		worf: C({
			skin: SKIN.worf,
			hair: 'flattop',
			hairColor: HAIR.black,
			cloth: '#c2a14a',
			ridges: '#8a5c34',
			mouth: 'flat'
		})
	},
	'arrested-development': {
		'michael-bluth': C({
			skin: SKIN.light,
			hair: 'short',
			hairColor: HAIR.brown,
			cloth: '#3f6fa3',
			mouth: 'flat'
		}),
		gob: C({
			skin: SKIN.light,
			hair: 'slick',
			hairColor: HAIR.black,
			cloth: '#2a2a2a',
			mouth: 'smirk'
		}),
		lucille: C({
			skin: SKIN.light,
			hair: 'updo',
			hairColor: HAIR.gray,
			cloth: '#9c2b2b',
			mouth: 'flat'
		}),
		buster: C({
			skin: SKIN.light,
			hair: 'short',
			hairColor: HAIR.brown,
			cloth: '#c9c2b0',
			mouth: 'worried',
			eyes: 'wide'
		}),
		tobias: C({
			skin: SKIN.light,
			hair: 'short',
			hairColor: HAIR.brown,
			cloth: '#3f6fa3',
			moustache: HAIR.brown,
			mouth: 'flat'
		})
	},
	'parks-and-rec': {
		leslie: C({
			skin: SKIN.light,
			hair: 'bangs',
			hairColor: HAIR.blonde,
			cloth: '#3f6fa3',
			mouth: 'grin'
		}),
		ron: C({
			skin: SKIN.light,
			hair: 'short',
			hairColor: HAIR.brown,
			cloth: '#6b4a2e',
			moustache: HAIR.brown,
			mouth: 'flat'
		}),
		tom: C({
			skin: SKIN.tan,
			hair: 'short',
			hairColor: HAIR.black,
			cloth: '#7a4fa3',
			mouth: 'smirk'
		}),
		april: C({
			skin: SKIN.light,
			hair: 'bangs',
			hairColor: HAIR.black,
			cloth: '#3a3340',
			mouth: 'flat'
		}),
		andy: C({
			skin: SKIN.light,
			hair: 'short',
			hairColor: HAIR.brown,
			cloth: '#4a4a4a',
			stubble: HAIR.brown,
			mouth: 'grin'
		})
	}
};

// group background tint (lightened group color) for face backdrops
const GROUP_COLOR = {
	'arrested-development': '#c0392b',
	mash: '#556b2f',
	office: '#4a7c59',
	'parks-and-rec': '#2e86de',
	seinfeld: '#f5c518',
	'star-trek-tng': '#8e44ad'
};

function tint(hex, amt) {
	const n = parseInt(hex.slice(1), 16);
	let r = (n >> 16) & 255,
		g = (n >> 8) & 255,
		b = n & 255;
	r = Math.round(r + (255 - r) * amt);
	g = Math.round(g + (255 - g) * amt);
	b = Math.round(b + (255 - b) * amt);
	return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
}

function buildFace(group, spec) {
	const g = newGrid();
	rect(g, 0, 0, 15, 15, tint(GROUP_COLOR[group], 0.78)); // soft backdrop
	drawHead(g, spec.skin, spec.cloth);
	if (spec.ridges) drawRidges(g, spec.ridges);
	drawHair(g, spec.hair, spec.hairColor);
	if (spec.cap) drawCap(g, spec.cap);
	if (spec.visor) drawVisor(g);
	else drawEyes(g, spec.eyes ?? 'normal', spec.eyeColor ?? INK);
	if (spec.moustache) drawMoustache(g, spec.moustache);
	if (spec.beard) drawBeard(g, spec.beard);
	if (spec.stubble) drawStubble(g, spec.stubble);
	if (!spec.beard) drawMouth(g, spec.mouth, '#7a3b2f');
	return g;
}

// group icon: a chunky retro TV set in the group colour
function buildGroupIcon(group) {
	const g = newGrid();
	const col = GROUP_COLOR[group];
	rect(g, 0, 0, 15, 15, tint(col, 0.82));
	// antenna
	px(g, 6, 1, INK);
	px(g, 5, 0, INK);
	px(g, 9, 1, INK);
	px(g, 10, 0, INK);
	px(g, 7, 2, INK);
	px(g, 8, 2, INK);
	// set body
	rect(g, 2, 3, 13, 13, INK);
	rect(g, 3, 4, 12, 12, col);
	// screen
	rect(g, 4, 5, 9, 11, tint(col, 0.55));
	rect(g, 5, 6, 8, 10, tint(col, 0.3));
	// speaker / dials on the right
	px(g, 11, 6, INK);
	px(g, 11, 8, INK);
	px(g, 11, 10, INK);
	return g;
}

// ── serialize to SVG (row run-length) ────────────────────────────────────────
function toSvg(g) {
	let rects = '';
	for (let y = 0; y < SIZE; y++) {
		let x = 0;
		while (x < SIZE) {
			const c = g[y][x];
			if (!c) {
				x++;
				continue;
			}
			let w = 1;
			while (x + w < SIZE && g[y][x + w] === c) w++;
			rects += `<rect x="${x}" y="${y}" width="${w}" height="1" fill="${c}"/>`;
			x += w;
		}
	}
	return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" shape-rendering="crispEdges">${rects}</svg>\n`;
}

// ── write everything ─────────────────────────────────────────────────────────
let count = 0;
for (const [group, bots] of Object.entries(SPEC)) {
	writeFileSync(resolve(OUT, group, 'group-icon.svg'), toSvg(buildGroupIcon(group)));
	count++;
	for (const [id, spec] of Object.entries(bots)) {
		const dir = resolve(OUT, group);
		mkdirSync(dir, { recursive: true });
		writeFileSync(resolve(dir, `${id}.svg`), toSvg(buildFace(group, spec)));
		count++;
	}
}
console.log(`Generated ${count} pixel-art avatars under static/bots/`);
