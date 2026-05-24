<script lang="ts">
	import type { GroupMeta, Bot } from '$lib/types';
	import { isOnAir, minutesRemaining, isSlotActive } from '$lib/schedule';
	import { onMount } from 'svelte';

	let {
		groups,
		bots,
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

	const channelMap: Record<string, { ch: string; net: string }> = {
		mash: { ch: '02', net: 'CBS' },
		seinfeld: { ch: '04', net: 'NBC' },
		office: { ch: '06', net: 'NBC' },
		'arrested-development': { ch: '08', net: 'FOX' },
		'star-trek-tng': { ch: '10', net: 'SYN' },
		'parks-and-rec': { ch: '12', net: 'NBC' }
	};

	const EPISODE_LIBRARY: Record<string, Array<{ title: string; year: string }>> = {
		seinfeld: [
			{ title: 'The Parking Garage', year: '1991' },
			{ title: 'The Marble Rye', year: '1996' },
			{ title: 'The Soup Nazi', year: '1995' },
			{ title: 'The Contest', year: '1992' },
			{ title: 'The Chinese Restaurant', year: '1991' },
			{ title: 'The Junior Mint', year: '1993' },
			{ title: 'The Puffy Shirt', year: '1993' },
			{ title: 'The Yada Yada', year: '1997' },
			{ title: 'The Limo', year: '1992' },
			{ title: 'The Hamptons', year: '1994' },
			{ title: 'The Outing', year: '1993' },
			{ title: 'The Jacket', year: '1991' }
		],
		office: [
			{ title: 'Dinner Party', year: '2008' },
			{ title: 'Stress Relief', year: '2009' },
			{ title: 'Casino Night', year: '2006' },
			{ title: 'The Injury', year: '2006' },
			{ title: 'Office Olympics', year: '2005' },
			{ title: 'Beach Games', year: '2007' },
			{ title: 'Niagara', year: '2009' },
			{ title: 'Goodbye, Michael', year: '2011' },
			{ title: 'Threat Level Mid.', year: '2011' },
			{ title: 'Pretzel Day', year: '2006' },
			{ title: 'The Dundies', year: '2005' },
			{ title: 'Diwali', year: '2006' }
		],
		'arrested-development': [
			{ title: 'Pier Pressure', year: '2004' },
			{ title: 'Afternoon Delight', year: '2004' },
			{ title: 'Top Banana', year: '2003' },
			{ title: 'Sword of Destiny', year: '2005' },
			{ title: 'Mr. F', year: '2005' },
			{ title: 'Motherboy XXX', year: '2005' },
			{ title: 'Marta Complex', year: '2004' },
			{ title: 'Good Grief', year: '2005' },
			{ title: 'Meat the Veals', year: '2005' },
			{ title: 'Making a Stand', year: '2006' },
			{ title: 'Spring Breakout', year: '2005' },
			{ title: 'Righteous Brothers', year: '2005' }
		],
		mash: [
			{ title: 'Goodbye, Farewell', year: '1983' },
			{ title: 'The Interview', year: '1976' },
			{ title: 'Abyssinia, Henry', year: '1975' },
			{ title: 'Dear Sigmund', year: '1976' },
			{ title: 'The Bus', year: '1976' },
			{ title: 'Point of View', year: '1978' },
			{ title: 'Dreams', year: '1980' },
			{ title: 'Tuttle', year: '1973' },
			{ title: 'The Joker Is Wild', year: '1979' },
			{ title: 'Death Takes a Holiday', year: '1980' },
			{ title: 'Old Soldiers', year: '1981' },
			{ title: 'Heal Thyself', year: '1982' }
		],
		'star-trek-tng': [
			{ title: 'Best of Both Worlds', year: '1990' },
			{ title: 'Inner Light', year: '1992' },
			{ title: 'Yesterday\'s Enterprise', year: '1990' },
			{ title: 'Darmok', year: '1991' },
			{ title: 'Chain of Command', year: '1992' },
			{ title: 'Measure of a Man', year: '1989' },
			{ title: 'All Good Things', year: '1994' },
			{ title: 'Tapestry', year: '1993' },
			{ title: 'Cause and Effect', year: '1992' },
			{ title: 'The Offspring', year: '1990' },
			{ title: 'Frame of Mind', year: '1993' },
			{ title: 'Lower Decks', year: '1994' }
		],
		'parks-and-rec': [
			{ title: 'Halloween Surprise', year: '2012' },
			{ title: 'Flu Season', year: '2011' },
			{ title: 'Treat Yo Self', year: '2011' },
			{ title: 'Pawnee Zoo', year: '2009' },
			{ title: 'Hunting Trip', year: '2010' },
			{ title: 'Trial of Leslie K.', year: '2011' },
			{ title: 'Win, Lose or Draw', year: '2012' },
			{ title: 'Galentine\'s Day', year: '2010' },
			{ title: 'Sister City', year: '2009' },
			{ title: 'Bowling for Votes', year: '2012' },
			{ title: 'Sweet Sixteen', year: '2010' },
			{ title: 'Article Two', year: '2014' }
		]
	};

	const PREVIEW_LINES: Record<string, string> = {
		seinfeld: "What is this — a chat? A chat with me? Alright. What do you want.",
		office: "Hey, hey, hey — welcome to the Scranton branch group chat. Boss vibes only.",
		'arrested-development': "I've made a huge mistake. Actually no — this chat is going great.",
		mash: "Attention all personnel: incoming message from... you, apparently.",
		'star-trek-tng': "Make it so. State your message, number one.",
		'parks-and-rec': "Leslie Knope, deputy director, official welcomer of new chat-friends."
	};

	interface TimeSlot {
		label: string;
		hour24: number;
		minute: number;
		isNow: boolean;
		isDayBoundary: boolean;
	}

	interface EpisodeCell {
		start: number;
		span: number;
		title: string;
		year: string;
		isLive: boolean;
		encore: boolean;
		runtime?: string;
	}

	interface FeaturedShow {
		groupSlug: string;
		title: string;
		year: string;
		ch: string;
		net: string;
		runtime?: string;
		isLive: boolean;
	}

	function buildTimeSlots(date: Date, tz?: string): TimeSlot[] {
		const opts: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit', hour12: false };
		if (tz) opts.timeZone = tz;
		const parts = new Intl.DateTimeFormat('en-US', opts).formatToParts(date);
		const hour = parseInt(parts.find((p) => p.type === 'hour')?.value ?? '0');
		const minute = parseInt(parts.find((p) => p.type === 'minute')?.value ?? '0');

		const startMin = hour * 60 + (minute >= 30 ? 30 : 0);
		const slots: TimeSlot[] = [];
		for (let i = 0; i < DAY_SLOTS; i++) {
			const total = startMin + i * SLOT_MINUTES;
			const h24 = Math.floor(total / 60) % 24;
			const m = total % 60;
			const h12 = h24 % 12 || 12;
			const ampm = h24 >= 12 ? 'PM' : 'AM';
			slots.push({
				label: `${h12}:${String(m).padStart(2, '0')} ${ampm}`,
				hour24: h24,
				minute: m,
				isNow: i === 0,
				isDayBoundary: i > 0 && h24 === 0 && m === 0
			});
		}
		return slots;
	}

	function isSlotOnAir(group: GroupMeta, slotIndex: number, baseDate: Date, tz?: string): boolean {
		const slotDate = new Date(baseDate.getTime() + slotIndex * SLOT_MINUTES * 60 * 1000);
		return isOnAir(group, slotDate, tz);
	}

	function spanFor(chIdx: number, slot: number): number {
		return ((slot + chIdx * 3) % 5 === 2) ? 2 : 1;
	}

	function buildChannelSchedule(group: GroupMeta, chIdx: number, baseDate: Date, tz?: string): EpisodeCell[] {
		const library = EPISODE_LIBRARY[group.slug] || [];
		if (library.length === 0) return [];

		const cells: EpisodeCell[] = [];
		const taken = new Array(DAY_SLOTS).fill(false);
		let epIdx = 0;
		let slot = 0;

		while (slot < DAY_SLOTS) {
			if (taken[slot]) { slot++; continue; }

			const isLive = isSlotOnAir(group, slot, baseDate, tz);
			let span = spanFor(chIdx, slot);

			while (span > 1 && (slot + span > DAY_SLOTS || taken[slot + span - 1])) span--;

			const nextSlotLive = span > 1 ? isSlotOnAir(group, slot + 1, baseDate, tz) : isLive;
			if (span > 1 && isLive !== nextSlotLive) span = 1;

			const ep = library[epIdx % library.length];
			const encore = epIdx >= library.length;

			cells.push({
				start: slot,
				span,
				title: ep.title,
				year: ep.year,
				isLive,
				encore,
				runtime: span > 1 ? '1HR' : undefined
			});

			for (let k = slot; k < slot + span; k++) taken[k] = true;
			slot += span;
			epIdx++;
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

	let halfHourKey = $derived.by(() => {
		const opts: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit', hour12: false };
		if (timezone) opts.timeZone = timezone;
		const parts = new Intl.DateTimeFormat('en-US', opts).formatToParts(now);
		const h = parts.find((p) => p.type === 'hour')?.value ?? '0';
		const m = parseInt(parts.find((p) => p.type === 'minute')?.value ?? '0');
		return `${h}:${m >= 30 ? '30' : '00'}`;
	});

	let slots = $derived(buildTimeSlots(now, timezone));

	let activeGroups = $derived(
		groups
			.filter((g) => g.active)
			.sort((a, b) => {
				const chA = channelMap[a.slug]?.ch ?? '99';
				const chB = channelMap[b.slug]?.ch ?? '99';
				return chA.localeCompare(chB);
			})
	);

	let schedule = $derived.by(() => {
		return activeGroups.map((group, idx) => ({
			group,
			ch: channelMap[group.slug] || { ch: '??', net: '???' },
			items: buildChannelSchedule(group, idx, now, timezone)
		}));
	});

	let marqueeText = $derived.by(() => {
		return activeGroups
			.filter((g) => isOnAir(g, now, timezone))
			.map((g) => {
				const remaining = minutesRemaining(g, now, timezone);
				const timeStr = remaining ? `${remaining} min left` : '';
				return `● ${g.name.toUpperCase()} — ON NOW${timeStr ? ` (${timeStr})` : ''}`;
			})
			.join('   ✦   ') || '● ALL SHOWS — check the schedule for upcoming broadcasts';
	});

	$effect(() => {
		if (!featured && schedule.length > 0) {
			const firstLive = schedule.find((s) => s.items.some((i) => i.isLive));
			if (firstLive) {
				const liveItem = firstLive.items.find((i) => i.isLive);
				if (liveItem) {
					featured = {
						groupSlug: firstLive.group.slug,
						title: liveItem.title,
						year: liveItem.year,
						ch: firstLive.ch.ch,
						net: firstLive.ch.net,
						runtime: liveItem.runtime,
						isLive: true
					};
				}
			}
		}
	});

	const animState = { gridLoop: gridLoop, paused: false };
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

	function selectFeatured(group: GroupMeta, item: EpisodeCell) {
		const ch = channelMap[group.slug] || { ch: '??', net: '???' };
		featured = {
			groupSlug: group.slug,
			title: item.title,
			year: item.year,
			ch: ch.ch,
			net: ch.net,
			runtime: item.runtime,
			isLive: item.isLive
		};
	}

	function handleCellDblClick(group: GroupMeta) {
		if (!isOnAir(group, now, timezone)) return;
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
		{@const featuredGroup = groups.find((g) => g.slug === feat.groupSlug)}
		{@const featuredBots = featuredGroup ? getGroupBots(featuredGroup) : []}
		<div class="tvg-preview">
			<div class="tvg-preview-bar">
				<span class="tvg-preview-net">{feat.net} · CHANNEL {feat.ch}</span>
				<span class="tvg-preview-time">
					{#if feat.isLive}ON NOW{:else}UPCOMING{/if}
					{#if feat.runtime}<span class="tvg-preview-runtime">· {feat.runtime}</span>{/if}
				</span>
			</div>
			<div class="tvg-preview-main">
				<div class="tvg-preview-text">
					<div class="tvg-preview-titleline">
						<span class="tvg-preview-title">"{feat.title}"</span>
						<span class="tvg-preview-year">({feat.year})</span>
					</div>
					<div class="tvg-preview-showname">
						{featuredGroup?.name ?? feat.groupSlug}
						{#if featuredGroup}<span class="tvg-preview-era"> · {featuredGroup.era}</span>{/if}
					</div>
					<div class="tvg-preview-dialogue">
						<span class="tvg-preview-who">{featuredBots[0]?.name.toUpperCase() ?? '—'}:</span>
						<span class="tvg-preview-line">"{PREVIEW_LINES[feat.groupSlug] || '...'}"</span>
					</div>
				</div>
				{#if feat.isLive && featuredGroup}
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
			{#if activeGroups.some((g) => isOnAir(g, now, timezone))}
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
			{#each schedule as { group, ch, items }, chIdx}
				{@const isAlt = chIdx % 2 === 1}
				<div
					class="tvg-cell tvg-ch-cell"
					class:alt={isAlt}
					class:current={group.slug === activeChatGroupSlug}
					style="grid-column: 1; grid-row: {chIdx + 2};"
				>
					<div class="ch-num">{ch.ch}</div>
					<div class="ch-net">{ch.net}</div>
					{#if group.slug === activeChatGroupSlug}
						<button
							class="ch-open"
							onclick={(e) => { e.stopPropagation(); onFocusChat(group.slug); }}
							title="Bring chat window to front"
						>● open</button>
					{/if}
				</div>

				{#each items as item, i}
					{@const isFeatured = featured && featured.groupSlug === group.slug && featured.title === item.title && featured.isLive === item.isLive}
					<div
						class="tvg-cell tvg-ep-cell"
						class:now={item.start === 0 && item.isLive}
						class:live={item.isLive}
						class:off-air={!item.isLive}
						class:featured={isFeatured}
						class:alt={isAlt}
						style="grid-column: {item.start + 2} / span {item.span}; grid-row: {chIdx + 2};"
						onclick={() => selectFeatured(group, item)}
						ondblclick={() => handleCellDblClick(group)}
						title={item.isLive ? `Click to preview · double-click to chat` : `Off air — click to preview`}
					>
						<div class="ep-show">
							<span class="ep-show-name">{group.name.toUpperCase()}</span>
							{#if item.runtime}<span class="ep-runtime">{item.runtime}</span>{/if}
							{#if item.encore && item.isLive}<span class="ep-encore">ENCORE</span>{/if}
							{#if !item.isLive}<span class="ep-off">OFF AIR</span>{/if}
						</div>
						<div class="ep-title">"{item.title}" <span class="ep-year">({item.year})</span></div>
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
	.tvg-preview-runtime { color: #a6f000; margin-left: 6px; }
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
	.ep-encore {
		font-size: 7px;
		color: rgba(255, 255, 255, 0.65);
		border: 1px solid rgba(255, 255, 255, 0.3);
		padding: 1px 3px;
		letter-spacing: 0.04em;
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
