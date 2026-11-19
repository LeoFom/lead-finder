import assert from 'node:assert/strict';
import process from 'node:process';
import test from 'node:test';
import { spawn } from 'node:child_process';
import { setTimeout as wait } from 'node:timers/promises';

test('private API persists CRM, records history, enforces revision and licenses', async () => {
  const proxy = 'ci-proxy-'.padEnd(64, '1');
  const token = 'ci-setup-'.padEnd(64, '2');
  const origin = 'http://localhost:3000';
  const server = spawn(process.execPath, ['apps/api/dist/main.js'], {
    env: {
      ...process.env,
      PORT: '3099',
      API_PROXY_KEY: proxy,
      OWNER_SETUP_TOKEN: token,
      WEB_ORIGINS: origin,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  server.stdout.on('data', (chunk) => {
    output += chunk;
  });
  server.stderr.on('data', (chunk) => {
    output += chunk;
  });
  let cookie = '';
  const request = async (path, body, method = 'GET', extra = {}) => {
    const response = await globalThis.fetch('http://127.0.0.1:3099/api/v1/' + path, {
      method,
      headers: {
        'content-type': 'application/json',
        'x-api-proxy-key': proxy,
        origin,
        cookie,
        ...extra,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return response;
  };
  try {
    let ready = false;
    for (let attempt = 0; attempt < 60; attempt++) {
      try {
        ready = (await request('health/ready')).ok;
        if (ready) break;
      } catch {
        /* startup */
      }
      await wait(500);
    }
    assert.ok(ready, output);
    assert.equal((await request('workspace')).status, 401);
    const setup = await request(
      'auth/setup',
      { token, email: 'owner@example.test', password: 'Strong-test-password-19' },
      'POST',
    );
    assert.equal(setup.status, 201, await setup.clone().text());
    cookie = setup.headers.get('set-cookie').split(';')[0];
    assert.equal(
      (
        await request(
          'auth/setup',
          { token, email: 'other@example.test', password: 'Strong-test-password-20' },
          'POST',
        )
      ).status,
      409,
    );
    const workspace = await (await request('workspace')).json();
    const profileId = workspace.activeKey;
    assert.equal(workspace.workspaces[profileId].businesses.length, 0);
    const input = {
      profileId,
      name: 'Fixture business',
      address: 'Fixture address',
      website: 'https://fixture.example',
      independentObservation: true,
    };
    const headers = { 'idempotency-key': '0fc7bde3-7dab-47fd-90e1-f6c22a967590' };
    const created = await (await request('businesses', input, 'POST', headers)).json();
    assert.ok(created.id);
    const retry = await (await request('businesses', input, 'POST', headers)).json();
    assert.equal(retry.id, created.id);
    assert.equal(
      (await request('businesses', { ...input, name: 'Other' }, 'POST', headers)).status,
      409,
    );
    const patch = {
      revision: 1,
      crm: 'do_not_contact',
      priority: 'Високий',
      notes: 'Keep this note',
      website: 'https://manual.example',
      websiteLocked: true,
    };
    assert.equal((await request('businesses/' + created.id + '/crm', patch, 'PATCH')).status, 200);
    assert.equal((await request('businesses/' + created.id + '/crm', patch, 'PATCH')).status, 409);
    assert.equal((await request('search-runs', {}, 'POST')).status, 409);
    const detail = await (await request('businesses/' + created.id)).json();
    assert.equal(detail.notes, patch.notes);
    assert.equal(detail.crm, 'do_not_contact');
    assert.equal(detail.website, patch.website);
    assert.equal(detail.operating, 'unknown');
    assert.equal(detail.facts.filter((f) => f.fieldName === 'website_url').length, 2);
    assert.equal(
      detail.facts.filter((f) => f.fieldName === 'website_url' && f.isCurrent).length,
      1,
    );
    const snapshot = await (await request('offline-snapshot')).json();
    assert.equal(snapshot.policy, 'independent-manual-only-v1');
    assert.equal(snapshot.state.workspaces[profileId].businesses[0].website, patch.website);
    const csv = await request('exports/csv', { ids: [created.id] }, 'POST');
    assert.equal(csv.status, 201);
    assert.match(await csv.text(), /manual.example/);
    const blocked = await request(
      'businesses/' + created.id + '/crm',
      { ...patch, revision: 2 },
      'PATCH',
      { origin: 'https://evil.example' },
    );
    assert.equal(blocked.status, 403);
    assert.equal((await request('auth/logout', {}, 'POST')).status, 200);
    assert.equal((await request('workspace')).status, 401);
    const login = await request(
      'auth/login',
      { email: 'owner@example.test', password: 'Strong-test-password-19' },
      'POST',
    );
    assert.equal(login.status, 200);
  } finally {
    server.kill();
    await new Promise((resolve) => server.once('exit', resolve));
  }
});
