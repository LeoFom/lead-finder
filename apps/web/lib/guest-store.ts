import type { DemoState } from './model.ts';
import { emptyLocalState } from './offline-model.ts';
const key = 'lead-finder-guest-v1';
interface StoragePort {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}
interface SavedGuest {
  version: 1;
  revision: string;
  state: DemoState;
}
export class GuestStore {
  private state = emptyLocalState();
  private revision: string | null = null;
  private loaded = false;
  warning = '';
  private storage: StoragePort | null;
  constructor(storage: StoragePort | null) {
    this.storage = storage;
    if (!storage)
      this.warning =
        'Тимчасовий гість: сховище браузера недоступне. Збережіть важливі дані у CSV перед закриттям.';
  }
  read(): DemoState {
    if (this.loaded) return structuredClone(this.state);
    if (!this.storage) return structuredClone(this.state);
    try {
      const raw = this.storage.getItem(key);
      if (raw) {
        const saved = JSON.parse(raw) as SavedGuest;
        if (
          saved.version !== 1 ||
          typeof saved.revision !== 'string' ||
          saved.state?.version !== 1 ||
          !saved.state.workspaces[saved.state.activeKey] ||
          !Object.values(saved.state.workspaces).every(
            (w) => Array.isArray(w.businesses) && Array.isArray(w.changes) && Array.isArray(w.runs),
          )
        )
          throw new Error();
        this.state = saved.state;
        this.revision = saved.revision;
      } else {
        this.state = emptyLocalState();
        this.revision = null;
      }
    } catch {
      this.storage = null;
      this.warning =
        'Збережену гостьову базу не вдалося прочитати. Відкрито тимчасовий простір; попередній файл не перезаписується.';
    }
    this.loaded = true;
    return structuredClone(this.state);
  }
  change(change: (state: DemoState) => DemoState): DemoState {
    if (this.storage) {
      let raw: string | null;
      try {
        raw = this.storage.getItem(key);
      } catch {
        throw new Error('Браузер заблокував сховище. Експортуйте дані перед закриттям.');
      }
      const actual = raw ? (JSON.parse(raw) as SavedGuest).revision : null;
      if (actual !== this.revision)
        throw new Error(
          'Гостьову базу змінено в іншій вкладці. Оновіть сторінку перед редагуванням.',
        );
    }
    const next = change(structuredClone(this.state));
    const revision = crypto.randomUUID();
    if (this.storage) {
      try {
        this.storage.setItem(key, JSON.stringify({ version: 1, revision, state: next }));
      } catch {
        throw new Error(
          'Не вистачає місця у сховищі браузера. Попередні дані збережено. Експортуйте CSV.',
        );
      }
    }
    this.state = next;
    this.loaded = true;
    this.revision = revision;
    return structuredClone(next);
  }
}
let instance: GuestStore | null = null;
function store() {
  if (!instance) {
    let storage: StoragePort | null = null;
    try {
      storage = globalThis.localStorage;
    } catch {
      /* Temporary guest can still work. */
    }
    instance = new GuestStore(storage);
  }
  return instance;
}
export function readGuest() {
  const state = store().read();
  window.dispatchEvent(new Event('lead-guest-storage'));
  return state;
}
export function guestWarning() {
  return store().warning;
}
export async function changeGuest(change: (state: DemoState) => DemoState) {
  if (navigator.locks) return navigator.locks.request(key, () => store().change(change));
  // Browsers without cross-tab locks use only an in-memory guest.
  if (!instance?.warning) {
    const state = store().read();
    instance = new GuestStore(null);
    instance.change(() => state);
  }
  window.dispatchEvent(new Event('lead-guest-storage'));
  return store().change(change);
}
