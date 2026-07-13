import type { AudioLine, OsAudioContext } from '$lib/os/audio.svelte';

/**
 * Every Dialer sound, synthesized on the OS audio line (`os.audio.line()`),
 * so the one mute/volume setting and hidden-tab suspend govern the modem too.
 * All timing lives in exported constants so tests can assert the schedule
 * without an audio device — the synth methods only turn constants into
 * oscillator programs.
 *
 * Sound design per the PRD: the handshake is the product. Four phases,
 * ~4.5 s, ending in silence — no persistent hiss after CONNECT.
 */

// ── Timing constants (the testable spec) ────────────────────────────────────

/** Standard DTMF matrix: digit → [row Hz, column Hz]. */
export const DTMF_FREQS: Record<string, [number, number]> = {
	'1': [697, 1209],
	'2': [697, 1336],
	'3': [697, 1477],
	'4': [770, 1209],
	'5': [770, 1336],
	'6': [770, 1477],
	'7': [852, 1209],
	'8': [852, 1336],
	'9': [852, 1477],
	'*': [941, 1209],
	'0': [941, 1336],
	'#': [941, 1477]
};

export const DTMF_ON_MS = 80;
export const DTMF_GAP_MS = 60;
/** Attack/release ramp keeping tone edges click-free. */
export const RAMP_S = 0.005;

export const DIAL_TONE = { freqs: [350, 440] as const, gain: 0.12 };
export const RINGBACK = { freqs: [440, 480] as const, onS: 1.2, offS: 0.8, cycles: 2, gain: 0.15 };
export const BUSY = { freqs: [480, 620] as const, onS: 0.5, offS: 0.5, gain: 0.18 };

/**
 * The four handshake phases, in seconds from the start of the handshake.
 * Contiguous by construction; `CONNECT 2400` prints at `connectAtS` while the
 * settle hiss is still decaying to zero.
 */
export const HANDSHAKE = {
	answer: { startS: 0.0, endS: 0.7, freq: 2100, wobbleHz: 15, gain: 0.3 },
	warble: { startS: 0.7, endS: 1.6, freqs: [1200, 2400] as const, stepS: 0.035, gain: 0.25 },
	screech: {
		startS: 1.6,
		endS: 3.0,
		bandpassHz: 1800,
		bandpassQ: 0.8,
		tones: [1650, 1850] as const,
		gateHz: 8,
		gain: 0.35
	},
	settle: { startS: 3.0, endS: 4.5, lowpassHz: 3000, gain: 0.22 },
	connectAtS: 3.6,
	totalS: 4.5
};

export const CARRIER_DROP = { clickS: 0.06, hissS: 0.3, gain: 0.2 };

// ── The synth ────────────────────────────────────────────────────────────────

type Voice = { source: AudioScheduledSourceNode; nodes: AudioNode[] };

export class ModemSynth {
	private line: AudioLine;
	private ctx: OsAudioContext;
	private voices: Voice[] = [];
	private noiseBuffer: AudioBuffer | null = null;

	constructor(line: AudioLine) {
		this.line = line;
		this.ctx = line.ctx;
	}

	/** Continuous dial tone; runs until `stopAll()` (going off the dial screen). */
	startDialTone(): void {
		const t0 = this.ctx.currentTime;
		for (const freq of DIAL_TONE.freqs) {
			this.tone(freq, t0, Number.POSITIVE_INFINITY, DIAL_TONE.gain / 2);
		}
	}

	playDigit(digit: string): void {
		const pair = DTMF_FREQS[digit];
		if (!pair) return;
		const t0 = this.ctx.currentTime;
		for (const freq of pair) this.tone(freq, t0, t0 + DTMF_ON_MS / 1000, 0.15);
	}

	/** Two rings of ringback cadence. Returns total duration in seconds. */
	playRingback(): number {
		const t0 = this.ctx.currentTime;
		for (let i = 0; i < RINGBACK.cycles; i++) {
			const on = t0 + i * (RINGBACK.onS + RINGBACK.offS);
			for (const freq of RINGBACK.freqs) this.tone(freq, on, on + RINGBACK.onS, RINGBACK.gain / 2);
		}
		return RINGBACK.cycles * (RINGBACK.onS + RINGBACK.offS);
	}

