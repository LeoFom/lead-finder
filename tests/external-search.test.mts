import assert from 'node:assert/strict';
import test from 'node:test';
import {
  defaultSearch,
  externalSearchLinks,
  searchPhrase,
} from '../apps/web/lib/transient-search.ts';

test('external search keeps user input inside query parameters on fixed provider hosts', () => {
  const input = {
    city: 'Львів & https://evil.example/?x=1',
    query: 'Клініка «А+Б» # & next=bad',
    mode: 'web' as const,
  };
  const links = externalSearchLinks(input);
  for (const link of Object.values(links)) {
    const url = new URL(link);
    assert.equal(url.origin, 'https://www.google.com');
    assert.equal(url.username, '');
    assert.equal(url.hash, '');
    assert.equal(url.searchParams.has('next'), false);
  }
  const google = new URL(links.google);
  assert.equal(google.searchParams.get('q'), searchPhrase(input));
  assert.deepEqual([...google.searchParams.keys()], ['q']);
  const maps = new URL(links.maps);
  assert.equal(maps.searchParams.get('api'), '1');
  assert.match(maps.searchParams.get('query')!, /Клініка/);
});

test('Instagram navigation adds a site filter without changing Maps intent or default profile', () => {
  const input = { ...defaultSearch, mode: 'instagram' as const };
  const links = externalSearchLinks(input);
  assert.match(new URL(links.google).searchParams.get('q')!, /^site:instagram\.com /);
  assert.equal(
    new URL(links.google).searchParams.get('q'),
    new URL(links.instagram).searchParams.get('q'),
  );
  assert.ok(!new URL(links.maps).searchParams.get('query')!.includes('site:'));
  assert.equal(defaultSearch.mode, 'web');
  assert.match(searchPhrase(defaultSearch), /Івано-Франківськ Україна$/);
});
