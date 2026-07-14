import { describe, it, expect } from 'vitest';
import { blockLabel, blockPrefixes, scanlogLines, sweepBlock } from './autodialer';

describe('the exchange sweeper', () => {
	it('offers 100 blocks across the 555 exchange, labeled by the middle two digits', () => {
		const blocks = blockPrefixes();
		expect(blocks).toHaveLength(100);
		expect(blocks[0]).toBe('55500');
		expect(blocks[1]).toBe('55501');
		expect(blocks[99]).toBe('55599');
		expect(blockLabel('55501')).toBe('01');
	});

	it('sweeps a full block of 100 numbers', () => {
		const result = sweepBlock('55501');
		expect(result.calls).toHaveLength(100);
		expect(result.block).toBe('5550100-5550199');
		expect(result.calls[0].number).toBe('5550100');
		expect(result.calls[99].number).toBe('5550199');
	});

	it('surfaces canon carriers and nothing else as CARRIER', () => {
		// 555-0113 (LODESTONE) lives in the 555-01xx block.
		const block = sweepBlock('55501');
		const lodestone = block.calls.find((c) => c.number === '5550113');
		expect(lodestone?.outcome).toBe('CARRIER');
		expect(lodestone?.systemId).toBe('lodestone');
		expect(block.carriers).toContain('5550113');

		// A number with no board answers with something other than a carrier.
		const plain = block.calls.find((c) => c.number === '5550100');
		expect(plain?.outcome).not.toBe('CARRIER');
		expect(plain?.systemId).toBeNull();
	});

	it('is deterministic — the same block reads the same every night', () => {
		expect(sweepBlock('55580')).toEqual(sweepBlock('55580'));
	});

	it('finds Night Circuit in the 555-80xx block', () => {
		const carriers = sweepBlock('55580').carriers;
		expect(carriers).toContain('5558008'); // Night Circuit
	});

	it('renders an aligned scanlog with a line per number', () => {
		const lines = scanlogLines(sweepBlock('55501'));
		expect(lines).toHaveLength(100);
		expect(lines.find((l) => l.includes('555-0113'))).toContain('NAMED BOARD');
	});
});
