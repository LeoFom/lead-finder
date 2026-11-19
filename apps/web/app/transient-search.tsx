'use client';
import { useEffect, useState } from 'react';
import { defaultSearch, externalSearchLinks, searchPhrase } from '../lib/transient-search';
import type { TransientQuery } from '../lib/transient-search';

export function TransientSearch() {
  const [input, setInput] = useState<TransientQuery>({ ...defaultSearch });
  const links = externalSearchLinks(input);
  useEffect(() => {
    const clear = () => setInput({ ...defaultSearch });
    const restore = (event: PageTransitionEvent) => {
      if (event.persisted) clear();
    };
    window.addEventListener('pagehide', clear);
    window.addEventListener('pageshow', restore);
    return () => {
      window.removeEventListener('pagehide', clear);
      window.removeEventListener('pageshow', restore);
    };
  }, []);
  return (
    <main className="transient-page">
      <header className="transient-header">
        <a className="brand" href="/" aria-label="Lead Finder — головна">
          <span className="brand-mark">
            L<span>↗</span>
          </span>
          <strong>
            Lead Finder<small>Пошук локальних бізнесів</small>
          </strong>
        </a>
        <a className="outline" href="/crm">
          Мої ручні записи
        </a>
      </header>
      <section className="transient-intro">
        <span className="demo-pill">Без реєстрації · без збереження видачі</span>
        <h1>Lead Finder</h1>
        <p>Вкажіть місто та бізнес — відкрийте готовий пошук.</p>
      </section>
      <section className="transient-card" aria-labelledby="search-title">
        <h2 id="search-title">Що шукаємо?</h2>
        <form
          action="https://www.google.com/search"
          method="GET"
          target="_blank"
          rel="noopener noreferrer"
        >
          <input type="hidden" name="q" value={searchPhrase(input)} />
          <div className="transient-fields">
            <label>
              Місто
              <input
                value={input.city}
                onChange={(e) => setInput({ ...input, city: e.target.value })}
                required
                maxLength={80}
                autoComplete="off"
              />
            </label>
            <label>
              Бізнес або категорія
              <input
                value={input.query}
                onChange={(e) => setInput({ ...input, query: e.target.value })}
                required
                maxLength={160}
                autoComplete="off"
                placeholder="Наприклад, стоматологія або назва клініки"
              />
            </label>
            <label>
              Напрям пошуку
              <select
                value={input.mode}
                onChange={(e) =>
                  setInput({ ...input, mode: e.target.value as TransientQuery['mode'] })
                }
              >
                <option value="web">Сайти та вебсторінки</option>
                <option value="instagram">Профілі Instagram</option>
              </select>
            </label>
          </div>
          <div className="transient-actions">
            <button className="primary" disabled={!input.city.trim() || !input.query.trim()}>
              Шукати в Google ↗
            </button>
            <button
              type="button"
              className="outline"
              onClick={() => setInput({ ...defaultSearch })}
            >
              Скинути запит
            </button>
          </div>
          <p className="transient-note">
            Відкриється нова вкладка Google. Lead Finder не отримує та не зберігає пошукову видачу.
          </p>
        </form>
      </section>
      <section className="transient-card" aria-labelledby="external-title">
        <h2 id="external-title">Ще два способи перевірити</h2>
        <div className="transient-options">
          <a
            className="transient-option"
            href={links.maps}
            target="_blank"
            rel="noopener noreferrer"
            referrerPolicy="no-referrer"
          >
            <strong>Google Maps ↗</strong>
            <span>Відкрити пошук бізнесів за вашим запитом і містом на карті.</span>
          </a>
          <a
            className="transient-option"
            href={links.instagram}
            target="_blank"
            rel="noopener noreferrer"
            referrerPolicy="no-referrer"
          >
            <strong>Знайти Instagram ↗</strong>
            <span>
              Відкрити Google із фільтром site:instagram.com. Контент профілів не завантажується в
              застосунок.
            </span>
          </a>
        </div>
      </section>
      <section className="transient-card transient-privacy" aria-labelledby="privacy-title">
        <h2 id="privacy-title">Пошук без накопичення</h2>
        <p>
          Без API-ключів, реєстрації та підключення до БД. Запит використовується лише для
          зовнішнього переходу. Списки, контакти й пошукова історія до Lead Finder не імпортуються;
          експорту видачі немає.
        </p>
        <p>
          Результати переглядаються на сторонніх сайтах за їхніми правилами. Назва в пошуку не
          підтверджує діяльність бізнесу, а посилання на Instagram — офіційність профілю.
        </p>
        <a href="/search/terms">Як працює пошук і приватність →</a>
      </section>
      <footer className="transient-footer">
        <span>
          Для зовнішнього пошуку потрібен інтернет. Render і CRM-база для цього екрана не потрібні.
        </span>
      </footer>
    </main>
  );
}
