<script lang="ts">
	import { SHOWS, type VCRShow, type VCREpisode } from './vcr-data';

	let selectedShow = $state<VCRShow | null>(null);
	let currentEpisode = $state<VCREpisode | null>(null);
	let transport = $state<'idle' | 'play' | 'pause' | 'stop'>('idle');
	let browseMode = $state<'shows' | 'episodes'>('shows');

	function selectShow(show: VCRShow) {
		selectedShow = show;
		browseMode = 'episodes';
	}

	function playEpisode(ep: VCREpisode) {
		currentEpisode = ep;
		transport = 'play';
	}

	let currentIndex = $derived(
		selectedShow && currentEpisode ? selectedShow.episodes.indexOf(currentEpisode) : -1
	);

	let canRew = $derived(selectedShow !== null && currentIndex > 0);
	let canFf = $derived(
		selectedShow !== null && currentIndex >= 0 && currentIndex < selectedShow.episodes.length - 1
	);
	let hasTape = $derived(currentEpisode !== null);

	function pressPlayPause() {
		if (!currentEpisode) return;
		if (transport === 'play') transport = 'pause';
		else transport = 'play';
	}

	function pressEject() {
		transport = 'idle';
		currentEpisode = null;
	}

	function pressRew() {
		if (!selectedShow || currentIndex <= 0) return;
		currentEpisode = selectedShow.episodes[currentIndex - 1];
		transport = 'play';
	}

	function pressFf() {
		if (!selectedShow || currentIndex < 0 || currentIndex >= selectedShow.episodes.length - 1)
			return;
		currentEpisode = selectedShow.episodes[currentIndex + 1];
		transport = 'play';
	}

	function backToShows() {
		browseMode = 'shows';
		selectedShow = null;
	}

	let embedUrl = $derived(
		currentEpisode
			? currentEpisode.archiveFile
				? `https://archive.org/embed/${currentEpisode.archiveId}/${encodeURIComponent(currentEpisode.archiveFile)}`
				: `https://archive.org/embed/${currentEpisode.archiveId}`
			: ''
	);

	let showVideo = $derived(transport === 'play' || transport === 'pause');

	const REF_W = 560;
	const REF_H = 523;

	let shellEl: HTMLElement;
	let unitScale = $state(1);

	$effect(() => {
		if (!shellEl) return;
		const observer = new ResizeObserver((entries) => {
			const { width, height } = entries[0].contentRect;
			unitScale = Math.min(width / REF_W, height / REF_H);
		});
		observer.observe(shellEl);
		return () => observer.disconnect();
	});
</script>

<svg width="0" height="0" aria-hidden="true" style="position:absolute">
	<defs>
		<clipPath id="crt-barrel" clipPathUnits="objectBoundingBox">
			<path
				d="M 0.04,0.045 Q 0.5,-0.01 0.96,0.045 Q 1,0.5 0.96,0.955 Q 0.5,1.01 0.04,0.955 Q 0,0.5 0.04,0.045 Z"
			/>
		</clipPath>
	</defs>
</svg>

