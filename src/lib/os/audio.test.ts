import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OsAudioClass, type OsAudioContext } from './audio.svelte';

// ── Fakes ────────────────────────────────────────────────────────────────────
// The unit project runs in node (no DOM, no WebAudio), so the browser surface
// the audio layer touches — window/document listeners, localStorage, and the
// AudioContext — is faked here. The mock context records every node it mints
// so tests can assert what got scheduled.

class FakeEventTarget {
	listeners = new Map<string, Set<() => void>>();
	addEventListener = vi.fn((type: string, fn: () => void) => {
		if (!this.listeners.has(type)) this.listeners.set(type, new Set());
		this.listeners.get(type)!.add(fn);
	});
	removeEventListener = vi.fn((type: string, fn: () => void) => {
		this.listeners.get(type)?.delete(fn);
	});
	fire(type: string): void {
		for (const fn of [...(this.listeners.get(type) ?? [])]) fn();
	}
}

class FakeDocument extends FakeEventTarget {
	hidden = false;
}

function fakeLocalStorage() {
	const store = new Map<string, string>();
	return {
		store,
		getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
		setItem: (k: string, v: string) => void store.set(k, v),
		removeItem: (k: string) => void store.delete(k)
	};
}

type FakeParam = {
	value: number;
	setValueAtTime: ReturnType<typeof vi.fn>;
	linearRampToValueAtTime: ReturnType<typeof vi.fn>;
};

function fakeParam(value = 0): FakeParam {
	return { value, setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() };
}

function createMockContext() {
	const gains: {
		gain: FakeParam;
		connect: ReturnType<typeof vi.fn>;
		disconnect: ReturnType<typeof vi.fn>;
	}[] = [];
	const oscillators: {
		type: string;
		frequency: FakeParam;
		connect: ReturnType<typeof vi.fn>;
		disconnect: ReturnType<typeof vi.fn>;
		start: ReturnType<typeof vi.fn>;
		stop: ReturnType<typeof vi.fn>;
		setPeriodicWave: ReturnType<typeof vi.fn>;
		onended: (() => void) | null;
	}[] = [];
	const bufferSources: {
		buffer: unknown;
		loop: boolean;
		connect: ReturnType<typeof vi.fn>;
		disconnect: ReturnType<typeof vi.fn>;
		start: ReturnType<typeof vi.fn>;
		stop: ReturnType<typeof vi.fn>;
		onended: (() => void) | null;
	}[] = [];

	const ctx = {
		currentTime: 0,
		state: 'suspended' as AudioContextState,
		sampleRate: 44100,
		destination: { id: 'destination' },
		resume: vi.fn(async () => {
			ctx.state = 'running';
		}),
		suspend: vi.fn(async () => {
			ctx.state = 'suspended';
		}),
		close: vi.fn(async () => {
			ctx.state = 'closed';
		}),
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
				stop: vi.fn(),
				setPeriodicWave: vi.fn(),
				onended: null
			};
			oscillators.push(o);
			return o;
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
				stop: vi.fn(),
				onended: null
			};
			bufferSources.push(s);
			return s;
		}),
		createPeriodicWave: vi.fn(() => ({ id: 'pulse-wave' })),
		createBiquadFilter: vi.fn(() => ({
			type: 'lowpass',
			frequency: fakeParam(350),
			Q: fakeParam(1),
			connect: vi.fn(),
			disconnect: vi.fn()
		}))
	};
	return { ctx, gains, oscillators, bufferSources };
}

// ── Setup ────────────────────────────────────────────────────────────────────

let fakeWindow: FakeEventTarget;
let fakeDocument: FakeDocument;
let storage: ReturnType<typeof fakeLocalStorage>;
let mock: ReturnType<typeof createMockContext>;

function createAudio(): OsAudioClass {
	const audio = new OsAudioClass(() => mock.ctx as unknown as OsAudioContext);
	audio.init();
	return audio;
}

/** Init + simulate the first user gesture so the context exists. */
function createUnlockedAudio(): OsAudioClass {
	const audio = createAudio();
	fakeWindow.fire('pointerdown');
	return audio;
}

