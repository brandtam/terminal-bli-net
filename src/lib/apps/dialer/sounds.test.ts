import { describe, it, expect, vi } from 'vitest';
import type { AudioLine, OsAudioContext } from '$lib/os/audio.svelte';
import { DTMF_FREQS, DTMF_ON_MS, DIAL_TONE, RINGBACK, BUSY, HANDSHAKE, ModemSynth } from './sounds';

// ── The testable spec: timing constants ─────────────────────────────────────

describe('DTMF matrix', () => {
	it('uses the standard row/column frequency pairs', () => {
		const rows = [697, 770, 852, 941];
		const cols = [1209, 1336, 1477];
		const layout = [
			['1', '2', '3'],
			['4', '5', '6'],
			['7', '8', '9'],
			['*', '0', '#']
		];
		layout.forEach((row, r) =>
			row.forEach((digit, c) => {
				expect(DTMF_FREQS[digit], `digit ${digit}`).toEqual([rows[r], cols[c]]);
			})
		);
	});
});

describe('handshake schedule', () => {
	it('has four contiguous phases', () => {
		expect(HANDSHAKE.answer.startS).toBe(0);
		expect(HANDSHAKE.warble.startS).toBe(HANDSHAKE.answer.endS);
		expect(HANDSHAKE.screech.startS).toBe(HANDSHAKE.warble.endS);
		expect(HANDSHAKE.settle.startS).toBe(HANDSHAKE.screech.endS);
		expect(HANDSHAKE.totalS).toBe(HANDSHAKE.settle.endS);
	});

	it('runs about four seconds and prints CONNECT during the settle', () => {
		expect(HANDSHAKE.totalS).toBeGreaterThan(4);
		expect(HANDSHAKE.totalS).toBeLessThan(5);
		expect(HANDSHAKE.connectAtS).toBeGreaterThan(HANDSHAKE.settle.startS);
		expect(HANDSHAKE.connectAtS).toBeLessThan(HANDSHAKE.settle.endS);
	});

	it('keeps cadences era-plausible', () => {
		expect(DIAL_TONE.freqs).toEqual([350, 440]);
		expect(RINGBACK.freqs).toEqual([440, 480]);
		expect(BUSY.freqs).toEqual([480, 620]);
	});
});

// ── The synth against a mock context ─────────────────────────────────────────

type FakeParam = {
	value: number;
	setValueAtTime: ReturnType<typeof vi.fn>;
	linearRampToValueAtTime: ReturnType<typeof vi.fn>;
};

function fakeParam(value = 0): FakeParam {
	return { value, setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() };
}

function mockLine() {
	const oscillators: {
		type: string;
		frequency: FakeParam;
		connect: ReturnType<typeof vi.fn>;
		disconnect: ReturnType<typeof vi.fn>;
		start: ReturnType<typeof vi.fn>;
		stop: ReturnType<typeof vi.fn>;
	}[] = [];
	const gains: {
		gain: FakeParam;
		connect: ReturnType<typeof vi.fn>;
		disconnect: ReturnType<typeof vi.fn>;
	}[] = [];
	const filters: {
		type: string;
		frequency: FakeParam;
		Q: FakeParam;
		connect: ReturnType<typeof vi.fn>;
		disconnect: ReturnType<typeof vi.fn>;
	}[] = [];
	const bufferSources: {
		buffer: unknown;
		loop: boolean;
		connect: ReturnType<typeof vi.fn>;
		disconnect: ReturnType<typeof vi.fn>;
		start: ReturnType<typeof vi.fn>;
		stop: ReturnType<typeof vi.fn>;
	}[] = [];

	const ctx = {
		currentTime: 0,
		sampleRate: 44100,
		createGain: vi.fn(() => {
			const g = { gain: fakeParam(1), connect: vi.fn(), disconnect: vi.fn() };
			gains.push(g);
			return g;
		}),
		createOscillator: vi.fn(() => {
			const o = {
				type: 'sine',
				frequency: fakeParam(440),
				connect: vi.fn(),
				disconnect: vi.fn(),
				start: vi.fn(),
				stop: vi.fn()
			};
			oscillators.push(o);
			return o;
		}),
		createBiquadFilter: vi.fn(() => {
			const f = {
				type: 'lowpass',
				frequency: fakeParam(350),
				Q: fakeParam(1),
				connect: vi.fn(),
				disconnect: vi.fn()
			};
			filters.push(f);
			return f;
		}),
		createBuffer: vi.fn((_ch: number, length: number) => ({
			getChannelData: vi.fn(() => new Float32Array(length))
		})),
		createBufferSource: vi.fn(() => {
			const s = {
				buffer: null as unknown,
				loop: false,
				connect: vi.fn(),
				disconnect: vi.fn(),
				start: vi.fn(),
				stop: vi.fn()
			};
			bufferSources.push(s);
			return s;
		})
	};
	const out = { connect: vi.fn(), disconnect: vi.fn() };
	const line = {
		ctx: ctx as unknown as OsAudioContext,
		out: out as unknown as GainNode,
		close: vi.fn()
	} as AudioLine;
	return { line, ctx, oscillators, gains, filters, bufferSources };
}

