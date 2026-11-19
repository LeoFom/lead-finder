/** Builds external navigation only. No fetch, provider payloads, or persistence. */
export interface TransientQuery {
  city: string;
  query: string;
  mode: 'web' | 'instagram';
}
export const defaultSearch: TransientQuery = {
  city: 'Івано-Франківськ',
  query: 'Стоматологія',
  mode: 'web',
};

export function searchPhrase(input: TransientQuery): string {
  return [
    input.mode === 'instagram' ? 'site:instagram.com' : '',
    input.query.trim(),
    input.city.trim(),
    'Україна',
  ]
    .filter(Boolean)
    .join(' ');
}

export function externalSearchLinks(input: TransientQuery) {
  return {
    google: 'https://www.google.com/search?q=' + encodeURIComponent(searchPhrase(input)),
    maps:
      'https://www.google.com/maps/search/?api=1&query=' +
      encodeURIComponent(
        [input.query.trim(), input.city.trim(), 'Україна'].filter(Boolean).join(' '),
      ),
    instagram:
      'https://www.google.com/search?q=' +
      encodeURIComponent(searchPhrase({ ...input, mode: 'instagram' })),
  };
}