beforeEach(() => {
	fakeWindow = new FakeEventTarget();
	fakeDocument = new FakeDocument();
	storage = fakeLocalStorage();
	mock = createMockContext();
	vi.stubGlobal('window', fakeWindow);
	vi.stubGlobal('document', fakeDocument);
	vi.stubGlobal('localStorage', storage);
});

afterEach(() => {
	vi.unstubAllGlobals();
});

// ── Tests ────────────────────────────────────────────────────────────────────

describe('gesture unlock', () => {
	it('creates no AudioContext before the first user gesture', () => {
		const audio = createAudio();
		audio.beep();
		audio.error();
		audio.tone({ wave: 'noise' });
		expect(mock.ctx.createOscillator).not.toHaveBeenCalled();
		expect(mock.oscillators).toHaveLength(0);
	});

	it('creates the context on the first gesture and wires the master gain', () => {
		createUnlockedAudio();
		expect(mock.gains).toHaveLength(1);
		expect(mock.gains[0].gain.value).toBe(0.6); // default volume
		expect(mock.gains[0].connect).toHaveBeenCalledWith(mock.ctx.destination);
		expect(mock.ctx.resume).toHaveBeenCalled();
	});

	it('removes both unlock listeners after the first gesture fires', () => {
		createUnlockedAudio();
		expect(fakeWindow.removeEventListener).toHaveBeenCalledWith(
			'pointerdown',
			expect.any(Function),
			{ capture: true }
		);
		expect(fakeWindow.removeEventListener).toHaveBeenCalledWith('keydown', expect.any(Function), {
			capture: true
		});
		// A second gesture must not mint a second context.
		fakeWindow.fire('keydown');
		expect(mock.gains).toHaveLength(1);
	});
});

describe('voices', () => {
	it('beep() schedules one square oscillator at the requested pitch and length', () => {
		const audio = createUnlockedAudio();
		audio.beep(880, 120);
		expect(mock.oscillators).toHaveLength(1);
		const osc = mock.oscillators[0];
		expect(osc.type).toBe('square');
		expect(osc.frequency.setValueAtTime).toHaveBeenCalledWith(880, 0);
		expect(osc.start).toHaveBeenCalledWith(0);
		expect(osc.stop).toHaveBeenCalledWith(0.12);
	});

	it('error() schedules a two-tone buzz, second tone delayed', () => {
		const audio = createUnlockedAudio();
		audio.error();
		expect(mock.oscillators).toHaveLength(2);
		// Both tones are the pulse voice (periodic wave), not a plain square.
		expect(mock.oscillators[0].setPeriodicWave).toHaveBeenCalled();
		expect(mock.oscillators[1].setPeriodicWave).toHaveBeenCalled();
		const firstStart = mock.oscillators[0].start.mock.calls[0][0] as number;
		const secondStart = mock.oscillators[1].start.mock.calls[0][0] as number;
		expect(secondStart).toBeGreaterThan(firstStart);
	});

	it('tone({wave:"noise"}) plays a looped buffer of generated noise', () => {
		const audio = createUnlockedAudio();
		audio.tone({ wave: 'noise', dur: 200 });
		expect(mock.ctx.createBuffer).toHaveBeenCalledWith(1, 44100, 44100);
		expect(mock.bufferSources).toHaveLength(1);
		expect(mock.bufferSources[0].loop).toBe(true);
		expect(mock.bufferSources[0].stop).toHaveBeenCalledWith(0.2);
	});

	it('caches the pulse wave and noise buffer across tones', () => {
		const audio = createUnlockedAudio();
		audio.tone({ wave: 'pulse' });
		audio.tone({ wave: 'pulse' });
		audio.tone({ wave: 'noise' });
		audio.tone({ wave: 'noise' });
		expect(mock.ctx.createPeriodicWave).toHaveBeenCalledTimes(1);
		expect(mock.ctx.createBuffer).toHaveBeenCalledTimes(1);
	});

	it('releases voice nodes when a tone ends', () => {
		const audio = createUnlockedAudio();
		audio.beep();
		const osc = mock.oscillators[0];
		expect(osc.onended).toBeTypeOf('function');
		osc.onended!();
		expect(osc.disconnect).toHaveBeenCalled();
	});
});

