<script lang="ts">
	import { onMount } from 'svelte';
	import type { AppDef, AppMenuItem, OsApi } from '$lib/os/os-api';

	let {
		app,
		os,
		openWindows = 0,
		contextInfo,
		now,
		timezone,
		onSetTimezone
	}: {
		app: AppDef;
		os: OsApi;
		openWindows?: number;
		contextInfo?: string;
		now: Date;
		timezone?: string;
		onSetTimezone?: (tz: string) => void;
	} = $props();

	let openMenu = $state<string | null>(null);
	let tzOpen = $state(false);

	const TZ_OPTIONS = [
		{ tz: 'local', label: 'Local (auto)' },
		{ tz: 'Pacific/Midway', label: 'Midway (UTC-11)' },
		{ tz: 'Pacific/Honolulu', label: 'Hawaii (UTC-10)' },
		{ tz: 'America/Anchorage', label: 'Alaska (UTC-9)' },
		{ tz: 'America/Los_Angeles', label: 'Pacific (UTC-8)' },
		{ tz: 'America/Denver', label: 'Mountain (UTC-7)' },
		{ tz: 'America/Chicago', label: 'Central (UTC-6)' },
		{ tz: 'America/New_York', label: 'Eastern (UTC-5)' },
		{ tz: 'America/Halifax', label: 'Atlantic (UTC-4)' },
		{ tz: 'America/Sao_Paulo', label: 'Brasilia (UTC-3)' },
		{ tz: 'Atlantic/South_Georgia', label: 'S. Georgia (UTC-2)' },
		{ tz: 'Atlantic/Azores', label: 'Azores (UTC-1)' },
		{ tz: 'Europe/London', label: 'London (UTC+0)' },
		{ tz: 'Europe/Paris', label: 'Paris (UTC+1)' },
		{ tz: 'Europe/Helsinki', label: 'Helsinki (UTC+2)' },
		{ tz: 'Europe/Moscow', label: 'Moscow (UTC+3)' },
		{ tz: 'Asia/Dubai', label: 'Dubai (UTC+4)' },
		{ tz: 'Asia/Karachi', label: 'Karachi (UTC+5)' },
		{ tz: 'Asia/Kolkata', label: 'India (UTC+5:30)' },
		{ tz: 'Asia/Dhaka', label: 'Dhaka (UTC+6)' },
		{ tz: 'Asia/Bangkok', label: 'Bangkok (UTC+7)' },
		{ tz: 'Asia/Shanghai', label: 'China (UTC+8)' },
		{ tz: 'Asia/Tokyo', label: 'Tokyo (UTC+9)' },
		{ tz: 'Australia/Sydney', label: 'Sydney (UTC+10)' },
		{ tz: 'Pacific/Noumea', label: 'Noumea (UTC+11)' },
		{ tz: 'Pacific/Auckland', label: 'Auckland (UTC+12)' }
	];

	const osMenuItems: AppMenuItem[] = [
		{ type: 'action', label: 'About Terminal', action: (os) => os.openAbout(null) },
		{ type: 'action', label: 'Welcome', action: (os) => os.launchApp('welcome') },
		{ type: 'separator' },
		{
			type: 'action',
			label: 'System Preferences…',
			shortcut: '⌘,',
			action: (os) => os.openSystemPreferences()
		},
		{
			type: 'action',
			label: 'System Maintenance…',
			action: (os) => os.openSystemMaintenance()
		},
		{ type: 'separator' },
		{
			type: 'action',
			label: 'My Shelf',
			action: (os) => os.openWindow('software-shop')
		},
		{
			type: 'action',
			label: 'Computer Store',
			action: (os) => os.openWindow('computer-store')
		},
		{ type: 'separator' },
		{
			type: 'action',
			label: 'Reinstall Terminal OS…',
			action: (os) => os.reinstallOS()
		}
	];

	let appMenus = $derived(app.menus(os));
	let statusExtra = $derived(app.statusExtra?.(os) ?? null);

	function formatClock(d: Date, tz?: string): string {
		const opts: Intl.DateTimeFormatOptions = {
			weekday: 'short',
			hour: 'numeric',
			minute: '2-digit',
			second: '2-digit',
			hour12: true
		};
		if (tz) opts.timeZone = tz;
		return new Intl.DateTimeFormat('en-US', opts).format(d);
	}

	function formatTzTime(d: Date, tz: string): string {
		const opts: Intl.DateTimeFormatOptions = {
			hour: 'numeric',
			minute: '2-digit',
			hour12: true
		};
		if (tz !== 'local') opts.timeZone = tz;
		return new Intl.DateTimeFormat('en-US', opts).format(d);
	}

	function shortTzLabel(tz?: string): string {
		if (!tz) return 'TZ';
		const localTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
		const match = TZ_OPTIONS.find((o) => (o.tz === 'local' ? tz === localTz : o.tz === tz));
		if (match && match.tz === 'local') return 'TZ';
		if (match) {
			try {
				const parts = new Intl.DateTimeFormat('en-US', {
					timeZoneName: 'short',
					timeZone: match.tz
				}).formatToParts(now);
				const part = parts.find((p) => p.type === 'timeZoneName');
				return part ? part.value : match.label;
			} catch {
				return match.label;
			}
		}
		return 'TZ';
	}

	function isSelectedTz(optTz: string, currentTz?: string): boolean {
		if (optTz === 'local') {
			if (!currentTz) return true;
			return currentTz === Intl.DateTimeFormat().resolvedOptions().timeZone;
		}
		return currentTz === optTz;
	}

	function handleMenuItemClick(item: AppMenuItem) {
		if (item.type === 'separator') return;
		openMenu = null;
		if (item.type === 'check') {
			item.toggle(os);
			return;
		}
		if (item.type === 'action' && !item.disabled && item.action) item.action(os);
	}

	let clock = $derived(formatClock(now, timezone));
	let tzLabel = $derived(shortTzLabel(timezone));

	onMount(() => {
		const handler = (e: MouseEvent) => {
			const target = e.target as HTMLElement;
			if (tzOpen && !target.closest('.clock-wrap-outer')) tzOpen = false;
		};
		document.addEventListener('mousedown', handler);
		return () => document.removeEventListener('mousedown', handler);
	});
