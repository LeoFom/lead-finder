import assert from 'node:assert/strict';
import test from 'node:test';
import { GuestStore } from '../apps/web/lib/guest-store.ts';
import { localAdd } from '../apps/web/lib/offline-model.ts';
import { getWorkspaceMode } from '../apps/web/lib/workspace-mode.ts';

const input = {
  name: 'Guest fixture',
  address: 'Guest address',
  website: '',
  independentObservation: true,
};
function memoryStorage() {
  const values = new Map<string, string>();
  return {
    values,
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
}
test('default mode is guest and guest persistence never touches private vault keys', () => {
  assert.equal(getWorkspaceMode(), 'guest');
  const storage = memoryStorage();
  storage.setItem('lead-finder-private-vault-v1', 'private-encrypted-sentinel');
  const guest = new GuestStore(storage);
  const initial = guest.read();
  assert.equal(initial.workspaces[initial.activeKey]!.businesses.length, 0);
  guest.change((state) => localAdd(state, input, '2026-11-19T12:00:00Z'));
  const reloaded = new GuestStore(storage).read();
  assert.equal(reloaded.workspaces[reloaded.activeKey]!.businesses[0]?.name, input.name);
  assert.equal(storage.getItem('lead-finder-private-vault-v1'), 'private-encrypted-sentinel');
});
test('another tab and full storage cannot silently overwrite guest data', () => {
  const storage = memoryStorage();
  const a = new GuestStore(storage),
    b = new GuestStore(storage);
  a.read();
  b.read();
  a.change((state) => localAdd(state, input, '2026-11-19T12:00:00Z'));
  assert.throws(() => b.change((state) => localAdd(state, input, 'later')), /іншій вкладці/);
  const full = new GuestStore({
    getItem: storage.getItem,
    setItem: () => {
      throw new Error('Quota');
    },
  });
  const before = full.read();
  assert.throws(() => full.change((state) => localAdd(state, input, 'later')), /Не вистачає місця/);
  assert.deepEqual(full.read(), before);
});
test('guest remains usable in memory when storage is denied or corrupt', () => {
  for (const storage of [
    null,
    {
      getItem: () => '{broken',
      setItem: () => {
        throw new Error('Must not replace corrupt copy');
      },
    },
  ]) {
    const guest = new GuestStore(storage);
    guest.read();
    const state = guest.change((value) => localAdd(value, input, '2026-11-19T12:00:00Z'));
    assert.equal(state.workspaces[state.activeKey]!.businesses.length, 1);
    assert.ok(guest.warning);
  }
});
