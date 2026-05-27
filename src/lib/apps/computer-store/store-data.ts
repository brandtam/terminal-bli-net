export type StoreApp = {
	id: string;
	cat: 'GAMES' | 'PROD' | 'ENT';
	title: string;
	pub: string;
	tagline: string;
	icon: string;
	sticker?: 'STAFF_PICK' | 'SALE' | 'NEW';
	back: string;
	inside: string[];
	reqs: string;
};

export type StoreCategory = {
	id: string;
	label: string;
	color: string;
	tagline: string;
	appIds: string[];
};

export const APPS: StoreApp[] = [
	// ─── GAMES ───
	{
		id: 'tetra',
		cat: 'GAMES',
		title: 'TETRA',
		pub: 'ELORG-ISH',
		tagline: "Stack 'em up.",
		icon: 'tetra',
		sticker: 'STAFF_PICK',
		back: "Falling blocks. Build rows. Don't lose. There are no levels, no story, no characters. The blocks fall faster the longer you play. That's the whole game and that has always been enough.",
		inside: ['Endless mode', 'Two-player attack', 'MIDI soundtrack'],
		reqs: 'Terminal OS 1.0 · 256K RAM'
	},
	{
		id: 'solitaire',
		cat: 'GAMES',
		title: 'SOLITAIRE',
		pub: 'KLONDIKE CO.',
		tagline: 'A patience.',
		icon: 'card',
		back: 'The version of solitaire your aunt plays during conference calls. Drag cards. Win or restart. The deck shuffles. It is, in fact, winnable.',
		inside: ['Klondike', 'FreeCell', 'Spider (broken)'],
		reqs: 'Terminal OS 1.0'
	},
	{
		id: 'minesweep',
		cat: 'GAMES',
		title: 'MINESWEEP',
		pub: 'BOMB SQUAD',
		tagline: 'Click. Pray.',
		icon: 'bomb',
		sticker: 'SALE',
		back: "A grid. Some squares have bombs. Most don't. Numbers tell you how many bombs are adjacent. You will lose. Repeatedly. Then suddenly you'll be very good at this.",
		inside: ['Beginner / Intermediate / Expert', 'Hi-score table', 'One unfair custom mode'],
		reqs: 'Terminal OS 1.0'
	},
	{
		id: 'zorquest',
		cat: 'GAMES',
		title: 'ZORQUEST',
		pub: 'INFOCOMME',
		tagline: 'Eaten by a grue.',
		icon: 'scroll',
		back: 'A text adventure. You type GO NORTH. The game says "It is dark. You are likely to be eaten by a grue." Then it eats you. This goes on for about 60 hours.',
		inside: ['Map (sold separately)', 'Adventure parser', 'One unsolvable puzzle'],
		reqs: 'Terminal OS 1.0 · A pencil'
	},

	// ─── PRODUCTIVITY ───
	{
		id: 'calc',
		cat: 'PROD',
		title: 'CALC.APP',
		pub: 'TI-ISH',
		tagline: 'Adds numbers.',
		icon: 'calc',
		back: 'A calculator. It adds, subtracts, multiplies, divides. There is one button labeled "sqrt". There is no "log". You don\'t need "log".',
		inside: ['Basic mode', 'Programmer mode (broken)', 'Tape printout'],
		reqs: 'Terminal OS 1.0'
	},
	{
		id: 'paint',
		cat: 'PROD',
		title: 'PIXEL PAINT',
		pub: 'CLARIS-ISH',
		tagline: '256 colors.',
		icon: 'brush',
		sticker: 'STAFF_PICK',
		back: "A bitmap painting program. Click to make pixels. The pixels are square. The pixels are the point. Saves to .bmp because .png hadn't been invented.",
		inside: ['256-color palette', 'Bucket fill', "One spray-paint tool that doesn't work right"],
		reqs: 'Terminal OS 1.0 · 1MB RAM'
	},

	{
		id: 'error',
		cat: 'PROD',
		title: 'DO_NOT_OPEN',
		pub: '???',
		tagline: "Don't.",
		icon: 'bomb',
		back: 'You were told not to open this. The name is right there. DO_NOT_OPEN. And yet here you are, reading the back of the box. There is no refund. There is no support. There is only whatever happens next.',
		inside: ['One warning', 'One consequence', 'No undo'],
		reqs: 'Terminal OS 1.0 · Hubris'
	},

	// ─── ENTERTAINMENT ───
	{
		id: 'tvguide',
		cat: 'ENT',
		title: 'TV GUIDE',
		pub: 'PREVUE',
		tagline: "What's on now.",
		icon: 'tvguide',
		sticker: 'STAFF_PICK',
		back: "The cable guide. Six channels, 48 half-hour slots, scrolling right-to-left like the Prevue Channel did. Tells you what's on so you know when to come back.",
		inside: ['Six channels', '24-hour rolling grid', 'Marquee at the bottom'],
		reqs: 'Terminal OS 1.0'
	},
	{
		id: 'chatrbot',
		cat: 'ENT',
		title: 'CHATRBOT',
		pub: 'TERMINAL',
		tagline: "They'll text back.",
		icon: 'cb',
		sticker: 'NEW',
		back: 'Talks to AI versions of TV characters. Only when their show is airing on the TV Guide. Wait for your show. Like real TV. This is the entire point of Terminal.',
		inside: ['Six show casts', 'Group chat (sometimes)', 'No save function'],
		reqs: 'Terminal OS 1.0 · TV Guide'
	},
	{
		id: 'recorder',
		cat: 'ENT',
		title: 'CAMERA',
		pub: 'POLAROID-ISH',
		tagline: 'Short clips.',
		icon: 'camera',
		back: 'Records 8-second video clips from your webcam. They are square. They are low resolution. You will use this exactly twice and then never again.',
		inside: ['Record button', 'Flip front/back', 'One sepia filter'],
		reqs: 'Terminal OS 1.0 · A webcam'
	},
	{
		id: 'stats',
		cat: 'ENT',
		title: 'STATS',
		pub: 'NUMBERS LTD.',
		tagline: 'Suspicious data.',
		icon: 'chart',
		back: 'Shows numbers about your Terminal usage. None of the numbers are real. The bar chart is for vibes. "Messages sent today: 14,209." No there weren\'t.',
		inside: ['Three charts', 'One leaderboard', 'Honesty (none)'],
		reqs: 'Terminal OS 1.0'
	},
	{
		id: 'vcr',
		cat: 'ENT',
		title: 'VCR',
		pub: 'ARCHIVE LABS',
		tagline: 'Be kind, rewind.',
		icon: 'vcr',
		sticker: 'NEW',
		back: 'A video cassette recorder for your desktop. Loads tapes from the Internet Archive — full episodes of The Computer Chronicles, BBS: The Documentary, and other relics of early computing. Hit play. Watch Stewart Cheifet explain the World Wide Web in 1996.',
		inside: ['Four show collections', 'Internet Archive streaming', 'CRT display mode'],
		reqs: 'Terminal OS 1.0 · Internet'
	}
];

