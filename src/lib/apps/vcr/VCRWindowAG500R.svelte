<script lang="ts">
	import { SHOWS, type VCRShow, type VCREpisode } from './vcr-data';
	import { appRead, appWrite } from '$lib/persistence';
	import { resolvePlayableUrl } from './vcr-media';
	import { nextShuttle, rateForLevel, type Shuttle } from './vcr-shuttle';

	// ── State machine (copied verbatim from VCRWindow.svelte) ──────────
	let selectedShow = $state<VCRShow | null>(null);
	let currentEpisode = $state<VCREpisode | null>(null);
	// 'still' is a distinct state from 'pause': STILL is a physical freeze (no overlay,
	// no green PLAY-lamp flash); 'pause' only results from toggling PLAY.
	let transport = $state<'idle' | 'cued' | 'play' | 'pause' | 'still' | 'stop'>('idle');
	let browseMode = $state<'shows' | 'episodes'>('shows');

	// ── Native <video> playback ────────────────────────────────────────
	let videoEl: HTMLVideoElement | undefined = $state();
	let videoUrl = $state<string | null>(null);
	let useIframe = $state(false);
	let loadingVideo = $state(false);
	let curTime = $state(0);

	// ── Variable-speed shuttle (FF/REW) ────────────────────────────────
	let shuttle = $state<Shuttle | null>(null);
	let rewTimer: ReturnType<typeof setInterval> | null = null;

	// ── STILL freeze + power ────────────────────────────────────────────
	let slowActive = $state(false);

	function clearSlow() {
		slowActive = false;
	}
	let powered = $state(true);

	function selectShow(show: VCRShow) {
		selectedShow = show;
		browseMode = 'episodes';
	}

	// Selecting an episode CUES the tape — loads it into the bay and shows
	// color bars, but does NOT resolve the media or start playing. PLAY
	// resolves the URL lazily on first press.
	function cueEpisode(ep: VCREpisode) {
		if (!powered) return;
		currentEpisode = ep;
		ejected = false;
		ejectedEpisode = null;
		transport = 'cued';
		videoUrl = null;
		useIframe = false;
		loadingVideo = false;
		curTime = 0;
		clearShuttle();
		clearSlow();
	}

	// Resolve the playable URL the first time PLAY is pressed from `cued`,
	// then let the <video autoplay> (or iframe fallback) take over.
	async function startPlayback() {
		if (!currentEpisode) return;
		if (videoUrl || useIframe) {
			// already resolved — just resume
			if (videoEl) videoEl.play();
			else transport = 'play';
			return;
		}
		const ep = currentEpisode;
		loadingVideo = true;
		transport = 'play';
		const url = await resolvePlayableUrl(ep);
		// guard against the user having switched episodes while we awaited
		if (currentEpisode !== ep) return;
		loadingVideo = false;
		if (url) {
			videoUrl = url;
			useIframe = false;
		} else {
			useIframe = true; // fall back to the archive.org iframe
		}
	}

	let hasTape = $derived(currentEpisode !== null);

	function pressPlayPause() {
		if (!powered || !currentEpisode) return;
		// Cued, or resolved-but-not-yet-loaded → start playback (lazy resolve).
		if (transport === 'cued' || (hasTape && !videoUrl && !useIframe)) {
			startPlayback();
			return;
		}
		if (useIframe) {
			// can't control the cross-origin iframe; just track our own flag
			transport = transport === 'play' ? 'pause' : 'play';
			return;
		}
		clearShuttle();
		clearSlow();
		if (videoEl) {
			videoEl.playbackRate = 1;
			videoEl.muted = false;
			if (videoEl.paused) videoEl.play();
			else videoEl.pause();
		}
	}

	function pressEject() {
		clearShuttle();
		clearSlow();
		transport = 'idle';
		currentEpisode = null;
		videoUrl = null;
		useIframe = false;
		loadingVideo = false;
		curTime = 0;
	}

	// ── Shuttle plumbing ────────────────────────────────────────────────
	// Clears any running reverse interval and resets the shuttle signal +
	// the video element back to normal 1× unmuted. Does NOT resume play.
	function clearShuttle() {
		shuttle = null;
		if (rewTimer) {
			clearInterval(rewTimer);
			rewTimer = null;
		}
		if (videoEl) {
			videoEl.playbackRate = 1;
			videoEl.muted = false;
		}
	}

	function pressRew() {
		if (!powered || !videoUrl || useIframe) return;
		clearSlow();
		shuttle = nextShuttle(shuttle, 'rew');
		applyShuttle();
	}

	function pressFf() {
		if (!powered || !videoUrl || useIframe) return;
		clearSlow();
		shuttle = nextShuttle(shuttle, 'ff');
		applyShuttle();
	}

	// Translates the current `shuttle` signal into real video behavior.
	// Browsers can't play in reverse, so REW is simulated by walking
	// currentTime backwards on a timer. Any non-1× speed is muted, like a
	// real deck scanning the tape.
	function applyShuttle() {
		if (rewTimer) {
			clearInterval(rewTimer);
			rewTimer = null;
		}
		if (!videoEl || useIframe) return;

		if (shuttle === null) {
			videoEl.playbackRate = 1;
			videoEl.muted = false;
			videoEl.play();
			transport = 'play';
			return;
		}

		if (shuttle.dir === 'ff') {
			videoEl.playbackRate = rateForLevel(shuttle.level);
			videoEl.muted = true;
			videoEl.play();
			transport = 'play';
			return;
		}

		// rew — simulate reverse by decrementing currentTime on an interval
		videoEl.pause();
		videoEl.muted = true;
		transport = 'play';
		const step = rateForLevel(shuttle.level) * 0.2;
		rewTimer = setInterval(() => {
			if (!videoEl) return;
			const next = videoEl.currentTime - step;
			if (next <= 0) {
				videoEl.currentTime = 0;
				if (rewTimer) {
					clearInterval(rewTimer);
					rewTimer = null;
				}
				shuttle = null;
				videoEl.playbackRate = 1;
				transport = 'stop';
				return;
			}
			videoEl.currentTime = next;
		}, 200);
	}

	function backToShows() {
		browseMode = 'shows';
		selectedShow = null;
	}

	// ── Power button — classic CRT on/off ───────────────────────────────
	let crtAnimating = $state(false);
	let powerTimer: ReturnType<typeof setTimeout> | null = null;

	function togglePower() {
		if (powerTimer) {
			clearTimeout(powerTimer);
			powerTimer = null;
		}
		if (powered) {
			// OFF: pause everything, reset shuttle, run the collapse, then black out.
			clearShuttle();
			clearSlow();
			if (videoEl) videoEl.pause();
			crtAnimating = true;
			powerTimer = setTimeout(() => {
				powered = false;
				crtAnimating = false;
				powerTimer = null;
			}, 520);
		} else {
			// ON: warm up, then reveal the prior screen but PAUSED. The <video>
			// element was never unmounted, so it still holds its currentTime —
			// we must NOT seek to 0 or reload. Just make sure it stays paused
			// (autoplay only fires on initial mount, not on this reveal) so the
			// retained frame comes back frozen.
			powered = true;
			crtAnimating = true;
			// come back frozen (STILL), not 'pause' — power-on isn't a PLAY-pause, so no green flash
			if (transport === 'play') transport = 'still';
			if (videoEl) videoEl.pause();
			powerTimer = setTimeout(() => {
				crtAnimating = false;
				powerTimer = null;
			}, 420);
		}
	}

	let embedUrl = $derived(
		currentEpisode
			? currentEpisode.archiveFile
				? `https://archive.org/embed/${currentEpisode.archiveId}/${encodeURIComponent(currentEpisode.archiveFile)}`
				: `https://archive.org/embed/${currentEpisode.archiveId}`
			: ''
	);

	// What the screen shows:
	//  - cued → color bars only (tape loaded, not playing)
	//  - play/pause/stop → video + overlays
	//  - idle → OSD TAPE LIBRARY
	// All of it is gated by power below.
	let showVideo = $derived(
		transport === 'play' || transport === 'pause' || transport === 'still' || transport === 'stop'
	);
	let showBars = $derived(transport === 'cued');

	// LED counter: elapsed time M:SS for native playback, else placeholder.
	// Blank while the unit is powered off.
	let ledText = $derived.by(() => {
		if (!powered) return '';
		if (
			!useIframe &&
			videoUrl &&
			(transport === 'play' ||
				transport === 'pause' ||
				transport === 'still' ||
				transport === 'stop')
		) {
			const total = Math.max(0, Math.floor(curTime));
			const m = Math.floor(total / 60);
			const s = total % 60;
			return `${m}:${String(s).padStart(2, '0')}`;
		}
		return '0443';
	});

	// ── Indicator lamps ──────────────────────────────────────────────────
	let playLampOn = $derived(powered && transport === 'play');
	let playLampFlash = $derived(powered && transport === 'pause');
	// STILL/SLOW share one lamp: solid yellow while frozen (STILL), flashing yellow while slow.
	let stillLampOn = $derived(powered && transport === 'still');
	let slowLampFlash = $derived(powered && slowActive);

	// ── AG-500R-specific transport helpers ─────────────────────────────
	function pressStop() {
		if (!powered) return;
		clearShuttle();
		clearSlow();
		if (!useIframe && videoEl) {
			videoEl.pause();
		}
		// STOP halts the transport and blacks out the screen (mechanics stopped),
		// keeping the tape loaded at its current position. PLAY resumes from there.
		if (transport !== 'idle') transport = 'stop';
	}

	function pressStill() {
		// STILL (▶◀) → freeze the picture
		if (!powered || !hasTape) return;
		clearShuttle();
		clearSlow();
		// STILL is its own state — set it BEFORE pausing so onpause won't downgrade to 'pause'.
		transport = 'still';
		if (useIframe) return;
		if (videoEl) videoEl.pause();
	}

	function pressSlow() {
		// SLOW (▮▶) → half-speed playback
		if (!powered) return;
		clearShuttle();
		clearSlow();
		slowActive = true;
		if (useIframe) {
			if (hasTape) pressPlayPause();
			return;
		}
		if (videoEl) {
			videoEl.playbackRate = 0.5;
			videoEl.muted = false;
			videoEl.play();
		}
	}

	// Tear down timers on unmount.
	$effect(() => {
		return () => {
			if (rewTimer) clearInterval(rewTimer);
			if (powerTimer) clearTimeout(powerTimer);
		};
	});

	// ── Cassette eject pop animation (cosmetic flag; real unload = pressEject) ──
	let ejected = $state(false);
	// Remember which tape was ejected so pushing it back in re-inserts the same one.
	let ejectedEpisode = $state<VCREpisode | null>(null);

	function ejectTape() {
		ejectedEpisode = currentEpisode;
		ejected = true;
		pressEject();
	}

	function pushTapeBack() {
		// Pushing the popped-out tape back in re-inserts it, cued from the start
		// (we don't track where it was ejected).
		if (!ejected) return;
		const ep = ejectedEpisode;
		ejected = false;
		ejectedEpisode = null;
		if (ep) cueEpisode(ep);
	}

	// ── Flip-down picture-controls door (cosmetic) ──────────────────────
	let doorOpen = $state(false);
	let doorPressed = $state(false);

	// ── Volume slider (persisted, drives the real <video>) ──────────────
	let vol = $state(appRead('vcr', 'volume', 42));
	let volChannelEl: HTMLDivElement;

	// Keep the video element's volume in sync with the slider once both exist.
	$effect(() => {
		if (videoEl) videoEl.volume = vol / 100;
	});

	function startVolDrag(e: PointerEvent) {
		e.preventDefault();
		const channel = volChannelEl;
		if (!channel) return;
		const apply = (clientX: number) => {
			const rect = channel.getBoundingClientRect();
			let pct = ((clientX - rect.left) / rect.width) * 100;
			pct = Math.max(3, Math.min(97, pct));
			vol = pct;
			appWrite('vcr', 'volume', pct);
		};
		apply(e.clientX);
		const move = (ev: PointerEvent) => {
			ev.preventDefault();
			apply(ev.clientX);
		};
		const up = () => {
			window.removeEventListener('pointermove', move);
			window.removeEventListener('pointerup', up);
		};
		window.addEventListener('pointermove', move);
		window.addEventListener('pointerup', up);
	}

	// ── Scaling / fit (ResizeObserver + transform: scale) ───────────────
	const REF_W = 1170;
	const REF_H = 720;

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

	const picKnobs = ['V-Hold', 'Sharpness', 'Contrast', 'Bright', 'Tint', 'Color'];
