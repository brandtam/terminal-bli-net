import type { Slot, GroupMeta, DayOfWeek } from './types';

const DAY_ORDER: DayOfWeek[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

function dayIndex(day: DayOfWeek): number {
	return DAY_ORDER.indexOf(day);
}

function parseTime(timeStr: string): { hours: number; minutes: number } {
	const [h, m] = timeStr.split(':').map(Number);
	return { hours: h, minutes: m };
}

function minutesSinceSunday(day: DayOfWeek, timeStr: string): number {
	const { hours, minutes } = parseTime(timeStr);
	return dayIndex(day) * 1440 + hours * 60 + minutes;
}

function nowToMinutesSinceSunday(now: Date, timezone?: string): number {
	const opts: Intl.DateTimeFormatOptions = {
		weekday: 'short',
		hour: '2-digit',
		minute: '2-digit',
		hour12: false,
		timeZone: timezone
	};
	const parts = new Intl.DateTimeFormat('en-US', opts).formatToParts(now);
	const weekday = parts.find((p) => p.type === 'weekday')?.value ?? 'Sun';
	const hour = parseInt(parts.find((p) => p.type === 'hour')?.value ?? '0');
	const minute = parseInt(parts.find((p) => p.type === 'minute')?.value ?? '0');

	const dayMap: Record<string, DayOfWeek> = {
		Sun: 'sun',
		Mon: 'mon',
		Tue: 'tue',
		Wed: 'wed',
		Thu: 'thu',
		Fri: 'fri',
		Sat: 'sat'
	};
	const day = dayMap[weekday] ?? 'sun';
	return dayIndex(day) * 1440 + hour * 60 + minute;
}

export function isSlotActive(slot: Slot, now: Date, timezone?: string): boolean {
	const currentMinute = nowToMinutesSinceSunday(now, timezone);
	const slotStart = minutesSinceSunday(slot.day, slot.start);
	const slotEnd = slotStart + slot.duration;
	const weekMinutes = 7 * 1440;

	if (slotEnd <= weekMinutes) {
		return currentMinute >= slotStart && currentMinute < slotEnd;
	}
	return currentMinute >= slotStart || currentMinute < slotEnd % weekMinutes;
}

export function isOnAir(group: GroupMeta, now: Date, timezone?: string): boolean {
	if (!group.active || !group.schedule) return false;
	return group.schedule.some((slot) => isSlotActive(slot, now, timezone));
}

export function minutesRemaining(group: GroupMeta, now: Date, timezone?: string): number | null {
	if (!group.active || !group.schedule) return null;
	const currentMinute = nowToMinutesSinceSunday(now, timezone);
	const weekMinutes = 7 * 1440;

	for (const slot of group.schedule) {
		const slotStart = minutesSinceSunday(slot.day, slot.start);
		const slotEnd = slotStart + slot.duration;

		if (slotEnd <= weekMinutes) {
			if (currentMinute >= slotStart && currentMinute < slotEnd) {
				return slotEnd - currentMinute;
			}
		} else {
			if (currentMinute >= slotStart) {
				return slotEnd - currentMinute;
			}
			if (currentMinute < slotEnd % weekMinutes) {
				return (slotEnd % weekMinutes) - currentMinute;
			}
		}
	}
	return null;
}

export function nextOnAir(
	group: GroupMeta,
	now: Date,
	timezone?: string
): { day: DayOfWeek; start: string; minutesUntil: number } | null {
	if (!group.active || !group.schedule || group.schedule.length === 0) return null;
	if (isOnAir(group, now, timezone)) return null;

	const currentMinute = nowToMinutesSinceSunday(now, timezone);
	const weekMinutes = 7 * 1440;

	let best: { day: DayOfWeek; start: string; minutesUntil: number } | null = null;

	for (const slot of group.schedule) {
		const slotStart = minutesSinceSunday(slot.day, slot.start);
		let diff = slotStart - currentMinute;
		if (diff <= 0) diff += weekMinutes;

		if (!best || diff < best.minutesUntil) {
			best = { day: slot.day, start: slot.start, minutesUntil: diff };
		}
	}

	return best;
}

export function currentlyAiring(
	groups: GroupMeta[],
	now: Date,
	timezone?: string
): GroupMeta[] {
	return groups.filter((g) => isOnAir(g, now, timezone));
}

export function validateOverlapInvariant(groups: GroupMeta[]): {
	valid: boolean;
	gaps: Array<{ day: DayOfWeek; hour: number }>;
} {
	const activeGroups = groups.filter((g) => g.active);
	const gaps: Array<{ day: DayOfWeek; hour: number }> = [];

	for (let dayIdx = 0; dayIdx < 7; dayIdx++) {
		const day = DAY_ORDER[dayIdx];
		for (let hour = 0; hour < 24; hour++) {
			const minuteOfWeek = dayIdx * 1440 + hour * 60 + 30;
			const weekMinutes = 7 * 1440;

			let covered = false;
			for (const group of activeGroups) {
				for (const slot of group.schedule ?? []) {
					const slotStart = minutesSinceSunday(slot.day, slot.start);
					const slotEnd = slotStart + slot.duration;

					if (slotEnd <= weekMinutes) {
						if (minuteOfWeek >= slotStart && minuteOfWeek < slotEnd) {
							covered = true;
						}
					} else {
						if (minuteOfWeek >= slotStart || minuteOfWeek < slotEnd % weekMinutes) {
							covered = true;
						}
					}
					if (covered) break;
				}
				if (covered) break;
			}

			if (!covered) {
				gaps.push({ day, hour });
			}
		}
	}

	return { valid: gaps.length === 0, gaps };
}

export function formatTimeUntil(minutes: number): string {
	if (minutes < 60) return `${minutes} min`;
	const h = Math.floor(minutes / 60);
	const m = minutes % 60;
	if (m === 0) return `${h}h`;
	return `${h}h ${m}m`;
}

export function formatSlotTime(start: string, duration: number): string {
	const { hours: sh, minutes: sm } = parseTime(start);
	const endTotal = sh * 60 + sm + duration;
	const eh = Math.floor(endTotal / 60) % 24;
	const em = endTotal % 60;

	const fmt = (h: number, m: number) => {
		const ampm = h >= 12 ? 'PM' : 'AM';
		const h12 = ((h + 11) % 12) + 1;
		return m === 0 ? `${h12}${ampm}` : `${h12}:${String(m).padStart(2, '0')}${ampm}`;
	};

	return `${fmt(sh, sm)}–${fmt(eh, em)}`;
}
