import { z } from 'zod';

const ID_RE = /^[a-z0-9][a-z0-9-]{0,59}$/;

const EpisodeSchema = z.object({
	id: z.string().min(1),
	title: z.string().min(1),
	year: z.number().int(),
	archiveId: z.string().min(1),
	archiveFile: z.string().optional(),
	description: z.string()
});

export const ShowInputSchema = z.object({
	id: z.string().regex(ID_RE, 'id must be kebab-case (letters/numbers/hyphens, max 60)'),
	name: z.string().min(1, 'name is required'),
	years: z.string(),
	description: z.string(),
	episodes: z.array(EpisodeSchema).min(1, 'at least one episode is required')
});

export type ValidatedShowInput = z.infer<typeof ShowInputSchema>;
