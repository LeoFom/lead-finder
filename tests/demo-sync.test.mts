import test from 'node:test';
import assert from 'node:assert/strict';
import { applyDemoScan, createWorkspace, profileKey } from '../apps/web/lib/model.ts';

test('demo A/B/C retains identities, CRM, locks and history across repeated scans', () => {
  const a = createWorkspace({ city: 'Івано-Франківськ', query: 'Стоматологія' });
  const edited = a.businesses.find((b) => b.id === 'demo-1')!;
  edited.notes = 'Зателефонувати наступного тижня';
  edited.crm = 'do_not_contact';
  edited.website = 'owner.example';
  edited.websiteLocked = true;
  const b = applyDemoScan(a, 1, '2026-11-19T09:00:00Z');
  assert.equal(b.businesses.length, 9);
  assert.equal(b.businesses.find((x) => x.id === edited.id)?.website, 'owner.example');
  assert.equal(b.businesses.find((x) => x.id === 'demo-3')?.discovery, 'missing_once');
  assert.equal(b.businesses.find((x) => x.id === 'demo-3')?.operating, 'unknown');
  assert.equal(applyDemoScan(b, 1, '2026-11-20T09:00:00Z'), b);
  const c = applyDemoScan(b, 2, '2026-11-21T09:00:00Z');
  assert.equal(c.businesses.length, 9);
  assert.equal(c.businesses.find((x) => x.id === 'demo-3')?.discovery, 'reappeared');
  assert.equal(c.businesses.find((x) => x.id === edited.id)?.notes, edited.notes);
  assert.equal(c.businesses.find((x) => x.id === edited.id)?.crm, 'do_not_contact');
  assert.ok(c.changes.length > b.changes.length);
  assert.equal(a.businesses.length, 8);
});

test('demo website history captures both values and scopes profiles by city and query', () => {
  const profile = { city: 'Львів', query: 'Стоматологія' };
  const a = createWorkspace(profile);
  const b = applyDemoScan(a, 1, '2026-11-19T09:00:00Z');
  assert.ok(
    b.changes.some(
      (c) => c.text.includes('clinic-2.example') && c.text.includes('new-clinic.example'),
    ),
  );
  assert.notEqual(profileKey(profile), profileKey({ ...profile, city: 'Київ' }));
  assert.equal(profileKey(profile), profileKey({ ...profile, query: ' стоматологія ' }));
});