</script>

<div class="menubar" role="menubar" tabindex="-1" onmouseleave={() => (openMenu = null)}>
	<div
		class="menu-wrapper"
		role="none"
		onmouseenter={() => {
			if (openMenu) openMenu = '__os';
		}}
	>
		<button
			class="apple menu-item"
			class:open={openMenu === '__os'}
			onclick={() => (openMenu = openMenu === '__os' ? null : '__os')}
			><img src="/favicon-16x16.png" alt="" class="os-icon" /></button
		>
		{#if openMenu === '__os'}
			<div class="dropdown">
				{#each osMenuItems as it, i (it.type === 'separator' ? `separator-${i}` : it.label)}
					{#if it.type === 'separator'}
						<div class="dropdown-sep"></div>
					{:else}
						<button
							class="dropdown-item"
							class:disabled={'disabled' in it && it.disabled}
							onclick={() => handleMenuItemClick(it)}
						>
							<span
								>{it.type === 'check' ? `${it.checked ? '✓ ' : '  '}${it.label}` : it.label}</span
							>
							{#if 'shortcut' in it && it.shortcut}<span class="shortcut">{it.shortcut}</span>{/if}
						</button>
					{/if}
				{/each}
			</div>
		{/if}
	</div>

	<!-- App name — bold, always visible -->
	<span class="menu-item app-name" style="cursor: default;">{app.name}</span>

	<!-- App-defined menus from the registry -->
	{#each appMenus as menu (menu.label)}
		<div
			class="menu-wrapper"
			role="none"
			onmouseenter={() => {
				if (openMenu) openMenu = menu.label;
			}}
		>
			<button
				class="menu-item"
				class:open={openMenu === menu.label}
				onclick={() => (openMenu = openMenu === menu.label ? null : menu.label)}
				>{menu.label}</button
			>
			{#if openMenu === menu.label}
				<div class="dropdown">
					{#each menu.items as it, i (it.type === 'separator' ? `separator-${i}` : it.label)}
						{#if it.type === 'separator'}
							<div class="dropdown-sep"></div>
						{:else}
							<button
								class="dropdown-item"
								class:disabled={'disabled' in it && it.disabled}
								onclick={() => handleMenuItemClick(it)}
							>
								<span>
									{#if it.type === 'check'}
										<span class="check-mark">{it.checked ? '✓' : ''}</span>
									{/if}
									{it.label}
								</span>
								{#if 'shortcut' in it && it.shortcut}<span class="shortcut">{it.shortcut}</span
									>{/if}
							</button>
						{/if}
					{/each}
				</div>
			{/if}
		</div>
	{/each}

	<!-- Right side -->
	<div class="right">
		{#if contextInfo}
			<span class="context-info">{contextInfo}</span>
		{/if}
		{#if statusExtra}
			<span class="status-extra status-{statusExtra.kind || 'default'}">
				<span class="status-dot">●</span>{statusExtra.label}
			</span>
		{/if}
		<span class="muted info">{openWindows} window{openWindows === 1 ? '' : 's'} open</span>

		<div class="clock-wrap-outer">
			<button
				class="clock-toggle"
				class:open={tzOpen}
				onclick={(e) => {
					e.stopPropagation();
					tzOpen = !tzOpen;
					openMenu = null;
				}}
				title="Click to change time zone"
			>
				<span class="clock">{clock}</span>
				<span class="tz-badge">{tzLabel}</span>
			</button>
			{#if tzOpen}
				<div
					class="tz-picker"
					role="listbox"
					tabindex="-1"
					onkeydown={(e) => {
						if (e.key === 'Escape') tzOpen = false;
					}}
					onclick={(e) => e.stopPropagation()}
				>
					<div class="tz-picker-head">Time zone</div>
					{#each TZ_OPTIONS as opt (opt.tz)}
						{@const selected = isSelectedTz(opt.tz, timezone)}
						<button
							class="tz-item"
							class:selected
							role="option"
							aria-selected={selected}
							onclick={() => {
								onSetTimezone?.(opt.tz);
								tzOpen = false;
							}}
						>
							<span class="tz-check">{selected ? '✓' : ''}</span>
							<span class="tz-item-label">{opt.label}</span>
							<span class="tz-time">{formatTzTime(now, opt.tz)}</span>
						</button>
					{/each}
				</div>
			{/if}
		</div>
	</div>
</div>

<style>
	.menubar {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		height: var(--chrome-menubar-height, 28px);
		background: var(--chrome-menubar-bg, var(--paper));
		border-bottom: 2px solid var(--chrome-window-border-color, var(--ink));
		display: flex;
		align-items: center;
		padding: 0 12px;
		gap: 0;
		font: var(--chrome-menubar-font, 16px var(--brand-font-ui, 'Pixelify Sans', sans-serif));
		z-index: 10000;
		letter-spacing: 0.02em;
		color: var(--chrome-menubar-fg, var(--ink));
	}
	.apple {
		line-height: 1;
		display: inline-flex;
		align-items: center;
	}
	.os-icon {
		width: 16px;
		height: 16px;
		image-rendering: pixelated;
	}
	.menu-item {
		cursor: pointer;
		padding: 2px 6px;
		border-radius: 0;
		margin-right: 8px;
	}
	.menu-item:hover,
	.menu-item.open {
		background: var(--chrome-menubar-hover-bg, var(--ink));
		color: var(--chrome-menubar-hover-fg, var(--paper));
	}
	.app-name {
		font-weight: 600;
	}
	.menu-wrapper {
		position: relative;
	}
	.dropdown {
		position: absolute;
		top: 22px;
		left: 0;
		background: var(--chrome-menubar-bg, var(--paper));
		color: var(--chrome-menubar-fg, var(--ink));
		border: 2px solid var(--chrome-window-border-color, var(--ink));
		box-shadow: 3px 3px 0 var(--shadow);
		min-width: 220px;
		padding: 4px 0;
		font-size: 14px;
		z-index: 11000;
	}
	.dropdown-item {
		padding: 4px 12px;
		display: flex;
		justify-content: space-between;
		gap: 24px;
		cursor: pointer;
		align-items: center;
	}
	.dropdown-item.disabled {
		opacity: 0.4;
		cursor: default;
	}
	.dropdown-item:not(.disabled):hover {
		background: var(--chrome-menubar-hover-bg, var(--ink));
		color: var(--chrome-menubar-hover-fg, var(--paper));
	}
	.dropdown-sep {
		height: 1px;
		background: var(--chrome-menubar-fg, var(--ink));
		margin: 4px 8px;
		opacity: 0.2;
	}
	.shortcut {
		opacity: 0.7;
		font-family: var(--brand-font-body, 'VT323', monospace);
	}
	.check-mark {
		display: inline-block;
		width: 14px;
		font-family: var(--brand-font-display, 'Press Start 2P', monospace);
		font-size: 10px;
	}
	.right {
		margin-left: auto;
		display: flex;
		gap: 14px;
		align-items: center;
		font-size: 14px;
	}
	.info {
		font-family: var(--brand-font-body, 'VT323', monospace);
	}
	.context-info {
		font-family: var(--brand-font-display, 'Press Start 2P', monospace);
		font-size: 8px;
		padding: 2px 6px;
		letter-spacing: 0.04em;
	}
	.status-extra {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		font-family: var(--brand-font-display, 'Press Start 2P', monospace);
		font-size: 9px;
		padding: 3px 6px;
		letter-spacing: 0.05em;
		background: var(--ink);
		color: var(--paper);
	}
	.status-extra.status-live {
		color: var(--accent-2);
	}
	/* REC rides the same active-app status channel as LIVE, but keeps its old
	   look: not inverted, accent text, a faster-pulsing dot. (Rehomed from the
	   former bespoke .rec / .rec-dot rules.) */
	.status-extra.status-rec {
		background: none;
		color: var(--accent);
	}
	.status-dot {
		font-size: 7px;
		color: var(--accent);
		animation: blink 1.4s steps(2, end) infinite;
	}
	.status-rec .status-dot {
		animation: blink 1s steps(2, end) infinite;
	}

	/* Clock + TZ picker */
	.clock-wrap-outer {
		position: relative;
	}
	.clock-toggle {
		display: flex;
		align-items: baseline;
		gap: 6px;
		padding: 2px 6px;
		cursor: pointer;
		border: 2px solid transparent;
		font-family: var(--brand-font-body, 'VT323', monospace);
		font-size: 16px;
		user-select: none;
		background: none;
		color: inherit;
	}
	.clock-toggle:hover,
	.clock-toggle.open {
		background: var(--chrome-menubar-hover-bg, var(--ink));
		color: var(--chrome-menubar-hover-fg, var(--paper));
		border-color: var(--chrome-menubar-hover-bg, var(--ink));
	}
	.clock {
		letter-spacing: 0.02em;
		white-space: nowrap;
	}
	.tz-badge {
		font-family: var(--brand-font-display, 'Press Start 2P', monospace);
		font-size: 8px;
		padding: 1px 4px;
		opacity: 0.5;
		letter-spacing: 0.04em;
	}
	.clock-toggle:hover .tz-badge,
	.clock-toggle.open .tz-badge {
		opacity: 0.8;
	}
	.tz-picker {
		position: absolute;
		top: 26px;
		right: -2px;
		background: var(--chrome-menubar-bg, var(--paper));
		color: var(--chrome-menubar-fg, var(--ink));
		border: 2px solid var(--chrome-window-border-color, var(--ink));
		box-shadow: 4px 4px 0 var(--shadow);
		min-width: 240px;
		max-height: 360px;
		overflow-y: auto;
		z-index: 11000;
		font-family: var(--brand-font-ui, 'Pixelify Sans', sans-serif);
	}
	.tz-picker-head {
		padding: 6px 12px;
		font-family: var(--brand-font-display, 'Press Start 2P', monospace);
		font-size: 9px;
		background: var(--paper-soft);
		border-bottom: 2px solid var(--chrome-window-border-color, var(--ink));
		letter-spacing: 0.05em;
	}
	.tz-item {
		display: grid;
		grid-template-columns: 16px 1fr auto;
		align-items: baseline;
		gap: 8px;
		padding: 6px 10px;
		cursor: pointer;
		border-bottom: 1px solid var(--paper-soft);
	}
	.tz-item:last-child {
		border-bottom: none;
	}
	.tz-item:hover {
		background: var(--chrome-menubar-hover-bg, var(--ink));
		color: var(--chrome-menubar-hover-fg, var(--paper));
	}
	.tz-item.selected {
		background: var(--accent-2);
		color: var(--ink);
	}
	.tz-item.selected:hover {
		background: var(--chrome-menubar-hover-bg, var(--ink));
		color: var(--chrome-menubar-hover-fg, var(--paper));
	}
	.tz-check {
		font-family: var(--brand-font-display, 'Press Start 2P', monospace);
		font-size: 10px;
	}
	.tz-item-label {
		font-size: 14px;
	}
	.tz-time {
		font-family: var(--brand-font-body, 'VT323', monospace);
		font-size: 15px;
		opacity: 0.75;
	}
	.tz-item:hover .tz-time {
		opacity: 0.85;
	}

	button.menu-item {
		background: none;
		border: none;
		font: inherit;
		color: inherit;
		cursor: pointer;
		padding: 2px 6px;
		margin: 0;
		line-height: inherit;
	}

	button.dropdown-item {
		background: none;
		border: none;
		font: inherit;
		color: inherit;
		cursor: pointer;
		text-align: left;
		width: 100%;
	}

	button.tz-item {
		background: none;
		border: none;
		font: inherit;
		color: inherit;
		cursor: pointer;
		text-align: left;
		width: 100%;
	}
</style>
