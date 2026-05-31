import type { NodeId } from './types';

// The fixed folder ids every TerminalFS volume is seeded with. Kept in their own
// leaf module (no runtime imports beyond a type) so code evaluated early in the
// load graph — e.g. apps/manifests.ts, which app-catalog reads at module load —
// can reference them WITHOUT pulling in terminal-fs → apps/app-install →
// app-catalog, which would be a load-order cycle (app-catalog evaluates
// MANIFESTS-derived routes at load). terminal-fs re-exports these unchanged.
export const ROOT_ID: NodeId = 'root_terminal_hd';
export const APPLICATIONS_ID: NodeId = 'folder_applications';
export const DOCUMENTS_ID: NodeId = 'folder_documents';
export const DESKTOP_ID: NodeId = 'folder_desktop';
export const SYSTEM_ID: NodeId = 'folder_system';
export const RECORDINGS_ID: NodeId = 'folder_recordings';
export const TRASH_ID: NodeId = 'folder_trash';
export const APPDATA_ID: NodeId = 'folder_appdata';
