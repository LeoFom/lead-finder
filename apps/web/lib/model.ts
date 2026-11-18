export const crmLabels = {
  new: 'Новий',
  planned: 'Заплановано',
  contacted: 'Контактовано',
  replied: 'Відповів',
  interested: 'Зацікавлений',
  negotiation: 'Переговори',
  won: 'Клієнт',
  lost: 'Відмова',
  do_not_contact: 'Не контактувати',
} as const;
export type CrmStatus = keyof typeof crmLabels;
export interface Profile {
  city: string;
  query: string;
}
export interface Business {
  id: string;
  name: string;
  address: string;
  website: string;
  instagram: string;
  discovery: 'seen' | 'missing_once' | 'reappeared';
  operating: 'operational' | 'unknown';
  crm: CrmStatus;
  priority: 'Звичайний' | 'Високий';
  notes: string;
  websiteLocked: boolean;
  firstSeen: string;
  lastSeen: string;
}
export interface Change {
  id: string;
  businessId: string;
  name: string;
  at: string;
  text: string;
}
export interface Run {
  id: string;
  at: string;
  snapshot: number;
  created: number;
  changed: number;
  missing: number;
}
export interface Workspace {
  profile: Profile;
  businesses: Business[];
  changes: Change[];
  runs: Run[];
}
export interface DemoState {
  version: 1;
  activeKey: string;
  workspaces: Record<string, Workspace>;
}
export const profileKey = (p: Profile) =>
  JSON.stringify([p.city, p.query.trim().normalize('NFKC').toLocaleLowerCase('uk')]);

export function createWorkspace(profile: Profile): Workspace {
  const names = [
    'Дентал Студія',
    'Білий простір',
    'Майстерня усмішки',
    'Денталіка',
    'Добра усмішка',
    'Сімейна стоматологія',
    'Нова усмішка',
    'Клініка 32',
  ];
  const streets = [
    'Незалежності, 18',
    'Галицька, 42',
    'Січових Стрільців, 7',
    'Мазепи, 24',
    'Коновальця, 85',
    'Вовчинецька, 12',
    'Дністровська, 9',
    'Чорновола, 31',
  ];
  const at = '2026-11-18T09:00:00.000Z';
  return {
    profile,
    businesses: names.map((name, i) => ({
      id: `demo-${i}`,
      name: /стомат|dental/i.test(profile.query) ? name : `${profile.query} · приклад ${i + 1}`,
      address: `вул. ${streets[i]}`,
      website: i % 3 === 0 ? '' : `clinic-${i + 1}.example`,
      instagram: i % 4 === 0 ? '' : `demo_clinic_${i + 1}`,
      discovery: 'seen',
      operating: 'unknown',
      crm: i === 2 ? 'interested' : i === 4 ? 'contacted' : 'new',
      priority: i === 2 ? 'Високий' : 'Звичайний',
      notes: '',
      websiteLocked: false,
      firstSeen: at,
      lastSeen: at,
    })),
    changes: [],
    runs: [{ id: 'demo-initial', at, snapshot: 0, created: 8, changed: 0, missing: 0 }],
  };
}

export function initialState(): DemoState {
  const profile = { city: 'Івано-Франківськ', query: 'Стоматологія' };
  return {
    version: 1,
    activeKey: profileKey(profile),
    workspaces: { [profileKey(profile)]: createWorkspace(profile) },
  };
}

/** Deterministic demo of A → B → C snapshots. Existing CRM belongs to the user. */
export function applyDemoScan(workspace: Workspace, snapshot: number, at: string): Workspace {
  if (workspace.runs.some((r) => r.snapshot === snapshot)) return workspace;
  const changes: Change[] = [];
  const businesses = workspace.businesses.map((b) => {
    const next = { ...b };
    if (b.id === 'demo-1' && snapshot === 1 && !b.websiteLocked) {
      next.website = 'new-clinic.example';
      changes.push({
        id: `${snapshot}-${b.id}`,
        businessId: b.id,
        name: b.name,
        at,
        text: `Сайт змінено з ${b.website} на ${next.website}`,
      });
    }
    if (b.id === 'demo-3') {
      next.discovery = snapshot === 1 ? 'missing_once' : 'reappeared';
      changes.push({
        id: `${snapshot}-${b.id}`,
        businessId: b.id,
        name: b.name,
        at,
        text:
          snapshot === 1
            ? 'Не знайдено в повному демонстраційному скані'
            : 'Повторно знайдено у джерелі',
      });
    }
    if (next.discovery !== 'missing_once') next.lastSeen = at;
    return next;
  });
  if (snapshot === 1) {
    const created: Business = {
      id: 'demo-8',
      name: 'Сучасна клініка · приклад',
      address: 'вул. Шевченка, 15',
      website: '',
      instagram: 'demo_new_clinic',
      discovery: 'seen',
      operating: 'unknown',
      crm: 'new',
      priority: 'Звичайний',
      notes: '',
      websiteLocked: false,
      firstSeen: at,
      lastSeen: at,
    };
    businesses.push(created);
    changes.push({
      id: 'created-demo-8',
      businessId: created.id,
      name: created.name,
      at,
      text: 'Новий бізнес додано до бази',
    });
  }
  const run = {
    id: `demo-run-${snapshot}`,
    snapshot,
    at,
    created: snapshot === 1 ? 1 : 0,
    changed: changes.length - (snapshot === 1 ? 1 : 0),
    missing: snapshot === 1 ? 1 : 0,
  };
  return {
    ...workspace,
    businesses,
    changes: [...changes, ...workspace.changes],
    runs: [run, ...workspace.runs],
  };
}
