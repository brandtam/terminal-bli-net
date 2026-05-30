import { describe, it, expect } from 'vitest';
import { nextShuttle, rateForLevel } from './vcr-shuttle';

describe('nextShuttle', () => {
	it('cycles forward: null → 1 → 2 → 3 → null', () => {
		const l1 = nextShuttle(null, 'ff');
		expect(l1).toEqual({ dir: 'ff', level: 1 });

		const l2 = nextShuttle(l1, 'ff');
		expect(l2).toEqual({ dir: 'ff', level: 2 });

		const l3 = nextShuttle(l2, 'ff');
		expect(l3).toEqual({ dir: 'ff', level: 3 });

		expect(nextShuttle(l3, 'ff')).toBeNull();
	});

	it('cycles in reverse: null → 1 → 2 → 3 → null', () => {
		const l1 = nextShuttle(null, 'rew');
		expect(l1).toEqual({ dir: 'rew', level: 1 });

		const l2 = nextShuttle(l1, 'rew');
		expect(l2).toEqual({ dir: 'rew', level: 2 });

		const l3 = nextShuttle(l2, 'rew');
		expect(l3).toEqual({ dir: 'rew', level: 3 });

		expect(nextShuttle(l3, 'rew')).toBeNull();
	});

	it('resets to level 1 when switching direction mid-shuttle', () => {
		expect(nextShuttle({ dir: 'ff', level: 2 }, 'rew')).toEqual({ dir: 'rew', level: 1 });
		expect(nextShuttle({ dir: 'rew', level: 3 }, 'ff')).toEqual({ dir: 'ff', level: 1 });
	});
});

describe('rateForLevel', () => {
	it('maps each level to its speed multiplier', () => {
		expect(rateForLevel(0)).toBe(1);
		expect(rateForLevel(1)).toBe(2);
		expect(rateForLevel(2)).toBe(4);
		expect(rateForLevel(3)).toBe(8);
	});

	it('falls back to 1× for out-of-range levels', () => {
		expect(rateForLevel(9)).toBe(1);
	});
});
