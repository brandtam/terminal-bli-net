<script lang="ts">
	import type { GroupMeta, Bot } from '$lib/types';
	import {
		isOnAir,
		nextOnAir,
		minutesRemaining,
		formatTimeUntil,
		formatSlotTime
	} from '$lib/schedule';

	let {
		groups,
		bots,
		timezone,
		onOpenChat,
		onSubscribe
	}: {
		groups: GroupMeta[];
		bots: Bot[];
		timezone?: string;
		onOpenChat: (group: GroupMeta, bot: Bot) => void;
		onSubscribe: (group: GroupMeta) => void;
	} = $props();

	let now = $state(new Date());
	let selectedDay = $state<number | null>(null);

	$effect(() => {
		const t = setInterval(() => {
			now = new Date();
		}, 30000);
		return () => clearInterval(t);
	});

	const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
	const dayKeys = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;

	function getGroupBots(group: GroupMeta): Bot[] {
		return bots.filter((b) => b.group === group.slug);
	}
</script>

<div class="tv-guide">
	<div class="guide-header">
		<span class="title">TV GUIDE</span>
		<span class="subtitle">chatrbot.ai programming schedule</span>
	</div>

	<div class="now-section">
		<h3>NOW ON AIR</h3>
		{#each groups.filter((g) => isOnAir(g, now, timezone)) as group}
			{@const remaining = minutesRemaining(group, now, timezone)}
			<div class="now-card">
				<div class="now-info">
					<span class="show-name">{group.name}</span>
					<span class="era">{group.setting} · {group.era}</span>
					{#if remaining !== null}
						<span class="remaining">{formatTimeUntil(remaining)} remaining</span>
					{/if}
				</div>
				<div class="now-bots">
					{#each getGroupBots(group) as bot}
						<button class="bot-chip" onclick={() => onOpenChat(group, bot)}>
							{bot.name}
						</button>
					{/each}
				</div>
			</div>
		{:else}
			<p class="nothing">Nothing on air right now. Check the schedule below.</p>
		{/each}
	</div>

	<div class="upcoming-section">
		<h3>UP NEXT</h3>
		{#each groups
			.filter((g) => !isOnAir(g, now, timezone))
			.map((g) => ({ group: g, next: nextOnAir(g, now, timezone) }))
			.filter((x) => x.next)
			.sort((a, b) => (a.next?.minutesUntil ?? 0) - (b.next?.minutesUntil ?? 0))
			.slice(0, 3) as { group, next }}
			<div class="upcoming-card">
				<span class="show-name">{group.name}</span>
				<span class="next-time">
					in {formatTimeUntil(next?.minutesUntil ?? 0)} ·
					{next?.day.toUpperCase()} {next?.start}
				</span>
				<button class="btn-notify" onclick={() => onSubscribe(group)}>
					notify me
				</button>
			</div>
		{/each}
	</div>

	<div class="schedule-section">
		<h3>WEEKLY SCHEDULE</h3>
		<div class="day-tabs">
			{#each days as day, i}
				<button
					class="day-tab"
					class:active={selectedDay === i}
					onclick={() => (selectedDay = selectedDay === i ? null : i)}
				>
					{day}
				</button>
			{/each}
		</div>

		{#each groups as group}
			{@const daySlots =
				selectedDay !== null
					? group.schedule.filter((s) => s.day === dayKeys[selectedDay as number])
					: group.schedule}
			{#if daySlots.length > 0}
				<div class="schedule-row">
					<span class="schedule-show">{group.name}</span>
					<div class="schedule-slots">
						{#each daySlots as slot}
							<span class="slot">
								{slot.day.toUpperCase()} {formatSlotTime(slot.start, slot.duration)}
							</span>
						{/each}
					</div>
				</div>
			{/if}
		{/each}
	</div>

	<div class="guide-footer">
		<p>Shows broadcast in your local timezone. All characters are AI-generated parodies.</p>
	</div>
</div>

<style>
	.tv-guide {
		padding: 0;
		font-family: 'VT323', monospace;
		font-size: 18px;
	}
	.guide-header {
		padding: 10px 12px;
		border-bottom: 2px solid var(--ink);
		background: #2b6cb0;
		color: white;
	}
	.title {
		font-family: 'Press Start 2P', monospace;
		font-size: 14px;
		display: block;
	}
	.subtitle {
		font-size: 15px;
		opacity: 0.8;
		display: block;
		margin-top: 4px;
	}
	.now-section,
	.upcoming-section,
	.schedule-section {
		padding: 12px;
		border-bottom: 2px solid var(--ink);
	}
	h3 {
		font-family: 'Press Start 2P', monospace;
		font-size: 10px;
		margin: 0 0 10px;
		font-weight: normal;
	}
	.now-card {
		border: 2px solid var(--ink);
		padding: 10px;
		margin-bottom: 8px;
		background: var(--accent-2);
	}
	.now-info {
		display: flex;
		flex-direction: column;
		gap: 2px;
		margin-bottom: 8px;
	}
	.show-name {
		font-family: 'Press Start 2P', monospace;
		font-size: 11px;
	}
	.era {
		font-size: 15px;
		opacity: 0.75;
	}
	.remaining {
		font-size: 15px;
		color: var(--accent);
		font-weight: bold;
	}
	.now-bots {
		display: flex;
		gap: 6px;
		flex-wrap: wrap;
	}
	.bot-chip {
		font-family: 'Pixelify Sans', sans-serif;
		font-size: 13px;
		padding: 4px 8px;
		border: 2px solid var(--ink);
		background: var(--paper);
		cursor: pointer;
	}
	.bot-chip:hover {
		background: var(--ink);
		color: var(--paper);
	}
	.nothing {
		font-style: italic;
		opacity: 0.6;
		margin: 0;
	}
	.upcoming-card {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 6px 0;
		border-bottom: 1px dotted var(--ink);
	}
	.upcoming-card:last-child {
		border-bottom: none;
	}
	.next-time {
		font-size: 15px;
		opacity: 0.7;
		flex: 1;
	}
	.btn-notify {
		font-family: 'Pixelify Sans', sans-serif;
		font-size: 12px;
		padding: 3px 8px;
		border: 2px solid var(--ink);
		background: var(--paper);
		cursor: pointer;
	}
	.btn-notify:hover {
		background: var(--accent);
		color: var(--paper);
	}
	.day-tabs {
		display: flex;
		gap: 4px;
		margin-bottom: 10px;
	}
	.day-tab {
		font-family: 'Press Start 2P', monospace;
		font-size: 8px;
		padding: 4px 6px;
		border: 2px solid var(--ink);
		background: var(--paper);
		cursor: pointer;
		flex: 1;
	}
	.day-tab.active {
		background: var(--ink);
		color: var(--paper);
	}
	.day-tab:hover:not(.active) {
		background: var(--accent-2);
	}
	.schedule-row {
		display: flex;
		gap: 10px;
		padding: 6px 0;
		border-bottom: 1px dotted var(--ink);
		align-items: flex-start;
	}
	.schedule-show {
		font-family: 'Press Start 2P', monospace;
		font-size: 9px;
		min-width: 100px;
		padding-top: 2px;
	}
	.schedule-slots {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
	}
	.slot {
		font-size: 14px;
		padding: 2px 6px;
		background: var(--paper-soft);
		border: 1px solid var(--ink);
	}
	.guide-footer {
		padding: 10px 12px;
		font-size: 14px;
		opacity: 0.6;
		font-style: italic;
	}
</style>