</script>

<div class="shell" bind:this={shellEl}>
	<div class="ag500" style="transform: scale({unitScale});">
		<div class="ag500-top">
			<!-- Left column: screen + flat strip beneath it -->
			<div class="left-stack">
				<!-- CRT screen = the playback surface -->
				<div class="crt">
					<div class="screen" class:off={!powered} class:crt-anim={crtAnimating}>
						<div class="bars" aria-hidden="true">
							<div style="background:#B8B8B8"></div>
							<div style="background:#B8B82F"></div>
							<div style="background:#2FB8B8"></div>
							<div style="background:#2FB82F"></div>
							<div style="background:#B82FB8"></div>
							<div style="background:#B82F2F"></div>
							<div style="background:#2F2FB8"></div>
							<div style="background:#1A1A1A"></div>
						</div>

						<!--
							The native <video> element must STAY MOUNTED across power
							toggles so its currentTime is preserved. It's rendered here —
							OUTSIDE the `!powered` branch — whenever the tape has a
							resolved video URL. When powered off it sits underneath the
							.power-off black-out overlay (added at the end of .screen),
							paused, holding its position. Power-on just reveals it.
						-->
						{#if showVideo && currentEpisode && videoUrl && !useIframe}
							<!-- svelte-ignore a11y_media_has_caption -->
							<video
								bind:this={videoEl}
								src={videoUrl}
								autoplay
								playsinline
								class="video"
								onplay={() => (transport = 'play')}
								onpause={() => {
									if (transport !== 'idle' && transport !== 'stop' && transport !== 'still')
										transport = 'pause';
								}}
								ontimeupdate={() => (curTime = videoEl?.currentTime ?? 0)}
								onended={() => (transport = 'stop')}
							></video>
							{#if powered && transport === 'pause'}
								<div class="screen-overlay">▐▐ PAUSED</div>
							{:else if powered && transport === 'stop'}
								<div class="screen-overlay stop">■ STOP</div>
							{/if}
						{/if}

						{#if !powered}
							<!-- screen is dark & inert while powered off; the .power-off
							     overlay below covers the still-mounted (paused) video -->
						{:else if showBars}
							<div class="cue-hint">PRESS ▶ PLAY</div>
						{:else if showVideo && currentEpisode}
							{#if useIframe}
								<iframe src={embedUrl} title={currentEpisode.title} allowfullscreen class="video"
								></iframe>
								{#if transport === 'pause'}
									<div class="screen-overlay">▐▐ PAUSED</div>
								{/if}
							{:else if loadingVideo}
								<div class="loading">LOADING…</div>
							{/if}
						{:else}
							<div class="osd">
								{#if browseMode === 'shows'}
									<div class="osd-title">TAPE LIBRARY</div>
									<div class="osd-list">
										{#each SHOWS as show (show.id)}
											<button class="osd-row" disabled={!powered} onclick={() => selectShow(show)}>
												<span class="osd-tape">📼</span>
												<span class="osd-name">{show.name}</span>
												<span class="osd-count">{show.episodes.length}</span>
												<span class="osd-arrow">▸</span>
											</button>
										{/each}
									</div>
									{#if hasTape}
										<button class="osd-resume" disabled={!powered} onclick={pressPlayPause}
											>▶ Resume: {currentEpisode?.title}</button
										>
									{/if}
								{:else if selectedShow}
									<button class="osd-back" disabled={!powered} onclick={backToShows}
										>◂ {selectedShow.name}</button
									>
									<div class="osd-list">
										{#each selectedShow.episodes as ep (ep.id)}
											<button
												class="osd-row"
												class:playing={currentEpisode?.id === ep.id}
												disabled={!powered}
												onclick={() => cueEpisode(ep)}
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

						{#if !powered}
							<!-- powered-off black-out, layered ON TOP of the still-mounted video -->
							<div class="power-off" aria-hidden="true"></div>
						{/if}
					</div>
				</div>

				<!-- Bottom strip — A/V cluster, vents, flip-down door -->
				<div class="bottom">
					<div class="av-cluster">
						<div class="av-power">
							<div class="label tl">Power</div>
							<div class="av-power-row">
								<div class="power-light" class:off={!powered}></div>
								<div style="margin-left:30px">
									<button
										class="bli-key style-cassette tint-beige key-small power-key"
										aria-label="Power"
										aria-pressed={powered}
										onclick={togglePower}
									>
										<span></span>
									</button>
								</div>
							</div>
						</div>
						<div class="av-hp">
							<div class="jack"></div>
							<div class="label dim tl">Headphones</div>
						</div>
					</div>
					<div class="vents"></div>
					<div class="av-door-wrap">
						<div class="av-knobs">
							{#each picKnobs as k (k)}
								<div class="knob-col">
									<div class="pic-knob"></div>
									<div class="knob-label">{k}</div>
								</div>
							{/each}
						</div>
						<button
							type="button"
							class="av-door"
							class:open={doorOpen}
							class:pressed={doorPressed}
							aria-label="Picture controls door"
							aria-pressed={doorOpen}
							onpointerdown={() => (doorPressed = true)}
							onpointerup={() => {
								doorPressed = false;
								doorOpen = !doorOpen;
							}}
							onpointerleave={() => (doorPressed = false)}
						>
							<div class="door-push">Push-Open</div>
							<div class="model-label">
								<div class="small">Monitor / Player</div>
								<div class="big">
									AG-<span class="num">500</span><span style="font-size:9px">R</span>
								</div>
							</div>
						</button>
					</div>
				</div>
			</div>

			<!-- Right cluster: control panel + cassette bay -->
			<div class="right-cluster">
				<div class="panel">
					<div class="brand-panasonic" style="margin-top:4px">Panasonic</div>

					<!-- Row 1: EJECT + POWER LED -->
					<div class="panel-row inset-deep" style="align-items:center;margin-top:4px">
						<div style="display:flex;flex-direction:column;gap:2px;align-items:center">
							<div class="label">Eject</div>
							<button
								class="bli-key style-cassette tint-beige key-small"
								disabled={!hasTape || !powered}
								onclick={ejectTape}
							>
								<span>▲</span>
							</button>
						</div>
						<div class="power-led">
							<div class="dot on"></div>
							<div class="dot"></div>
						</div>
					</div>

					<!-- LED display -->
					<div class="led" style="margin-top:4px">
						<div class="led-digits">{ledText}</div>
						<div class="led-printed-labels">
							<span>RESET</span>
							<span>MEMORY</span>
						</div>
					</div>

					<!-- RESET / MEMORY (cosmetic) -->
					<div class="panel-row inset-shallow" style="margin-top:4px">
						<div>
							<button class="bli-key style-cassette tint-beige key-small" aria-label="Reset"
								><span></span></button
							>
						</div>
						<div>
							<button class="bli-key style-cassette tint-beige key-small" aria-label="Memory"
								><span></span></button
							>
						</div>
					</div>
					<div class="label dim" style="text-align:right;margin-right:4px;margin-top:4px">
						Search Lock
					</div>

					<!-- REW / FF -->
					<div class="transport-rewff" style="margin-top:4px">
						<div class="label bracket">
							<span>REW/<span style="font-size:9px;letter-spacing:0">◀◀</span></span>
							<span><span style="font-size:9px;letter-spacing:0">▶▶</span>/FF</span>
						</div>
						<div class="panel-row">
							<div>
								<button
									class="bli-key style-cassette tint-beige key-med"
									disabled={!videoUrl || useIframe || !powered}
									onclick={pressRew}
									title="Rewind (shuttle)"
								>
									<span>◀◀</span>
								</button>
							</div>
							<div>
								<button
									class="bli-key style-cassette tint-beige key-med"
									disabled={!videoUrl || useIframe || !powered}
									onclick={pressFf}
									title="Fast-forward (shuttle)"
								>
									<span>▶▶</span>
								</button>
							</div>
						</div>
					</div>

					<!-- PLAY (big, green) -->
					<div
						style="display:flex;flex-direction:column;gap:2px;align-items:stretch;margin-top:7px"
					>
						<div
							class="label"
							style="position:relative;display:flex;align-items:center;justify-content:center"
						>
							<span
								class="led-marker lamp"
								class:on={playLampOn}
								class:flash={playLampFlash}
								style="position:absolute;left:7px;margin-right:0"
							></span>
							Play
						</div>
						<button
							class="bli-key style-cassette tint-green key-big key-wide"
							class:engaged={transport === 'play'}
							disabled={!hasTape || !powered}
							onclick={pressPlayPause}
							title="Play/Pause"
						>
							<span>
								<!-- physical PLAY button: always the play triangle. Pause is shown by the
								     flashing green lamp, never by morphing this glyph. -->
								<svg class="glyph" width="48" height="40" viewBox="0 0 24 20" aria-hidden="true">
									<polygon points="7 3 22 10 7 17" />
								</svg>
							</span>
						</button>
					</div>

					<!-- STOP (big) -->
					<div
						style="display:flex;flex-direction:column;gap:2px;align-items:stretch;margin-top:6px"
					>
						<div class="label" style="text-align:center">Stop</div>
						<button
							class="bli-key style-cassette tint-gray key-big key-wide"
							disabled={transport === 'idle' || !powered}
							onclick={pressStop}
							title="Stop"
						>
							<span>
								<svg
									class="glyph glyph-stop"
									width="44"
									height="44"
									viewBox="0 0 24 24"
									aria-hidden="true"
								>
									<rect x="5" y="5" width="14" height="14" />
								</svg>
							</span>
						</button>
					</div>

					<!-- STILL / SLOW -->
					<div class="stillslow">
						<div class="stillslow-labels">
							<div class="ss-label still">
								<span class="ss-lamp lamp" class:on={stillLampOn} class:flash={slowLampFlash}
								></span>
								<span class="ss-text">Still</span>
							</div>
							<div class="ss-label slow">
								<span class="slow-dial" aria-hidden="true">
									<svg width="13" height="13" viewBox="0 0 16 16">
										<circle class="dial-body" cx="8" cy="8" r="5.4" />
										<line class="dial-pointer" x1="5" y1="11" x2="11" y2="5" />
										<line class="dial-tick" x1="2.5" y1="8" x2="4" y2="8" />
										<line class="dial-tick" x1="12" y1="8" x2="13.5" y2="8" />
										<line class="dial-tick" x1="8" y1="2.5" x2="8" y2="4" />
									</svg>
								</span>
								<span class="ss-text">Slow</span>
							</div>
						</div>
						<div class="panel-row">
							<div style="display:flex;flex-direction:column;gap:2px;align-items:center">
								<button
									class="bli-key style-cassette tint-beige key-med"
									disabled={!hasTape || useIframe || !powered}
									onclick={pressStill}
									title="Still (freeze)"
								>
									<span>
										<svg
											class="glyph glyph-still"
											width="30"
											height="16"
											viewBox="0 0 30 16"
											aria-hidden="true"
										>
											<polygon points="2 2 13 8 2 14" />
											<polygon points="28 2 17 8 28 14" />
										</svg>
									</span>
								</button>
							</div>
							<div style="display:flex;flex-direction:column;gap:2px;align-items:center">
								<button
									class="bli-key style-cassette tint-beige key-med"
									disabled={!hasTape || useIframe || !powered}
									onclick={pressSlow}
									title="Slow (half speed)"
								>
									<span>
										<svg
											class="glyph glyph-slow"
											width="30"
											height="16"
											viewBox="0 0 30 16"
											aria-hidden="true"
										>
											<rect x="10" y="3" width="3" height="10" />
											<polygon points="16 2 27 8 16 14" />
										</svg>
									</span>
								</button>
							</div>
						</div>
					</div>

					<!-- Volume slider -->
					<div style="display:flex;flex-direction:column;margin-top:13px">
						<div class="volume-well">
							<div class="vol-label">Volume</div>
							<div class="vol-ticks">
								<span>0</span><i>·</i><span>2</span><i>·</i><span>4</span><i>·</i><span>6</span><i
									>·</i
								><span>8</span><i>·</i><span>10</span>
							</div>
							<div class="vol-recess">
								<div
									class="vol-channel"
									bind:this={volChannelEl}
									onpointerdown={startVolDrag}
									role="slider"
									aria-label="Volume"
									aria-valuemin="0"
									aria-valuemax="100"
									aria-valuenow={Math.round(vol)}
									tabindex="0"
								>
									<div class="vol-slot"></div>
									<div class="vol-knob" style="left:{vol}%"></div>
								</div>
							</div>
						</div>
					</div>

					<!-- SLOW TRACKING / TRACKING thumbwheels (cosmetic) -->
					<div class="track-section">
						<div class="track-control">
							<div class="track-label">Slow Tracking</div>
							<div class="track-fix">Fix</div>
							<div class="track-roller left"></div>
						</div>
						<div class="track-control">
							<div class="track-label">Tracking</div>
							<div class="track-fix">Fix</div>
							<div class="track-roller right"></div>
						</div>
					</div>
				</div>

				<!-- Cassette bay -->
				<div class="cassette-bay">
					<div class="bay-slot">
						<div class="bay-markings">
							<div class="vhs">VHS</div>
							<div class="cass-icon"></div>
							<div class="lside">LABEL<br />SIDE ▶</div>
						</div>
					</div>
					{#if hasTape || ejected}
						<button
							type="button"
							class="cassette"
							class:ejected
							aria-label={ejected ? 'Push tape back in' : 'Loaded cassette'}
							onclick={pushTapeBack}
						>
							<span class="tape-tag">2</span>
							<span class="tape-label">
								<span class="tape-title">
									<span class="tt-line"
										>{(currentEpisode ?? ejectedEpisode)?.title ?? 'No tape loaded'}</span
									>
								</span>
								<span class="tape-stripe"></span>
							</span>
						</button>
						{#if ejected}
							<div class="tape-hint">
								<span class="hand">🤚</span>
								<span>Push</span>
							</div>
						{/if}
					{/if}
				</div>
			</div>
		</div>
	</div>
</div>

<style>
	/* ===================================================================
	   AG-500R — vintage Panasonic monitor/player. Skeuomorphic device art.
	   Ported from agvcr.html; all CSS vars resolved to literal values.
	   =================================================================== */

	.shell {
		width: 100%;
		height: 100%;
		position: relative;
		background: #0a0a0a;
		overflow: hidden;
	}

	* {
		box-sizing: border-box;
	}

	/* THE CHASSIS */
	.ag500 {
		position: absolute;
		top: 50%;
		left: 50%;
		width: 1170px;
		height: 720px;
		transform-origin: center center;
		translate: -50% -50%;
		background: linear-gradient(180deg, #f2eee1 0%, #e8e4d8 12%, #e8e4d8 88%, #c9c2af 100%);
		border-radius: 18px;
		box-shadow:
			0 50px 100px rgba(0, 0, 0, 0.5),
			0 20px 40px rgba(0, 0, 0, 0.3),
			inset 0 1px 0 rgba(255, 255, 255, 0.45),
			inset 0 -2px 0 rgba(0, 0, 0, 0.18);
		padding: 20px;
		display: flex;
		flex-direction: column;
		gap: 10px;
		user-select: none;
		color: #2b281f;
		font-family: 'VT323', monospace;
	}
	.ag500-top {
		display: flex;
		gap: 10px;
		flex: 1 1 auto;
		min-height: 0;
	}
	.left-stack {
		display: flex;
		flex-direction: column;
		gap: 10px;
		flex: 1 1 auto;
		min-width: 0;
		min-height: 0;
	}
	.right-cluster {
		display: flex;
		gap: 10px;
		flex-shrink: 0;
		margin-bottom: 20px;
		position: relative;
		border-bottom-left-radius: 11px;
		box-shadow:
			0 5px 6px rgba(0, 0, 0, 0.32),
			0 11px 16px -2px rgba(0, 0, 0, 0.24);
	}
	.right-cluster::before {
		content: '';
		position: absolute;
		left: -2px;
		right: -1px;
		top: 4px;
		bottom: 0;
		border-left: 2px solid rgba(16, 13, 9, 0.42);
		border-bottom: 2px solid rgba(16, 13, 9, 0.42);
		border-bottom-left-radius: 11px;
		box-shadow:
			inset 1px 0 0 rgba(255, 255, 255, 0.3),
			0 1px 0 rgba(255, 255, 255, 0.5);
		pointer-events: none;
		z-index: 4;
	}

	/* Screen housing */
	.crt {
		flex: 1 1 auto;
		position: relative;
		background: #201e18;
		border-radius: 2px;
		padding: 5px;
		box-shadow:
			inset 0 1px 0 rgba(255, 255, 255, 0.07),
			inset 0 -1px 2px rgba(0, 0, 0, 0.5),
			0 7px 10px -2px rgba(0, 0, 0, 0.3),
			0 14px 20px -6px rgba(0, 0, 0, 0.22);
		display: flex;
	}
	.crt::after {
		content: '';
		position: absolute;
		left: -3px;
		right: -1px;
		top: 6px;
		bottom: -8px;
		border-left: 2px solid rgba(16, 13, 9, 0.4);
		border-bottom: 2px solid rgba(16, 13, 9, 0.4);
		border-bottom-left-radius: 11px;
		box-shadow:
			inset 1px 0 0 rgba(255, 255, 255, 0.3),
			0 1px 0 rgba(255, 255, 255, 0.5);
		pointer-events: none;
		z-index: 6;
	}
	.screen {
		background: #050507;
		border-radius: 5px;
		width: 100%;
		height: 100%;
		position: relative;
		overflow: hidden;
		border: 24px solid;
		border-top-color: #302e26;
		border-left-color: #25231b;
		border-right-color: #16140d;
		border-bottom-color: #100e08;
		box-shadow:
			inset 0 0 0 1px rgba(0, 0, 0, 0.8),
			inset 0 7px 16px rgba(0, 0, 0, 0.9),
			inset 0 -3px 10px rgba(0, 0, 0, 0.7),
			inset 0 0 50px rgba(0, 0, 0, 0.85);
	}
	/* CRT bulge highlight */
	.screen::before {
		content: '';
		position: absolute;
		inset: 0;
		background: radial-gradient(ellipse at 30% 20%, rgba(255, 255, 255, 0.06) 0%, transparent 55%);
		pointer-events: none;
		z-index: 3;
	}
	/* scanlines */
	.screen::after {
		content: '';
		position: absolute;
		inset: 0;
		background: repeating-linear-gradient(
			0deg,
			rgba(0, 0, 0, 0.18) 0px,
			rgba(0, 0, 0, 0.18) 1px,
			transparent 1px,
			transparent 3px
		);
		pointer-events: none;
		z-index: 2;
	}
	.bars {
		position: absolute;
		inset: 0;
		display: flex;
		z-index: 1;
	}
	.bars > div {
		flex: 1;
	}

	/* Cued-tape hint over the color bars */
	.cue-hint {
		position: absolute;
		bottom: 14px;
		left: 0;
		right: 0;
		text-align: center;
		z-index: 5;
		font-family: 'Press Start 2P', monospace;
		font-size: 9px;
		letter-spacing: 2px;
		color: #f0f0ea;
		opacity: 0.7;
		text-shadow: 0 0 8px rgba(180, 255, 220, 0.4);
		pointer-events: none;
		animation: cuePulse 1.6s ease-in-out infinite;
	}
	@keyframes cuePulse {
		0%,
		100% {
			opacity: 0.45;
		}
		50% {
			opacity: 0.85;
		}
	}

	/* ── Power: CRT on/off ─────────────────────────────────────────────
	   The collapse animation is driven by a class toggled in JS so the
	   inner content (video/bars/OSD) collapses with the tube. */
	.screen.off {
		background: #050507;
	}
	/* The <video> stays MOUNTED while powered off so its currentTime is
	   preserved. The .power-off overlay below blacks out everything (video,
	   bars, OSD) without removing it from the DOM. We still hide the color
	   bars so the underlying tube reads as truly dark. */
	.screen.off .bars {
		opacity: 0;
	}
	/* Solid black-out painted ON TOP of whatever is underneath while off.
	   z-index sits above the video (4) and overlays (5) but below the CRT
	   bulge/scanline pseudo-elements is irrelevant — it's just opaque black. */
	.power-off {
		position: absolute;
		inset: 0;
		background: #050507;
		z-index: 7;
	}
	.screen.crt-anim.off {
		animation: crtCollapse 520ms cubic-bezier(0.5, 0, 0.7, 0.2) forwards;
	}
	.screen.crt-anim:not(.off) {
		animation: crtWarmup 420ms ease-out;
	}
	/* collapse: full picture → bright thin line → center dot → black */
	@keyframes crtCollapse {
		0% {
			transform: scale(1, 1);
			filter: brightness(1);
		}
		55% {
			transform: scale(1, 0.012);
			filter: brightness(2.6);
		}
		80% {
			transform: scale(0.18, 0.012);
			filter: brightness(3);
		}
		100% {
			transform: scale(0.001, 0.001);
			filter: brightness(0.2);
		}
	}
	/* warm-up: dot/line → expand → settle, with a brief flicker */
	@keyframes crtWarmup {
		0% {
			transform: scale(0.001, 0.012);
			filter: brightness(2.6);
		}
		40% {
			transform: scale(1, 0.05);
			filter: brightness(2.2);
		}
		60% {
			transform: scale(1, 1);
			filter: brightness(1.6);
		}
		72% {
			filter: brightness(0.85);
		}
		100% {
			transform: scale(1, 1);
			filter: brightness(1);
		}
	}

	.video {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		border: none;
		display: block;
		z-index: 4;
	}

	/* Loading splash while we resolve the media URL */
	.loading {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		font-family: 'Press Start 2P', monospace;
		font-size: 14px;
		color: #f0f0ea;
		letter-spacing: 3px;
		z-index: 5;
		text-shadow: 0 0 8px rgba(180, 255, 220, 0.4);
	}

	/* Paused overlay */
	.screen-overlay {
		position: absolute;
		inset: 0;
		background: rgba(0, 0, 0, 0.5);
		display: flex;
		align-items: center;
		justify-content: center;
		font-family: 'Press Start 2P', monospace;
		font-size: 16px;
		color: #f0f0ea;
		letter-spacing: 3px;
		z-index: 5;
		text-shadow: 0 0 8px rgba(180, 255, 220, 0.4);
	}
	/* STOP blacks out the whole picture — the transport has stopped, no signal. */
	.screen-overlay.stop {
		background: #050507;
	}

	/* ── ON-SCREEN DISPLAY ─────────────────────────────────────────── */
	.osd {
		position: absolute;
		inset: 0;
		z-index: 4;
		display: flex;
		flex-direction: column;
		padding: 22px 28px;
		overflow: hidden;
	}
	.osd-title {
		font-family: 'Press Start 2P', monospace;
		font-size: 13px;
		color: #f0f0ea;
		letter-spacing: 2px;
		padding-bottom: 10px;
		border-bottom: 1px solid #333;
		margin-bottom: 8px;
		flex-shrink: 0;
		text-shadow: 0 0 8px rgba(180, 255, 220, 0.35);
	}
	.osd-back {
		background: none;
		border: none;
		border-bottom: 1px solid #333;
		color: #f0f0ea;
		font-family: 'Press Start 2P', monospace;
		font-size: 11px;
		padding: 0 0 10px;
		margin-bottom: 8px;
		cursor: pointer;
		text-align: left;
		letter-spacing: 1px;
		flex-shrink: 0;
	}
	.osd-back:hover {
		color: #ffb347;
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
		gap: 10px;
		width: 100%;
		padding: 7px 6px;
		background: none;
		border: none;
		border-bottom: 1px solid #222;
		color: #f0f0ea;
		cursor: pointer;
		text-align: left;
	}
	.osd-row:hover {
		background: #ffb347;
		color: #050507;
	}
	.osd-row.playing {
		color: #ffb347;
	}
	.osd-tape {
		flex: 0 0 auto;
		font-size: 18px;
		width: 24px;
		text-align: center;
	}
	.osd-name {
		flex: 1;
		font-family: 'VT323', monospace;
		font-size: 26px;
		line-height: 1.1;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		min-width: 0;
	}
	.osd-count {
		flex: 0 0 auto;
		font-family: 'VT323', monospace;
		font-size: 22px;
		opacity: 0.5;
	}
	.osd-arrow {
		flex: 0 0 auto;
		opacity: 0.4;
		font-size: 18px;
	}
	.osd-resume {
		flex-shrink: 0;
		margin-top: 8px;
		padding: 8px 10px;
		background: #ffb347;
		border: none;
		color: #050507;
		font-family: 'VT323', monospace;
		font-size: 22px;
		cursor: pointer;
		text-align: left;
	}
	.osd-resume:hover {
		background: #ffffff;
	}
	.osd-list::-webkit-scrollbar {
		width: 12px;
	}
	.osd-list::-webkit-scrollbar-track {
		background: #181818;
	}
	.osd-list::-webkit-scrollbar-thumb {
		background: #444;
		border: 2px solid #181818;
	}

	/* ── Cassette bay ──────────────────────────────────────────────── */
	.cassette-bay {
		width: 126px;
		flex-shrink: 0;
		align-self: stretch;
		position: relative;
		border-radius: 3px;
		border: 13px solid;
		border-top-color: #e8e2d0;
		border-left-color: #dbd4c1;
		border-right-color: #a8a18b;
		border-bottom-color: #9c9579;
		box-shadow:
			0 0 0 1px rgba(40, 34, 22, 0.3),
			inset 0 0 0 1px rgba(40, 34, 22, 0.45),
			inset 0 1px 0 1px rgba(255, 255, 255, 0.3);
	}
	.bay-slot {
		position: absolute;
		inset: 0;
		background: linear-gradient(96deg, #0b0a08 0%, #131009 55%, #070605 100%);
		border-radius: 1px;
		overflow: hidden;
		z-index: 1;
		box-shadow:
			inset 0 2px 5px rgba(0, 0, 0, 0.85),
			inset 0 0 0 1px rgba(0, 0, 0, 0.5);
	}
	.bay-slot::before {
		content: '';
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		height: 24px;
		background: linear-gradient(180deg, rgba(0, 0, 0, 0.9) 0%, rgba(0, 0, 0, 0) 100%);
		pointer-events: none;
		z-index: 3;
	}
	.bay-slot::after {
		content: '';
		position: absolute;
		bottom: 0;
		left: 0;
		right: 0;
		height: 9px;
		background: linear-gradient(180deg, #4f4a3b 0%, #b6af98 70%, #cbc4b0 100%);
		box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.6);
		z-index: 2;
	}
	.bay-markings {
		position: absolute;
		top: 26%;
		left: 50%;
		transform: translateX(-50%);
		width: 72px;
		z-index: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 11px;
		color: #e8e4d8;
		pointer-events: none;
	}
	.bay-markings .vhs {
		font-family: 'Helvetica Neue', Arial, sans-serif;
		font-weight: 800;
		font-size: 17px;
		letter-spacing: -0.03em;
		border: 2px solid #e8e4d8;
		border-radius: 3px;
		padding: 0 5px 1px;
		line-height: 1.1;
	}
	.bay-markings .cass-icon {
		width: 17px;
		height: 21px;
		border: 1.5px solid #e8e4d8;
		border-radius: 2px;
		position: relative;
	}
	.bay-markings .cass-icon::before,
	.bay-markings .cass-icon::after {
		content: '';
		position: absolute;
		top: 4px;
		width: 4px;
		height: 4px;
		border-radius: 50%;
		border: 1.5px solid #e8e4d8;
	}
	.bay-markings .cass-icon::before {
		left: 3px;
	}
	.bay-markings .cass-icon::after {
		right: 3px;
	}
	.bay-markings .lside {
		font-family: 'VT323', monospace;
		font-size: 11px;
		font-weight: 700;
		text-align: center;
		line-height: 1.2;
		letter-spacing: 0.07em;
	}
	/* the loaded tape — Eject sends it OUT toward the viewer */
	.cassette {
		position: absolute;
		top: 1px;
		left: 50%;
		transform: translateX(-50%);
		width: calc(100% - 2px);
		height: calc(100% - 2px);
		border: none;
		padding: 0;
		border-radius: 7px;
		background: linear-gradient(100deg, #1a1a1e 0%, #2e2e34 48%, #131316 100%);
		box-shadow:
			inset 0 1px 0 rgba(255, 255, 255, 0.16),
			inset 0 0 0 1px rgba(0, 0, 0, 0.6),
			inset 0 -12px 18px rgba(0, 0, 0, 0.45),
			0 6px 11px rgba(0, 0, 0, 0.5);
		z-index: 4;
		transform-origin: 50% 42%;
		transition:
			transform 500ms cubic-bezier(0.2, 0.82, 0.26, 1),
			box-shadow 500ms ease;
		cursor: default;
	}
	.tape-tag {
		position: absolute;
		top: 9px;
		left: 50%;
		transform: translateX(-50%) rotate(-8deg);
		width: 23px;
		height: 21px;
		background: linear-gradient(180deg, #ffffff, #ece7d9);
		border-radius: 2px;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.55);
		display: flex;
		align-items: center;
		justify-content: center;
		font-family: 'Helvetica Neue', Arial, sans-serif;
		font-weight: 800;
		font-size: 13px;
		color: #2a2620;
		z-index: 6;
	}
	.cassette::before,
	.cassette::after {
		content: '';
		position: absolute;
		left: 11px;
		right: 11px;
		height: 2px;
		background: rgba(0, 0, 0, 0.5);
		box-shadow: 0 1px 0 rgba(255, 255, 255, 0.1);
		border-radius: 1px;
		z-index: 5;
	}
	.cassette::before {
		top: 42px;
	}
	.cassette::after {
		bottom: 38px;
	}
	.tape-label {
		position: absolute;
		top: 46px;
		bottom: 42px;
		left: 22px;
		right: 22px;
		background:
			repeating-linear-gradient(0deg, transparent 0 17px, rgba(0, 0, 0, 0.06) 17px 18px),
			linear-gradient(180deg, #fcfaf2 0%, #f1ecde 100%);
		border-radius: 2px;
		box-shadow:
			inset 0 0 0 1px rgba(0, 0, 0, 0.16),
			0 1px 2px rgba(0, 0, 0, 0.45);
		overflow: hidden;
	}
	.tape-title {
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%) rotate(90deg);
		display: flex;
		flex-direction: column;
		gap: 2px;
		text-align: center;
		width: 300px;
	}
	.tt-line {
		font-family: 'Caveat', cursive;
		font-weight: 700;
		font-size: 20px;
		line-height: 1.04;
		color: #1e1b14;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		letter-spacing: 0.01em;
	}
	.tape-stripe {
		position: absolute;
		bottom: 14px;
		left: 4px;
		width: 50px;
		height: 14px;
		transform: rotate(-22deg);
		background: linear-gradient(180deg, #e8480a 0 34%, #efa52c 34% 67%, #2a6fdb 67% 100%);
		border-radius: 1px;
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.25);
	}
	.cassette.ejected {
		cursor: grab;
		transform: translateX(-50%) translateY(18px) scale(1.2);
		box-shadow:
			inset 0 1px 0 rgba(255, 255, 255, 0.16),
			inset 0 0 0 1px rgba(0, 0, 0, 0.6),
			0 30px 42px rgba(0, 0, 0, 0.5),
			0 12px 16px rgba(0, 0, 0, 0.42);
	}
	.cassette.ejected:active {
		cursor: grabbing;
	}
	.tape-hint {
		position: absolute;
		top: 24%;
		left: 50%;
		transform: translate(-50%, -50%);
		z-index: 9;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0;
		color: #fff;
		font-family: 'VT323', monospace;
		font-size: 12px;
		font-weight: 700;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		text-shadow: 0 1px 4px rgba(0, 0, 0, 0.95);
		pointer-events: none;
		animation: tapeHint 1.15s ease-in-out infinite;
	}
	.tape-hint .hand {
		font-size: 26px;
		line-height: 1;
	}
	@keyframes tapeHint {
		0%,
		100% {
			transform: translate(-50%, -50%) scale(1);
			opacity: 0.92;
		}
		50% {
			transform: translate(-50%, -64%) scale(1.06);
			opacity: 1;
		}
	}

	/* ── Control panel ─────────────────────────────────────────────── */
	.panel {
		width: 200px;
		flex-shrink: 0;
		display: flex;
		flex-direction: column;
		gap: 5px;
		padding: 2px 22px;
		position: relative;
		overflow: visible;
	}
	.panel-row {
		display: flex;
		gap: 8px;
		align-items: flex-end;
		justify-content: space-between;
	}
	.panel-row > div {
		display: flex;
		flex-direction: column;
		align-items: center;
	}
	.panel-row > div:has(.key-med) {
		flex: 1 1 0;
		min-width: 0;
	}
	.panel-row .key-med {
		width: 100%;
	}
	.panel-row .key-med > span {
		width: 100%;
		min-width: 0;
	}

	.brand-panasonic {
		font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
		font-size: 27px;
		font-style: normal;
		font-weight: 700;
		color: #1f1c16;
		letter-spacing: -0.005em;
		margin: 0 0 2px;
		text-align: center;
	}
	.label {
		font-family: ui-monospace, 'SF Mono', Menlo, Monaco, 'Courier New', monospace;
		font-size: 8px;
		color: #2b281f;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		text-align: center;
		font-weight: 700;
		margin-bottom: 6px;
	}
	.label.dim {
		color: #6b6553;
	}

	/* LED display */
	.led {
		background: #0e1b17;
		border-radius: 3px;
		padding: 10px 12px 6px;
		color: #6fe6c9;
		font-family: 'Courier New', monospace;
		font-size: 34px;
		font-weight: 700;
		letter-spacing: 0.12em;
		text-shadow: 0 0 10px #6fe6c9;
		box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.7);
		text-align: center;
		width: 100%;
	}
	/* Reserve the digit row height so powering off (blank text) doesn't collapse the panel */
	.led-digits {
		min-height: 41px;
		line-height: 41px;
	}
	.led-printed-labels {
		display: flex;
		justify-content: space-between;
		margin-top: 4px;
		font-family: ui-monospace, 'SF Mono', Menlo, Monaco, 'Courier New', monospace;
		font-size: 9px;
		color: #e8e4d8;
		letter-spacing: 0.1em;
		font-weight: 700;
		text-shadow: none;
	}

	/* Power LED */
	.power-led {
		display: inline-flex;
		gap: 6px;
		align-items: center;
		background: #0e1b17;
		border-radius: 3px;
		padding: 3px 7px;
		box-shadow: inset 0 2px 3px rgba(0, 0, 0, 0.6);
	}
	.power-led .dot {
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background: #ff2400;
		box-shadow: 0 0 6px #ff2400;
	}
	.power-led .dot.on {
		background: #6fe6c9;
		box-shadow: 0 0 6px #6fe6c9;
	}

	/* Volume */
	.volume-well {
		margin-top: 4px;
		padding: 3px 11px 11px;
		border-radius: 9px;
		border: 1px solid rgba(43, 40, 31, 0.34);
		box-shadow:
			inset 0 1px 0 rgba(255, 255, 255, 0.4),
			0 1px 0 rgba(255, 255, 255, 0.5);
	}
	.vol-label {
		width: fit-content;
		margin: -8px auto 6px;
		padding: 0 7px;
		background: #e8e4d8;
		white-space: nowrap;
		font-family: ui-monospace, 'SF Mono', Menlo, Monaco, 'Courier New', monospace;
		font-size: 9px;
		font-weight: 700;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: #2b281f;
		text-align: center;
	}
	.vol-ticks {
		display: flex;
		align-items: center;
		justify-content: space-between;
		white-space: nowrap;
		font-family: ui-monospace, 'SF Mono', Menlo, Monaco, 'Courier New', monospace;
		font-size: 9px;
		font-weight: 700;
		color: #6b6553;
		padding: 0 1px;
		margin-bottom: 6px;
	}
	.vol-ticks i {
		font-style: normal;
		opacity: 0.45;
	}
	.vol-recess {
		border-radius: 6px;
		padding: 4px 7px;
		background: linear-gradient(180deg, #d4cebc 0%, #dcd6c4 60%, #d5cfbd 100%);
		box-shadow:
			inset 0 3px 5px rgba(0, 0, 0, 0.32),
			inset 0 1px 0 rgba(0, 0, 0, 0.18),
			inset 0 -2px 2px rgba(255, 255, 255, 0.42),
			0 1px 0 rgba(255, 255, 255, 0.55);
	}
	.vol-channel {
		position: relative;
		height: 30px;
		touch-action: none;
	}
	.vol-slot {
		position: absolute;
		left: 4px;
		right: 4px;
		top: 50%;
		transform: translateY(-50%);
		height: 11px;
		border-radius: 5px;
		background: linear-gradient(180deg, #080706 0%, #1c1812 60%, #2c2618 100%);
		box-shadow:
			inset 0 2px 4px rgba(0, 0, 0, 0.9),
			inset 0 1px 0 rgba(0, 0, 0, 0.8),
			0 1px 0 rgba(255, 255, 255, 0.5);
	}
	.vol-knob {
		position: absolute;
		top: 50%;
		transform: translate(-50%, -50%);
		width: 26px;
		height: 34px;
		border-radius: 3px;
		background: linear-gradient(180deg, #f4eedc 0%, #e4dbc2 45%, #cfc4a6 100%);
		border: 1px solid #a89b78;
		box-shadow:
			0 4px 6px rgba(0, 0, 0, 0.4),
			0 1px 2px rgba(0, 0, 0, 0.35),
			inset 0 1px 0 rgba(255, 255, 255, 0.9),
			inset 0 -2px 3px rgba(0, 0, 0, 0.18);
		cursor: ew-resize;
	}
	.vol-knob::before {
		content: '';
		position: absolute;
		left: 50%;
		top: 6px;
		bottom: 6px;
		width: 2px;
		transform: translateX(-50%);
		background: linear-gradient(180deg, #8c8568, #b6ad8e);
		box-shadow:
			1px 0 0 rgba(255, 255, 255, 0.55),
			-1px 0 0 rgba(0, 0, 0, 0.18);
		border-radius: 1px;
	}

	/* Tracking thumbwheels */
	.track-section {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 10px;
		margin-top: auto;
		padding-top: 4px;
		padding-bottom: 3px;
	}
	.track-control {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 2px;
		position: relative;
	}
	.track-label {
		font-family: ui-monospace, 'SF Mono', Menlo, Monaco, 'Courier New', monospace;
		font-size: 8px;
		font-weight: 700;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: #2b281f;
		text-align: center;
		line-height: 1.1;
	}
	.track-fix {
		font-family: ui-monospace, 'SF Mono', Menlo, Monaco, 'Courier New', monospace;
		font-size: 7px;
		font-weight: 700;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: #6b6553;
	}
	.track-roller {
		position: absolute;
		top: 100%;
		left: 50%;
		margin-top: 3px;
		transform: translateX(-50%);
		width: 50px;
		height: 17px;
		border-radius: 0 0 38% 38% / 0 0 100% 100%;
		border: 1px solid #655c45;
		border-top: none;
		background:
			repeating-linear-gradient(
				90deg,
				rgba(38, 33, 21, 0.55) 0 1px,
				rgba(255, 250, 236, 0.42) 1px 2px,
				transparent 2px 3.1px
			),
			linear-gradient(180deg, #6e654a 0%, #dad1b6 36%, #bdb495 72%, #877d5f 100%);
		box-shadow:
			inset 0 2px 3px rgba(0, 0, 0, 0.38),
			0 2px 3px rgba(0, 0, 0, 0.22);
	}
	/* both rollers center under their own label cell */

	/* Row indents */
	.panel-row.inset-deep {
		padding: 0 14px;
	}
	.panel-row.inset-shallow {
		padding: 0 7px;
	}

	/* Bracket row label (REW/◀◀——▶▶/FF) */
	.label.bracket {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0;
		align-items: end;
		width: 100%;
		text-align: left;
		padding: 0 7px;
		margin-bottom: 6px;
	}
	.label.bracket > span {
		position: relative;
		display: flex;
		align-items: baseline;
		font-size: 9px;
		gap: 4px;
	}
	.label.bracket > span:first-child {
		justify-content: flex-start;
	}
	.label.bracket > span:last-child {
		justify-content: flex-end;
	}
	.label.bracket > span:first-child::after {
		content: '';
		flex: 1;
		height: 1px;
		background: #2b281f;
		margin: 0 0 0 4px;
		align-self: center;
	}
	.label.bracket > span:last-child::before {
		content: '';
		flex: 1;
		height: 1px;
		background: #2b281f;
		margin: 0 4px 0 0;
		align-self: center;
	}
	.led-marker {
		display: inline-block;
		width: 13px;
		height: 8px;
		background: #2b281f;
		margin-right: 6px;
		vertical-align: middle;
	}

	/* ── Indicator lamps (green, matching the LED #6fe6c9) ───────────────
	   Default = dark/off. `.on` = solid green glow. `.flash` = pulsing. */
	.lamp {
		background: #3a3a32;
		box-shadow: inset 0 1px 1px rgba(0, 0, 0, 0.5);
		transition:
			background 140ms ease,
			box-shadow 140ms ease;
	}
	.lamp.on {
		background: #2bff5b;
		box-shadow:
			0 0 7px 2px rgba(43, 255, 91, 0.9),
			inset 0 1px 0 rgba(255, 255, 255, 0.55);
	}
	.lamp.flash {
		animation: lampFlash 0.85s steps(1, end) infinite;
	}
	@keyframes lampFlash {
		0%,
		50% {
			background: #2bff5b;
			box-shadow:
				0 0 7px 2px rgba(43, 255, 91, 0.9),
				inset 0 1px 0 rgba(255, 255, 255, 0.55);
		}
		50.01%,
		100% {
			background: #3a3a32;
			box-shadow: inset 0 1px 1px rgba(0, 0, 0, 0.5);
		}
	}

	/* ── STILL / SLOW cluster ─────────────────────────────────────────── */
	.stillslow {
		margin-top: 6px;
		position: relative;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.stillslow-labels {
		display: flex;
		justify-content: space-between;
		align-items: flex-end;
		padding: 0 6px;
		position: relative;
	}
	/* connecting bracket line above the two labels */
	/* connecting bracket: left tick drops to the STILL lamp, line runs right and
	   ends with a tick at the SLOW dial (not past the SLOW text) */
	.stillslow-labels::before {
		content: '';
		position: absolute;
		left: 14px;
		right: 40px;
		top: -3px;
		height: 5px;
		border: 1px solid #2b281f;
		border-bottom: none;
		pointer-events: none;
	}
	.ss-label {
		display: flex;
		align-items: center;
		gap: 4px;
		font-family: ui-monospace, 'SF Mono', Menlo, Monaco, 'Courier New', monospace;
		font-size: 8px;
		font-weight: 700;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: #2b281f;
	}
	.ss-lamp {
		display: inline-block;
		width: 12px;
		height: 8px;
		border-radius: 1px;
	}
	/* STILL/SLOW lamp is YELLOW (overrides the green .lamp rules): solid for STILL, flashing for SLOW */
	.ss-lamp.on {
		background: #ffe24a;
		box-shadow:
			0 0 7px 2px rgba(255, 226, 74, 0.9),
			inset 0 1px 0 rgba(255, 255, 255, 0.55);
	}
	.ss-lamp.flash {
		animation: ssLampFlash 0.6s steps(1, end) infinite;
	}
	@keyframes ssLampFlash {
		0%,
		50% {
			background: #ffe24a;
			box-shadow:
				0 0 7px 2px rgba(255, 226, 74, 0.9),
				inset 0 1px 0 rgba(255, 255, 255, 0.55);
		}
		50.01%,
		100% {
			background: #3a3a32;
			box-shadow: inset 0 1px 1px rgba(0, 0, 0, 0.5);
		}
	}
	.slow-dial {
		display: inline-flex;
		align-items: center;
	}
	.slow-dial .dial-body {
		fill: none;
		stroke: #2b281f;
		stroke-width: 1.1;
	}
	.slow-dial .dial-pointer {
		stroke: #2b281f;
		stroke-width: 1.3;
		stroke-linecap: round;
	}
	.slow-dial .dial-tick {
		stroke: #2b281f;
		stroke-width: 1;
		stroke-linecap: round;
	}

	.transport-rewff {
		position: relative;
	}
	.transport-rewff .panel-row {
		gap: 18px;
	}
	.transport-rewff::after {
		content: '';
		position: absolute;
		left: 50%;
		top: 8px;
		bottom: -8px;
		width: 1px;
		background: #2b281f;
		pointer-events: none;
	}

	/* Bottom strip */
	.bottom {
		display: grid;
		grid-template-columns: auto 1.6fr 2.4fr;
		gap: 16px;
		padding: 13px 6px 4px;
		align-items: stretch;
		box-shadow: inset 0 11px 13px -2px rgba(0, 0, 0, 0.15);
		border-radius: 0 0 6px 6px;
	}
	.av-cluster,
	.av-door-wrap {
		justify-content: center;
	}
	.av-cluster {
		display: flex;
		flex-direction: column;
		gap: 12px;
		align-items: flex-start;
	}
	.label.tl {
		text-align: left;
		margin-bottom: 0;
	}
	.av-power {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.av-power-row {
		display: flex;
		align-items: center;
		gap: 9px;
	}
	.power-light {
		width: 15px;
		height: 7px;
		border-radius: 1px;
		background: linear-gradient(180deg, #ff5038, #cc1a0a);
		box-shadow:
			0 0 7px 1px rgba(255, 70, 40, 0.75),
			inset 0 1px 0 rgba(255, 255, 255, 0.45);
		transition:
			background 160ms ease,
			box-shadow 160ms ease;
	}
	.power-light.off {
		background: linear-gradient(180deg, #5a2018, #3a120c);
		box-shadow: inset 0 1px 1px rgba(0, 0, 0, 0.5);
	}
	.av-hp {
		display: flex;
		align-items: center;
		gap: 9px;
	}
	.power-key > span {
		width: 32px;
		height: 32px;
		min-width: 0;
		padding: 0;
	}
	.jack {
		width: 17px;
		height: 17px;
		border-radius: 50%;
		background: radial-gradient(circle at 50% 38%, #2c2820 0%, #070605 72%);
		box-shadow:
			inset 0 2px 3px rgba(0, 0, 0, 0.9),
			0 1px 0 rgba(255, 255, 255, 0.4);
	}
	.vents {
		align-self: stretch;
		min-height: 64px;
		background:
			repeating-linear-gradient(
				180deg,
				rgba(18, 15, 10, 0.62) 0 2px,
				rgba(255, 255, 255, 0.4) 2px 3px,
				transparent 3px 5.5px
			),
			linear-gradient(180deg, #d2cbb8 0%, #c4bca6 100%);
		border-radius: 2px;
		box-shadow:
			inset 0 1px 2px rgba(0, 0, 0, 0.2),
			inset 0 -1px 0 rgba(255, 255, 255, 0.35);
	}

	/* Flip-down picture-controls door */
	.av-door-wrap {
		position: relative;
		perspective: 620px;
		align-self: stretch;
		min-height: 58px;
	}
	.av-knobs {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: space-around;
		padding: 4px 8px;
	}
	.knob-col {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 3px;
	}
	.pic-knob {
		width: 22px;
		height: 22px;
		border-radius: 50%;
		background: radial-gradient(circle at 50% 34%, #3c3a34 0%, #1a1814 58%, #0b0a07 100%);
		box-shadow:
			0 1px 2px rgba(0, 0, 0, 0.55),
			inset 0 1px 0 rgba(255, 255, 255, 0.16);
		position: relative;
	}
	.pic-knob::after {
		content: '';
		position: absolute;
		left: 50%;
		top: 3px;
		width: 2px;
		height: 7px;
		background: #cbc4b1;
		transform: translateX(-50%);
		border-radius: 1px;
	}
	.knob-label {
		font-family: ui-monospace, 'SF Mono', Menlo, Monaco, 'Courier New', monospace;
		font-size: 6px;
		font-weight: 700;
		color: #2b281f;
		text-transform: uppercase;
		letter-spacing: 0.02em;
		white-space: nowrap;
	}
	.av-door {
		position: absolute;
		inset: 0;
		background: linear-gradient(180deg, #e8e2d0 0%, #d7d0bc 100%);
		border-radius: 3px;
		border: 1px solid rgba(43, 40, 31, 0.22);
		box-shadow:
			inset 0 1px 0 rgba(255, 255, 255, 0.6),
			inset 0 -2px 3px rgba(0, 0, 0, 0.1),
			0 1px 2px rgba(0, 0, 0, 0.2);
		transform-origin: bottom center;
		transform: rotateX(0deg);
		transition:
			transform 520ms cubic-bezier(0.32, 0.72, 0.3, 1),
			box-shadow 520ms ease;
		cursor: pointer;
		backface-visibility: hidden;
		z-index: 2;
		padding: 0;
		text-align: left;
	}
	.av-door.pressed:not(.open) {
		transform: translateZ(-7px) scale(0.99);
		transition-duration: 110ms;
		box-shadow: inset 0 2px 6px rgba(0, 0, 0, 0.28);
	}
	.av-door.open {
		transform: rotateX(-78deg);
		box-shadow: 0 16px 20px rgba(0, 0, 0, 0.3);
	}
	.door-push {
		position: absolute;
		top: 6px;
		left: 0;
		right: 0;
		text-align: center;
		font-family: ui-monospace, 'SF Mono', Menlo, Monaco, 'Courier New', monospace;
		font-size: 8px;
		font-weight: 700;
		letter-spacing: 0.12em;
		color: #6b6553;
		text-transform: uppercase;
	}
	.av-door .model-label {
		position: absolute;
		bottom: 4px;
		right: 9px;
	}
	.model-label {
		text-align: right;
		font-family: ui-monospace, 'SF Mono', Menlo, Monaco, 'Courier New', monospace;
		color: #2b281f;
	}
	.model-label .small {
		font-size: 7px;
	}
	.model-label .big {
		font-family: 'Helvetica Neue', sans-serif;
		font-size: 18px;
		font-weight: 700;
		letter-spacing: -0.02em;
		color: #2b281f;
	}
	.model-label .big .num {
		font-style: italic;
	}

	/* ── BUTTONS ───────────────────────────────────────────────────── */
	.bli-key {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		background: var(--shadow, #6b1f00);
		border: 1.5px solid var(--edge, #a14a14);
		border-radius: 2px;
		padding: 0;
		cursor: pointer;
		line-height: 1;
		font-family: 'VT323', monospace;
		color: var(--ink, #1a1408);
	}
	.bli-key > span {
		display: inline-flex;
		gap: 6px;
		align-items: center;
		justify-content: center;
		background: var(--face, #ff8a3d);
		border: 1.5px solid var(--edge, #a14a14);
		border-radius: 2px;
		margin: -1.5px;
		padding: 14px 20px;
		font-size: 18px;
		font-weight: 800;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		transform: translateY(-2px);
		transition:
			transform 100ms cubic-bezier(0.3, 1.4, 0.5, 1),
			filter 100ms ease;
		min-width: 64px;
	}
	.bli-key:hover:not(:disabled) > span {
		transform: translateY(-4px);
		filter: brightness(1.03);
	}
	.bli-key:active:not(:disabled) > span {
		transform: translateY(0);
		filter: brightness(0.98);
		transition-duration: 40ms;
	}
	.bli-key:disabled {
		opacity: 0.4;
		cursor: default;
	}
	/* engaged PLAY stays seated */
	.bli-key.engaged > span {
		transform: translateY(0);
		filter: brightness(1.05);
	}

	/* #2 Cassette Play style */
	.style-cassette {
		border-radius: 3px;
		box-shadow: 0 2px 0 var(--edge);
	}
	.style-cassette > span {
		border-radius: 2px;
		box-shadow:
			inset 0 2px 0 rgba(255, 255, 255, 0.55),
			inset 0 -1px 0 rgba(0, 0, 0, 0.18);
	}

	/* Button color tints */
	.tint-beige {
		--face: #e8ddc2;
		--shadow: #6b5e48;
		--edge: #2a2419;
		--ink: #1a1408;
	}
	.tint-green {
		--face: #6bb562;
		--shadow: #1e3f1a;
		--edge: #2e5e2a;
		--ink: #ffffff;
	}
	.tint-gray {
		--face: #b0ac9d;
		--shadow: #5e5a4e;
		--edge: #2c2a22;
		--ink: #1a1408;
	}

	/* Big buttons — PLAY / STOP */
	.key-big {
		display: flex;
		width: 100%;
	}
	.bli-key.key-big > span {
		padding: 8px 0;
		font-size: 24px;
		flex: 1;
		letter-spacing: 0;
		min-width: 0;
	}
	.bli-key.key-wide > span {
		padding: 8px 0;
	}
	.bli-key.key-small > span {
		padding: 6px 8px;
		font-size: 9px;
		min-width: 36px;
		letter-spacing: 0.06em;
	}
	.bli-key.key-med > span {
		padding: 6px 8px;
		font-size: 11px;
		min-width: 0;
		letter-spacing: 0.08em;
	}

	/* SVG glyphs inside buttons */
	.glyph {
		display: block;
	}
	.glyph rect,
	.glyph polygon {
		fill: none;
		stroke: var(--ink, #fff);
		stroke-width: 2;
	}
	.glyph-stop rect {
		stroke: #ffffff;
	}
	/* STILL bowtie + SLOW (bar + triangle) — filled like the printed icons */
	.glyph-still polygon,
	.glyph-slow polygon,
	.glyph-slow rect {
		fill: var(--ink, #1a1408);
		stroke: none;
	}
</style>