describe('ModemSynth', () => {
	it('plays a digit as its two DTMF frequencies for the standard burst', () => {
		const m = mockLine();
		new ModemSynth(m.line).playDigit('5');
		expect(m.oscillators).toHaveLength(2);
		expect(m.oscillators[0].frequency.setValueAtTime).toHaveBeenCalledWith(770, 0);
		expect(m.oscillators[1].frequency.setValueAtTime).toHaveBeenCalledWith(1336, 0);
		expect(m.oscillators[0].stop).toHaveBeenCalledWith(DTMF_ON_MS / 1000);
	});

	it('ignores a non-DTMF key', () => {
		const m = mockLine();
		new ModemSynth(m.line).playDigit('x');
		expect(m.oscillators).toHaveLength(0);
	});

	it('dial tone runs both frequencies with no scheduled stop', () => {
		const m = mockLine();
		new ModemSynth(m.line).startDialTone();
		expect(m.oscillators.map((o) => o.frequency.setValueAtTime.mock.calls[0][0])).toEqual([
			350, 440
		]);
		for (const osc of m.oscillators) expect(osc.stop).not.toHaveBeenCalled();
	});

	it('ringback returns its cadence duration', () => {
		const m = mockLine();
		const duration = new ModemSynth(m.line).playRingback();
		expect(duration).toBe(RINGBACK.cycles * (RINGBACK.onS + RINGBACK.offS));
	});

	it('handshake schedules all four phases and ends at literal zero gain', () => {
		const m = mockLine();
		const total = new ModemSynth(m.line).playHandshake();
		expect(total).toBe(HANDSHAKE.totalS);

		// Screech phase: a bandpass at ~1800 Hz over noise.
		const bandpass = m.filters.find((f) => f.type === 'bandpass');
		expect(bandpass).toBeDefined();
		expect(bandpass!.frequency.setValueAtTime).toHaveBeenCalledWith(
			HANDSHAKE.screech.bandpassHz,
			HANDSHAKE.screech.startS
		);

		// Settle phase: lowpassed hiss whose gain ramps to zero at the end —
		// the line MUST be silent after CONNECT (no persistent hiss).
		const settleRamps = m.gains.flatMap((g) => g.gain.linearRampToValueAtTime.mock.calls);
		expect(settleRamps).toContainEqual([0, HANDSHAKE.settle.endS]);

		// Warble phase: frequency stepping between the two carriers.
		const warbleOsc = m.oscillators.find(
			(o) =>
				o.frequency.setValueAtTime.mock.calls.length > 10 &&
				o.frequency.setValueAtTime.mock.calls[0][0] === HANDSHAKE.warble.freqs[0]
		);
		expect(warbleOsc).toBeDefined();
	});

	it('stopAll stops and disconnects every live voice', () => {
		const m = mockLine();
		const synth = new ModemSynth(m.line);
		synth.startDialTone();
		synth.playDigit('1');
		synth.stopAll();
		for (const osc of m.oscillators) {
			expect(osc.stop).toHaveBeenCalled();
			expect(osc.disconnect).toHaveBeenCalled();
		}
	});
});
