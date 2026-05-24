<script lang="ts">
	import { onMount } from 'svelte';
	import type { Bot, GroupMeta, WindowState, TweaksState } from '$lib/types';
	import { isOnAir, currentlyAiring, minutesRemaining } from '$lib/schedule';
	import {
		loadWindows,
		saveWindows,
		loadTweaks,
		saveTweaks,
		loadTimezone,
		isFirstVisit
	} from '$lib/persistence';
	import Window from './Window.svelte';
	import MenuBar from './MenuBar.svelte';
	import DesktopIcon from './DesktopIcon.svelte';
	import PixelIcon from './PixelIcon.svelte';
	import Dock from './Dock.svelte';
	import ChatWindow from './ChatWindow.svelte';
	import TVGuide from './TVGuide.svelte';

	let groups = $state<GroupMeta[]>([]);
	let bots = $state<Bot[]>([]);
	let windows = $state<WindowState[]>([]);
	let zCounter = $state(10);
	let activeId = $state<string | null>(null);
	let tweaks = $state<TweaksState>({ wallpaper: 'teal', accent: '#f54e00' });
	let timezone = $state<string | undefined>(undefined);
	let now = $state(new Date());
	let chatBotId = $state<Record<string, string>>({});
	let isMobile = $state(false);

	onMount(() => {
		tweaks = loadTweaks();
		timezone = loadTimezone() || Intl.DateTimeFormat().resolvedOptions().timeZone;
		isMobile = window.innerWidth < 768;

		fetch('/api/data')
			.then((res) => (res.ok ? res.json() : null))
			.then((data) => {
				if (data) {
					groups = (data as { groups: GroupMeta[]; bots: Bot[] }).groups;
					bots = (data as { groups: GroupMeta[]; bots: Bot[] }).bots;
				}
			})
			.catch(() => {});

		const saved = loadWindows();
		if (saved.length > 0) {
			windows = saved;
		} else if (isFirstVisit()) {
			openWindow('tv-guide');
		}

		const tick = setInterval(() => {
			now = new Date();
		}, 30000);

		const handleResize = () => {
			isMobile = window.innerWidth < 768;
		};
		window.addEventListener('resize', handleResize);

		const handleKeydown = (e: KeyboardEvent) => {
			if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'g') {
				e.preventDefault();
				openWindow('tv-guide');
			} else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'w') {
				e.preventDefault();
				if (activeId) closeWindow(activeId);
			}
		};
		window.addEventListener('keydown', handleKeydown);

		return () => {
			clearInterval(tick);
			window.removeEventListener('resize', handleResize);
			window.removeEventListener('keydown', handleKeydown);
		};
	});

	$effect(() => {
		document.documentElement.style.setProperty('--accent', tweaks.accent);
	});

	$effect(() => {
		saveWindows(windows);
	});

	function getWindowDef(id: string): { title: string; w: number; h: number } {
		const defs: Record<string, { title: string; w: number; h: number }> = {
			welcome: { title: 'Welcome.app', w: 460, h: 540 },
			'tv-guide': { title: 'TV Guide.app', w: 620, h: 540 },
			pricing: { title: 'Pricing.txt', w: 460, h: 380 },
			readme: { title: 'README.TXT', w: 380, h: 420 },
			about: { title: 'About this Mac', w: 380, h: 420 },
			error: { title: 'System Error', w: 420, h: 260 },
			trash: { title: 'Trash', w: 380, h: 320 }
		};
		if (id.startsWith('chat-')) {
			const botId = id.replace('chat-', '');
			const bot = bots.find((b) => b.id === botId);
			const group = bot ? groups.find((g) => g.slug === bot.group) : null;
			return {
				title: bot ? `${bot.name} · ${group?.name ?? bot.group}` : 'Chat',
				w: 440,
				h: 560
			};
		}
		return defs[id] || { title: id, w: 380, h: 320 };
	}

	function focusWindow(id: string) {
		activeId = id;
		zCounter++;
		windows = windows.map((w) => (w.id === id ? { ...w, z: zCounter } : w));
	}

	function moveWindow(id: string, x: number, y: number) {
		windows = windows.map((w) => (w.id === id ? { ...w, x, y } : w));
	}

	function resizeWindow(id: string, w: number, h: number) {
		windows = windows.map((win) => (win.id === id ? { ...win, w, h } : win));
	}

	function closeWindow(id: string) {
		windows = windows.filter((w) => w.id !== id);
		if (activeId === id) activeId = null;
	}

	function openWindow(id: string) {
		if (isMobile) {
			windows = windows.filter((w) => w.id !== id);
		}

		const existing = windows.find((w) => w.id === id);
		if (existing) {
			focusWindow(id);
			return;
		}

		const def = getWindowDef(id);
		const vw = typeof window !== 'undefined' ? window.innerWidth : 1200;
		const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
		const offset = (windows.length * 28) % 200;

		const w: WindowState = {
			id,
			x: isMobile ? 0 : Math.max(20, Math.min(vw - def.w - 20, 160 + offset)),
			y: isMobile ? 28 : Math.max(32, Math.min(vh - def.h - 110, 70 + offset)),
			w: isMobile ? vw : Math.min(def.w, vw - 40),
			h: isMobile ? vh - 28 : Math.min(def.h, vh - 140),
			z: ++zCounter
		};

		windows = [...windows, w];
		activeId = id;
	}

	function openChat(group: GroupMeta, bot: Bot) {
		if (!isOnAir(group, now, timezone)) return;
		const windowId = `chat-${bot.id}`;
		chatBotId[windowId] = bot.id;
		openWindow(windowId);
	}

	function handleSubscribe(_group: GroupMeta) {
		// TODO: open email opt-in
	}

	function getShowColors(slug: string): string {
		const colors: Record<string, string> = {
			mash: '#a6f000',
			seinfeld: '#f9bd2b',
			office: '#a6d8ff',
			'arrested-development': '#f54e00',
			'star-trek-tng': '#2b6cb0',
			'parks-and-rec': '#ff79c6'
		};
		return colors[slug] || '#a6f000';
	}

	const isRecording = $derived(currentlyAiring(groups, now, timezone).length > 0);
