<script lang="ts">
	import { getSystem } from '$lib/os/os-context';

	// The Player is a generic video document handler. It takes no props: the OS
	// hands it the shared context, and it pulls the file to play from win.args
	// (the fileId the matcher parsed out of the `player:<fileId>` window-id).
	const { fs, win } = getSystem();

	let src = $state<string | null>(null);
	let status = $state<'loading' | 'ready' | 'missing' | 'empty'>('loading');

	$effect(() => {
		// Bare launch — Player.app opened from Applications with no document.
		// args.fileId is absent (this is the exact 'player' window, not player:<id>).
		if (!win.args.fileId) {
			status = 'empty';
			return;
		}

		const node = fs.peekNode(win.args.fileId);
		if (!node || node.kind !== 'file' || !node.bodyRef) {
			status = 'missing';
			return;
		}
		const bodyRef = node.bodyRef;

		// Legacy clips inline a base64 data: URL — play it directly, nothing to free.
		if (bodyRef.kind === 'inline-text') {
			src = bodyRef.text;
			status = 'ready';
			return;
		}

		// Blob-backed media: read the bytes, hand the <video> an object URL, and
		// revoke it on cleanup so it doesn't leak when the window closes.
		if (bodyRef.kind === 'indexeddb-blob') {
			let objectUrl: string | null = null;
			let cancelled = false;
			status = 'loading';
			src = null;
			(async () => {
				const res = await fs.readBody(bodyRef.bodyId);
				if (cancelled) return;
				if (!res.ok) {
					status = 'missing';
					return;
				}
				objectUrl = URL.createObjectURL(
					new Blob([res.value], { type: bodyRef.contentType ?? 'video/webm' })
				);
				src = objectUrl;
				status = 'ready';
			})();
			return () => {
				cancelled = true;
				if (objectUrl) URL.revokeObjectURL(objectUrl);
			};
		}

		status = 'missing';
	});
</script>

{#if status === 'ready' && src}
	<div class="player">
		<!-- svelte-ignore a11y_media_has_caption -->
		<video {src} controls autoplay class="player-video"></video>
	</div>
{:else if status === 'loading'}
	<div class="player-msg"><p>Loading…</p></div>
{:else if status === 'empty'}
	<div class="player-msg player-empty">
		<p class="player-empty-glyph">▶</p>
		<p>No video open.</p>
		<p class="player-empty-hint">Open a clip from Finder to play it.</p>
	</div>
{:else}
	<div class="player-msg"><p>This file can’t be played.</p></div>
{/if}

<style>
	.player {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 100%;
		background: var(--brand-color-ink, #000);
	}
	.player-video {
		width: 100%;
		height: 100%;
		object-fit: contain;
	}
	.player-msg {
		padding: 1rem;
	}
	.player-empty {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 100%;
		gap: 4px;
		text-align: center;
		color: var(--ink, #0a0a0a);
		font-family: var(--brand-font-body, 'VT323', monospace);
		font-size: 18px;
	}
	.player-empty-glyph {
		font-size: 40px;
		color: var(--accent, #f54e00);
		margin: 0 0 8px;
	}
	.player-empty-hint {
		opacity: 0.6;
		font-size: 16px;
	}
</style>
