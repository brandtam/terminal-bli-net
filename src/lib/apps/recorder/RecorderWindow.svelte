<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import type { TerminalFS, FsFile } from '$lib/terminalos';
	import { RECORDINGS_ID } from '$lib/terminalos';

	let {
		recording = $bindable(false),
		fs
	}: {
		recording?: boolean;
		fs: TerminalFS;
	} = $props();

	const MAX_DURATION = 10;
	const MAX_RECORDINGS = 5;

	let stream = $state<MediaStream | null>(null);
	let recorder = $state<MediaRecorder | null>(null);
	let isRecording = $state(false);
	let elapsed = $state(0);
	let recordings = $state<FsFile[]>([]);
	let playbackUrl = $state<string | null>(null);
	let error = $state<string | null>(null);
	let videoEl: HTMLVideoElement | undefined = $state(undefined);
	let playbackEl: HTMLVideoElement | undefined = $state(undefined);
	let chunks: Blob[] = [];
	let timerInterval: ReturnType<typeof setInterval> | null = null;

	$effect(() => {
		recording = isRecording;
	});

	function refreshRecordings() {
		recordings = fs.findByApp('recorder', RECORDINGS_ID);
	}

	function formatTime(s: number): string {
		const mm = String(Math.floor(s / 60)).padStart(2, '0');
		const ss = String(s % 60).padStart(2, '0');
		return `${mm}:${ss}`;
	}

	async function initCamera() {
		if (!navigator.mediaDevices?.getUserMedia) {
			error = "Your browser doesn't support camera access.";
			return;
		}
		try {
			stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
			if (videoEl) {
				videoEl.srcObject = stream;
			}
		} catch (e: unknown) {
			const err = e as Error;
			if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
				error = 'Camera access was denied. Check your browser settings.';
			} else {
				error = `Camera error: ${err.message}`;
			}
		}
	}

	function startRecording() {
		if (!stream) return;
		if (recordings.length >= MAX_RECORDINGS) {
			error = `Storage full — delete a recording first (max ${MAX_RECORDINGS}).`;
			return;
		}

		chunks = [];
		try {
			recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
		} catch {
			try {
				recorder = new MediaRecorder(stream);
			} catch (e: unknown) {
				error = `Recording not supported: ${(e as Error).message}`;
				return;
			}
		}

		recorder.ondataavailable = (e) => {
			if (e.data.size > 0) chunks.push(e.data);
		};

		recorder.onstop = () => {
			const blob = new Blob(chunks, { type: recorder?.mimeType || 'video/webm' });
			const reader = new FileReader();
			reader.onload = async () => {
				const dataUrl = reader.result as string;
				let clipNumber = recordings.length + 1;
				let name = `Clip ${clipNumber} (${elapsed}s).webm`;
				while (fs.exists(RECORDINGS_ID, name)) {
					clipNumber++;
					name = `Clip ${clipNumber} (${elapsed}s).webm`;
				}
				const result = await fs.createFile(RECORDINGS_ID, name, {
					appId: 'recorder',
					fileType: 'recording',
					text: dataUrl
				});
				if (result.ok) {
					refreshRecordings();
					playbackUrl = dataUrl;
				} else {
					error =
						result.error.code === 'duplicate_name'
							? 'A recording with that name already exists.'
							: 'Storage full — delete old recordings to free space.';
				}
			};
			reader.readAsDataURL(blob);
		};

		recorder.start(100);
		isRecording = true;
		elapsed = 0;
		playbackUrl = null;

		timerInterval = setInterval(() => {
			elapsed++;
			if (elapsed >= MAX_DURATION) {
				stopRecording();
			}
		}, 1000);
	}

	function stopRecording() {
		if (recorder && recorder.state !== 'inactive') {
			recorder.stop();
		}
		isRecording = false;
		if (timerInterval) {
			clearInterval(timerInterval);
			timerInterval = null;
		}
	}

	async function removeRecording(id: string) {
		await fs.deleteNode(id);
		refreshRecordings();
		if (playbackUrl && recordings.every((r) => getFileText(r) !== playbackUrl)) {
			playbackUrl = null;
		}
	}

	function getFileText(file: FsFile): string {
		return file.bodyRef?.kind === 'inline-text' ? file.bodyRef.text : '';
	}

	function playRecording(rec: FsFile) {
		playbackUrl = getFileText(rec);
	}

	function cleanup() {
		stopRecording();
		if (stream) {
			stream.getTracks().forEach((t) => t.stop());
			stream = null;
		}
	}

	onMount(() => {
		refreshRecordings();
		initCamera();
	});

	onDestroy(() => {
		cleanup();
	});

	$effect(() => {
		if (videoEl && stream) {
			videoEl.srcObject = stream;
		}
	});
</script>

