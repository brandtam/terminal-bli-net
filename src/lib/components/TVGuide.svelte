<script lang="ts">
	import type { GroupMeta, PublicBot, Channel, ChannelSlot } from '$lib/types';
	import { getSlotIndex, getCurrentSlot, isShowOnAir } from '$lib/schedule';
	import {
		type TimeSlot,
		type MergedCell,
		getEpisodeInfo,
		buildTimeSlots,
		buildMergedCells,
		formatGuideDate,
		formatLiveClock
	} from './tv-guide-utils';
	import { getAppContext } from '$lib/os/os-context';
	import { untrack } from 'svelte';

	// Zero-prop window-host app (Slice 4). Everything the guide shows — the
	// channel grid, the live clock, the marquee — derives off the live OS, so
	// the schedule rolls forward in real time as os.slotNow/os.now advance with
	// no props threaded through Desktop. Opening/focusing chats goes straight
	// through os (chat windows are keyed `chat:<slug>`).
	const { os } = getAppContext();

	const COLUMN_WIDTH_PX = 140;
	const CHANNEL_COL_PX = 72;

	let groupMap = $derived(new Map(os.groups.map((g) => [g.slug, g])));

	// The slug of the show whose chat window is focused — used to highlight that
	// channel and offer a "bring to front" button. Aliased from os for the three
	// template reads below.
	const activeChatGroupSlug = $derived(os.activeChatGroupSlug);

	interface FeaturedShow {
		channelSlug: string;
		showSlug: string;
		title: string;
		year: string;
		ch: number;
		net: string;
		isLive: boolean;
	}

	function getGroupBots(group: GroupMeta): PublicBot[] {
		return os.bots.filter((b) => b.group === group.slug);
	}

	let scrollerEl = $state<HTMLDivElement | null>(null);
	let fixedEl = $state<HTMLDivElement | null>(null);
	let paused = $state(false);
	let featured = $state<FeaturedShow | null>(null);

	let slots = $derived(buildTimeSlots(os.slotNow, os.timezone));
	let currentSlotIdx = $derived(getSlotIndex(os.slotNow, os.timezone));

	let sortedChannels = $derived([...os.channels].sort((a, b) => a.number - b.number));

	let schedule = $derived.by(() => {
		return sortedChannels.map((channel) => ({
			channel,
			cells: buildMergedCells(channel, slots, currentSlotIdx, groupMap)
		}));
	});

	let marqueeText = $derived.by(() => {
		const nowPlaying: string[] = [];
		for (const channel of sortedChannels) {
			const slot = getCurrentSlot(channel, os.slotNow, os.timezone);
			if (slot) {
				const show = groupMap.get(slot.showSlug);
				const epInfo = getEpisodeInfo(slot, groupMap);
				const showName = show?.name ?? slot.showSlug;
				const epTitle = epInfo ? ` — "${epInfo.title}"` : '';
				nowPlaying.push(`● CH${channel.number} ${showName.toUpperCase()}${epTitle}`);
			}
		}
		return (
			nowPlaying.join('   ✦   ') || '● ALL CHANNELS — check the schedule for upcoming broadcasts'
		);
	});

	$effect(() => {
		if (schedule.length === 0) return;
		if (untrack(() => featured)) return;
		const firstLive = schedule.find((s) => s.cells.some((c) => c.isLive));
		if (firstLive) {
			const liveCell = firstLive.cells.find((c) => c.isLive);
			if (liveCell) {
				const epInfo = getEpisodeInfo(
					{
						showSlug: liveCell.showSlug,
						season: liveCell.season,
						episode: liveCell.episode
					},
					groupMap
				);
				featured = {
					channelSlug: firstLive.channel.slug,
					showSlug: liveCell.showSlug,
					title: epInfo?.title ?? liveCell.title,
					year: epInfo?.year ?? liveCell.year,
					ch: firstLive.channel.number,
					net: firstLive.channel.network,
					isLive: true
				};
			}
		}
	});

	// Auto-scroll loop. The effect owns the rAF: it stops entirely while
	// paused or when the grid-loop tweak disables scrolling, restarts when
	// either changes, and cancels on unmount.
	$effect(() => {
		const el = scrollerEl;
		const loop = os.tweaks.tvGridLoop;
		if (!el || paused || loop <= 0) return;

		let raf: number;
		let last = performance.now();
		let accum = 0;

		const animate = (t: number) => {
			const dt = (t - last) / 1000;
			last = t;
			const max = el.scrollWidth - el.clientWidth;
			const speed = max > 0 ? max / loop : 0;

			if (speed > 0) {
				accum += speed * dt;
				const whole = Math.floor(accum);
				if (whole > 0) {
					accum -= whole;
					let target = el.scrollLeft + whole;
					if (target >= max) {
						target = 0;
						accum = 0;
					}
					el.scrollLeft = target;
				}
			}
			raf = requestAnimationFrame(animate);
		};

		raf = requestAnimationFrame(animate);
		return () => cancelAnimationFrame(raf);
	});

	function selectFeaturedFromChannel(channel: Channel) {
		const slot = getCurrentSlot(channel, os.slotNow, os.timezone);
		if (slot) {
			const epInfo = getEpisodeInfo(slot, groupMap);
			featured = {
				channelSlug: channel.slug,
				showSlug: slot.showSlug,
				title: epInfo?.title ?? `S${slot.season}E${slot.episode}`,
				year: epInfo?.year ?? '',
				ch: channel.number,
				net: channel.network,
				isLive: true
			};
		} else {
			// Find first non-null slot on this channel
			const firstSlot = channel.schedule.find((s): s is ChannelSlot => s !== null);
			if (firstSlot) {
				const epInfo = getEpisodeInfo(firstSlot, groupMap);
				featured = {
					channelSlug: channel.slug,
					showSlug: firstSlot.showSlug,
					title: epInfo?.title ?? `S${firstSlot.season}E${firstSlot.episode}`,
					year: epInfo?.year ?? '',
					ch: channel.number,
					net: channel.network,
					isLive: false
				};
			}
		}
	}

	function selectFeaturedFromCell(channel: Channel, cell: MergedCell) {
		featured = {
			channelSlug: channel.slug,
			showSlug: cell.showSlug,
			title: cell.title,
			year: cell.year,
			ch: channel.number,
			net: channel.network,
			isLive: cell.isLive
		};
	}

	function handleCellDblClick(cell: MergedCell) {
		if (!isShowOnAir(cell.showSlug, os.channels, os.slotNow, os.timezone)) return;
		const group = groupMap.get(cell.showSlug);
		if (!group) return;
		os.openChat(group);
	}
