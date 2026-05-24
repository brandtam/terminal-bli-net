<script lang="ts">
	import type { GroupMeta, Bot, Channel, ChannelSlot } from '$lib/types';
	import { getSlotIndex, getCurrentSlot, isShowOnAir } from '$lib/schedule';
	import { onMount } from 'svelte';

	let {
		groups,
		bots,
		channels,
		timezone,
		now,
		activeChatGroupSlug = null,
		gridLoop = 400,
		marqueeLoop = 100,
		pauseOnHover = false,
		onOpenChat,
		onFocusChat,
		onSubscribe
	}: {
		groups: GroupMeta[];
		bots: Bot[];
		channels: Channel[];
		timezone?: string;
		now: Date;
		activeChatGroupSlug?: string | null;
		gridLoop?: number;
		marqueeLoop?: number;
		pauseOnHover?: boolean;
		onOpenChat: (group: GroupMeta, bot: Bot) => void;
		onFocusChat: (groupSlug: string) => void;
		onSubscribe: (group: GroupMeta) => void;
	} = $props();

	const SLOT_MINUTES = 30;
	const DAY_SLOTS = 48;
	const COLUMN_WIDTH_PX = 140;
	const CHANNEL_COL_PX = 72;

	interface TimeSlot {
		label: string;
		hour24: number;
		minute: number;
		isNow: boolean;
		isDayBoundary: boolean;
		slotIndex: number;
	}

	interface MergedCell {
		startSlot: number;
		span: number;
		showSlug: string;
		season: number;
		episode: number;
		title: string;
		year: string;
		isLive: boolean;
	}

	interface FeaturedShow {
		channelSlug: string;
		showSlug: string;
		title: string;
		year: string;
		ch: number;
		net: string;
		isLive: boolean;
	}

	function getEpisodeInfo(slot: ChannelSlot): { title: string; year: string } | null {
		const show = groups.find(g => g.slug === slot.showSlug);
		const ep = show?.episodes?.find(e => e.season === slot.season && e.episode === slot.episode);
		return ep ? { title: ep.title, year: ep.year } : null;
	}

	function buildTimeSlots(date: Date, tz?: string): TimeSlot[] {
		const currentSlotIdx = getSlotIndex(date, tz);
		const slots: TimeSlot[] = [];

		for (let i = 0; i < DAY_SLOTS; i++) {
			const slotIdx = (currentSlotIdx + i) % DAY_SLOTS;
			const h24 = Math.floor(slotIdx / 2);
			const m = (slotIdx % 2) * 30;
			const h12 = h24 % 12 || 12;
			const ampm = h24 >= 12 ? 'PM' : 'AM';
			slots.push({
				label: `${h12}:${String(m).padStart(2, '0')} ${ampm}`,
				hour24: h24,
				minute: m,
				isNow: i === 0,
				isDayBoundary: i > 0 && slotIdx === 0,
				slotIndex: slotIdx
			});
		}
		return slots;
	}

	function buildMergedCells(channel: Channel, slotOrder: TimeSlot[], currentSlotIdx: number): MergedCell[] {
		const cells: MergedCell[] = [];
		let i = 0;

		while (i < slotOrder.length) {
			const slotIdx = slotOrder[i].slotIndex;
			const channelSlot = channel.schedule[slotIdx] ?? null;

			if (!channelSlot) {
				i++;
				continue;
			}

			const epInfo = getEpisodeInfo(channelSlot);
			let span = 1;

			// Merge consecutive slots with the same show+episode
			while (i + span < slotOrder.length) {
				const nextSlotIdx = slotOrder[i + span].slotIndex;
				const nextSlot = channel.schedule[nextSlotIdx] ?? null;
				if (
					nextSlot &&
					nextSlot.showSlug === channelSlot.showSlug &&
					nextSlot.season === channelSlot.season &&
					nextSlot.episode === channelSlot.episode
				) {
					span++;
				} else {
					break;
				}
			}

			// A cell is live if any of its slot indices equals the current slot
			const isLive = slotOrder.slice(i, i + span).some(s => s.slotIndex === currentSlotIdx);

			cells.push({
				startSlot: i,
				span,
				showSlug: channelSlot.showSlug,
				season: channelSlot.season,
				episode: channelSlot.episode,
				title: epInfo?.title ?? `S${channelSlot.season}E${channelSlot.episode}`,
				year: epInfo?.year ?? '',
				isLive
			});

			i += span;
		}
		return cells;
	}

	function formatGuideDate(d: Date, tz?: string): string {
		const opts: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric' };
		if (tz) opts.timeZone = tz;
		return new Intl.DateTimeFormat('en-US', opts).format(d).toUpperCase();
	}

	function formatLiveClock(d: Date, tz?: string): string {
		const opts: Intl.DateTimeFormatOptions = {
			hour: 'numeric',
			minute: '2-digit',
			second: '2-digit',
			hour12: true
		};
		if (tz) opts.timeZone = tz;
		return new Intl.DateTimeFormat('en-US', opts).format(d);
	}

	function getGroupBots(group: GroupMeta): Bot[] {
		return bots.filter((b) => b.group === group.slug);
	}

	let scrollerEl = $state<HTMLDivElement | null>(null);
	let paused = $state(false);
	let featured = $state<FeaturedShow | null>(null);

	let slots = $derived(buildTimeSlots(now, timezone));
	let currentSlotIdx = $derived(getSlotIndex(now, timezone));

	let sortedChannels = $derived(
		[...channels].sort((a, b) => a.number - b.number)
	);

	let schedule = $derived.by(() => {
		return sortedChannels.map((channel) => ({
			channel,
			cells: buildMergedCells(channel, slots, currentSlotIdx)
		}));
	});

	let marqueeText = $derived.by(() => {
		const nowPlaying: string[] = [];
		for (const channel of sortedChannels) {
			const slot = getCurrentSlot(channel, now, timezone);
			if (slot) {
				const show = groups.find(g => g.slug === slot.showSlug);
				const epInfo = getEpisodeInfo(slot);
				const showName = show?.name ?? slot.showSlug;
				const epTitle = epInfo ? ` — "${epInfo.title}"` : '';
				nowPlaying.push(`● CH${channel.number} ${showName.toUpperCase()}${epTitle}`);
			}
		}
		return nowPlaying.join('   ✦   ') || '● ALL CHANNELS — check the schedule for upcoming broadcasts';
	});

	$effect(() => {
		if (!featured && schedule.length > 0) {
			const firstLive = schedule.find((s) => s.cells.some((c) => c.isLive));
			if (firstLive) {
				const liveCell = firstLive.cells.find((c) => c.isLive);
				if (liveCell) {
					const epInfo = getEpisodeInfo({
						showSlug: liveCell.showSlug,
						season: liveCell.season,
						episode: liveCell.episode
					});
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
		}
	});

	const animState = { gridLoop: 0, paused: false };
	$effect(() => { animState.gridLoop = gridLoop; });
	$effect(() => { animState.paused = paused; });

	onMount(() => {
		let raf: number;
		let last = performance.now();
		let accum = 0;

		const animate = (t: number) => {
			const el = scrollerEl;
			if (!el) { raf = requestAnimationFrame(animate); return; }

			const dt = (t - last) / 1000;
			last = t;
			const max = el.scrollWidth - el.clientWidth;
			const loop = animState.gridLoop;
			const speed = max > 0 && loop > 0 ? max / loop : 0;

			if (!animState.paused && max > 0 && speed > 0) {
				accum += speed * dt;
				const whole = Math.floor(accum);
				if (whole > 0) {
					accum -= whole;
					let target = el.scrollLeft + whole;
					if (target >= max) { target = 0; accum = 0; }
					el.scrollLeft = target;
				}
			}
			raf = requestAnimationFrame(animate);
		};

		raf = requestAnimationFrame(animate);
		return () => cancelAnimationFrame(raf);
	});

	function selectFeaturedFromChannel(channel: Channel) {
		const slot = getCurrentSlot(channel, now, timezone);
		if (slot) {
			const epInfo = getEpisodeInfo(slot);
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
				const epInfo = getEpisodeInfo(firstSlot);
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
		if (!isShowOnAir(cell.showSlug, channels, now, timezone)) return;
		const group = groups.find(g => g.slug === cell.showSlug);
		if (!group) return;
		const groupBots = getGroupBots(group);
		if (groupBots.length > 0) {
			onOpenChat(group, groupBots[0]);
		}
	}
</script>

<div class="tvguide">
	<!-- Preview Pane -->
	{#if featured}
		{@const feat = featured}
		{@const featuredGroup = groups.find((g) => g.slug === feat.showSlug)}
		{@const featuredBots = featuredGroup ? getGroupBots(featuredGroup) : []}
		{@const liveNow = isShowOnAir(feat.showSlug, channels, now, timezone)}
		<div class="tvg-preview">
			<div class="tvg-preview-bar">
				<span class="tvg-preview-net">{feat.net} · CHANNEL {feat.ch}</span>
				<span class="tvg-preview-time">
					{#if liveNow}ON NOW{:else}UPCOMING{/if}
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
				{#if liveNow && featuredGroup}
					<button
						class="tvg-preview-cta"
						onclick={() => {
							if (featuredGroup) {
								const fBots = getGroupBots(featuredGroup);
								if (fBots.length > 0) onOpenChat(featuredGroup, fBots[0]);
							}
						}}
					>
						▸ START<br/>CHAT
					</button>
				{:else}
					<button
						class="tvg-preview-cta off"
						onclick={() => { if (featuredGroup) onSubscribe(featuredGroup); }}
					>
						NOTIFY<br/>ME
					</button>
				{/if}
			</div>
		</div>
	{/if}

	<!-- Date Bar -->
	<div class="tvg-datebar">
		<span class="tvg-datebar-date">{formatGuideDate(now, timezone)}</span>
		<span class="tvg-datebar-live">
			{#if sortedChannels.some((ch) => getCurrentSlot(ch, now, timezone) !== null)}
				<span class="tvg-now-dot live">●</span>LIVE @ {formatLiveClock(now, timezone)}
			{:else}
				<span class="tvg-now-dot">●</span>OFF AIR · {formatLiveClock(now, timezone)}
			{/if}
			{#if paused}<span class="tvg-paused"> · ⏸ paused</span>{/if}
		</span>
	</div>

	<!-- Scrolling Timeline Grid -->
	<div
		class="tvg-scroller"
		bind:this={scrollerEl}
		onmouseenter={pauseOnHover ? () => { paused = true; } : undefined}
		onmouseleave={pauseOnHover ? () => { paused = false; } : undefined}
	>
		<div
			class="tvg-grid"
			style="grid-template-columns: {CHANNEL_COL_PX}px repeat({slots.length}, {COLUMN_WIDTH_PX}px);"
		>
			<!-- Header row: CH + time slots -->
			<div class="tvg-cell tvg-ch-cell tvg-ch-head" style="grid-column: 1; grid-row: 1;">CH</div>
			{#each slots as s, i}
				<div
					class="tvg-cell tvg-time-cell"
					class:now={s.isNow}
					class:day-boundary={s.isDayBoundary}
					style="grid-column: {i + 2}; grid-row: 1;"
				>
					{#if s.isNow}<span class="tvg-now-dot">●</span>{/if}
					{#if s.isDayBoundary}<span class="tvg-day-mark">→ </span>{/if}
					{s.label}
				</div>
			{/each}

			<!-- Channel rows -->
			{#each schedule as { channel, cells }, chIdx}
				{@const isAlt = chIdx % 2 === 1}
				{@const currentShowSlug = getCurrentSlot(channel, now, timezone)?.showSlug ?? null}
				<!-- svelte-ignore a11y_click_events_have_key_events -->
				<div
					class="tvg-cell tvg-ch-cell"
					class:alt={isAlt}
					class:current={currentShowSlug === activeChatGroupSlug && activeChatGroupSlug !== null}
					style="grid-column: 1; grid-row: {chIdx + 2}; cursor: pointer;"
					onclick={() => selectFeaturedFromChannel(channel)}
				>
					<div class="ch-num">{String(channel.number).padStart(2, '0')}</div>
					<div class="ch-net">{channel.network}</div>
					{#if currentShowSlug === activeChatGroupSlug && activeChatGroupSlug !== null}
						<button
							class="ch-open"
							onclick={(e) => { e.stopPropagation(); if (activeChatGroupSlug) onFocusChat(activeChatGroupSlug); }}
							title="Bring chat window to front"
						>● open</button>
					{/if}
				</div>

				{#each cells as cell}
					{@const showGroup = groups.find(g => g.slug === cell.showSlug)}
					{@const isFeatured = featured && featured.channelSlug === channel.slug && featured.showSlug === cell.showSlug && featured.title === cell.title}
					<div
						class="tvg-cell tvg-ep-cell"
						class:now={cell.isLive && cell.startSlot === 0}
						class:live={cell.isLive}
						class:off-air={!cell.isLive}
						class:featured={isFeatured}
						class:alt={isAlt}
						style="grid-column: {cell.startSlot + 2} / span {cell.span}; grid-row: {chIdx + 2};"
						onclick={() => selectFeaturedFromCell(channel, cell)}
						ondblclick={() => handleCellDblClick(cell)}
						title={cell.isLive ? `Click to preview · double-click to chat` : `Off air — click to preview`}
					>
						<div class="ep-show">
							<span class="ep-show-name">{(showGroup?.name ?? cell.showSlug).toUpperCase()}</span>
							{#if cell.span > 1}<span class="ep-runtime">{cell.span * 30}MIN</span>{/if}
							{#if !cell.isLive}<span class="ep-off">OFF AIR</span>{/if}
						</div>
						<div class="ep-title">"{cell.title}" {#if cell.year}<span class="ep-year">({cell.year})</span>{/if}</div>
					</div>
				{/each}
			{/each}
		</div>
	</div>

	<!-- Bottom Marquee -->
	<div class="tvg-marquee">
		<div class="tvg-marquee-track" style="animation-duration: {marqueeLoop}s;">
			{marqueeText}&nbsp;&nbsp;&nbsp;{marqueeText}
		</div>
	</div>
</div>

<style>
	.tvguide {
		font-family: 'Pixelify Sans', sans-serif;
		display: flex;
		flex-direction: column;
		height: 100%;
		background: #0000aa;
		color: #ffffff;
		min-height: 0;
	}

	/* ====== Preview pane ====== */
	.tvg-preview {
		background: #0000aa;
		color: #fff;
		border-bottom: 2px solid #ffffff;
		flex-shrink: 0;
	}
	.tvg-preview-bar {
		display: flex;
		justify-content: space-between;
		align-items: center;
		background: #000066;
		padding: 5px 12px;
		font-family: 'Press Start 2P', monospace;
		font-size: 9px;
		color: #f9bd2b;
		border-bottom: 1px solid #4d4dcc;
	}
	.tvg-preview-net { letter-spacing: 0.04em; }
	.tvg-preview-main {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		gap: 12px 14px;
		padding: 10px 12px 12px;
		align-items: center;
	}
	.tvg-preview-text { min-width: 0; }
	.tvg-preview-titleline {
		font-family: 'VT323', monospace;
		font-size: 22px;
		color: #fff;
		line-height: 1.15;
	}
	.tvg-preview-title { font-weight: 700; }
	.tvg-preview-year { color: rgba(255, 255, 255, 0.55); font-size: 16px; margin-left: 4px; }
	.tvg-preview-showname {
		font-family: 'Press Start 2P', monospace;
		font-size: 9px;
		color: #f9bd2b;
		letter-spacing: 0.02em;
		margin-top: 4px;
	}
	.tvg-preview-era { color: rgba(249, 189, 43, 0.6); }
	.tvg-preview-dialogue {
		font-family: 'VT323', monospace;
		font-size: 16px;
		color: #fff;
		margin-top: 6px;
		line-height: 1.25;
		display: flex;
		gap: 6px;
		align-items: baseline;
		flex-wrap: wrap;
	}
	.tvg-preview-who {
		color: #a6f000;
		font-family: 'Press Start 2P', monospace;
		font-size: 8px;
		letter-spacing: 0.02em;
		flex-shrink: 0;
	}
	.tvg-preview-line { font-style: italic; opacity: 0.95; min-width: 0; }
	.tvg-preview-cta {
		font-family: 'Press Start 2P', monospace;
		font-size: 10px;
		background: #f54e00;
		color: #fff;
		border: 2px solid #fff;
		padding: 12px 14px;
		cursor: pointer;
		letter-spacing: 0.05em;
		line-height: 1.4;
		white-space: nowrap;
		text-align: center;
		align-self: stretch;
	}
	.tvg-preview-cta:hover { background: #fff; color: #f54e00; }
	.tvg-preview-cta:active { transform: translate(1px, 1px); }
	.tvg-preview-cta.off {
		background: #000066;
		border-color: #f9bd2b;
		color: #f9bd2b;
	}
	.tvg-preview-cta.off:hover { background: #f9bd2b; color: #000066; }

	/* ====== Date bar ====== */
	.tvg-datebar {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 6px 12px;
		background: #000066;
		color: #f9bd2b;
		font-family: 'Press Start 2P', monospace;
		font-size: 10px;
		letter-spacing: 0.02em;
		border-bottom: 1px solid #4d4dcc;
		flex-shrink: 0;
	}
	.tvg-datebar-live { color: #fff; display: flex; align-items: center; gap: 6px; }
	.tvg-now-dot {
		display: inline-block;
		color: #f54e00;
		animation: blink 1.4s steps(2, end) infinite;
	}
	.tvg-now-dot.live { color: #a6f000; }
	.tvg-paused { color: #ffd86b; font-style: italic; }

	/* ====== Scrolling timeline grid ====== */
	.tvg-scroller {
		flex: 1;
		overflow-x: hidden;
		overflow-y: auto;
		min-height: 0;
		background: #0000aa;
		position: relative;
	}
	.tvg-grid {
		display: grid;
		grid-auto-rows: 64px;
		width: max-content;
		min-width: 100%;
	}

	/* Sticky channel column */
	.tvg-ch-cell {
		position: sticky;
		left: 0;
		z-index: 2;
		background: #000066;
		border-right: 2px solid #fff;
		border-bottom: 1px solid #4d4dcc;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		font-family: 'Press Start 2P', monospace;
		font-size: 11px;
		color: #f9bd2b;
		gap: 3px;
		padding: 4px;
		text-align: center;
	}
	.tvg-ch-head {
		z-index: 3;
		font-size: 11px;
		color: #f9bd2b;
	}
	.tvg-ch-cell.alt { background: #2a0000; }
	.tvg-ch-cell.current { box-shadow: inset 3px 0 0 #a6f000; }
	.ch-num { font-size: 13px; color: #fff; }
	.ch-net { font-size: 8px; color: #a6f000; }
	.ch-open {
		margin-top: 2px;
		font-family: 'Press Start 2P', monospace;
		font-size: 7px;
		color: #a6f000;
		letter-spacing: 0.04em;
		background: #0a0a0a;
		padding: 2px 4px;
		border: 1px solid #a6f000;
		border-radius: 1px;
		animation: blink 1.4s steps(2, end) infinite;
		cursor: pointer;
	}
	.ch-open:hover {
		animation: none;
		background: #a6f000;
		color: #0a0a0a;
		border-color: #0a0a0a;
	}

	/* Time header */
	.tvg-time-cell {
		background: #000066;
		font-family: 'Press Start 2P', monospace;
		font-size: 9px;
		color: #f9bd2b;
		text-align: center;
		display: flex;
		align-items: center;
		justify-content: center;
		border-right: 1px solid #4d4dcc;
		border-bottom: 2px solid #fff;
		white-space: nowrap;
		z-index: 1;
		gap: 4px;
	}
	.tvg-time-cell.now {
		background: #f9bd2b;
		color: #0a0a0a;
		font-weight: 700;
	}
	.tvg-time-cell.day-boundary {
		background: #4d4dcc;
		color: #fff;
	}
	.tvg-day-mark { color: #a6f000; font-size: 8px; }

	/* Episode cells */
	.tvg-ep-cell {
		background: #0000aa;
		border-right: 1px solid #4d4dcc;
		border-bottom: 1px solid #4d4dcc;
		padding: 6px 8px;
		font-family: 'VT323', monospace;
		font-size: 16px;
		color: #fff;
		display: flex;
		flex-direction: column;
		justify-content: center;
		overflow: hidden;
		cursor: pointer;
		min-width: 0;
		position: relative;
	}
	.tvg-ep-cell.alt { background: #6b0000; border-right-color: #aa2929; }
	.tvg-ep-cell.off-air { opacity: 0.45; }
	.tvg-ep-cell.off-air.alt { background: #3a0000; }

	.tvg-ep-cell:hover { background: #2929cc; opacity: 1; }
	.tvg-ep-cell.alt:hover { background: #aa2929; }
	.tvg-ep-cell:hover .ep-title { color: #a6f000; }

	.tvg-ep-cell.now {
		background: rgba(249, 189, 43, 0.18);
		box-shadow: inset 0 0 0 2px #f9bd2b;
	}
	.tvg-ep-cell.now.alt { background: rgba(249, 189, 43, 0.30); }
	.tvg-ep-cell.now .ep-title { color: #f9bd2b; font-weight: 700; }

	.tvg-ep-cell.featured {
		box-shadow: inset 0 0 0 3px #a6f000;
	}
	.tvg-ep-cell.featured .ep-show-name { color: #a6f000; }

	.ep-show {
		font-family: 'Press Start 2P', monospace;
		font-size: 8px;
		color: #f9bd2b;
		letter-spacing: 0.02em;
		margin-bottom: 4px;
		display: flex;
		align-items: center;
		gap: 5px;
		flex-wrap: wrap;
	}
	.ep-show-name { color: #f9bd2b; }
	.ep-runtime {
		font-size: 7px;
		color: #a6f000;
		background: rgba(166, 240, 0, 0.12);
		border: 1px solid #a6f000;
		padding: 1px 3px;
		letter-spacing: 0.02em;
	}
	.ep-off {
		font-size: 7px;
		color: #888;
		border: 1px solid #555;
		padding: 1px 3px;
		letter-spacing: 0.04em;
	}
	.ep-title {
		font-family: 'VT323', monospace;
		font-size: 16px;
		color: #fff;
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
		background: #ffffff;
		color: #0000aa;
		padding: 4px 0;
		border-top: 2px solid #0a0a0a;
		flex-shrink: 0;
	}
	.tvg-marquee-track {
		display: inline-block;
		white-space: nowrap;
		font-family: 'VT323', monospace;
		font-size: 17px;
		font-weight: 700;
		animation: tvg-scroll linear infinite;
		padding-left: 100%;
	}

	@keyframes blink {
		0%, 49% { opacity: 1; }
		50%, 100% { opacity: 0; }
	}
	@keyframes tvg-scroll {
		from { transform: translateX(0); }
		to { transform: translateX(-100%); }
	}
</style>
