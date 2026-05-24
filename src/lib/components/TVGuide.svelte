<script lang="ts">
	import type { GroupMeta, Bot } from '$lib/types';
	import {
		isOnAir,
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

	$effect(() => {
		const t = setInterval(() => {
			now = new Date();
		}, 30000);
		return () => clearInterval(t);
	});

	const channelMap: Record<string, { ch: string; net: string }> = {
		mash: { ch: '02', net: 'CBS' },
		seinfeld: { ch: '04', net: 'NBC' },
		office: { ch: '06', net: 'NBC' },
		'arrested-development': { ch: '08', net: 'FOX' },
		'star-trek-tng': { ch: '10', net: 'SYN' },
		'parks-and-rec': { ch: '12', net: 'NBC' }
	};

	function getGroupBots(group: GroupMeta): Bot[] {
		return bots.filter((b) => b.group === group.slug);
	}

	function getActiveSlots(group: GroupMeta) {
		return group.schedule.slice(0, 4);
	}

	function formatGuideDate(d: Date): string {
		const day = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][d.getDay()];
		const mon = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'][d.getMonth()];
		let h = d.getHours();
		const m = String(d.getMinutes()).padStart(2, '0');
		const ampm = h >= 12 ? 'PM' : 'AM';
		h = ((h + 11) % 12) + 1;
		return `${day} ${mon} ${d.getDate()} · ${h}:${m} ${ampm}`;
	}

	$effect(() => {
		const t = setInterval(() => {
			now = new Date();
		}, 1000);
		return () => clearInterval(t);
	});
</script>

