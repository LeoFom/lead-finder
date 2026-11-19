import type { Business, DemoState, Profile, Workspace } from './model.ts';
import { profileKey } from './model.ts';
type CrmPatch = Pick<Business, 'crm' | 'priority' | 'notes' | 'website' | 'websiteLocked'>;
export function emptyLocalState(): DemoState {
  const profile = { city: 'Івано-Франківськ', query: 'Стоматологія' };
  return {
    version: 1,
    activeKey: profileKey(profile),
    workspaces: { [profileKey(profile)]: { profile, businesses: [], changes: [], runs: [] } },
  };
}
const normalize = (s: string) => s.normalize('NFKC').trim().toLocaleLowerCase('uk');
export function localProfile(state: DemoState, profile: Profile): DemoState {
  const key = profileKey(profile);
  if (state.workspaces[key]) return { ...state, activeKey: key };
  const found = new Map<string, Business>();
  for (const workspace of Object.values(state.workspaces)) {
    if (workspace.profile.city !== profile.city) continue;
    for (const b of workspace.businesses) {
      if (
        normalize(workspace.profile.query).includes(normalize(profile.query)) ||
        normalize(b.name).includes(normalize(profile.query))
      )
        found.set(b.id, b);
    }
  }
  return {
    ...state,
    activeKey: key,
    workspaces: {
      ...state.workspaces,
      [key]: { profile, businesses: [...found.values()], changes: [], runs: [] },
    },
  };
}
export function localEdit(state: DemoState, id: string, patch: CrmPatch, at: string): DemoState {
  if (!Object.values(state.workspaces).some((w) => w.businesses.some((b) => b.id === id)))
    throw new Error('Бізнес не знайдено в локальній базі');
  const workspaces: Record<string, Workspace> = {};
  for (const [key, workspace] of Object.entries(state.workspaces)) {
    const business = workspace.businesses.find((b) => b.id === id);
    workspaces[key] = business
      ? {
          ...workspace,
          businesses: workspace.businesses.map((b) => (b.id === id ? { ...b, ...patch } : b)),
          changes: [
            {
              id: crypto.randomUUID(),
              businessId: id,
              name: business.name,
              at,
              text:
                'Локальна правка CRM: ' +
                JSON.stringify({
                  before: { crm: business.crm, website: business.website, notes: business.notes },
                  after: patch,
                }),
            },
            ...workspace.changes,
          ],
        }
      : workspace;
  }
  return { ...state, workspaces };
}
export function localAdd(
  state: DemoState,
  input: { name: string; address: string; website: string; independentObservation: boolean },
  at: string,
): DemoState {
  if (!input.independentObservation || !input.name.trim() || !input.address.trim())
    throw new Error('Підтвердіть походження та заповніть назву й адресу');
  const workspace = state.workspaces[state.activeKey];
  if (!workspace) throw new Error('Оберіть профіль');
  const business: Business = {
    id: crypto.randomUUID(),
    name: input.name.trim(),
    address: input.address.trim(),
    website: input.website.trim(),
    instagram: '',
    websiteLocked: Boolean(input.website),
    crm: 'new',
    priority: 'Звичайний',
    notes: '',
    discovery: 'unchecked',
    operating: 'unknown',
    firstSeen: at,
    lastSeen: at,
  };
  return {
    ...state,
    workspaces: {
      ...state.workspaces,
      [state.activeKey]: {
        ...workspace,
        businesses: [...workspace.businesses, business],
        changes: [
          {
            id: crypto.randomUUID(),
            businessId: business.id,
            name: business.name,
            at,
            text: 'Бізнес додано вручну до локальної бази',
          },
          ...workspace.changes,
        ],
      },
    },
  };
}
export function localCsv(state: DemoState, ids: string[], at: string, snapshotAt = at) {
  const w = state.workspaces[state.activeKey];
  if (!w) throw new Error('Оберіть профіль');
  const rows = w.businesses.filter((b) => ids.includes(b.id));
  const cell = (s: string) =>
    '"' + (/^[=+@\-\t\r\n]/.test(s) ? "'" + s : s).replaceAll('"', '""') + '"';
  return (
    '\uFEFF' +
    [
      [
        'ID',
        'Назва',
        'Місто',
        'Адреса',
        'Сайт',
        'Instagram',
        'CRM',
        'Стан бізнесу',
        'Походження',
        'Дата звіту',
        'Станом на',
      ],
      ...rows.map((b) => [
        b.id,
        b.name,
        w.profile.city,
        b.address,
        b.website,
        b.instagram,
        b.crm,
        b.operating,
        'Власні ручні дані / owner-original-v1 / локальна копія',
        at,
        snapshotAt,
      ]),
    ]
      .map((row) => row.map(cell).join(';'))
      .join('\r\n')
  );
}
