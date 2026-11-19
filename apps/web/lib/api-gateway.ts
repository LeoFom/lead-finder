import type { LeadGateway, CrmPatch } from './gateway';
import type { Business, DemoState, Profile } from './model';
export const isApiMode = process.env.NEXT_PUBLIC_DATA_MODE === 'api';
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export async function api<T>(
  path: string,
  body?: unknown,
  method = 'GET',
  extraHeaders: Record<string, string> = {},
): Promise<T> {
  const response = await fetch('/api/v1/' + path, {
    method,
    credentials: 'same-origin',
    cache: 'no-store',
    headers: { 'content-type': 'application/json', ...extraHeaders },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const result = await response.json();
  if (!response.ok)
    throw new ApiError(response.status, result.message || 'Не вдалося виконати запит');
  return result as T;
}
let current: DemoState | null = null;
async function load() {
  current = await api<DemoState>('workspace');
  return current;
}
export const apiGateway: LeadGateway = {
  load,
  async selectProfile(profile: Profile) {
    await api('search-profiles', profile, 'POST');
    return load();
  },
  async updateBusiness(id: string, patch: CrmPatch) {
    const business =
      current && current.workspaces[current.activeKey]?.businesses.find((b) => b.id === id);
    if (!business) throw new Error('Оновіть сторінку, щоб завантажити картку');
    await api('businesses/' + id + '/crm', { ...patch, revision: business.revision }, 'PATCH');
    return load();
  },
  async scan() {
    await api('search-runs', {}, 'POST');
    return load();
  },
};
export async function addBusiness(input: {
  name: string;
  address: string;
  website: string;
  independentObservation: boolean;
}) {
  if (!current) throw new Error('Оновіть сторінку');
  await api('businesses', { ...input, profileId: current.activeKey }, 'POST', {
    'idempotency-key': crypto.randomUUID(),
  });
  return load();
}
export async function exportBusinesses(ids: Business['id'][]) {
  const response = await fetch('/api/v1/exports/csv', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ids }),
    credentials: 'same-origin',
  });
  if (!response.ok) throw new Error('Не вдалося експортувати дані');
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement('a');
  link.href = url;
  link.download = 'lead-finder.csv';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
