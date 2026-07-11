/**
 * The shared palette for manifest-supplied pixel sprites (`iconSprite` on a
 * TerminalAppManifest). A sprite is rows of characters — one char per pixel,
 * `.` or space for transparent — and PixelIcon renders it generically, so an
 * app ships its own icon without adding a glyph branch to the component.
 *
 * These are intentional pixel-art internals, NOT theme tokens (see the note in
 * PixelIcon.svelte): an icon has to read correctly on every wallpaper and
 * theme, so the colors are pinned. The letters are mnemonic where possible.
 */
export const SPRITE_PALETTE: Record<string, string> = {
	K: '#0a0a0a', // ink (black)
	W: '#ffffff', // white
	A: '#7a7a7a', // gray
	T: '#dcd6c8', // tan (hardware beige)
	D: '#3a322a', // dark brown
	Y: '#f9bd2b', // yellow
	O: '#f54e00', // orange
	R: '#c92127', // red
	G: '#a6f000', // green
	B: '#1ec8ff', // blue
	P: '#ff4ec8', // pink
	V: '#5e3a8a', // violet
	C: '#f0d8a0', // cream (parchment)
	S: '#b88a3a' // saddle (wood brown)
};

/** Characters a sprite may use for an empty pixel. */
export const SPRITE_TRANSPARENT = new Set(['.', ' ']);
