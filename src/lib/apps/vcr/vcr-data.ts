export type VCRShow = {
	id: string;
	name: string;
	years: string;
	description: string;
	episodes: VCREpisode[];
};

export type VCREpisode = {
	id: string;
	title: string;
	year: number;
	archiveId: string;
	/** Path to a specific file within a multi-file archive item, e.g. "Alf/Season 01/ALF - S01E01 - A.L.F SDTV.mp4". Omitted when the archive item is a single video. */
	archiveFile?: string;
	description: string;
};

export const SHOWS: VCRShow[] = [
	{
		id: 'computer-chronicles',
		name: 'The Computer Chronicles',
		years: '1983–2002',
		description:
			'The longest-running TV series about personal computers. Stewart Cheifet hosted 20 seasons covering every major moment in PC history.',
		episodes: [
			{
				id: 'cc-macintosh',
				title: 'The Macintosh Computer',
				year: 1985,
				archiveId: 'TheMacin1985',
				description:
					'Apple just released the Macintosh. 128K of RAM. A mouse. People are confused and delighted.'
			},
			{
				id: 'cc-games-84',
				title: 'Computer Games',
				year: 1984,
				archiveId: 'Computer1984_4',
				description: 'The state of computer gaming in 1984. Text adventures and 8-bit graphics.'
			},
			{
				id: 'cc-printers',
				title: 'Printers',
				year: 1984,
				archiveId: 'Printers1984',
				description: 'Dot matrix, daisy wheel, and the new laser printers. Paper jams for everyone.'
			},
			{
				id: 'cc-security',
				title: 'Computer Security',
				year: 1984,
				archiveId: 'Computer1984_2',
				description: 'Passwords, hackers, and the first generation of computer crime.'
			},
			{
				id: 'cc-robotics',
				title: 'Robotics',
				year: 1984,
				archiveId: 'Robotics1984',
				description: 'Industrial robots and the dream of household automation.'
			},
			{
				id: 'cc-ai',
				title: 'Artificial Intelligence',
				year: 1984,
				archiveId: 'Artifici1984',
				description:
					'Expert systems, natural language processing, and the AI winter nobody saw coming.'
			},
			{
				id: 'cc-speech',
				title: 'Speech Synthesis',
				year: 1984,
				archiveId: 'SpeechSy1984',
				description: 'Computers that talk. Kind of. If you listen very carefully.'
			},
			{
				id: 'cc-networking',
				title: 'Networking',
				year: 1984,
				archiveId: 'Networki1984',
				description: 'LANs, modems, and the dream of connecting every computer on earth.'
			},
			{
				id: 'cc-amiga-atari',
				title: 'Amiga and Atari',
				year: 1985,
				archiveId: 'Amigaand1985',
				description:
					'The Amiga and the Atari ST go head to head. Multimedia before the word existed.'
			},
			{
				id: 'cc-modems',
				title: 'Modems & Bulletin Boards',
				year: 1985,
				archiveId: 'ModemsBu1985',
				description: "2400 baud, ANSI art, and dialing into other people's computers at 3am."
			},
			{
				id: 'cc-graphics',
				title: 'Computer Graphics',
				year: 1985,
				archiveId: 'Computer1985_10',
				description: 'Ray tracing, wireframe models, and pixels the size of chicklets.'
			},
			{
				id: 'cc-desktop-publishing',
				title: 'Desktop Publishing',
				year: 1986,
				archiveId: 'DesktopP1986',
				description:
					'PageMaker, LaserWriter, and the death of the print shop. Everyone is a publisher now.'
			},
			{
				id: 'cc-email',
				title: 'Electronic Mail',
				year: 1986,
				archiveId: 'Electron1986',
				description:
					'Sending letters through a phone line. Faster than the post, slower than a fax.'
			},
			{
				id: 'cc-speech-rec',
				title: 'Speech Recognition',
				year: 1987,
				archiveId: 'SpeechRe1987',
				description:
					'Computers that understand words. If you speak very slowly. And clearly. And repeat yourself.'
			},
			{
				id: 'cc-portable',
				title: 'Portable Computers',
				year: 1987,
				archiveId: 'Portable1987',
				description: 'Laptops that weigh 8 pounds and cost $4,000. The future of mobile computing.'
			},
			{
				id: 'cc-windows-30',
				title: 'Windows 3.0',
				year: 1990,
				archiveId: 'windows30',
				description:
					'Microsoft finally makes Windows usable. Program Manager, File Manager, Solitaire.'
			},
			{
				id: 'cc-vr',
				title: 'Virtual Reality',
				year: 1992,
				archiveId: 'virtualreali',
				description:
					'VR in 1992. Head-mounted displays the size of a motorcycle helmet. The future is now.'
			},
			{
				id: 'cc-internet',
				title: 'The Internet',
				year: 1993,
				archiveId: 'episode_1134',
				description:
					'A look at this new thing called the Internet. Mosaic, FTP, Gopher, and the earliest web browsers.'
			},
			{
				id: 'cc-windows-nt',
				title: 'Windows NT',
				year: 1993,
				archiveId: 'WindowsN',
				description:
					'Microsoft builds a real operating system. 32-bit, preemptive multitasking, and a new kernel.'
			},
			{
				id: 'cc-windows-95',
				title: 'Windows 95',
				year: 1995,
				archiveId: 'CC1301_windows_95',
				description:
					'The Start button arrives. Jay Leno was at the launch. Midnight lines at CompUSA.'
			},
			{
				id: 'cc-internet-95',
				title: 'Internet 1995',
				year: 1995,
				archiveId: 'CC1232_internet',
				description:
					'The internet goes mainstream. Netscape, Yahoo, and the first wave of dot-com mania.'
			},
			{
				id: 'cc-greatest-games',
				title: 'Greatest Computer Games',
				year: 1995,
				archiveId: 'CC1308_greatest_games',
				description:
					'DOOM, Myst, SimCity, and the shareware revolution. The golden age of PC gaming.'
			}
		]
	},
	{
		id: 'computer-programme',
		name: 'The Computer Programme',
		years: '1982',
		description:
			'BBC series that introduced personal computing to Britain. Ian McNaught-Davis and Chris Serle stumble through BASIC.',
		episodes: [
			{
				id: 'tcp-ep1',
				title: "It's Happening Now",
				year: 1982,
				archiveId: 'the_computer_programme_ep01',
				description:
					'The BBC Micro arrives. Two men who barely understand computers try to explain them to millions.'
			},
			{
				id: 'tcp-ep2',
				title: 'Just One Thing After Another',
				year: 1982,
				archiveId: 'the_computer_programme_ep02',
				description: 'Programming in BASIC. Line numbers. GOTO statements. What could go wrong.'
			},
			{
				id: 'tcp-ep3',
				title: 'Talking To A Machine',
				year: 1982,
				archiveId: 'the_computer_programme_ep03',
				description:
					'Programming languages beyond BASIC. How do you actually tell a computer what to do.'
			},
			{
				id: 'tcp-ep4',
				title: "It's On The Computer",
				year: 1982,
				archiveId: 'the_computer_programme_ep04',
				description:
					'Data storage and retrieval. Databases, filing systems, and getting information back out.'
			},
			{
				id: 'tcp-ep5',
				title: 'The New Media',
				year: 1982,
				archiveId: 'the_computer_programme_ep05',
				description:
					'Computers and communications. Viewdata, Prestel, and the information superhighway circa 1982.'
			}
		]
	},
	{
		id: 'arpanet-doc',
		name: 'Computer Networks: The Heralds of Resource Sharing',
		years: '1972',
		description:
			'The 1972 ARPANET documentary. Thirty minutes of bearded engineers explaining the future of communication to a camera. They were right about everything.',
		episodes: [
			{
				id: 'arpanet-full',
				title: 'The Heralds of Resource Sharing',
				year: 1972,
				archiveId: 'ComputerNetworks_TheHeraldsOfResourceSharing',
				description:
					'The entire ARPANET documentary. BBN, UCLA, MIT. Packet switching. "We thought if we could connect these machines together…"'
			}
		]
	},
	{
		id: 'bbs-documentary',
		name: 'BBS: The Documentary',
		years: '2005',
		description:
			"Jason Scott's documentary about bulletin board systems. The internet before the internet. Dial-up modems, ANSI art, and the people who built a world at 2400 baud.",
		episodes: [
			{
				id: 'bbs-baud',
				title: 'Baud',
				year: 2005,
				archiveId: 'BBS_Documentary_Clips_Baud',
				description:
					'The birth of the BBS. Ward Christensen and Randy Suess, a Chicago blizzard, and a phone line.'
			},
			{
				id: 'bbs-community',
				title: 'Sysops and Users',
				year: 2005,
				archiveId: 'BBS_Documentary_Clips_Sysops_and_Users_1',
				description: 'How strangers became friends through 80-column text and 300 baud modems.'
			},
			{
				id: 'bbs-fidonet',
				title: 'FidoNet',
				year: 2005,
				archiveId: 'BBS_Documentary_Clips_Fidonet',
				description:
					'The network that connected BBSes worldwide. Store-and-forward messaging across phone lines.'
			},
			{
				id: 'bbs-no-carrier',
				title: 'No Carrier',
				year: 2005,
				archiveId: 'BBS_Documentary_Clips_No_Carrier',
				description: 'The end of the BBS era. The internet arrives and the modems go silent.'
			},
			{
				id: 'bbs-artscene',
				title: 'Sidelines and Musings',
				year: 2005,
				archiveId: 'BBS_Documentary_Clips_Sidelines',
				description: "The culture, the drama, and the stories that didn't fit anywhere else."
			}
		]
	},
	{
		id: 'monkees',
		name: 'Monkees',
		years: '????',
		description: 'The Complete Monkees series + Head',
		episodes: [
			{
				id: 'show-the-monkees-complete',
				title: 'Monkees',
				year: 0,
				archiveId: 'The-Monkees-Complete',
				description: 'The Complete Monkees series + Head'
			}
		]
	},
	{
		id: 'v-the-series',
		name: 'V The Series',
		years: '1984–1986',
		description: 'Continues from where V The Final Battle part 3 left off.',
		episodes: [
			{
				id: 'v-the-series-s01e01',
				title: 'V The Series (1984-85) s01e01 Liberation Day',
				year: 1984,
				archiveId: 'v-the-series-1984-85-s-01e-01-liberation-day',
				description: 'Continues from where V The Final Battle part 3 left off.'
			},
			{
				id: 'v-the-series-s01e02',
				title: 'V The Series (1984-85) s01e02 Dreadnaught',
				year: 1984,
				archiveId: 'v-the-series-1984-85-s-01e-02-dreadnaught',
				description:
					'Diana activates her unstoppable Triax superweapon to reduce Bates and the city of Los Angeles to rubble.'
			},
			{
				id: 'v-the-series-s01e03',
				title: 'V The Series (1984-85) s01e03 Breakout',
				year: 1985,
				archiveId: 'v-the-series-1984-85-s-01e-03-breakout',
				description:
					'Donovan and Ham are imprisoned in a Visitor work camp guarded by a hideous alien monster; Nathan Bates mounts a desperate search to find the "star-child" to ex…'
			},
			{
				id: 'v-the-series-s01e04',
				title: 'V The Series (1984-85) s01e04 The Deception',
				year: 1984,
				archiveId: 'v-the-series-1984-85-s-01e-04-the-deception',
				description:
					"While the Resistance seeks to help Elizabeth escape from Los Angeles, Diana captures Mike Donovan in an elaborate scheme to learn Elizabeth's whereabouts."
			},
			{
				id: 'v-the-series-s01e05',
				title: 'V The Series (1984-85) s01e05 The Sanction',
				year: 1984,
				archiveId: 'v-the-series-1984-85-s-01e-05-the-sanction',
				description:
					'Seeking to free his son Sean from the Visitors, Donovan grapples with an insidious, powerful alien named Klaus.'
			},
			{
				id: 'v-the-series-s01e06',
				title: "V The Series (1984-85) s01e06 Visitor's Choice",
				year: 1984,
				archiveId: 'v-the-series-1984-85-s-01e-06-visitors-choice',
				description:
					'The Resistance, led by Donovan, Julie, and Ham, stage a daring sabotage at a convention of Visitor commanders in a seaside estate where Diana intends to show o…'
			},
			{
				id: 'v-the-series-s01e07',
				title: 'V The Series (1984-85) S01e07 The Overlord',
				year: 1984,
				archiveId: 'v-the-series-1984-85-s-01e-07-the-overlord',
				description:
					'Led by Donovan, Ham, and Elias, the Resistance seek to rid a mining community from alien-backed thugs.'
			},
			{
				id: 'v-the-series-s01e08',
				title: 'V The Series (1984-85) s01e08 The Dissident',
				year: 1984,
				archiveId: 'v-the-series-1984-85-s-01e-08-the-dissident',
				description:
					'When Diana seals off the Open City with an impenetrable force field which destroys humans on contact, Donovan and Ham must kidnap the alien genius responsible …'
			},
			{
				id: 'v-the-series-s01e09',
				title: 'V The Series (1984-85) s01e09 Reflections In Terror',
				year: 1984,
				archiveId: 'v-the-series-1984-85-s-01e-09-reflections-in-terror',
				description:
					'With a blood sample from the "star-child," Diana creates an uncontrollable and deadly clone which seeks out Elizabeth; Bates tests Julie\'s loyalty when he susp…'
			},
			{
				id: 'v-the-series-s01e10',
				title: 'V The Series (1984-85) s01e10 The Conversion',
				year: 1985,
				archiveId: 'v-the-series-1984-85-s-01e-10-the-conversion',
				description:
					'Warning : This episode contains flashing lights which can trigger seizures in some people.'
			},
			{
				id: 'v-the-series-s01e11',
				title: 'V The Series (1984-85) s01e11 The Hero',
				year: 1985,
				archiveId: 'v-the-series-1984-85-s01e11-the-hero_202210',
				description:
					"A small group of resistance sympathizers (Robin included) are arrested by Bates' police, and a prisoner will be handed over to the Visitors to be executed ever…"
			},
			{
				id: 'v-the-series-s01e11-2',
				title: 'V The Series (1984-85) s01e11 The Hero',
				year: 1985,
				archiveId: 'v-the-series-1984-85-s-01e-11-the-hero',
				description:
					"A small group of resistance sympathizers (Robin included) are arrested by Bates' police, and a prisoner will be handed over to the Visitors to be executed ever…"
			},
			{
				id: 'v-the-series-s01e12',
				title: 'V The Series (1984-85) s01e12 The Betrayal',
				year: 1985,
				archiveId: 'v-the-series-1984-85-s01e-12-the-betrayal',
				description: 'While Bates remains in a coma Charles plots to overthrow him.'
			},
			{
				id: 'v-the-series-s01e12-2',
				title: 'V The Series (1984-85) s01e12 The Betrayal',
				year: 1985,
				archiveId: 'v-the-series-1984-85-s-01e-12-the-betrayal',
				description: 'While Bates remains in a coma Charles plots to overthrow him.'
			},
			{
				id: 'v-the-series-s01e13',
				title: 'V The Series (1984-85) s01e13 The Rescue',
				year: 1985,
				archiveId: 'v-the-series-1984-85-s-01e-13-the-rescue_202210',
				description:
					"Feeling Diana's presence threatens his power, Charles forces her to marry him, after which Alien law requires she return home"
			},
			{
				id: 'v-the-series-s01e14',
				title: 'V The Series (1984-85) s01e14 The Champion',
				year: 1985,
				archiveId: 'v-the-series-1984-85-s-01e-14-the-champion_202210',
				description:
					'Newly arrived Inspector General Philip allows Lydia to choose a trial by combat in a laser duel to the death with Diana.'
			},
			{
				id: 'v-the-series-s01e15',
				title: 'V The Series (1984-85) s01e15 The Wildcats',
				year: 1985,
				archiveId: 'v-the-series-1984-85-s-01e-15-the-wildcats',
				description:
					'Needing medicine to treat a deadly diphtheria epidemic, Julie and Kyle recruit a youth gang, one of whom may be a Visitor spy, to help steal the serum.'
			},
			{
				id: 'v-the-series-s01e15-2',
				title: 'V The Series (1984-85) s01e15 The Wildcats',
				year: 1985,
				archiveId: 'v-the-series-1984-85-s01e-15-the-wildcats',
				description:
					'Needing medicine to treat a deadly diphtheria epidemic, Julie and Kyle recruit a youth gang, one of whom may be a Visitor spy, to help steal the serum.'
			},
			{
				id: 'v-the-series-s01e16',
				title: 'V The Series (1984-85) S01e16 The Littlest Dragon',
				year: 1985,
				archiveId: 'v-the-series-1984-85-s-01e-16-the-littlest-dragon_202210',
				description:
					'Anxious to settle a personal vendetta, Philip trails a Fifth Columnist, hoping he will lead him to the Resistance and Donovan.'
			},
			{
				id: 'v-the-series-s01e17',
				title: 'V The Series (1984-85) S01e17 War of Illusions',
				year: 1985,
				archiveId: 'v-the-series-1984-85-s-01e-17-war-of-illusions_202210',
				description:
					"When Philip and Diana install a high tech computer capable of launching a final victory over Earth, the Resistance's only hope at retaliation is a teenaged com…"
			},
			{
				id: 'v-the-series-s01e18',
				title: 'V The Series (1984-85) S01e18 Secret Underground',
				year: 1985,
				archiveId: 'v-the-series-1984-85-s-01e-18-secret-underground',
				description:
					'Julie and Donovan sneak aboard the Mother Ship to look for a hidden list naming all the Resistance leaders.'
			},
			{
				id: 'v-the-series-s01e19',
				title: 'V - The Series (1984-1985) s01e19 The Return',
				year: 1986,
				archiveId: 'v-the-series-1984-85-s-01e-19-the-return_202206',
				description: 'Could peace be on the horizon..or is it a ploy?'
			},
			{
				id: 'v-the-series-s01e19-2',
				title: 'V The Series (1984-85) S01e19 The Return',
				year: 1985,
				archiveId: 'v-the-series-1984-85-s-01e-19-the-return_202210',
				description:
					'The Leader stuns the Visitors by ordering a truce and traveling to Earth to negotiate peace; Diana plots to disrupt the peace.'
			}
		]
	}
	// >>> /dev/library inserts new shows above this line <<<
];

export const SHOW_BY_ID: Record<string, VCRShow> = SHOWS.reduce(
	(m, s) => {
		m[s.id] = s;
		return m;
	},
	{} as Record<string, VCRShow>
);

export function getAllEpisodes(): { show: VCRShow; episode: VCREpisode }[] {
	return SHOWS.flatMap((show) => show.episodes.map((episode) => ({ show, episode })));
}

export function findEpisode(episodeId: string): { show: VCRShow; episode: VCREpisode } | undefined {
	for (const show of SHOWS) {
		const episode = show.episodes.find((e) => e.id === episodeId);
		if (episode) return { show, episode };
	}
	return undefined;
}