describe('mute and volume', () => {
	it('setMuted(true) zeroes the master gain, persists, and drops new tones', () => {
		const audio = createUnlockedAudio();
		audio.setMuted(true);
		expect(mock.gains[0].gain.value).toBe(0);
		expect(JSON.parse(storage.store.get('terminal.os.sound')!)).toEqual({
			muted: true,
			volume: 0.6
		});
		audio.beep();
		expect(mock.oscillators).toHaveLength(0);
	});

	it('setVolume clamps to 0..1, applies to the master gain, and persists', () => {
		const audio = createUnlockedAudio();
		audio.setVolume(2);
		expect(audio.volume).toBe(1);
		expect(mock.gains[0].gain.value).toBe(1);
		audio.setVolume(-1);
		expect(audio.volume).toBe(0);
		expect(JSON.parse(storage.store.get('terminal.os.sound')!)).toEqual({
			muted: false,
			volume: 0
		});
	});

	it('loads persisted mute/volume before the first gesture', () => {
		storage.setItem('terminal.os.sound', JSON.stringify({ muted: true, volume: 0.3 }));
		const audio = createUnlockedAudio();
		expect(audio.muted).toBe(true);
		expect(audio.volume).toBe(0.3);
		expect(mock.gains[0].gain.value).toBe(0);
	});
});

describe('hidden tab', () => {
	it('suspends when the document hides and resumes on return', () => {
		createUnlockedAudio();
		fakeDocument.hidden = true;
		fakeDocument.fire('visibilitychange');
		expect(mock.ctx.suspend).toHaveBeenCalled();
		fakeDocument.hidden = false;
		fakeDocument.fire('visibilitychange');
		expect(mock.ctx.resume).toHaveBeenCalledTimes(2); // unlock + return
	});

	it('stays suspended on return while muted', () => {
		const audio = createUnlockedAudio();
		audio.setMuted(true);
		fakeDocument.hidden = true;
		fakeDocument.fire('visibilitychange');
		fakeDocument.hidden = false;
		fakeDocument.fire('visibilitychange');
		expect(mock.ctx.resume).toHaveBeenCalledTimes(1); // only the unlock resume
	});

	it('never schedules a tone while the document is hidden', () => {
		const audio = createUnlockedAudio();
		fakeDocument.hidden = true;
		audio.beep();
		expect(mock.oscillators).toHaveLength(0);
	});
});

describe('line', () => {
	it('returns null before the first user gesture', () => {
		const audio = createAudio();
		expect(audio.line()).toBeNull();
	});

	it('hands out the shared context and an output routed under the master gain', () => {
		const audio = createUnlockedAudio();
		const line = audio.line();
		expect(line).not.toBeNull();
		expect(line!.ctx).toBe(mock.ctx);
		// gains[0] is the master; the line's out is a fresh gain wired into it.
		expect(mock.gains).toHaveLength(2);
		expect(mock.gains[1].connect).toHaveBeenCalledWith(mock.gains[0]);
	});

	it('close() detaches the line output', () => {
		const audio = createUnlockedAudio();
		const line = audio.line()!;
		line.close();
		expect(mock.gains[1].disconnect).toHaveBeenCalled();
	});

	it('still hands out a line while muted — mute lives in the master gain', () => {
		const audio = createUnlockedAudio();
		audio.setMuted(true);
		expect(audio.line()).not.toBeNull();
		expect(mock.gains[0].gain.value).toBe(0);
	});

	it('returns null after destroy', () => {
		const audio = createUnlockedAudio();
		audio.destroy();
		expect(audio.line()).toBeNull();
	});
});

describe('destroy', () => {
	it('closes the context and detaches the visibility listener', () => {
		const audio = createUnlockedAudio();
		audio.destroy();
		expect(mock.ctx.close).toHaveBeenCalled();
		expect(fakeDocument.removeEventListener).toHaveBeenCalledWith(
			'visibilitychange',
			expect.any(Function)
		);
		// Tones after destroy are silent no-ops, not crashes.
		audio.beep();
		expect(mock.oscillators).toHaveLength(0);
	});
});