<div class="recorder">
	{#if error}
		<div class="error-msg">{error}</div>
		<button class="btn" onclick={() => (error = null)}>Dismiss</button>
	{/if}

	<div class="preview-area">
		{#if playbackUrl && !isRecording}
			<video bind:this={playbackEl} class="video-playback" src={playbackUrl} controls autoplay>
				<track kind="captions" />
			</video>
		{:else}
			<video bind:this={videoEl} class="video-live" autoplay muted playsinline>
				<track kind="captions" />
			</video>
		{/if}
	</div>

	<div class="controls">
		{#if isRecording}
			<span class="timer">{formatTime(elapsed)}</span>
			<button class="rec-btn recording" onclick={stopRecording} aria-label="Stop recording">
				<span class="stop-icon"></span>
			</button>
			<span class="timer-hint">max {MAX_DURATION}s</span>
		{:else}
			<button
				class="rec-btn"
				onclick={startRecording}
				disabled={!stream}
				aria-label="Start recording"
			>
				<span class="rec-circle"></span>
			</button>
		{/if}
	</div>

	{#if recordings.length > 0}
		<div class="recordings-list">
			<div class="list-header">SAVED ({recordings.length}/{MAX_RECORDINGS})</div>
			{#each recordings as rec (rec.id)}
				<div class="rec-item">
					<button class="rec-item-play" onclick={() => playRecording(rec)}>
						{rec.name}
					</button>
					<span class="rec-item-meta">{new Date(rec.createdAt).toLocaleTimeString()}</span>
					<button class="rec-item-del" onclick={() => removeRecording(rec.id)}>✕</button>
				</div>
			{/each}
		</div>
	{/if}
</div>

<style>
	.recorder {
		padding: 10px;
		display: flex;
		flex-direction: column;
		gap: 10px;
		height: 100%;
		box-sizing: border-box;
		overflow-y: auto;
	}

	.error-msg {
		background: var(--accent);
		color: var(--paper);
		padding: 8px 10px;
		font-family: var(--brand-font-body, 'VT323', monospace);
		font-size: 16px;
		border: 2px solid var(--ink);
	}

	.preview-area {
		background: var(--brand-color-ink, #000);
		border: 2px solid var(--ink);
		box-shadow: 2px 2px 0 var(--shadow);
		aspect-ratio: 4 / 3;
		display: flex;
		align-items: center;
		justify-content: center;
		overflow: hidden;
	}

	.video-live,
	.video-playback {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}

	.controls {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 12px;
		padding: 8px 0;
	}

	.timer {
		font-family: var(--brand-font-body, 'VT323', monospace);
		font-size: 24px;
		color: var(--accent);
		min-width: 60px;
		text-align: right;
	}

	.timer-hint {
		font-family: var(--brand-font-body, 'VT323', monospace);
		font-size: 14px;
		opacity: 0.5;
		min-width: 60px;
	}

	.rec-btn {
		width: 48px;
		height: 48px;
		border-radius: 50%;
		border: 3px solid var(--ink);
		background: var(--paper);
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		box-shadow: 2px 2px 0 var(--shadow);
		transition: transform 0.1s;
	}

	.rec-btn:hover:not(:disabled) {
		transform: scale(1.05);
	}

	.rec-btn:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.rec-btn.recording {
		background: var(--accent);
		animation: pulse-border 0.6s steps(2, end) infinite;
	}

	.rec-circle {
		width: 24px;
		height: 24px;
		border-radius: 50%;
		background: var(--accent);
	}

	.stop-icon {
		width: 18px;
		height: 18px;
		background: var(--paper);
	}

	@keyframes pulse-border {
		0%,
		100% {
			border-color: var(--ink);
		}
		50% {
			border-color: var(--accent);
		}
	}

	.recordings-list {
		border: 2px solid var(--ink);
		box-shadow: 2px 2px 0 var(--shadow);
	}

	.list-header {
		font-family: var(--brand-font-display, 'Press Start 2P', monospace);
		font-size: 9px;
		padding: 6px 8px;
		background: var(--paper-soft);
		border-bottom: 2px solid var(--ink);
		letter-spacing: 0.05em;
	}

	.rec-item {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 6px 8px;
		border-bottom: 1px solid var(--paper-soft);
		font-family: var(--brand-font-body, 'VT323', monospace);
		font-size: 16px;
	}

	.rec-item:last-child {
		border-bottom: none;
	}

	.rec-item-play {
		background: none;
		border: none;
		cursor: pointer;
		font-family: inherit;
		font-size: inherit;
		padding: 0;
		text-decoration: underline;
		color: var(--ink);
	}

	.rec-item-play:hover {
		color: var(--accent);
	}

	.rec-item-meta {
		flex: 1;
		text-align: right;
		opacity: 0.6;
		font-size: 14px;
	}

	.rec-item-del {
		background: none;
		border: 1px solid var(--ink);
		cursor: pointer;
		font-size: 12px;
		padding: 2px 5px;
		font-family: var(--brand-font-body, 'VT323', monospace);
	}

	.rec-item-del:hover {
		background: var(--accent);
		color: var(--paper);
	}
</style>
