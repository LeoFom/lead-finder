import type { LeadGateway, CrmPatch } from './gateway';
import type { Business, DemoState, Profile } from './model';
import { changeLocal, chooseLocal, isLocalMode, localUnlocked, readLocal } from './offline-vault';
import { localAdd, localEdit, localProfile, localCsv } from './offline-model';
export const isApiMode = process.env.NEXT_PUBLIC_DATA_MODE === 'api';
let safeSnapshot: { state: DemoState; snapshotAt: string } | null = null;
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
  let response: Response;
  try {
    response = await fetch('/api/v1/' + path, {
      method,
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { 'content-type': 'application/json', ...extraHeaders },
      signal: AbortSignal.timeout(path.startsWith('auth/') ? 65000 : 12000),
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  } catch {
    throw new ApiError(
      0,
      'Сервер недоступний. Відкрийте локальний простір для продовження роботи.',
    );
  }
  const result = await response.json().catch(() => ({ message: 'Сервер тимчасово недоступний' }));
  if (!response.ok)
    throw new ApiError(response.status, result.message || 'Не вдалося виконати запит');
  if (path === 'auth/logout') safeSnapshot = null;
  return result as T;
}
let current: DemoState | null = null;
export const isUnavailable = (error: unknown) =>
  error instanceof ApiError && (error.status === 0 || error.status >= 500);
async function load() {
  if (isLocalMode()) return readLocal();
  try {
    current = await api<DemoState>('workspace');
    try {
      safeSnapshot = await api<{ state: DemoState; snapshotAt: string }>('offline-snapshot');
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) safeSnapshot = null;
    }
  } catch (error) {
    if (isUnavailable(error) && localUnlocked()) {
      chooseLocal();
      return readLocal();
    }
    throw error;
  }
  return current;
}
export const apiGateway: LeadGateway = {
  load,
  async selectProfile(profile: Profile) {
    if (isLocalMode()) return changeLocal((state) => localProfile(state, profile));
    await api('search-profiles', profile, 'POST');
    return load();
  },
  async updateBusiness(id: string, patch: CrmPatch) {
    if (isLocalMode())
      return changeLocal((state) => localEdit(state, id, patch, new Date().toISOString()));
    const business =
      current && current.workspaces[current.activeKey]?.businesses.find((b) => b.id === id);
    if (!business) throw new Error('Оновіть сторінку, щоб завантажити картку');
    await api('businesses/' + id + '/crm', { ...patch, revision: business.revision }, 'PATCH');
    return load();
  },
  async scan() {
    if (isLocalMode())
      throw new Error(
        'Локальний пошук працює в полі «Назва, адреса або домен». Для нового джерела потрібен сервер та підключений адаптер.',
      );
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
  if (isLocalMode())
    return changeLocal((state) => localAdd(state, input, new Date().toISOString()));
  if (!current) throw new Error('Оновіть сторінку');
  await api('businesses', { ...input, profileId: current.activeKey }, 'POST', {
    'idempotency-key': crypto.randomUUID(),
  });
  return load();
}
export async function exportBusinesses(ids: Business['id'][]) {
  if (isLocalMode()) {
    downloadCsv(
      new Blob([localCsv(readLocal(), ids, new Date().toISOString())], {
        type: 'text/csv;charset=utf-8',
      }),
    );
    return;
  }
  let response: Response;
  try {
    response = await fetch('/api/v1/exports/csv', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ids }),
      credentials: 'same-origin',
      signal: AbortSignal.timeout(12000),
    });
  } catch {
    return cachedReport(ids);
  }
  if (response.status >= 500) return cachedReport(ids);
  if (!response.ok)
    throw new Error('Не вдалося експортувати дані. Перевірте вхід та права доступу.');
  downloadCsv(await response.blob());
}
function cachedReport(ids: string[]) {
  if (!safeSnapshot)
    throw new Error(
      'Сервер недоступний. Відкрийте підготовлену локальну базу для формування звіту.',
    );
  downloadCsv(
    new Blob(
      [localCsv(safeSnapshot.state, ids, new Date().toISOString(), safeSnapshot.snapshotAt)],
      { type: 'text/csv;charset=utf-8' },
    ),
  );
  window.dispatchEvent(new CustomEvent('lead-cached-report', { detail: safeSnapshot.snapshotAt }));
}
function downloadCsv(blob: Blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'lead-finder.csv';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
