<script lang="ts">
	import ShelfHTML from './ShelfHTML.svelte';
	import BackWallHTML from './BackWallHTML.svelte';
	import CounterScene from './CounterScene.svelte';
	import Hotspot from './Hotspot.svelte';
	import { CATEGORIES, shelfLineup } from './store-data';

	let { onenter }: { onenter: (view: string) => void } = $props();

	let hot = $state<string | null>(null);

	const shelfT = {
		games: { scale: 1.0, tilt: 20, x: 12, y: 110 },
		ent: { scale: 1.0, tilt: -22, x: 0, y: 80 },
		business: { scale: 1.0, tilt: 0, x: 186, y: 97 },
		counter: { scale: 1.0, tilt: 0, x: 380, y: 56 }
	};

	const G = shelfT.games;
	const E = shelfT.ent;
	const B = shelfT.business;
	const C = shelfT.counter;

	const ceilPerspXs = [40, 120, 200, 280, 360, 440, 520, 600, 680];
	const floorPerspXs = [40, 120, 200, 280, 360, 440, 520, 600, 680];
	const wallStripeXs = [80, 160, 240, 320, 400, 480, 560, 640];

	const INK = '#0a0a0a';
	const YELLOW = '#f9bd2b';
	const ACCENT = '#f54e00';
</script>