	/** Busy cadence. Returns total duration in seconds. */
	playBusy(cycles = 4): number {
		const t0 = this.ctx.currentTime;
		for (let i = 0; i < cycles; i++) {
			const on = t0 + i * (BUSY.onS + BUSY.offS);
			for (const freq of BUSY.freqs) this.tone(freq, on, on + BUSY.onS, BUSY.gain / 2);
		}
		return cycles * (BUSY.onS + BUSY.offS);
	}

	/**
	 * The whole four-phase handshake, scheduled up front on the context clock.
	 * Returns its total duration in seconds; the caller prints CONNECT at
	 * `HANDSHAKE.connectAtS`.
	 */
	playHandshake(): number {
		const t0 = this.ctx.currentTime;
		const { answer, warble, screech, settle } = HANDSHAKE;

		// Phase 1 — answer tone: 2100 Hz with a square-wave gain wobble, the
		// crude phase-reversal feel of a real answer tone.
		{
			const env = this.envelope(t0 + answer.startS, t0 + answer.endS, answer.gain);
			const osc = this.ctx.createOscillator();
			osc.frequency.setValueAtTime(answer.freq, t0 + answer.startS);
			osc.connect(env);
			const wobble = this.ctx.createOscillator();
			wobble.type = 'square';
			wobble.frequency.setValueAtTime(answer.wobbleHz, t0 + answer.startS);
			const wobbleDepth = this.ctx.createGain();
			wobbleDepth.gain.setValueAtTime(answer.gain * 0.5, t0 + answer.startS);
			wobble.connect(wobbleDepth);
			wobbleDepth.connect(env.gain);
			this.run(osc, t0 + answer.startS, t0 + answer.endS, [env]);
			this.run(wobble, t0 + answer.startS, t0 + answer.endS, [wobbleDepth]);
		}

		// Phase 2 — V.22 warble: one oscillator stepped between 1200/2400 Hz
		// every ~35 ms, over a quiet 550 Hz undertone.
		{
			const env = this.envelope(t0 + warble.startS, t0 + warble.endS, warble.gain);
			const osc = this.ctx.createOscillator();
			let step = 0;
			for (let t = warble.startS; t < warble.endS; t += warble.stepS, step++) {
				osc.frequency.setValueAtTime(warble.freqs[step % 2], t0 + t);
			}
			osc.connect(env);
			this.run(osc, t0 + warble.startS, t0 + warble.endS, [env]);

			const underEnv = this.envelope(t0 + warble.startS, t0 + warble.endS, warble.gain * 0.3);
			const under = this.ctx.createOscillator();
			under.frequency.setValueAtTime(550, t0 + warble.startS);
			under.connect(underEnv);
			this.run(under, t0 + warble.startS, t0 + warble.endS, [underEnv]);
		}

		// Phase 3 — training screech: bandpassed noise rising under two tones
		// gated on/off at ~8 Hz. The gnarly part; not shy.
		{
			const env = this.ctx.createGain();
			env.gain.setValueAtTime(0.0001, t0 + screech.startS);
			env.gain.linearRampToValueAtTime(screech.gain, t0 + screech.endS);
			env.connect(this.line.out);
			const bandpass = this.ctx.createBiquadFilter();
			bandpass.type = 'bandpass';
			bandpass.frequency.setValueAtTime(screech.bandpassHz, t0 + screech.startS);
			bandpass.Q.setValueAtTime(screech.bandpassQ, t0 + screech.startS);
			bandpass.connect(env);
			const noise = this.noiseSource();
			noise.connect(bandpass);
			this.run(noise, t0 + screech.startS, t0 + screech.endS, [bandpass, env]);

			const gateS = 1 / screech.gateHz;
			for (const freq of screech.tones) {
				const gate = this.ctx.createGain();
				gate.gain.setValueAtTime(0, t0 + screech.startS);
				for (let t = screech.startS; t < screech.endS; t += gateS) {
					gate.gain.setValueAtTime(screech.gain * 0.5, t0 + t);
					gate.gain.setValueAtTime(0, t0 + Math.min(t + gateS / 2, screech.endS));
				}
				gate.connect(this.line.out);
				const osc = this.ctx.createOscillator();
				osc.frequency.setValueAtTime(freq, t0 + screech.startS);
				osc.connect(gate);
				this.run(osc, t0 + screech.startS, t0 + screech.endS, [gate]);
			}
		}

		// Phase 4 — carrier settle: lowpassed hiss decaying to literal zero.
		// CONNECT prints at 3.6 s; by 4.5 s the line is silent, and stays so.
		{
			const env = this.ctx.createGain();
			env.gain.setValueAtTime(settle.gain, t0 + settle.startS);
			env.gain.linearRampToValueAtTime(0, t0 + settle.endS);
			env.connect(this.line.out);
			const lowpass = this.ctx.createBiquadFilter();
			lowpass.type = 'lowpass';
			lowpass.frequency.setValueAtTime(settle.lowpassHz, t0 + settle.startS);
			lowpass.connect(env);
			const noise = this.noiseSource();
			noise.connect(lowpass);
			this.run(noise, t0 + settle.startS, t0 + settle.endS, [lowpass, env]);
		}

		return HANDSHAKE.totalS;
	}

