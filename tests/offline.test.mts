import assert from 'node:assert/strict';
import test from 'node:test';
import {
  emptyLocalState,
  localAdd,
  localEdit,
  localProfile,
  localCsv,
} from '../apps/web/lib/offline-model.ts';
import { deriveVaultKey, openVault, sealVault } from '../apps/web/lib/offline-vault.ts';

test('local-only business search, CRM and CSV need no API or DB and retain history', () => {
  const initial = emptyLocalState();
  const a = localAdd(
    initial,
    {
      name: '=Original clinic',
      address: 'Fixture street',
      website: 'https://fixture.example',
      independentObservation: true,
    },
    '2026-11-19T09:00:00Z',
  );
  const business = a.workspaces[a.activeKey]!.businesses[0]!;
  const b = localEdit(
    a,
    business.id,
    {
      crm: 'do_not_contact',
      notes: 'Keep history',
      priority: 'Високий',
      website: 'https://manual.example',
      websiteLocked: true,
    },
    '2026-11-19T10:00:00Z',
  );
  const found = localProfile(b, { city: 'Івано-Франківськ', query: 'Original' });
  assert.equal(found.workspaces[found.activeKey]!.businesses[0]?.notes, 'Keep history');
  assert.equal(found.workspaces[found.activeKey]!.businesses[0]?.discovery, 'unchecked');
  assert.equal(found.workspaces[found.activeKey]!.businesses[0]?.operating, 'unknown');
  assert.equal(b.workspaces[b.activeKey]!.changes.length, 2);
  assert.equal(initial.workspaces[initial.activeKey]!.businesses.length, 0);
  const csv = localCsv(found, [business.id], '2026-11-19T12:00:00Z');
  assert.ok(csv.startsWith('\uFEFF'));
  assert.ok(csv.includes("'=Original clinic"));
  assert.ok(csv.includes('owner-original-v1'));
  const otherCity = localProfile(found, { city: 'Львів', query: 'Original' });
  assert.equal(otherCity.workspaces[otherCity.activeKey]!.businesses.length, 0);
  assert.throws(() =>
    localAdd(initial, { name: 'x', address: 'x', website: '', independentObservation: false }, 'x'),
  );
});

test('encrypted local vault rejects wrong password and modified ciphertext', async () => {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await deriveVaultKey('local-password-test', salt);
  const text = JSON.stringify({ notes: 'Private CRM note' });
  const sealed = await sealVault(key, text);
  assert.ok(!sealed.ciphertext.includes('Private'));
  assert.equal(await openVault(key, sealed), text);
  const wrong = await deriveVaultKey('different-password', salt);
  await assert.rejects(openVault(wrong, sealed));
  await assert.rejects(
    openVault(key, {
      ...sealed,
      ciphertext: (sealed.ciphertext[0] === 'A' ? 'B' : 'A') + sealed.ciphertext.slice(1),
    }),
  );
});