<div class="aisle">
	<svg
		viewBox="0 0 720 522"
		preserveAspectRatio="xMidYMid slice"
		class="bg-svg"
		xmlns="http://www.w3.org/2000/svg"
	>
		<!-- PATTERN DEFINITIONS -->
		<defs>
			<pattern id="floorTile" x="0" y="0" width="28" height="28" patternUnits="userSpaceOnUse">
				<rect width="28" height="28" fill="#cbd5cb" />
				<rect x="0" y="0" width="14" height="14" fill="#b6c0b6" />
				<rect x="14" y="14" width="14" height="14" fill="#b6c0b6" />
				<rect x="13" y="0" width="1" height="28" fill="#9aa89a" />
				<rect x="0" y="13" width="28" height="1" fill="#9aa89a" />
			</pattern>
			<pattern id="floorCarpet" x="0" y="0" width="36" height="36" patternUnits="userSpaceOnUse">
				<rect width="36" height="36" fill="#cbd5cb" />
				<rect x="2" y="2" width="2" height="2" fill="#a8b3a8" />
				<rect x="14" y="8" width="2" height="2" fill="#a8b3a8" />
				<rect x="26" y="2" width="2" height="2" fill="#a8b3a8" />
				<rect x="8" y="18" width="2" height="2" fill="#a8b3a8" />
				<rect x="20" y="22" width="2" height="2" fill="#a8b3a8" />
				<rect x="32" y="14" width="2" height="2" fill="#a8b3a8" />
				<rect x="6" y="30" width="2" height="2" fill="#a8b3a8" />
				<rect x="22" y="32" width="2" height="2" fill="#a8b3a8" />
			</pattern>
		</defs>

		<!-- CEILING -->
		<rect x="0" y="0" width="720" height="56" fill="#e8c897" />
		{#each ceilPerspXs as cx (cx)}
			<line
				x1={cx}
				y1="0"
				x2={cx + (380 - cx) * (56 / 206)}
				y2="56"
				stroke="#bca270"
				stroke-width="1"
			/>
		{/each}
		{#each [14, 30, 44] as cy (cy)}
			<line x1="0" y1={cy} x2="720" y2={cy} stroke="#bca270" stroke-width="1" />
		{/each}
		<line x1="0" y1="56" x2="720" y2="56" stroke={INK} stroke-width="2" />

		<!-- FLUORESCENT LIGHTS -->
		{#each [160, 360, 560] as lx (lx)}
			<g>
				<line x1={lx} y1="56" x2={lx} y2="74" stroke={INK} stroke-width="2" />
				<rect
					x={lx - 28}
					y="74"
					width="56"
					height="8"
					fill="#dcd6c8"
					stroke={INK}
					stroke-width="2"
				/>
				<rect x={lx - 24} y="76" width="48" height="4" fill="#fff9d6" />
			</g>
		{/each}

		<!-- BACK WALL -->
		<rect x="0" y="56" width="720" height="160" fill="#f5b34f" />
		<!-- wall stripe trim -->
		<rect x="0" y="200" width="720" height="6" fill={ACCENT} />
		<line x1="0" y1="206" x2="720" y2="206" stroke={INK} stroke-width="2" />
		<!-- wallpaper vertical stripes -->
		{#each wallStripeXs as wx (wx)}
			<line x1={wx} y1="56" x2={wx} y2="200" stroke="#e09f3f" stroke-width="1" />
		{/each}

		<!-- FLOOR -->
		<rect x="0" y="206" width="720" height="316" fill="#cbd5cb" />
		{#each floorPerspXs as fx (fx)}
			<line x1={fx} y1="522" x2="380" y2="206" stroke="#9aa89a" stroke-width="1" />
		{/each}
		{#each [230, 260, 300, 350, 410, 478] as fy (fy)}
			<line x1="0" y1={fy} x2="720" y2={fy} stroke="#9aa89a" stroke-width="1" />
		{/each}

		<!-- HANGING PROMO SIGNS -->
		<g>
			<line x1="80" y1="56" x2="80" y2="62" stroke={INK} stroke-width="2" />
			<line x1="124" y1="56" x2="124" y2="62" stroke={INK} stroke-width="2" />
			<polygon
				points="48,62 156,62 162,76 156,90 48,90 42,76"
				fill="#a6f000"
				stroke={INK}
				stroke-width="2"
			/>
			<text
				x="102"
				y="82"
				font-family="'Press Start 2P', monospace"
				font-size="12"
				fill={INK}
				text-anchor="middle"
				letter-spacing="1.5"
			>
				&#x2605; SALE!
			</text>
		</g>
		<g>
			<line x1="600" y1="56" x2="600" y2="62" stroke={INK} stroke-width="2" />
			<line x1="644" y1="56" x2="644" y2="62" stroke={INK} stroke-width="2" />
			<polygon
				points="568,62 676,62 682,76 676,90 568,90 562,76"
				fill={YELLOW}
				stroke={INK}
				stroke-width="2"
			/>
			<text
				x="622"
				y="82"
				font-family="'Press Start 2P', monospace"
				font-size="11"
				fill={INK}
				text-anchor="middle"
				letter-spacing="1"
			>
				&#x2605; NEW
			</text>
		</g>

		<!-- SHOPPING BASKET -->
		<g transform="translate(232 472)">
			<rect x="-2" y="0" width="8" height="4" fill={INK} />
			<rect x="22" y="0" width="8" height="4" fill={INK} />
			<rect x="0" y="2" width="28" height="16" fill="#f9bd2b" stroke={INK} stroke-width="2" />
			<rect x="3" y="5" width="22" height="11" fill={INK} />
			<rect x="3" y="6" width="22" height="1" fill="#f9bd2b" />
			<rect x="3" y="9" width="22" height="1" fill="#f9bd2b" />
			<rect x="3" y="12" width="22" height="1" fill="#f9bd2b" />
			<rect x="3" y="15" width="22" height="1" fill="#f9bd2b" />
		</g>

		<!-- RETRO COMPUTER SHELF (top) + PARTS SHELF (bottom) on back wall -->
		<g>
			<!-- TOP SHELF brackets -->
			<rect x="304" y="150" width="3" height="6" fill="#7a4f2a" />
			<rect x="416" y="150" width="3" height="6" fill="#7a4f2a" />
			<rect x="527" y="150" width="3" height="6" fill="#7a4f2a" />
			<!-- TOP SHELF plank -->
			<rect x="298" y="148" width="240" height="5" fill="#a06a3a" stroke={INK} stroke-width="2" />
			<!-- under-shelf shadow -->
			<rect x="300" y="153" width="236" height="1" fill="rgba(0,0,0,0.18)" />

			<!-- COMPUTER 1: COMMODORE 64 -->
			<g transform="translate(304 120)">
				<rect x="6" y="0" width="20" height="11" fill="#3a322a" stroke={INK} stroke-width="2" />
				<rect x="8" y="2" width="16" height="7" fill="#1e3a4e" />
				<rect x="9" y="3" width="3" height="1" fill="#a6c8f0" />
				<rect x="9" y="5" width="7" height="1" fill="#a6c8f0" />
				<rect x="9" y="7" width="4" height="1" fill="#a6c8f0" />
				<rect x="14" y="11" width="4" height="2" fill="#3a322a" />
				<rect x="0" y="14" width="32" height="14" fill="#d4cdb8" stroke={INK} stroke-width="2" />
				<rect x="2" y="16" width="20" height="1" fill={INK} />
				<rect x="2" y="18" width="20" height="1" fill={INK} />
				<rect x="2" y="20" width="20" height="1" fill={INK} />
				<rect x="2" y="22" width="20" height="1" fill={INK} />
				<rect x="23" y="16" width="7" height="8" fill="#b88848" stroke={INK} stroke-width="0.5" />
				<rect x="3" y="25" width="3" height="2" fill="#f54e00" />
				<rect x="7" y="25" width="3" height="2" fill="#c92127" />
				<rect x="11" y="25" width="3" height="2" fill="#5e3a8a" />
			</g>

			<!-- COMPUTER 2: MAC SE -->
			<g transform="translate(348 120)">
				<rect x="0" y="0" width="30" height="28" fill="#d4cdb8" stroke={INK} stroke-width="2" />
				<rect x="1" y="1" width="28" height="2" fill="#e8e0c8" />
				<rect x="4" y="4" width="22" height="13" fill={INK} />
				<rect x="6" y="6" width="18" height="9" fill="#1e3a1e" />
				<rect x="7" y="8" width="4" height="1" fill="#a6f000" />
				<rect x="12" y="8" width="2" height="1" fill="#a6f000" />
				<rect x="15" y="8" width="3" height="1" fill="#a6f000" />
				<rect x="7" y="11" width="6" height="1" fill="#a6f000" />
				<rect x="14" y="11" width="3" height="1" fill="#a6f000" />
				<rect x="8" y="21" width="14" height="2" fill={INK} />
				<rect x="3" y="20" width="1" height="1" fill="#a6f000" />
				<rect x="3" y="21" width="1" height="1" fill="#f9bd2b" />
				<rect x="3" y="22" width="1" height="1" fill="#f54e00" />
				<rect x="3" y="23" width="1" height="1" fill="#c92127" />
				<rect x="26" y="24" width="2" height="2" fill="#a6f000" />
			</g>

			<!-- COMPUTER 3: APPLE II -->
			<g transform="translate(392 120)">
				<rect x="5" y="0" width="20" height="12" fill="#888888" stroke={INK} stroke-width="2" />
				<rect x="7" y="2" width="16" height="8" fill="#1e3a1e" />
				<rect x="8" y="4" width="6" height="1" fill="#a6f000" />
				<rect x="8" y="6" width="10" height="1" fill="#a6f000" />
				<rect x="8" y="8" width="4" height="1" fill="#a6f000" />
				<rect x="13" y="12" width="4" height="2" fill="#888888" />
				<rect x="0" y="14" width="30" height="14" fill="#d4cdb8" stroke={INK} stroke-width="2" />
				<rect x="2" y="16" width="20" height="10" fill="#c2b9a0" />
				<rect x="4" y="18" width="16" height="1" fill={INK} />
				<rect x="4" y="20" width="16" height="1" fill={INK} />
				<rect x="4" y="22" width="16" height="1" fill={INK} />
				<rect x="4" y="24" width="10" height="1" fill={INK} />
				<rect x="23" y="16" width="5" height="1" fill="#a6f000" />
				<rect x="23" y="17" width="5" height="1" fill="#f9bd2b" />
				<rect x="23" y="18" width="5" height="1" fill="#f54e00" />
				<rect x="23" y="19" width="5" height="1" fill="#c92127" />
				<rect x="23" y="20" width="5" height="1" fill="#5e3a8a" />
			</g>

			<!-- COMPUTER 4: TRS-80 -->
			<g transform="translate(440 118)">
				<rect x="0" y="0" width="32" height="30" fill="#7a7a7a" stroke={INK} stroke-width="2" />
				<rect x="1" y="1" width="30" height="2" fill="#9a9a9a" />
				<rect x="3" y="3" width="26" height="14" fill={INK} />
				<rect x="5" y="5" width="22" height="10" fill="#3a2818" />
				<rect x="7" y="7" width="6" height="1" fill="#f9bd2b" />
				<rect x="7" y="9" width="12" height="1" fill="#f9bd2b" />
				<rect x="7" y="11" width="4" height="1" fill="#f9bd2b" />
				<rect x="7" y="13" width="2" height="1" fill="#f9bd2b" />
				<rect x="2" y="19" width="28" height="8" fill="#5a5a5a" />
				<rect x="4" y="20" width="24" height="1" fill={INK} />
				<rect x="4" y="22" width="24" height="1" fill={INK} />
				<rect x="4" y="24" width="24" height="1" fill={INK} />
				<rect x="4" y="27" width="8" height="2" fill={INK} />
				<rect x="5" y="27" width="1" height="2" fill="#f9bd2b" />
				<rect x="7" y="27" width="1" height="2" fill="#f9bd2b" />
				<rect x="9" y="27" width="1" height="2" fill="#f9bd2b" />
				<rect x="27" y="20" width="2" height="2" fill="#f54e00" />
			</g>

			<!-- COMPUTER 5: IBM PC -->
			<g transform="translate(488 118)">
				<rect x="5" y="0" width="22" height="14" fill="#3a322a" stroke={INK} stroke-width="2" />
				<rect x="7" y="2" width="18" height="10" fill="#1e3a1e" />
				<rect x="8" y="4" width="3" height="1" fill="#a6f000" />
				<rect x="8" y="6" width="2" height="1" fill="#a6f000" />
				<rect x="8" y="8" width="6" height="1" fill="#a6f000" />
				<rect x="11" y="14" width="10" height="2" fill="#3a322a" />
				<rect x="0" y="16" width="32" height="14" fill="#d4cdb8" stroke={INK} stroke-width="2" />
				<rect x="1" y="17" width="30" height="2" fill="#e8e0c8" />
				<rect x="3" y="20" width="14" height="3" fill={INK} />
				<rect x="3" y="24" width="14" height="3" fill={INK} />
				<rect x="20" y="21" width="9" height="3" fill="#5e3a8a" />
				<rect x="21" y="22" width="2" height="1" fill="#ffffff" />
				<rect x="24" y="22" width="2" height="1" fill="#ffffff" />
				<rect x="27" y="22" width="2" height="1" fill="#ffffff" />
				<rect x="27" y="26" width="2" height="2" fill="#a6f000" />
			</g>

			<!-- BOTTOM SHELF: random boxes of computer parts -->
			<g>
				<!-- shelf plank -->
				<rect x="298" y="174" width="240" height="4" fill="#a06a3a" stroke={INK} stroke-width="2" />
				<rect x="300" y="178" width="236" height="1" fill="rgba(0,0,0,0.18)" />

				<!-- stack of floppy disks -->
				<g transform="translate(306 156)">
					<rect x="0" y="0" width="14" height="3" fill="#2a3a5a" stroke={INK} stroke-width="0.5" />
					<rect x="0" y="3" width="14" height="3" fill="#3a2818" stroke={INK} stroke-width="0.5" />
					<rect x="0" y="6" width="14" height="3" fill="#5e3a8a" stroke={INK} stroke-width="0.5" />
					<rect x="0" y="9" width="14" height="3" fill="#c92127" stroke={INK} stroke-width="0.5" />
					<rect x="0" y="12" width="14" height="3" fill="#2a5a2a" stroke={INK} stroke-width="0.5" />
					<rect x="0" y="15" width="14" height="3" fill="#3a2818" stroke={INK} stroke-width="0.5" />
				</g>

				<!-- CABLES box -->
				<g transform="translate(326 160)">
					<rect x="0" y="0" width="22" height="14" fill="#c8a06a" stroke={INK} stroke-width="1.5" />
					<rect x="0" y="5" width="22" height="1" fill="#7a4f2a" />
					<rect x="2" y="2" width="18" height="3" fill="#ffffff" />
					<rect x="4" y="3" width="2" height="1" fill={INK} />
					<rect x="7" y="3" width="2" height="1" fill={INK} />
					<rect x="10" y="3" width="2" height="1" fill={INK} />
					<rect x="13" y="3" width="2" height="1" fill={INK} />
				</g>

				<!-- RAM sticks standing up -->
				<g transform="translate(354 156)">
					<rect x="0" y="0" width="3" height="18" fill="#2a5a2a" stroke={INK} stroke-width="0.5" />
					<rect x="4" y="0" width="3" height="18" fill="#2a5a2a" stroke={INK} stroke-width="0.5" />
					<rect x="8" y="0" width="3" height="18" fill="#2a5a2a" stroke={INK} stroke-width="0.5" />
					<rect x="12" y="0" width="3" height="18" fill="#2a5a2a" stroke={INK} stroke-width="0.5" />
					<rect x="0" y="16" width="15" height="2" fill="#f9bd2b" />
				</g>

				<!-- hard drive / power supply -->
				<g transform="translate(376 160)">
					<rect x="0" y="0" width="22" height="14" fill="#5a5a5a" stroke={INK} stroke-width="1.5" />
					<rect x="1" y="1" width="20" height="3" fill="#3a3a3a" />
					<rect x="2" y="6" width="18" height="1" fill="#3a3a3a" />
					<rect x="2" y="9" width="18" height="1" fill="#3a3a3a" />
					<rect x="2" y="12" width="6" height="1" fill="#3a3a3a" />
					<rect x="18" y="12" width="2" height="1" fill="#a6f000" />
				</g>

				<!-- DRIVES box (tilted) -->
				<g transform="translate(404 156) rotate(-4)">
					<rect x="0" y="0" width="24" height="18" fill="#a88848" stroke={INK} stroke-width="1.5" />
					<rect x="0" y="6" width="24" height="1" fill="#7a4f2a" />
					<rect x="2" y="2" width="20" height="3" fill="#ffffff" />
					<rect x="4" y="3" width="2" height="1" fill={INK} />
					<rect x="7" y="3" width="2" height="1" fill={INK} />
					<rect x="10" y="3" width="2" height="1" fill={INK} />
					<rect x="13" y="3" width="2" height="1" fill={INK} />
					<rect x="16" y="3" width="2" height="1" fill={INK} />
					<rect x="0" y="10" width="24" height="1" fill="#d4c08a" />
				</g>

				<!-- CD/disk pile -->
				<g transform="translate(434 162)">
					<rect x="0" y="0" width="11" height="11" fill="#dcdcdc" stroke={INK} stroke-width="0.5" />
					<rect x="2" y="2" width="7" height="7" fill="#1e3a4e" />
					<rect x="4" y="4" width="3" height="3" fill={INK} />
					<rect x="1" y="11" width="10" height="1" fill="#dcdcdc" stroke={INK} stroke-width="0.5" />
				</g>

				<!-- manuals stack -->
				<g transform="translate(450 156)">
					<rect x="0" y="0" width="20" height="3" fill="#c92127" stroke={INK} stroke-width="0.5" />
					<rect x="0" y="3" width="20" height="3" fill="#2a3a8a" stroke={INK} stroke-width="0.5" />
					<rect x="0" y="6" width="20" height="3" fill="#5e3a8a" stroke={INK} stroke-width="0.5" />
					<rect x="0" y="9" width="20" height="3" fill="#2a5a2a" stroke={INK} stroke-width="0.5" />
					<rect x="0" y="12" width="20" height="3" fill="#a04030" stroke={INK} stroke-width="0.5" />
					<rect x="0" y="15" width="20" height="3" fill="#c92127" stroke={INK} stroke-width="0.5" />
				</g>

				<!-- PARTS box -->
				<g transform="translate(478 160)">
					<rect x="0" y="0" width="26" height="14" fill="#c8a06a" stroke={INK} stroke-width="1.5" />
					<rect x="0" y="5" width="26" height="1" fill="#7a4f2a" />
					<rect x="2" y="2" width="22" height="3" fill="#ffffff" />
					<rect x="4" y="3" width="2" height="1" fill={INK} />
					<rect x="7" y="3" width="2" height="1" fill={INK} />
					<rect x="10" y="3" width="2" height="1" fill={INK} />
					<rect x="13" y="3" width="2" height="1" fill={INK} />
					<rect x="16" y="3" width="2" height="1" fill={INK} />
					<rect x="19" y="3" width="2" height="1" fill={INK} />
					<rect
						x="13"
						y="-3"
						width="14"
						height="5"
						fill="#f9bd2b"
						stroke={INK}
						stroke-width="0.5"
						transform="rotate(-6 20 0)"
					/>
				</g>

				<!-- shelf-2 brackets -->
				<rect x="304" y="178" width="3" height="3" fill="#7a4f2a" />
				<rect x="416" y="178" width="3" height="3" fill="#7a4f2a" />
				<rect x="527" y="178" width="3" height="3" fill="#7a4f2a" />
			</g>
		</g>

		<!-- DOORMAT -->
		<rect x="280" y="490" width="160" height="20" fill="#7a4f2a" stroke={INK} stroke-width="2" />
		<text
			x="360"
			y="504"
			font-family="'Press Start 2P', monospace"
			font-size="9"
			fill={YELLOW}
			text-anchor="middle"
		>
			&#x25B8; WELCOME &#x25C2;
		</text>
	</svg>

	<!-- SHELVES + BOXES (HTML overlay) -->
	<ShelfHTML
		side="left"
		apps={shelfLineup('games', 6)}
		label="GAMES"
		color={CATEGORIES.games.color}
		gap={G.x}
		top={G.y}
		width={232 * G.scale}
		boxW={68 * G.scale}
		boxH={96 * G.scale}
		tilt={G.tilt}
	/>
	<ShelfHTML
		side="right"
		apps={shelfLineup('ent', 6)}
		label="ENTERTAINMENT"
		color={CATEGORIES.ent.color}
		gap={E.x}
		top={E.y}
		width={184 * E.scale}
		boxW={52 * E.scale}
		boxH={76 * E.scale}
		tilt={E.tilt}
	/>
	<BackWallHTML
		apps={shelfLineup('business', 6)}
		label="BUSINESS"
		color={CATEGORIES.business.color}
		left={B.x}
		top={B.y}
		width={108 * B.scale}
		boxW={24 * B.scale}
		boxH={30 * B.scale}
		tilt={B.tilt}
	/>
	<CounterScene scale={C.scale} tilt={C.tilt} x={C.x} y={C.y} />

	<!-- CLICKABLE HOTSPOTS -->
	<Hotspot
		id="games"
		left="0%"
		top="26%"
		width="35%"
		height="56%"
		label="GAMES AISLE"
		sublabel="Adventure · Puzzle · Card"
		{hot}
		onenter={() => (hot = 'games')}
		onleave={() => (hot = null)}
		onclick={() => onenter('games')}
	/>
	<Hotspot
		id="ent"
		left="74%"
		top="21%"
		width="26%"
		height="56%"
		label="ENTERTAINMENT"
		sublabel="TV · Chat · Multimedia"
		{hot}
		onenter={() => (hot = 'ent')}
		onleave={() => (hot = null)}
		onclick={() => onenter('ent')}
	/>
	<Hotspot
		id="business"
		left="29%"
		top="13%"
		width="24%"
		height="28%"
		label="BUSINESS"
		sublabel="Productivity · Tools"
		{hot}
		onenter={() => (hot = 'business')}
		onleave={() => (hot = null)}
		onclick={() => onenter('business')}
	/>
	<Hotspot
		id="counter"
		left="52%"
		top="14%"
		width="24%"
		height="34%"
		label="CHECKOUT"
		sublabel="Take your cart up here"
		{hot}
		onenter={() => (hot = 'counter')}
		onleave={() => (hot = null)}
		onclick={() => onenter('counter')}
	/>

	<!-- Idle hint -->
	<div class="idle-hint">click an aisle · step closer</div>
</div>

<style>
	.aisle {
		position: absolute;
		inset: 0;
		background: #f5b34f;
		overflow: hidden;
	}
	.bg-svg {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
	}
	.idle-hint {
		position: absolute;
		left: 50%;
		bottom: 8px;
		transform: translateX(-50%);
		background: #ffffff;
		border: 2px solid #0a0a0a;
		box-shadow: 2px 2px 0 #0a0a0a;
		padding: 4px 10px;
		font-family: 'VT323', monospace;
		font-size: 14px;
		letter-spacing: 0.02em;
		white-space: nowrap;
	}
</style>