	/** The click-and-fade of a dropped carrier. */
	playCarrierDrop(): void {
		const t0 = this.ctx.currentTime;
		const click = this.envelope(t0, t0 + CARRIER_DROP.clickS, CARRIER_DROP.gain);
		const burst = this.noiseSource();
		burst.connect(click);
		this.run(burst, t0, t0 + CARRIER_DROP.clickS, [click]);

		const hissEnv = this.ctx.createGain();
		hissEnv.gain.setValueAtTime(CARRIER_DROP.gain * 0.5, t0 + CARRIER_DROP.clickS);
		hissEnv.gain.linearRampToValueAtTime(0, t0 + CARRIER_DROP.clickS + CARRIER_DROP.hissS);
		hissEnv.connect(this.line.out);
		const hiss = this.noiseSource();
		hiss.connect(hissEnv);
		this.run(hiss, t0 + CARRIER_DROP.clickS, t0 + CARRIER_DROP.clickS + CARRIER_DROP.hissS, [
			hissEnv
		]);
	}

	/** Silence everything now — hangup, view change, window close. */
	stopAll(): void {
		const now = this.ctx.currentTime;
		for (const voice of this.voices) {
			try {
				voice.source.stop(now);
			} catch {
				// already stopped
			}
			voice.source.disconnect();
			for (const node of voice.nodes) node.disconnect();
		}
		this.voices = [];
	}

	// ── Internals ──────────────────────────────────────────────────────────

	/** A plain sine voice with declick ramps, from `t0` to `t1` (may be ∞). */
	private tone(freq: number, t0: number, t1: number, gain: number): void {
		const env = this.ctx.createGain();
		env.gain.setValueAtTime(0, t0);
		env.gain.linearRampToValueAtTime(gain, t0 + RAMP_S);
		if (Number.isFinite(t1)) env.gain.setValueAtTime(gain, Math.max(t0 + RAMP_S, t1 - RAMP_S));
		if (Number.isFinite(t1)) env.gain.linearRampToValueAtTime(0, t1);
		env.connect(this.line.out);
		const osc = this.ctx.createOscillator();
		osc.frequency.setValueAtTime(freq, t0);
		osc.connect(env);
		this.run(osc, t0, t1, [env]);
	}

	/** A gain node ramped up at `t0` and back to zero at `t1`. */
	private envelope(t0: number, t1: number, gain: number): GainNode {
		const env = this.ctx.createGain();
		env.gain.setValueAtTime(0, t0);
		env.gain.linearRampToValueAtTime(gain, t0 + RAMP_S);
		env.gain.setValueAtTime(gain, Math.max(t0 + RAMP_S, t1 - RAMP_S));
		env.gain.linearRampToValueAtTime(0, t1);
		env.connect(this.line.out);
		return env;
	}

	private noiseSource(): AudioBufferSourceNode {
		if (!this.noiseBuffer) {
			const buffer = this.ctx.createBuffer(1, this.ctx.sampleRate, this.ctx.sampleRate);
			const data = buffer.getChannelData(0);
			for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
			this.noiseBuffer = buffer;
		}
		const src = this.ctx.createBufferSource();
		src.buffer = this.noiseBuffer;
		src.loop = true;
		return src;
	}

	private run(source: AudioScheduledSourceNode, t0: number, t1: number, nodes: AudioNode[]): void {
		source.start(t0);
		if (Number.isFinite(t1)) source.stop(t1);
		this.voices.push({ source, nodes });
	}
}
