import { loadSoundPrefs, saveSoundPrefs } from '$lib/persistence';

/**
 * The OS voice layer — one lazily-created AudioContext shared by the OS and
 * every app, reached as `os.audio` off AppContext. All sound is synthesized
 * (square/pulse/triangle/noise); there are no audio assets. Apps that share
 * this vocabulary sound like siblings instead of each reinventing WebAudio.
 *
 * Browser autoplay policy shapes the whole design: the context is only created
 * after the first user gesture (a one-shot pointer/key listener installed by
 * `init()`). Any tone requested before that gesture is dropped silently — the
 * OS never queues sound the user hasn't "earned" with an interaction. The
 * context suspends while the tab is hidden, so sound never plays from a
 * background tab.
 */

/** The subset of AudioContext the voice layer touches — mockable in tests. */
export type OsAudioContext = Pick<
	AudioContext,
	| 'currentTime'
	| 'state'
	| 'sampleRate'
	| 'destination'
	| 'resume'
	| 'suspend'
	| 'close'
	| 'createGain'
	| 'createOscillator'
	| 'createBuffer'
	| 'createBufferSource'
	| 'createPeriodicWave'
	| 'createBiquadFilter'
>;

/**
 * A raw line into the shared context, handed out by `line()`. `ctx` is the
 * one OS AudioContext (schedule on its clock); `out` is where the app's
 * graph terminates — it routes through the OS master gain, so the single
 * mute/volume setting and hidden-tab suspend govern app synths too.
 */
export type AudioLine = {
	ctx: OsAudioContext;
	out: GainNode;
	/** Detach the line's output. Call from the window's lifecycle cleanup. */
	close(): void;
};

export type ToneWave = 'square' | 'pulse' | 'triangle' | 'noise';

export type ToneSpec = {
	/** Oscillator shape. `pulse` is a 25%-duty square; `noise` is white noise. */
	wave?: ToneWave;
	/** Frequency in Hz (ignored for noise). */
	freq?: number;
	/** Duration in milliseconds. */
	dur?: number;
	/** Per-tone gain 0–1, multiplied under the master volume. */
	gain?: number;
	/** Delay before the tone starts, in milliseconds (for two-tone phrases). */
	delayMs?: number;
};

/** Headroom so a full-gain tone at full volume doesn't clip. */
const VOICE_LEVEL = 0.25;

function clamp01(v: number): number {
	return Math.min(1, Math.max(0, v));
}

export class OsAudioClass {
	/** Master mute — persisted. All voices route through one master gain. */
	muted = $state(false);
	/** Master volume 0–1 — persisted. */
	volume = $state(0.6);

	private createContext: () => OsAudioContext;
	private ctx: OsAudioContext | null = null;
	private masterGain: GainNode | null = null;
	private noiseBuffer: AudioBuffer | null = null;
	private pulseWave: PeriodicWave | null = null;
	private unlockHandler: (() => void) | null = null;
	private visibilityHandler: (() => void) | null = null;
	private loadedPrefs = false;

	constructor(createContext: () => OsAudioContext = () => new AudioContext()) {
		this.createContext = createContext;
	}

	/**
	 * Install the one-shot gesture unlock and the visibility auto-suspend.
	 * Called from OsApiClass.init(); safe to call more than once and a no-op
	 * during SSR. No AudioContext exists until the first pointerdown/keydown.
	 */
	init(): void {
		if (typeof window === 'undefined' || this.unlockHandler) return;

		// Read persisted prefs here (not in the constructor) so the module-level
		// singleton can be imported during SSR/tests before storage exists.
		if (!this.loadedPrefs) {
			this.loadedPrefs = true;
			const prefs = loadSoundPrefs();
			this.muted = prefs.muted;
			this.volume = clamp01(prefs.volume);
		}

		this.unlockHandler = () => this.unlock();
		window.addEventListener('pointerdown', this.unlockHandler, { capture: true });
		window.addEventListener('keydown', this.unlockHandler, { capture: true });

		this.visibilityHandler = () => {
			if (!this.ctx) return;
			// Sound must never play from a hidden tab; resume only on return.
			if (document.hidden) void this.ctx.suspend();
			else if (!this.muted) void this.ctx.resume();
		};
		document.addEventListener('visibilitychange', this.visibilityHandler);
	}

	/** Tear down listeners and close the context. Called from OsApiClass.destroy(). */
	destroy(): void {
		if (typeof window !== 'undefined' && this.unlockHandler) {
			window.removeEventListener('pointerdown', this.unlockHandler, { capture: true });
			window.removeEventListener('keydown', this.unlockHandler, { capture: true });
			this.unlockHandler = null;
		}
		if (typeof document !== 'undefined' && this.visibilityHandler) {
			document.removeEventListener('visibilitychange', this.visibilityHandler);
			this.visibilityHandler = null;
		}
		if (this.ctx) {
			void this.ctx.close();
			this.ctx = null;
			this.masterGain = null;
			this.noiseBuffer = null;
			this.pulseWave = null;
		}
	}