</script>

<div class="tvguide">
	{#snippet epCell(
		channel: Channel,
		cell: MergedCell,
		chIdx: number,
		isAlt: boolean,
		colStart: number,
		colSpan: number,
		pinned: boolean
	)}
		{@const showGroup = groupMap.get(cell.showSlug)}
		{@const isFeatured =
			featured &&
			featured.channelSlug === channel.slug &&
			featured.showSlug === cell.showSlug &&
			featured.title === cell.title}
		<div
			class="tvg-cell tvg-ep-cell"
			class:now={cell.isLive && pinned}
			class:live={cell.isLive}
			class:featured={isFeatured}
			class:alt={isAlt}
			class:tvg-now-col={pinned}
			style="grid-column: {colStart} / span {colSpan}; grid-row: {chIdx + 2};"
			role="button"
			tabindex="0"
			aria-label="{showGroup?.name ?? cell.showSlug} - {cell.title}{cell.isLive
				? ' (live)'
				: ' (off air)'}"
			onclick={() => selectFeaturedFromCell(channel, cell)}
			ondblclick={() => handleCellDblClick(cell)}
			onkeydown={(e) => {
				if (e.key === 'Enter') {
					e.preventDefault();
					if (cell.isLive) handleCellDblClick(cell);
					else selectFeaturedFromCell(channel, cell);
				} else if (e.key === ' ') {
					e.preventDefault();
					selectFeaturedFromCell(channel, cell);
				}
			}}
			title={cell.isLive ? 'Click to preview · double-click to chat' : 'Off air — click to preview'}
		>
			<div class="ep-show">
				<span class="ep-show-name">{(showGroup?.name ?? cell.showSlug).toUpperCase()}</span>
				{#if colSpan > 1}<span class="ep-runtime">{colSpan * 30}MIN</span>{/if}
			</div>
			<div class="ep-title">
				"{cell.title}" {#if cell.year}<span class="ep-year">({cell.year})</span>{/if}
			</div>
		</div>
	{/snippet}

	<!-- Preview Pane -->
	{#if featured}
		{@const feat = featured}
		{@const featuredGroup = groupMap.get(feat.showSlug)}
		{@const featuredBots = featuredGroup ? getGroupBots(featuredGroup) : []}
		{@const showOnAir = isShowOnAir(feat.showSlug, os.channels, os.slotNow, os.timezone)}
		<div class="tvg-preview">
			<div class="tvg-preview-bar">
				<span class="tvg-preview-net">{feat.net} · CHANNEL {feat.ch}</span>
				<span class="tvg-preview-time">
					{#if feat.isLive}ON NOW{:else}UPCOMING{/if}
				</span>
			</div>
			<div class="tvg-preview-main">
				<div class="tvg-preview-text">
					<div class="tvg-preview-titleline">
						<span class="tvg-preview-title">"{feat.title}"</span>
						{#if feat.year}<span class="tvg-preview-year">({feat.year})</span>{/if}
					</div>
					<div class="tvg-preview-showname">
						{featuredGroup?.name ?? feat.showSlug}
						{#if featuredGroup}<span class="tvg-preview-era"> · {featuredGroup.era}</span>{/if}
					</div>
					<div class="tvg-preview-dialogue">
						<span class="tvg-preview-who">{featuredBots[0]?.name.toUpperCase() ?? '—'}:</span>
						<span class="tvg-preview-line">"{featuredBots[0]?.greeting ?? '...'}"</span>
					</div>
				</div>
				{#if showOnAir && featuredGroup}
					<button
						class="btn primary"
						onclick={() => {
							if (featuredGroup) os.openChat(featuredGroup);
						}}
					>
						▸ CHAT
					</button>
				{/if}
			</div>
		</div>
	{/if}

	<!-- Date Bar -->
	<div class="tvg-datebar">
		<span class="tvg-datebar-date">{formatGuideDate(os.now, os.timezone)}</span>
		<button
			class="tvg-datebar-live"
			onclick={() => {
				if (scrollerEl) scrollerEl.scrollLeft = 0;
				paused = true;
				setTimeout(() => {
					paused = false;
				}, 1000);
			}}
		>
			{#if sortedChannels.some((ch) => getCurrentSlot(ch, os.slotNow, os.timezone) !== null)}
				<span class="tvg-now-dot live">●</span>LIVE @ {formatLiveClock(os.now, os.timezone)}
			{:else}
				<span class="tvg-now-dot">●</span>OFF AIR · {formatLiveClock(os.now, os.timezone)}
			{/if}
			{#if paused}<span class="tvg-paused"> · ⏸ paused</span>{/if}
		</button>
	</div>

	<!-- Timeline Grid: fixed left (CH + NOW) + scrolling right -->
	<div
		class="tvg-schedule"
		role="region"
		aria-label="TV schedule"
		onmouseenter={os.tweaks.tvPauseOnHover
			? () => {
					paused = true;
				}
			: undefined}
		onmouseleave={os.tweaks.tvPauseOnHover
			? () => {
					paused = false;
				}
			: undefined}
	>
		<!-- Fixed panel: CH + NOW -->
		<div class="tvg-fixed" bind:this={fixedEl}>
			<div
				class="tvg-fixed-grid"
				style="grid-template-columns: {CHANNEL_COL_PX}px {COLUMN_WIDTH_PX}px;"
			>
				<div class="tvg-cell tvg-ch-cell tvg-ch-head" style="grid-column: 1; grid-row: 1;">CH</div>
				<div class="tvg-cell tvg-time-cell now" style="grid-column: 2; grid-row: 1;">
					<span class="tvg-now-dot">●</span>
					{slots[0].label}
				</div>

				{#each schedule as { channel, cells }, chIdx (channel.slug)}
					{@const isAlt = chIdx % 2 === 1}
					{@const currentShowSlug =
						getCurrentSlot(channel, os.slotNow, os.timezone)?.showSlug ?? null}
					{@const nowCell = cells.find((c) => c.startSlot === 0)}
					<div
						class="tvg-cell tvg-ch-cell"
						class:alt={isAlt}
						class:current={currentShowSlug === activeChatGroupSlug && activeChatGroupSlug !== null}
						style="grid-column: 1; grid-row: {chIdx + 2}; cursor: pointer;"
						role="button"
						tabindex="0"
						onclick={() => selectFeaturedFromChannel(channel)}
						onkeydown={(e) => {
							if (e.key === 'Enter' || e.key === ' ') {
								e.preventDefault();
								selectFeaturedFromChannel(channel);
							}
						}}
					>
						<div class="ch-num">{String(channel.number).padStart(2, '0')}</div>
						<div class="ch-net">{channel.network}</div>
						{#if currentShowSlug === activeChatGroupSlug && activeChatGroupSlug !== null}
							<button
								class="ch-open"
								onclick={(e) => {
									e.stopPropagation();
									if (activeChatGroupSlug) os.focusWindow(`chat:${activeChatGroupSlug}`);
								}}
								title="Bring chat window to front">● open</button
							>
						{/if}
					</div>

					<!-- NOW cell -->
					{#if nowCell}
						{@render epCell(channel, nowCell, chIdx, isAlt, 2, 1, true)}
					{:else}
						<div
							class="tvg-cell tvg-ep-cell tvg-now-col off-air"
							class:alt={isAlt}
							style="grid-column: 2; grid-row: {chIdx + 2};"
						>
							<div class="ep-show"><span class="ep-show-name">OFF AIR</span></div>
						</div>
					{/if}
				{/each}
			</div>
		</div>

		<!-- Scrollable panel: remaining time slots -->
		<div
			class="tvg-scroller"
			bind:this={scrollerEl}
			onscroll={() => {
				if (fixedEl && scrollerEl) fixedEl.scrollTop = scrollerEl.scrollTop;
			}}
		>
			<div
				class="tvg-scroll-grid"
				style="grid-template-columns: repeat({slots.length - 1}, {COLUMN_WIDTH_PX}px);"
			>
				{#each slots as s, i (i)}
					{#if i > 0}
						<div
							class="tvg-cell tvg-time-cell"
							class:day-boundary={s.isDayBoundary}
							style="grid-column: {i}; grid-row: 1;"
						>
							{#if s.isDayBoundary}<span class="tvg-day-mark">→ </span>{/if}
							{s.label}
						</div>
					{/if}
				{/each}

				{#each schedule as { channel, cells }, chIdx (channel.slug)}
					{@const isAlt = chIdx % 2 === 1}
					{@const nowCell = cells.find((c) => c.startSlot === 0)}

					{#if nowCell && nowCell.span > 1}
						{@render epCell(channel, nowCell, chIdx, isAlt, 1, nowCell.span - 1, false)}
					{/if}

					{#each cells as cell (cell.startSlot)}
						{#if cell.startSlot > 0}
							{@render epCell(channel, cell, chIdx, isAlt, cell.startSlot, cell.span, false)}
						{/if}
					{/each}
				{/each}
			</div>
		</div>
	</div>

	<!-- Bottom Marquee -->
	<div class="tvg-marquee">
		<div class="tvg-marquee-track" style="animation-duration: {os.tweaks.marqueeLoop}s;">
			{marqueeText}&nbsp;&nbsp;&nbsp;{marqueeText}
		</div>
	</div>
</div>

<style>
	.tvguide {
		--tvg-bg: var(--brand-color-prevue);
		--tvg-dark: var(--brand-color-prevue-dark);
		--tvg-mid: var(--brand-color-prevue-mid);
		--tvg-text: var(--brand-color-paper);
		--tvg-gold: var(--brand-color-yellow);
		--tvg-accent: var(--brand-color-orange);
		--tvg-live: var(--brand-color-green);
		--tvg-ink: var(--brand-color-ink);
		--tvg-alt: #6b0000;
		--tvg-alt-dark: #2a0000;
		--tvg-alt-border: #aa2929;
		--tvg-hover: #2929cc;
		--tvg-off: #888;
		--tvg-off-border: #555;
		--tvg-paused: #ffd86b;

		font-family: var(--brand-font-ui, 'Pixelify Sans', sans-serif);
		display: flex;
		flex-direction: column;
		height: 100%;
		background: var(--tvg-bg);
		color: var(--tvg-text);
		min-height: 0;
	}

	/* ====== Preview pane ====== */
	.tvg-preview {
		background: var(--tvg-bg);
		color: var(--tvg-text);
		border-bottom: 2px solid var(--tvg-text);
		flex-shrink: 0;
	}
	.tvg-preview-bar {
		display: flex;
		justify-content: space-between;
		align-items: center;
		background: var(--tvg-dark);
		padding: 5px 12px;
		font-family: var(--brand-font-display, 'Press Start 2P', monospace);
		font-size: 9px;
		color: var(--tvg-gold);
		border-bottom: 1px solid var(--tvg-mid);
	}
	.tvg-preview-net {
		letter-spacing: 0.04em;
	}
	.tvg-preview-main {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		gap: 12px 14px;
		padding: 10px 12px 12px;
		align-items: center;
	}
	.tvg-preview-text {
		min-width: 0;
	}
	.tvg-preview-titleline {
		font-family: var(--brand-font-body, 'VT323', monospace);
		font-size: 22px;
		color: var(--tvg-text);
		line-height: 1.15;
	}
	.tvg-preview-title {
		font-weight: 700;
	}
	.tvg-preview-year {
		color: rgba(255, 255, 255, 0.55);
		font-size: 16px;
		margin-left: 4px;
	}
	.tvg-preview-showname {
		font-family: var(--brand-font-display, 'Press Start 2P', monospace);
		font-size: 9px;
		color: var(--tvg-gold);
		letter-spacing: 0.02em;
		margin-top: 4px;
	}
	.tvg-preview-era {
		color: rgba(249, 189, 43, 0.6);
	}
	.tvg-preview-dialogue {
		font-family: var(--brand-font-body, 'VT323', monospace);
		font-size: 16px;
		color: var(--tvg-text);
		margin-top: 6px;
		line-height: 1.25;
		display: flex;
		gap: 6px;
		align-items: baseline;
		flex-wrap: wrap;
	}
	.tvg-preview-who {
		color: var(--tvg-live);
		font-family: var(--brand-font-display, 'Press Start 2P', monospace);
		font-size: 8px;
		letter-spacing: 0.02em;
		flex-shrink: 0;
	}
	.tvg-preview-line {
		font-style: italic;
		opacity: 0.95;
		min-width: 0;
	}

	/* ====== Date bar ====== */
	.tvg-datebar {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 6px 12px;
		background: var(--tvg-dark);
		color: var(--tvg-gold);
		font-family: var(--brand-font-display, 'Press Start 2P', monospace);
		font-size: 10px;
		letter-spacing: 0.02em;
		border-bottom: 1px solid var(--tvg-mid);
		flex-shrink: 0;
	}
	.tvg-datebar-live {
		color: var(--tvg-text);
		display: flex;
		align-items: center;
		gap: 6px;
		background: none;
		border: none;
		font: inherit;
		cursor: pointer;
		padding: 0;
	}
	.tvg-datebar-live:hover {
		color: var(--tvg-gold);
	}
	.tvg-now-dot {
		display: inline-block;
		color: var(--tvg-accent);
		animation: blink 1.4s steps(2, end) infinite;
	}
	.tvg-now-dot.live {
		color: var(--tvg-live);
	}
	.tvg-paused {
		color: var(--tvg-paused);
		font-style: italic;
	}

	/* ====== Two-panel timeline grid ====== */
	.tvg-schedule {
		display: flex;
		flex: 1;
		min-height: 0;
	}
	.tvg-fixed {
		flex-shrink: 0;
		overflow-y: auto;
		background: var(--tvg-bg);
		border-right: 2px solid var(--tvg-gold);
		scrollbar-width: none;
	}
	.tvg-fixed::-webkit-scrollbar {
		display: none;
	}
	.tvg-fixed-grid {
		display: grid;
		grid-auto-rows: 64px;
	}
	.tvg-scroller {
		flex: 1;
		overflow-x: hidden;
		overflow-y: auto;
		min-width: 0;
		min-height: 0;
		background: var(--tvg-bg);
	}
	.tvg-scroll-grid {
		display: grid;
		grid-auto-rows: 64px;
		width: max-content;
		min-width: 100%;
	}

	/* Channel column */
	.tvg-ch-cell {
		background: var(--tvg-dark);
		border-right: 2px solid var(--tvg-text);
		border-bottom: 1px solid var(--tvg-mid);
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		font-family: var(--brand-font-display, 'Press Start 2P', monospace);
		font-size: 11px;
		color: var(--tvg-gold);
		gap: 3px;
		padding: 4px;
		text-align: center;
	}
	.tvg-ch-head {
		font-size: 11px;
		color: var(--tvg-gold);
	}
	.tvg-ch-cell.alt {
		background: var(--tvg-alt-dark);
	}
	.tvg-ch-cell.current {
		box-shadow: inset 3px 0 0 var(--tvg-live);
	}
	.ch-num {
		font-size: 13px;
		color: var(--tvg-text);
	}
	.ch-net {
		font-size: 8px;
		color: var(--tvg-live);
	}
	.ch-open {
		margin-top: 2px;
		font-family: var(--brand-font-display, 'Press Start 2P', monospace);
		font-size: 7px;
		color: var(--tvg-live);
		letter-spacing: 0.04em;
		background: var(--tvg-ink);
		padding: 2px 4px;
		border: 1px solid var(--tvg-live);
		border-radius: 0;
		animation: blink 1.4s steps(2, end) infinite;
		cursor: pointer;
	}
	.ch-open:hover {
		animation: none;
		background: var(--tvg-live);
		color: var(--tvg-ink);
		border-color: var(--tvg-ink);
	}

	/* NOW column */
	.tvg-now-col.off-air {
		background: var(--tvg-dark);
		cursor: default;
	}
	.tvg-now-col.off-air.alt {
		background: var(--tvg-alt-dark);
	}

	/* Time header */
	.tvg-time-cell {
		background: var(--tvg-dark);
		font-family: var(--brand-font-display, 'Press Start 2P', monospace);
		font-size: 9px;
		color: var(--tvg-gold);
		text-align: center;
		display: flex;
		align-items: center;
		justify-content: center;
		border-right: 1px solid var(--tvg-mid);
		border-bottom: 2px solid var(--tvg-text);
		white-space: nowrap;
		z-index: 1;
		gap: 4px;
	}
	.tvg-time-cell.now {
		background: var(--tvg-gold);
		color: var(--tvg-ink);
		font-weight: 700;
	}
	.tvg-time-cell.day-boundary {
		background: var(--tvg-mid);
		color: var(--tvg-text);
	}
	.tvg-day-mark {
		color: var(--tvg-live);
		font-size: 8px;
	}

	/* Episode cells */
	.tvg-ep-cell {
		background: var(--tvg-bg);
		border-right: 1px solid var(--tvg-mid);
		border-bottom: 1px solid var(--tvg-mid);
		padding: 6px 8px;
		font-family: var(--brand-font-body, 'VT323', monospace);
		font-size: 16px;
		color: var(--tvg-text);
		display: flex;
		flex-direction: column;
		justify-content: center;
		overflow: hidden;
		cursor: pointer;
		min-width: 0;
		position: relative;
	}
	.tvg-ep-cell.alt {
		background: var(--tvg-alt);
		border-right-color: var(--tvg-alt-border);
	}
	.tvg-ep-cell:hover {
		background: var(--tvg-hover);
	}
	.tvg-ep-cell.alt:hover {
		background: var(--tvg-alt-border);
	}
	.tvg-ep-cell:hover .ep-title {
		color: var(--tvg-live);
	}

	.tvg-ep-cell.now {
		background: rgba(249, 189, 43, 0.18);
		box-shadow: inset 0 0 0 2px var(--tvg-gold);
	}
	.tvg-ep-cell.now.alt {
		background: rgba(249, 189, 43, 0.3);
	}
	.tvg-ep-cell.now .ep-title {
		color: var(--tvg-gold);
		font-weight: 700;
	}

	.tvg-ep-cell.featured {
		box-shadow: inset 0 0 0 3px var(--tvg-live);
	}
	.tvg-ep-cell.featured .ep-show-name {
		color: var(--tvg-live);
	}

	.tvg-cell[role='button']:focus-visible {
		outline: 2px solid var(--tvg-gold);
		outline-offset: -2px;
		z-index: 1;
	}

	.ep-show {
		font-family: var(--brand-font-display, 'Press Start 2P', monospace);
		font-size: 8px;
		color: var(--tvg-gold);
		letter-spacing: 0.02em;
		margin-bottom: 4px;
		display: flex;
		align-items: center;
		gap: 5px;
		flex-wrap: wrap;
	}
	.ep-show-name {
		color: var(--tvg-gold);
	}
	.ep-runtime {
		font-size: 7px;
		color: var(--tvg-live);
		background: rgba(166, 240, 0, 0.12);
		border: 1px solid var(--tvg-live);
		padding: 1px 3px;
		letter-spacing: 0.02em;
	}
	.ep-title {
		font-family: var(--brand-font-body, 'VT323', monospace);
		font-size: 16px;
		color: var(--tvg-text);
		line-height: 1.1;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.ep-year {
		color: rgba(255, 255, 255, 0.5);
		font-size: 13px;
	}

	/* ====== Marquee ====== */
	.tvg-marquee {
		overflow: hidden;
		background: var(--tvg-text);
		color: var(--tvg-bg);
		padding: 4px 0;
		border-top: 2px solid var(--tvg-ink);
		flex-shrink: 0;
	}
	.tvg-marquee-track {
		display: inline-block;
		white-space: nowrap;
		font-family: var(--brand-font-body, 'VT323', monospace);
		font-size: 17px;
		font-weight: 700;
		animation: tvg-scroll linear infinite;
		padding-left: 100%;
	}

	@keyframes blink {
		0%,
		49% {
			opacity: 1;
		}
		50%,
		100% {
			opacity: 0;
		}
	}
	@keyframes tvg-scroll {
		from {
			transform: translateX(0);
		}
		to {
			transform: translateX(-100%);
		}
	}
</style>
