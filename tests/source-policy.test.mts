import assert from 'node:assert/strict';
import test from 'node:test';
import type { FactProvenance, SourceType } from '../packages/shared/src/index.ts';
import {
  createSourcePolicy,
  evaluateSourcePolicy,
  requireSourceRights,
  type SourceGrant,
} from '../packages/data-sources/src/index.ts';

const manual: FactProvenance = {
  sourceType: 'manual',
  sourceRef: 'own-observation:fixture-1',
  field: 'website_url',
  license: 'owner-original-v1',
  observedAt: '2026-10-22T12:00:00Z',
  confidence: 1,
  storageRights: 'allowed',
  exportRights: 'allowed',
  attribution: 'Власна перевірка',
  dataset: 'independent-user-observation',
};
const sourceFact: FactProvenance = {
  ...manual,
  sourceType: 'overture',
  sourceRef: 'fixture:record-1',
  dataset: 'fixture-publisher',
  releaseId: 'fixture-release',
  license: 'fixture-license',
  attribution: 'Synthetic test publisher',
};
const grant: SourceGrant = {
  sourceType: 'overture',
  dataset: 'fixture-publisher',
  releaseId: 'fixture-release',
  license: 'fixture-license',
  fields: ['website_url'],
  canStore: true,
  canExport: false,
  expiresAt: '2026-11-01T00:00:00Z',
};
const beforeExpiry = new Date('2026-10-31T00:00:00Z');

for (const source of ['google_maps', 'brave_search', 'instagram', 'other']) {
  test(`${source} cannot enter storage or export even with claimed rights`, () => {
    for (const operation of ['store', 'export'] as const) {
      assert.equal(
        evaluateSourcePolicy(operation, { ...manual, sourceType: source as SourceType }).allowed,
        false,
      );
    }
  });
}

test('independent original observation has an explicit grant', () => {
  assert.doesNotThrow(() => requireSourceRights('store', [manual]));
  assert.doesNotThrow(() => requireSourceRights('export', [manual]));
});

test('a field with no provenance or any restricted parent is denied', () => {
  for (const operation of ['store', 'export'] as const) {
    assert.throws(() => requireSourceRights(operation, []));
    assert.throws(() =>
      requireSourceRights(operation, [manual, { ...manual, sourceType: 'google_maps' }]),
    );
  }
});

test('unreviewed external sources are disabled by default', () => {
  for (const sourceType of ['overture', 'official_website', 'osm', 'licensed_search'] as const) {
    assert.equal(evaluateSourcePolicy('store', { ...sourceFact, sourceType }).allowed, false);
  }
});

test('per-fact storage and export rights are independent', () => {
  for (const storageRights of ['unknown', 'denied'] as const) {
    assert.equal(evaluateSourcePolicy('store', { ...manual, storageRights }).allowed, false);
    assert.equal(evaluateSourcePolicy('export', { ...manual, storageRights }).allowed, false);
  }
  const storeOnly = { ...manual, exportRights: 'denied' } as const;
  assert.equal(evaluateSourcePolicy('store', storeOnly).allowed, true);
  assert.equal(evaluateSourcePolicy('export', storeOnly).allowed, false);
});

test('missing or invalid field provenance is rejected', () => {
  for (const patch of [
    { license: ' ' },
    { sourceRef: '' },
    { attribution: '' },
    { field: '' },
    { dataset: '' },
    { confidence: NaN },
    { confidence: -1 },
    { confidence: 1.1 },
    { observedAt: 'invalid' },
  ]) {
    assert.equal(evaluateSourcePolicy('store', { ...manual, ...patch }).allowed, false);
  }
});

test('trusted grant is scoped to source, dataset, release, license, field and operation', () => {
  const check = createSourcePolicy([grant]);
  assert.equal(check('store', sourceFact, beforeExpiry).allowed, true);
  assert.equal(check('export', sourceFact, beforeExpiry).allowed, false);
  for (const patch of [
    { dataset: 'other' },
    { releaseId: 'later' },
    { releaseId: '' },
    { license: 'other' },
    { field: 'phone' },
    { sourceType: 'manual' as const },
  ]) {
    assert.equal(check('store', { ...sourceFact, ...patch }, beforeExpiry).allowed, false);
  }
});

test('retention deadline and revocation apply even to previously allowed facts', () => {
  const check = createSourcePolicy([{ ...grant, canExport: true }]);
  for (const operation of ['store', 'export'] as const) {
    assert.equal(check(operation, sourceFact, beforeExpiry).allowed, true);
    assert.equal(check(operation, sourceFact, new Date(grant.expiresAt!)).allowed, false);
    assert.equal(createSourcePolicy([])(operation, sourceFact, beforeExpiry).allowed, false);
  }
});