</script>

<div class="desktop" data-wallpaper={tweaks.wallpaper}>
	<MenuBar onopen={openWindow} openWindows={windows.length} {isRecording} />

	{#if !isMobile || windows.length === 0}
		<div class="desktop-icons left">
			<DesktopIcon label="chatrbot HD" ondblclick={() => openWindow('welcome')}>
				<PixelIcon kind="hd" />
			</DesktopIcon>
			<DesktopIcon label="TV Guide.app" ondblclick={() => openWindow('tv-guide')}>
				<PixelIcon kind="tvguide" />
			</DesktopIcon>
			<DesktopIcon label="README.txt" ondblclick={() => openWindow('readme')}>
				<PixelIcon kind="doc" />
			</DesktopIcon>
		</div>

		<div class="desktop-icons right">
			<DesktopIcon label="Pricing.txt" ondblclick={() => openWindow('pricing')}>
				<PixelIcon kind="doc" accent />
			</DesktopIcon>
			<DesktopIcon label="Trash" ondblclick={() => openWindow('trash')}>
				<PixelIcon kind="trash" />
			</DesktopIcon>
		</div>

		<div class="sticky">
			<h4>v3 launch — todo</h4>
			<div class="sticky-body">
				☑ ship 6 shows<br />
				☑ build desktop OS<br />
				☒ get sued<br />
				☐ teach Kramer to type<br />
				☐ <i>"try Game of Thrones?"</i>
			</div>
		</div>
	{/if}

	{#each windows as w (w.id)}
		{@const def = getWindowDef(w.id)}
		<Window
			id={w.id}
			title={def.title}
			x={w.x}
			y={w.y}
			width={w.w}
			height={w.h}
			z={w.z}
			active={activeId === w.id}
			onfocus={focusWindow}
			onclose={closeWindow}
			onmove={moveWindow}
			onresize={resizeWindow}
		>
			{#if w.id === 'welcome'}
				<div class="window-content welcome-content">
					<h1 class="welcome-title">chatrbot<span class="accent">.ai</span><span class="blink-cursor"></span></h1>
					<div class="lede">
						<b>It's like a group chat,</b> except the group is Jerry, George, Kramer & Elaine.
						Or Michael & the gang from Scranton. Or Picard on the bridge. You get it.
					</div>
					<p class="tagline">
						We took ~6,000 episodes of TV nobody can shut up about, fed them to some very rude
						language models, and built a desktop OS around them. You can text these people now.
						They will text back. Mostly in character. Sometimes too in character.
					</p>
					<div class="btn-row">
						<button class="btn primary" onclick={() => openWindow('tv-guide')}>OPEN TV GUIDE &rarr;</button>
						<button class="btn" onclick={() => openWindow('about')}>What is this?</button>
					</div>
					<div class="logo-marquee">
						<div class="logo-marquee-track">
							<span>&#9733; AS SEEN ON: your roommate's TikTok</span>
							<span>&#9733; FEATURED IN: a Reddit thread you'd be embarrassed by</span>
							<span>&#9733; TRUSTED BY: 4 cousins and a guy named Doug</span>
							<span>&#9733; ZERO (0) VENTURE FUNDING</span>
							<span>&#9733; AS SEEN ON: your roommate's TikTok</span>
							<span>&#9733; FEATURED IN: a Reddit thread you'd be embarrassed by</span>
							<span>&#9733; TRUSTED BY: 4 cousins and a guy named Doug</span>
							<span>&#9733; ZERO (0) VENTURE FUNDING</span>
						</div>
					</div>
					<p class="muted" style="margin:0;">
						&uarr; open windows by double-clicking the icons, dragging stuff around, or pretending it's 1994.
					</p>
				</div>
			{:else if w.id === 'tv-guide'}
				<TVGuide
					{groups}
					{bots}
					{timezone}
					onOpenChat={openChat}
					onSubscribe={handleSubscribe}
				/>
			{:else if w.id.startsWith('chat-')}
				{@const botId = w.id.replace('chat-', '')}
				{@const bot = bots.find((b) => b.id === botId)}
				{@const group = bot ? groups.find((g) => g.slug === bot.group) : null}
				{#if bot}
					<ChatWindow
						{bot}
						minutesLeft={group ? minutesRemaining(group, now, timezone) : null}
					/>
				{/if}
			{:else if w.id === 'pricing'}
				<div class="window-content readme">
					<pre class="pricing-txt">Pricing.txt
===========

Tier 1: $0/mo — current tier, also the only tier
Tier 2: $0/mo — same as Tier 1, but in a different font
Tier 3: lol

FAQ:
Q: Is this really free?
A: Yes.
Q: How?
A: I write code at night and own the domain.
Q: Can I buy you a coffee?
A: That's nice. No.</pre>
				</div>
			{:else if w.id === 'readme'}
				<div class="window-content readme">
					<h3>README.TXT — v3.0</h3>
					<p>
						welcome to chatrbot.ai — a desktop full of chats with people who don't
						exist (in this universe). shows have broadcast schedules. you can only
						chat when they're on the air.
					</p>
					<h3>HOW IT WORKS</h3>
					<p>
						1. check the <b>TV Guide</b>. 2. find a show that's on. 3. click a
						character. 4. they reply, in character.
					</p>
					<h3>KEYBOARD SHORTCUTS</h3>
					<ul>
						<li><span class="kbd">⌘G</span> TV Guide</li>
						<li><span class="kbd">⌘W</span> close window</li>
					</ul>
					<h3>HOUSE RULES</h3>
					<ul>
						<li>characters can be rude. that is the point.</li>
						<li>shows go off-air. that is also the point.</li>
						<li>screenshots are encouraged, framed printouts are unhinged.</li>
					</ul>
					<h3>FAQ</h3>
					<p>
						<b>Is this legal?</b> Probably. Parody is. We're not licensed by anyone.
					</p>
					<p>
						<b>Does it use AI?</b> Yes. We won't pretend it doesn't. The vibes are
						100% homemade.
					</p>
				</div>
			{:else if w.id === 'about'}
				<div class="window-content readme">
					<div class="about-header">
						<div class="about-icon">:)</div>
						<div>
							<div class="about-title">chatrbot.ai</div>
							<div class="about-version">
								Version 3.0 "Pilot" · Built in a garage · Yes, like that one
							</div>
						</div>
					</div>
					<h3>WHAT</h3>
					<p>
						a chat simulator for casts of TV shows. it runs on the world's most
						expensive improv troupe. shows have broadcast schedules — you can only
						chat when they're on.
					</p>
					<h3>WHY</h3>
					<p>
						your favorite show ended. you want one more episode. we can't do that.
						but we can have George yell at you for forgetting milk.
					</p>
					<h3>WHO</h3>
					<p>one person, zero VCs. ships when the code compiles.</p>
					<h3>DISCLAIMER</h3>
					<p>
						These are AI characters. Not the real people, alive or fictional.
						Conversations are private (we don't store them server-side). The shows
						are when they're on.
					</p>
				</div>
			{:else if w.id === 'error'}
				<div class="window-content error-content">
					<div class="bomb">⚠</div>
					<div>
						<div class="error-title">Sorry, a system error occurred.</div>
						<div class="error-detail">
							"ID = -42: hubris overflow"<br />
							<span class="muted">You knew this would happen.</span>
						</div>
						<div class="error-btns">
							<button class="btn" onclick={() => closeWindow('error')}>
								Restart
							</button>
							<button class="btn primary" onclick={() => closeWindow('error')}>
								Forget it
							</button>
						</div>
					</div>
				</div>
			{:else if w.id === 'trash'}
				<div class="window-content readme">
					<h3>TRASH</h3>
					<p>In here you'll find:</p>
					<ul>
						<li>The pilot script</li>
						<li>Whatever Charlie ate</li>
						<li>"a Nigerian prince" — clearly real, do not delete</li>
						<li>Season 9 of every show</li>
						<li>A half-finished Game of Thrones bot (it refused to end)</li>
					</ul>
					<p class="muted">
						Empty Trash from the Special menu. Or don't. Lot of memories in there.
					</p>
				</div>
			{:else}
				<div class="window-content">
					<p>Coming soon...</p>
				</div>
			{/if}
		</Window>
	{/each}

	<Dock onopen={openWindow} openIds={windows.map((w) => w.id)} />
</div>

<style>
	.desktop {
		position: fixed;
		inset: 0;
		overflow: hidden;
		cursor: default;
		user-select: none;
		font-family: 'Pixelify Sans', 'VT323', monospace;
	}
	.desktop[data-wallpaper='teal'] {
		background-color: #008080;
		background-image: linear-gradient(
				45deg,
				#5e8585 25%,
				transparent 25%,
				transparent 75%,
				#5e8585 75%
			),
			linear-gradient(45deg, #5e8585 25%, transparent 25%, transparent 75%, #5e8585 75%);
		background-size: 4px 4px, 4px 4px;
		background-position: 0 0, 2px 2px;
	}
	.desktop[data-wallpaper='speckle'] {
		background-color: #e8e1d3;
		background-image: radial-gradient(circle at 1px 1px, #c8bda6 1px, transparent 1.5px),
			radial-gradient(circle at 3px 5px, #b8a989 1px, transparent 1.5px);
		background-size: 6px 6px, 8px 8px;
		background-position: 0 0, 2px 3px;
	}
	.desktop[data-wallpaper='yellow'] {
		background-color: #f9bd2b;
		background-image: linear-gradient(
				45deg,
				#e3aa20 25%,
				transparent 25%,
				transparent 75%,
				#e3aa20 75%
			),
			linear-gradient(45deg, #e3aa20 25%, transparent 25%, transparent 75%, #e3aa20 75%);
		background-size: 4px 4px, 4px 4px;
		background-position: 0 0, 2px 2px;
	}
	.desktop[data-wallpaper='pink'] {
		background-color: #ff79c6;
		background-image: linear-gradient(
				45deg,
				#ee63b3 25%,
				transparent 25%,
				transparent 75%,
				#ee63b3 75%
			),
			linear-gradient(45deg, #ee63b3 25%, transparent 25%, transparent 75%, #ee63b3 75%);
		background-size: 4px 4px, 4px 4px;
		background-position: 0 0, 2px 2px;
	}
	.desktop[data-wallpaper='navy'] {
		background-color: #0e1a2b;
		background-image: linear-gradient(
				45deg,
				#16243a 25%,
				transparent 25%,
				transparent 75%,
				#16243a 75%
			),
			linear-gradient(45deg, #16243a 25%, transparent 25%, transparent 75%, #16243a 75%);
		background-size: 4px 4px, 4px 4px;
		background-position: 0 0, 2px 2px;
	}
	.desktop-icons {
		position: absolute;
		top: 40px;
		display: flex;
		flex-direction: column;
		gap: 18px;
		z-index: 1;
	}
	.desktop-icons.left {
		left: 16px;
	}
	.desktop-icons.right {
		right: 16px;
	}
	.sticky {
		background: #fff39a;
		border: 2px solid var(--ink);
		padding: 14px;
		font-family: 'Pixelify Sans', sans-serif;
		font-size: 15px;
		line-height: 1.3;
		transform: rotate(-1.5deg);
		position: absolute;
		right: 116px;
		bottom: 80px;
		width: 220px;
		box-shadow: 4px 4px 0 var(--shadow);
		z-index: 1;
	}
	.sticky h4 {
		font-family: 'Press Start 2P', monospace;
		font-size: 10px;
		margin: 0 0 8px;
		font-weight: normal;
	}
	.sticky-body {
		font-family: 'VT323', monospace;
		font-size: 17px;
		line-height: 1.3;
	}
	.window-content {
		padding: 14px;
		font-family: 'VT323', monospace;
		font-size: 18px;
		line-height: 1.35;
	}
	.readme h3 {
		font-family: 'Press Start 2P', monospace;
		font-size: 10px;
		margin: 14px 0 6px;
		font-weight: normal;
	}
	.readme h3:first-child {
		margin-top: 0;
	}
	.readme p {
		margin: 0 0 8px;
	}
	.readme ul {
		padding-left: 18px;
		margin: 4px 0 8px;
	}
	.readme li {
		margin: 2px 0;
	}
	.pricing-txt {
		font-family: 'VT323', monospace;
		font-size: 18px;
		line-height: 1.4;
		white-space: pre-wrap;
		margin: 0;
		padding: 14px;
	}
	.about-header {
		display: flex;
		gap: 14px;
		align-items: center;
		border-bottom: 2px solid var(--ink);
		padding-bottom: 12px;
		margin-bottom: 12px;
	}
	.about-icon {
		width: 64px;
		height: 64px;
		background: var(--accent-2);
		border: 2px solid var(--ink);
		display: grid;
		place-items: center;
		font-family: 'Press Start 2P', monospace;
		font-size: 22px;
	}
	.about-title {
		font-family: 'Press Start 2P', monospace;
		font-size: 14px;
	}
	.about-version {
		font-family: 'VT323', monospace;
		font-size: 17px;
		opacity: 0.8;
		margin-top: 4px;
	}
	.error-content {
		padding: 18px;
		display: flex;
		gap: 14px;
		font-family: 'Pixelify Sans', sans-serif;
		font-size: 14px;
		height: 100%;
		box-sizing: border-box;
	}
	.bomb {
		width: 44px;
		height: 44px;
		background: var(--ink);
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--paper);
		font-size: 28px;
		flex-shrink: 0;
	}
	.error-title {
		font-family: 'Press Start 2P', monospace;
		font-size: 11px;
		margin-bottom: 10px;
		line-height: 1.4;
	}
	.error-detail {
		font-family: 'VT323', monospace;
		font-size: 17px;
		margin-bottom: 14px;
		line-height: 1.3;
	}
	.error-btns {
		display: flex;
		gap: 8px;
		flex-wrap: wrap;
	}

	/* Welcome window */
	.welcome-content {
		font-family: 'VT323', monospace;
	}
	.welcome-title {
		font-family: 'Press Start 2P', monospace;
		font-size: 28px;
		line-height: 1.2;
		margin: 0 0 14px;
		letter-spacing: -1px;
		font-weight: normal;
	}
	.welcome-title .accent {
		color: var(--accent);
	}
	.blink-cursor {
		display: inline-block;
		width: 14px;
		height: 24px;
		background: var(--ink);
		vertical-align: -4px;
		margin-left: 4px;
		animation: blink 1s steps(2, end) infinite;
	}
	.lede {
		font-size: 20px;
		line-height: 1.35;
		margin: 0 0 16px;
		background: var(--accent-2);
		padding: 10px 12px;
		border: 2px solid var(--ink);
	}
	.tagline {
		font-size: 22px;
		line-height: 1.3;
		margin: 0 0 18px;
	}
	.btn-row {
		display: flex;
		gap: 10px;
		flex-wrap: wrap;
		margin-bottom: 14px;
	}
	.logo-marquee {
		overflow: hidden;
		border-top: 2px solid var(--ink);
		border-bottom: 2px solid var(--ink);
		background: var(--paper-soft);
		padding: 10px 0;
		margin: 14px 0;
	}
	.logo-marquee-track {
		display: flex;
		gap: 36px;
		animation: scroll-marquee 22s linear infinite;
		white-space: nowrap;
		width: max-content;
		font-family: 'Press Start 2P', monospace;
		font-size: 11px;
	}

	@media (max-width: 767px) {
		.desktop-icons {
			position: static;
			flex-direction: row;
			flex-wrap: wrap;
			justify-content: center;
			padding: 40px 16px 16px;
			gap: 12px;
		}
		.desktop-icons.right {
			padding-top: 0;
		}
		.sticky {
			display: none;
		}
	}
</style>