export const APP_BY_ID: Record<string, StoreApp> = APPS.reduce(
	(m, a) => {
		m[a.id] = a;
		return m;
	},
	{} as Record<string, StoreApp>
);

export const CATEGORIES: Record<string, StoreCategory> = {
	games: {
		id: 'games',
		label: 'GAMES',
		color: '#5e3a8a',
		tagline: 'Adventure · Puzzle · Card',
		appIds: ['tetra', 'solitaire', 'minesweep', 'zorquest']
	},
	business: {
		id: 'business',
		label: 'BUSINESS',
		color: '#1e5fc8',
		tagline: 'Productivity · Tools',
		appIds: ['calc', 'paint', 'error']
	},
	ent: {
		id: 'ent',
		label: 'ENTERTAINMENT',
		color: '#c92127',
		tagline: 'TV · Chat · Multimedia',
		appIds: ['tvguide', 'chatrbot', 'recorder', 'stats', 'vcr']
	}
};

export const CAT_COLORS: Record<string, { band: string; splash: string; trim: string }> = {
	GAMES: { band: '#5e3a8a', splash: '#d6c4f0', trim: '#3a1f5a' },
	PROD: { band: '#1e5fc8', splash: '#c8dffa', trim: '#103a82' },
	ENT: { band: '#c92127', splash: '#ffd0c0', trim: '#8a1218' }
};

export type CategoryId = 'games' | 'business' | 'ent';

/**
 * Builds a lineup of apps for a shelf, duplicating staff picks to fill
 * the requested count. Gives a real-store feel where popular titles
 * get more facings.
 */
export function shelfLineup(catId: CategoryId, count: number): StoreApp[] {
	const apps = CATEGORIES[catId].appIds.map((id) => APP_BY_ID[id]);
	const picks = apps.filter((a) => a.sticker === 'STAFF_PICK');
	const rest = apps.filter((a) => a.sticker !== 'STAFF_PICK');
	const out = [...apps];
	let i = 0;
	while (out.length < count && picks.length > 0) {
		out.push(picks[i % picks.length]);
		i++;
	}
	while (out.length < count) out.push(rest[0] || apps[0]);
	return out;
}
