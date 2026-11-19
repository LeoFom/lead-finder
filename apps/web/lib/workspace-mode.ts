export type WorkspaceMode = 'guest' | 'local' | 'server';
let mode: WorkspaceMode = 'guest';
export function getWorkspaceMode() {
  return mode;
}
export function setWorkspaceMode(next: WorkspaceMode) {
  mode = next;
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('lead-storage-mode'));
}
export const isGuestMode = () => mode === 'guest';