<div class="tvguide">
	<div class="tvg-header">
		<div class="tvg-date">
			{formatGuideDate(now)}
			<span class="tvg-primetime">
				{#if groups.some((g) => isOnAir(g, now, timezone))}
					● ON AIR
				{:else}
					○ OFF AIR
				{/if}
			</span>
		</div>
		<div class="tvg-marquee">
			<div class="tvg-marquee-track">
				{#each groups.filter((g) => isOnAir(g, now, timezone)) as group}
					<span>● {group.name.toUpperCase()} — on now</span>
				{/each}
				{#each groups.filter((g) => !isOnAir(g, now, timezone)).slice(0, 3) as group}
					<span>● {group.name.toUpperCase()} — coming soon</span>
				{/each}
				{#each groups.filter((g) => isOnAir(g, now, timezone)) as group}
					<span>● {group.name.toUpperCase()} — on now</span>
				{/each}
				{#each groups.filter((g) => !isOnAir(g, now, timezone)).slice(0, 3) as group}
					<span>● {group.name.toUpperCase()} — coming soon</span>
				{/each}
			</div>
		</div>
	</div>

	<div class="tvg-grid">
		<div class="tvg-row tvg-row-head">
			<div class="tvg-cell tvg-cell-ch">CH</div>
			<div class="tvg-cell tvg-cell-info">SHOW</div>
			<div class="tvg-cell tvg-cell-status">STATUS</div>
			<div class="tvg-cell tvg-cell-chars">CHARACTERS</div>
		</div>

		{#each groups.filter((g) => g.active) as group}
			{@const onAir = isOnAir(group, now, timezone)}
			{@const remaining = minutesRemaining(group, now, timezone)}
			{@const ch = channelMap[group.slug] || { ch: '??', net: '???' }}
			{@const groupBots = getGroupBots(group)}

			<div class="tvg-row" class:tvg-row-live={onAir}>
				<div class="tvg-cell tvg-cell-ch">
					<div class="ch-num">{ch.ch}</div>
					<div class="ch-net">{ch.net}</div>
				</div>
				<div class="tvg-cell tvg-cell-info">
					<div class="ep-show">{group.name.toUpperCase()}</div>
					<div class="ep-desc">{group.setting} · {group.era}</div>
				</div>
				<div class="tvg-cell tvg-cell-status">
					{#if onAir}
						<span class="status-live">
							<span class="now-dot">●</span> LIVE
						</span>
						{#if remaining !== null}
							<span class="status-time">{formatTimeUntil(remaining)} left</span>
						{/if}
					{:else}
						<span class="status-off">OFF AIR</span>
						<button class="btn-notify" onclick={() => onSubscribe(group)}>
							notify me
						</button>
					{/if}
				</div>
				<div class="tvg-cell tvg-cell-chars">
					{#each groupBots as bot}
						<button
							class="bot-chip"
							disabled={!onAir}
							onclick={() => onOpenChat(group, bot)}
						>
							{bot.name.split(' ')[0]}
						</button>
					{/each}
				</div>
			</div>
		{/each}
	</div>

	<div class="tvg-footer">
		Click a character name to start a chat · Shows broadcast in your local timezone
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
	}
	.tvg-header {
		border-bottom: 2px solid #ffffff;
		background: #0000aa;
		color: #f9bd2b;
	}
	.tvg-date {
		padding: 8px 12px;
		font-family: 'Press Start 2P', monospace;
		font-size: 11px;
		letter-spacing: 0.02em;
		border-bottom: 1px solid #4d4dcc;
		display: flex;
		justify-content: space-between;
		align-items: center;
	}
	.tvg-primetime {
		margin-left: 12px;
		opacity: 0.85;
	}
	.tvg-marquee {
		overflow: hidden;
		background: #ffffff;
		color: #0000aa;
		padding: 4px 0;
		border-bottom: 2px solid var(--ink);
	}
	.tvg-marquee-track {
		display: inline-flex;
		gap: 36px;
		white-space: nowrap;
		font-family: 'VT323', monospace;
		font-size: 18px;
		animation: tvg-scroll 38s linear infinite;
		font-weight: 700;
	}
	@keyframes tvg-scroll {
		from {
			transform: translateX(0);
		}
		to {
			transform: translateX(-50%);
		}
	}
	.tvg-grid {
		flex: 1;
		overflow: auto;
		display: flex;
		flex-direction: column;
	}
	.tvg-row {
		display: grid;
		grid-template-columns: 56px 1fr 100px 1fr;
		border-bottom: 1px solid #4d4dcc;
		min-height: 56px;
	}
	.tvg-row:last-child {
		border-bottom: none;
	}
	.tvg-row-head {
		background: #000066;
		min-height: 28px;
		position: sticky;
		top: 0;
		z-index: 1;
	}
	.tvg-row-head .tvg-cell {
		font-family: 'Press Start 2P', monospace;
		font-size: 8px;
		color: #f9bd2b;
		align-items: center;
	}
	.tvg-row-live {
		background: rgba(249, 189, 43, 0.12);
	}
	.tvg-cell {
		padding: 6px 8px;
		font-family: 'VT323', monospace;
		font-size: 17px;
		line-height: 1.15;
		border-right: 1px solid #4d4dcc;
		color: #ffffff;
		display: flex;
		flex-direction: column;
		justify-content: center;
		overflow: hidden;
	}
	.tvg-cell:last-child {
		border-right: none;
	}
	.tvg-cell-ch {
		background: #000066;
		color: #f9bd2b;
		align-items: center;
		text-align: center;
		font-family: 'Press Start 2P', monospace;
		font-size: 11px;
		gap: 4px;
	}
	.ch-num {
		font-size: 14px;
		color: #ffffff;
	}
	.ch-net {
		font-size: 8px;
		color: #a6f000;
	}
	.ep-show {
		font-family: 'Press Start 2P', monospace;
		font-size: 9px;
		color: #f9bd2b;
		letter-spacing: 0.02em;
		margin-bottom: 4px;
	}
	.ep-desc {
		font-family: 'VT323', monospace;
		font-size: 15px;
		color: #cccccc;
	}
	.tvg-cell-status {
		align-items: center;
		gap: 4px;
	}
	.status-live {
		font-family: 'Press Start 2P', monospace;
		font-size: 8px;
		color: #a6f000;
	}
	.status-time {
		font-family: 'VT323', monospace;
		font-size: 15px;
		color: #f9bd2b;
	}
	.status-off {
		font-family: 'Press Start 2P', monospace;
		font-size: 8px;
		color: #888888;
	}
	.now-dot {
		display: inline-block;
		margin-right: 4px;
		color: #f54e00;
		animation: blink 1.4s steps(2, end) infinite;
	}
	.tvg-cell-chars {
		flex-direction: row;
		flex-wrap: wrap;
		gap: 4px;
		align-items: center;
	}
	.bot-chip {
		font-family: 'Pixelify Sans', sans-serif;
		font-size: 12px;
		padding: 2px 6px;
		border: 1px solid #4d4dcc;
		background: transparent;
		color: #ffffff;
		cursor: pointer;
	}
	.bot-chip:hover:not(:disabled) {
		background: #2929cc;
		color: #a6f000;
	}
	.bot-chip:disabled {
		opacity: 0.4;
		cursor: default;
	}
	.btn-notify {
		font-family: 'Pixelify Sans', sans-serif;
		font-size: 10px;
		padding: 2px 6px;
		border: 1px solid #4d4dcc;
		background: transparent;
		color: #f9bd2b;
		cursor: pointer;
	}
	.btn-notify:hover {
		background: #f9bd2b;
		color: #0000aa;
	}
	.tvg-footer {
		padding: 8px 12px;
		background: #000066;
		color: #ffffff;
		font-family: 'VT323', monospace;
		font-size: 16px;
		border-top: 2px solid #ffffff;
	}
</style>