<div class="shell" bind:this={shellEl}>
	<div class="unit" style="transform: scale({unitScale});">
		<!-- ── TV ──────────────────────────────────── -->
		<div class="tv">
			<div class="bezel">
				<svg class="seams" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
					<line x1="0" y1="0" x2="7" y2="9" vector-effect="non-scaling-stroke" />
					<line x1="100" y1="0" x2="93" y2="9" vector-effect="non-scaling-stroke" />
					<line x1="100" y1="100" x2="93" y2="91" vector-effect="non-scaling-stroke" />
					<line x1="0" y1="100" x2="7" y2="91" vector-effect="non-scaling-stroke" />
				</svg>
				<div class="screen">
					{#if showVideo && currentEpisode}
						<iframe src={embedUrl} title={currentEpisode.title} allowfullscreen class="video"
						></iframe>
						{#if transport === 'pause'}
							<div class="overlay">▐▐ PAUSED</div>
						{/if}
					{:else}
						<div class="osd">
							{#if browseMode === 'shows'}
								<div class="osd-title">TAPE LIBRARY</div>
								<div class="osd-list">
									{#each SHOWS as show (show.id)}
										<button class="osd-row" onclick={() => selectShow(show)}>
											<span class="osd-tape">📼</span>
											<span class="osd-name">{show.name}</span>
											<span class="osd-count">{show.episodes.length}</span>
											<span class="osd-arrow">▸</span>
										</button>
									{/each}
								</div>
								{#if hasTape}
									<button class="osd-resume" onclick={pressPlayPause}
										>▶ Resume: {currentEpisode?.title}</button
									>
								{/if}
							{:else if selectedShow}
								<button class="osd-back" onclick={backToShows}>◂ {selectedShow.name}</button>
								<div class="osd-list">
									{#each selectedShow.episodes as ep (ep.id)}
										<button
											class="osd-row"
											class:playing={currentEpisode?.id === ep.id}
											onclick={() => playEpisode(ep)}
										>
											<span class="osd-tape">{currentEpisode?.id === ep.id ? '▶' : '○'}</span>
											<span class="osd-name">{ep.title}</span>
											<span class="osd-count">{ep.year}</span>
										</button>
									{/each}
								</div>
							{/if}
						</div>
					{/if}
				</div>
			</div>
		</div>

		<!-- ── VCR DECK ───────────────────────────── -->
		<div class="deck">
			<div class="slot"></div>
			<div class="panel">
				<!-- Cassette tape -->
				<div class="cassette">
					<div class="cassette-label">
						<span class="cassette-text">
							{#if currentEpisode}{currentEpisode.title}{:else}No tape loaded{/if}
						</span>
						<span class="cassette-stripes">
							<span class="cs" style="background:#f54e00"></span>
							<span class="cs" style="background:#f9bd2b"></span>
							<span class="cs" style="background:#1e5fc8"></span>
						</span>
					</div>
				</div>

				<!-- 3 large buttons -->
				<div class="btns">
					<button class="tb" disabled={!canRew} onclick={pressRew} title="Rewind">◀▏</button>
					<button
						class="tb tb-main"
						class:engaged={transport === 'play'}
						disabled={!hasTape}
						onclick={pressPlayPause}
						title="Play/Pause"
					>
						{#if transport === 'pause'}▐▐{:else}▶{/if}
					</button>
					<button class="tb" disabled={!canFf} onclick={pressFf} title="Fast Forward">▕▶</button>
				</div>
			</div>
			{#if hasTape}
				<button class="eject-btn" onclick={pressEject}>⏏ EJECT</button>
			{/if}
		</div>
	</div>
</div>

<style>
	.shell {
		width: 100%;
		height: 100%;
		position: relative;
		background: #0a0a0a;
		overflow: hidden;
	}

	.unit {
		position: absolute;
		top: 50%;
		left: 50%;
		width: 560px;
		height: 523px;
		transform-origin: center center;
		translate: -50% -50%;
		display: flex;
		flex-direction: column;
		background: #d4cdb8;
		overflow: hidden;
	}

	/* ── TV ─────────────────────────────────────── */
	.tv {
		flex: 1;
		min-height: 0;
		padding: 12px 12px 6px;
	}

	.bezel {
		width: 100%;
		height: 100%;
		background: #7a7268;
		border: 2px solid #0a0a0a;
		display: flex;
		position: relative;
	}

	.seams {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		z-index: 2;
		pointer-events: none;
	}
	.seams line {
		stroke: #0a0a0a;
		stroke-width: 1.5px;
	}

	.screen {
		flex: 1;
		background: #181818;
		position: relative;
		overflow: hidden;
		margin: 3% 2.5%;
		padding: 2%;
		clip-path: url(#crt-barrel);
	}

	.video {
		width: 100%;
		height: 100%;
		border: none;
		display: block;
	}

	/* ── OVERLAY ────────────────────────────────── */
	.overlay {
		position: absolute;
		inset: 0;
		background: rgba(0, 0, 0, 0.5);
		display: flex;
		align-items: center;
		justify-content: center;
		font-family: 'Press Start 2P', monospace;
		font-size: 12px;
		color: #fff;
		letter-spacing: 3px;
		z-index: 1;
	}

	/* ── ON-SCREEN DISPLAY ─────────────────────── */
	.osd {
		height: 100%;
		display: flex;
		flex-direction: column;
		padding: 20px;
		overflow: hidden;
	}

	.osd-title {
		font-family: 'Press Start 2P', monospace;
		font-size: 10px;
		color: #ffffff;
		letter-spacing: 2px;
		padding-bottom: 8px;
		border-bottom: 1px solid #333;
		margin-bottom: 6px;
		flex-shrink: 0;
	}

	.osd-back {
		background: none;
		border: none;
		border-bottom: 1px solid #333;
		color: #ffffff;
		font-family: 'Press Start 2P', monospace;
		font-size: 8px;
		padding: 0 0 8px;
		margin-bottom: 6px;
		cursor: pointer;
		text-align: left;
		letter-spacing: 1px;
		flex-shrink: 0;
	}
	.osd-back:hover {
		color: #f9bd2b;
	}

	.osd-list {
		flex: 1;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
	}

	.osd-row {
		display: flex;
		align-items: center;
		gap: 8px;
		width: 100%;
		padding: 5px 4px;
		background: none;
		border: none;
		border-bottom: 1px solid #222;
		color: #ffffff;
		cursor: pointer;
		text-align: left;
	}
	.osd-row:hover {
		background: #f9bd2b;
		color: #0a0a0a;
	}
	.osd-row.playing {
		color: #f9bd2b;
	}

	.osd-tape {
		flex: 0 0 auto;
		font-size: 13px;
		width: 18px;
		text-align: center;
	}
	.osd-name {
		flex: 1;
		font-family: 'VT323', monospace;
		font-size: 18px;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		min-width: 0;
	}
	.osd-count {
		flex: 0 0 auto;
		font-family: 'VT323', monospace;
		font-size: 15px;
		opacity: 0.5;
	}
	.osd-arrow {
		flex: 0 0 auto;
		opacity: 0.4;
	}

	.osd-resume {
		flex-shrink: 0;
		margin-top: 6px;
		padding: 6px 8px;
		background: #f9bd2b;
		border: none;
		color: #0a0a0a;
		font-family: 'VT323', monospace;
		font-size: 16px;
		cursor: pointer;
		text-align: left;
	}
	.osd-resume:hover {
		background: #ffffff;
	}

	.osd-list::-webkit-scrollbar {
		width: 10px;
	}
	.osd-list::-webkit-scrollbar-track {
		background: #181818;
	}
	.osd-list::-webkit-scrollbar-thumb {
		background: #444;
		border: 2px solid #181818;
	}

	/* ── VCR DECK ──────────────────────────────── */
	.deck {
		flex: 0 0 auto;
		background: #d4cdb8;
		border-top: 3px solid #0a0a0a;
		padding: 10px 14px 12px;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.slot {
		width: 55%;
		max-width: 200px;
		height: 8px;
		background: #0a0a0a;
		margin: 0 auto;
	}

	.panel {
		display: flex;
		align-items: stretch;
		gap: 6px;
		min-height: 48px;
	}

	/* ── CASSETTE TAPE ─────────────────────────── */
	.cassette {
		flex: 1;
		min-width: 0;
		background: #2a2a2a;
		border: 2px solid #0a0a0a;
		border-radius: 6px;
		padding: 6px 6px 6px 8px;
		display: flex;
		align-items: center;
	}

	.cassette-label {
		flex: 1;
		min-width: 0;
		background: #ffffff;
		border: 1px solid #aaa;
		display: flex;
		align-items: center;
		overflow: hidden;
		height: 100%;
	}

	.cassette-text {
		flex: 1;
		min-width: 0;
		padding: 2px 10px;
		font-family: 'Caveat', cursive;
		font-size: 20px;
		font-weight: 700;
		color: #0a0a0a;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		line-height: 1.2;
	}

	.cassette-stripes {
		flex: 0 0 18px;
		height: 100%;
		display: flex;
		flex-direction: column;
	}
	.cs {
		flex: 1;
	}

	/* ── TRANSPORT (3 large buttons) ───────────── */
	.btns {
		flex: 0 0 auto;
		display: flex;
		gap: 4px;
	}

	.tb {
		width: 48px;
		height: 48px;
		background: #0a0a0a;
		border: 2px solid #0a0a0a;
		box-shadow: 3px 3px 0 rgba(0, 0, 0, 0.3);
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 16px;
		color: #ffffff;
		padding: 0;
	}
	.tb:hover:not(:disabled) {
		transform: translate(1px, 1px);
		box-shadow: 2px 2px 0 rgba(0, 0, 0, 0.3);
	}
	.tb:active:not(:disabled),
	.tb.engaged:not(:disabled) {
		transform: translate(3px, 3px);
		box-shadow: 0 0 0 rgba(0, 0, 0, 0);
	}
	.tb:disabled {
		opacity: 0.2;
		cursor: default;
	}

	.tb-main {
		background: #f9bd2b;
		color: #0a0a0a;
		border-color: #0a0a0a;
	}
	.tb-main.engaged {
		background: #f54e00;
		color: #ffffff;
	}

	/* ── EJECT ─────────────────────────────────── */
	.eject-btn {
		align-self: flex-end;
		background: none;
		border: none;
		font-family: 'Press Start 2P', monospace;
		font-size: 7px;
		color: #0a0a0a;
		opacity: 0.5;
		cursor: pointer;
		padding: 0;
		letter-spacing: 1px;
	}
	.eject-btn:hover {
		opacity: 1;
	}
</style>
