import type { AppLaunchHandler } from '$lib/terminalos/apps/app-manifest';
import type { FsFile } from '$lib/terminalos/filesystem/types';
import { DOCUMENTS_ID } from '$lib/terminalos/filesystem/well-known-ids';

async function textEditFiles(fs: Parameters<AppLaunchHandler>[0]['fs']): Promise<FsFile[]> {
	const listed = await fs.listFolder(DOCUMENTS_ID);
	if (!listed.ok) return [];
	return listed.value.filter(
		(node): node is FsFile =>
			node.kind === 'file' && (node.fileType === 'text' || node.opensWith === 'textedit')
	);
}

async function openNamedTextFile(
	ctx: Parameters<AppLaunchHandler>[0],
	name: string
): Promise<void> {
	const file = (await textEditFiles(ctx.fs)).find((f) => f.name === name);
	if (file) ctx.os.openDocument(file);
}

export const launchTextEdit: AppLaunchHandler = async (ctx, payload) => {
	if (payload?.action === 'new') {
		const base = 'Untitled';
		const ext = '.txt';
		let name = `${base}${ext}`;
		if (ctx.fs.exists(DOCUMENTS_ID, name)) {
			let i = 2;
			while (ctx.fs.exists(DOCUMENTS_ID, `${base} ${i}${ext}`)) i++;
			name = `${base} ${i}${ext}`;
		}
		const result = await ctx.fs.createTextFile(DOCUMENTS_ID, name, '');
		if (result.ok) ctx.os.openDocument(result.value);
		return;
	}

	if (payload?.action === 'open') {
		const docs = await textEditFiles(ctx.fs);
		const buttons = docs.map((file) => ({
			label: file.name,
			action: () => ctx.os.openDocument(file)
		}));
		ctx.os.alert({
			title: 'Open Document',
			body: docs.length > 0 ? 'Choose a document to open:' : 'No documents found.',
			buttons: [...buttons, { label: 'Cancel', primary: true }]
		});
		return;
	}

	if (typeof payload?.open === 'string') {
		openNamedTextFile(ctx, payload.open);
		return;
	}

	openNamedTextFile(ctx, 'README.TXT');
};