	setMuted(muted: boolean): void {
		this.muted = muted;
		if (this.masterGain) this.masterGain.gain.value = muted ? 0 : this.volume;
		this.persist();
	}

	setVolume(volume: number): void {
		this.volume = clamp01(volume);
		if (this.masterGain && !this.muted) this.masterGain.gain.value = this.volume;
		this.persist();
	}

	// ── Voices ────────────────────────────────────────────────────────────

	/** The general-purpose system beep. */
	beep(freq = 880, dur = 120): void {
		this.tone({ wave: 'square', freq, dur });
	}

	/** A short UI tick — menu actions, key clicks. */
	blip(): void {
		this.tone({ wave: 'square', freq: 1320, dur: 35, gain: 0.5 });
	}

	/** The system alert voice — a two-tone descending buzz. */
	error(): void {
		this.tone({ wave: 'pulse', freq: 196, dur: 110, gain: 0.9 });
		this.tone({ wave: 'pulse', freq: 131, dur: 150, gain: 0.9, delayMs: 120 });
	}

	/**
	 * Low-level synth voice. Drops silently when muted, when the tab is hidden,
	 * or before the first user gesture — callers never need to guard.
	 */
	tone(spec: ToneSpec = {}): void {
		const { wave = 'square', freq = 440, dur = 100, gain = 1, delayMs = 0 } = spec;
		const ctx = this.ctx;
		if (!ctx || !this.masterGain || this.muted) return;
		if (typeof document !== 'undefined' && document.hidden) return;

		const t0 = ctx.currentTime + delayMs / 1000;
		const t1 = t0 + Math.max(dur, 10) / 1000;
		const level = VOICE_LEVEL * clamp01(gain);

		// Per-tone envelope: a few-ms attack (declick), then a linear decay to
		// the stop time. Chip-style — no sustain stage.
		const env = ctx.createGain();
		env.gain.setValueAtTime(0, t0);
		env.gain.linearRampToValueAtTime(level, t0 + 0.004);
		env.gain.linearRampToValueAtTime(0.0001, t1);
		env.connect(this.masterGain);

		let source: AudioScheduledSourceNode;
		if (wave === 'noise') {
			const src = ctx.createBufferSource();
			src.buffer = this.getNoiseBuffer(ctx);
			src.loop = true;
			source = src;
		} else {
			const osc = ctx.createOscillator();
			if (wave === 'pulse') osc.setPeriodicWave(this.getPulseWave(ctx));
			else osc.type = wave;
			osc.frequency.setValueAtTime(freq, t0);
			source = osc;
		}
		source.connect(env);
		source.onended = () => {
			source.disconnect();
			env.disconnect();
		};
		source.start(t0);
		source.stop(t1);
	}

	/**
	 * A raw line for an app whose sound outgrows the chip-tone voices —
	 * continuous tones, scheduled frequency sweeps, filtered noise. Returns
	 * null before the first user gesture, so take the line inside a gesture
	 * handler and hold onto it. A line taken while muted still plays later:
	 * mute lives in the master gain, not in the line.
	 */
	line(): AudioLine | null {
		const ctx = this.ctx;
		const master = this.masterGain;
		if (!ctx || !master) return null;
		const out = ctx.createGain();
		out.connect(master);
		return { ctx, out, close: () => out.disconnect() };
	}

	// ── Internals ─────────────────────────────────────────────────────────

	private unlock(): void {
		if (typeof window !== 'undefined' && this.unlockHandler) {
			window.removeEventListener('pointerdown', this.unlockHandler, { capture: true });
			window.removeEventListener('keydown', this.unlockHandler, { capture: true });
			this.unlockHandler = null;
		}
		if (this.ctx) return;
		this.ctx = this.createContext();
		this.masterGain = this.ctx.createGain();
		this.masterGain.gain.value = this.muted ? 0 : this.volume;
		this.masterGain.connect(this.ctx.destination);
		if (this.ctx.state === 'suspended') void this.ctx.resume();
	}

	/** One second of cached white noise, looped by noise voices. */
	private getNoiseBuffer(ctx: OsAudioContext): AudioBuffer {
		if (!this.noiseBuffer) {
			const buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
			const data = buffer.getChannelData(0);
			for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
			this.noiseBuffer = buffer;
		}
		return this.noiseBuffer;
	}

	/** 25%-duty pulse built from its Fourier series — the classic chip lead. */
	private getPulseWave(ctx: OsAudioContext): PeriodicWave {
		if (!this.pulseWave) {
			const duty = 0.25;
			const n = 32;
			const real = new Float32Array(n);
			const imag = new Float32Array(n);
			for (let k = 1; k < n; k++) {
				real[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * duty);
			}
			this.pulseWave = ctx.createPeriodicWave(real, imag);
		}
		return this.pulseWave;
	}

	private persist(): void {
		saveSoundPrefs({ muted: this.muted, volume: this.volume });
	}
}

/** The OS-wide singleton. Apps reach it as `os.audio` off AppContext. */
export const osAudio = new OsAudioClass();
