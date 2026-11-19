import { applyDemoScan, initialState, createWorkspace, profileKey } from './model.ts';
import type { Business, DemoState, Profile } from './model.ts';
import { apiGateway, isApiMode } from './api-gateway';

export type CrmPatch = Pick<Business, 'crm' | 'priority' | 'notes' | 'website' | 'websiteLocked'>;
/** Replace the implementation with authenticated NestJS requests, keeping the UI contract. */
export interface LeadGateway {
  load(): Promise<DemoState>;
  selectProfile(profile: Profile): Promise<DemoState>;
  updateBusiness(id: string, patch: CrmPatch): Promise<DemoState>;
  scan(): Promise<DemoState>;
}
const storageKey = 'lead-finder-demo-v1';
function read(): DemoState {
  const raw = localStorage.getItem(storageKey);
  if (!raw) return initialState();
  const state = JSON.parse(raw) as DemoState;
  if (state.version !== 1 || !state.workspaces?.[state.activeKey]?.businesses)
    throw new Error('Невідома версія демоданих. Очистіть дані сайту у браузері.');
  return state;
}
function write(state: DemoState) {
  localStorage.setItem(storageKey, JSON.stringify(state));
  return state;
}
export const demoGateway: LeadGateway = {
  async load() {
    return read();
  },
  async selectProfile(profile) {
    const state = read();
    const key = profileKey(profile);
    return write({
      ...state,
      activeKey: key,
      workspaces: { ...state.workspaces, [key]: state.workspaces[key] ?? createWorkspace(profile) },
    });
  },
  async updateBusiness(id, patch) {
    const state = read();
    const workspace = state.workspaces[state.activeKey]!;
    const business = workspace.businesses.find((b) => b.id === id);
    if (!business) throw new Error('Бізнес не знайдено');
    const at = new Date().toISOString();
    return write({
      ...state,
      workspaces: {
        ...state.workspaces,
        [state.activeKey]: {
          ...workspace,
          businesses: workspace.businesses.map((b) => (b.id === id ? { ...b, ...patch } : b)),
          changes: [
            {
              id: crypto.randomUUID(),
              businessId: id,
              name: business.name,
              at,
              text: 'Збережено ручні зміни CRM та контактів',
            },
            ...workspace.changes,
          ],
        },
      },
    });
  },
  async scan() {
    const state = read();
    const workspace = state.workspaces[state.activeKey]!;
    const snapshot = Math.min(2, workspace.runs[0]!.snapshot + 1);
    return write({
      ...state,
      workspaces: {
        ...state.workspaces,
        [state.activeKey]: applyDemoScan(workspace, snapshot, new Date().toISOString()),
      },
    });
  },
};
export const leadGateway = isApiMode ? apiGateway : demoGateway;
