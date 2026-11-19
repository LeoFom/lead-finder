export async function prepareOfflineShell() {
  if (!('serviceWorker' in navigator)) return;
  await navigator.serviceWorker.register('/sw.js', { scope: '/' });
  const registration = await navigator.serviceWorker.ready;
  const paths = [
    ...Array.from(
      document.querySelectorAll<HTMLScriptElement>('script[src]'),
      (element) => element.src,
    ),
    ...Array.from(
      document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]'),
      (element) => element.href,
    ),
  ].filter((url) => url.startsWith(location.origin + '/_next/static/'));
  registration.active?.postMessage({ type: 'CACHE_SHELL', paths });
}
