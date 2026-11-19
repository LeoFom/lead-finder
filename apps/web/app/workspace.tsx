'use client';

import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { leadGateway } from '../lib/gateway';
import { addBusiness, exportBusinesses } from '../lib/api-gateway';
import { useLocalMode, useGuestMode } from './local-access';
import { lockLocal } from '../lib/offline-vault';
import type { CrmPatch } from '../lib/gateway';
import { crmLabels } from '../lib/model';
import type { Business, DemoState } from '../lib/model';

const date = (s: string) =>
  new Date(s).toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' });
const navigation = ['Бізнеси', 'CRM', 'Історія змін', 'Запуски пошуку'] as const;
type View = (typeof navigation)[number];

function Editor({
  business,
  close,
  save,
}: {
  business: Business;
  close: () => void;
  save: (patch: CrmPatch) => Promise<void>;
}) {
  const [draft, setDraft] = useState<CrmPatch>({
    crm: business.crm,
    priority: business.priority,
    notes: business.notes,
    website: business.website,
    websiteLocked: business.websiteLocked,
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await save(draft);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не вдалося зберегти.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <dialog
      ref={(node) => {
        if (node && !node.open) node.showModal();
      }}
      onCancel={close}
      className="inspector"
      aria-labelledby="business-title"
    >
      <div className="inspector-top">
        <span>Картка бізнесу</span>
        <button autoFocus onClick={close} aria-label="Закрити картку">
          ✕
        </button>
      </div>
      <div className="avatar large">{business.name.slice(0, 1)}</div>
      <h2 id="business-title">{business.name}</h2>
      <p className="muted">{business.address}</p>
      <div className="detail-facts">
        <span>
          Стан бізнесу<strong>Не підтверджено</strong>
        </span>
        <span>
          Перше виявлення<strong>{date(business.firstSeen)}</strong>
        </span>
        <span>
          Останнє виявлення<strong>{date(business.lastSeen)}</strong>
        </span>
        <span>
          Походження<strong>Власна ручна перевірка</strong>
        </span>
      </div>
      <form onSubmit={submit}>
        <h3>Робота з контактом</h3>
        <label>
          Статус CRM
          <select
            value={draft.crm}
            onChange={(e) => setDraft({ ...draft, crm: e.target.value as Business['crm'] })}
          >
            {Object.entries(crmLabels).map(([key, text]) => (
              <option key={key} value={key}>
                {text}
              </option>
            ))}
          </select>
        </label>
        {draft.crm === 'do_not_contact' && (
          <p className="notice">Комунікацію з цим контактом заборонено.</p>
        )}
        <label>
          Пріоритет
          <select
            value={draft.priority}
            onChange={(e) =>
              setDraft({ ...draft, priority: e.target.value as Business['priority'] })
            }
          >
            <option>Звичайний</option>
            <option>Високий</option>
          </select>
        </label>
        <label>
          Сайт
          <input
            maxLength={200}
            value={draft.website}
            onChange={(e) => setDraft({ ...draft, website: e.target.value, websiteLocked: true })}
            placeholder="clinic.example"
          />
        </label>
        <label className="check-label">
          <input
            type="checkbox"
            checked={draft.websiteLocked}
            onChange={(e) => setDraft({ ...draft, websiteLocked: e.target.checked })}
          />
          Захистити ручне значення сайту від імпорту
        </label>
        <label>
          Нотатки
          <textarea
            rows={4}
            maxLength={3000}
            value={draft.notes}
            onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
            placeholder="Деталі розмови, наступний крок…"
          />
        </label>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <button disabled={busy} className="primary full">
          {busy ? 'Збереження…' : 'Зберегти зміни'}
        </button>
      </form>
    </dialog>
  );
}

export function LeadWorkspace() {
  const local = useLocalMode();
  const guest = useGuestMode();
  const [state, setState] = useState<DemoState | null>(null);
  const [view, setView] = useState<View>('Бізнеси');
  const [filter, setFilter] = useState('all');
  const [term, setTerm] = useState('');
  const [sort, setSort] = useState('default');
  const [selected, setSelected] = useState<string[]>([]);
  const [opened, setOpened] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  useEffect(() => {
    const onCachedReport = (event: Event) =>
      setMessage(
        'Звіт сформовано з дозволеної копії станом на ' +
          new Date((event as CustomEvent<string>).detail).toLocaleString('uk-UA'),
      );
    window.addEventListener('lead-cached-report', onCachedReport);
    return () => window.removeEventListener('lead-cached-report', onCachedReport);
  }, []);
  useEffect(() => {
    leadGateway
      .load()
      .then(setState)
      .catch(() =>
        setError('Не вдалося завантажити базу. Оновіть сторінку або увійдіть повторно.'),
      );
  }, []);
  const workspace = state?.workspaces[state.activeKey];
  async function scan() {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await new Promise((resolve) => setTimeout(resolve, 700));
      setState(await leadGateway.scan());
      setMessage('Демоскан завершено. Історію та ручні CRM-правки збережено.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не вдалося оновити пошук.');
    } finally {
      setBusy(false);
    }
  }
  async function search(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    setBusy(true);
    try {
      setState(
        await leadGateway.selectProfile({
          city: String(data.get('city')),
          query: String(data.get('query')).trim(),
        }),
      );
      setSearchOpen(false);
      setSelected([]);
      setOpened(null);
      setFilter('all');
      setTerm('');
      setView('Бізнеси');
      setMessage('Профіль пошуку відкрито.');
    } catch {
      setError('Не вдалося відкрити профіль.');
    } finally {
      setBusy(false);
    }
  }
  if (!workspace)
    return (
      <main className="loading">
        <h1>Lead Finder</h1>
        <p role="status">{error || 'Завантаження робочого простору…'}</p>
      </main>
    );
  const rows = workspace.businesses
    .filter(
      (b) =>
        `${b.name} ${b.website} ${b.address}`
          .toLocaleLowerCase('uk')
          .includes(term.toLocaleLowerCase('uk')) &&
        (filter !== 'no-site' || !b.website) &&
        (filter !== 'instagram' || (!!b.instagram && !b.website)) &&
        (filter !== 'priority' || b.priority === 'Високий') &&
        (filter !== 'missing' || ['missing_once', 'missing_multiple'].includes(b.discovery)) &&
        (filter !== 'new' || b.firstSeen === workspace.runs[0]?.at) &&
        (view !== 'CRM' || b.crm !== 'new'),
    )
    .sort((a, b) =>
      sort === 'name'
        ? a.name.localeCompare(b.name, 'uk')
        : sort === 'priority'
          ? Number(b.priority === 'Високий') - Number(a.priority === 'Високий')
          : 0,
    );
  const business = workspace.businesses.find((b) => b.id === opened);
  async function exportCsv() {
    const exportRows = selected.length ? rows.filter((b) => selected.includes(b.id)) : rows;
    try {
      await exportBusinesses(exportRows.map((b) => b.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Помилка експорту');
    }
  }
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="/">
          <span className="brand-mark">
            L<span>↗</span>
          </span>
          <strong>
            Lead Finder<small>Ваш наступний клієнт</small>
          </strong>
        </a>
        <div className="workspace-label">Робочий простір</div>
        <nav aria-label="Основна навігація">
          {navigation.map((item, i) => (
            <button
              key={item}
              className={view === item ? 'nav-item active' : 'nav-item'}
              onClick={() => {
                setView(item);
                setSelected([]);
              }}
            >
              <span aria-hidden>{['▦', '◉', '↺', '◷'][i]}</span>
              {item}
              {item === 'Бізнеси' && <small>{workspace.businesses.length}</small>}
            </button>
          ))}
        </nav>
        <div className="sidebar-note">
          <span className="demo-dot" />
          {guest ? 'Гостьовий простір' : local ? 'Локальна база' : 'Приватний простір'}
          <p>
            {guest
              ? 'Дані зберігаються в цьому браузері без пароля. Сервер та реєстрація не потрібні.'
              : local
                ? 'Зашифровані дані в цьому браузері. Пошук і CSV працюють без API.'
                : 'Ваші бізнеси, CRM та історія зберігаються у PostgreSQL.'}
          </p>
        </div>
        <div className="user">
          <span className="user-avatar">{guest ? 'Г' : 'ЛФ'}</span>
          <div>
            Мій простір<small>{guest ? 'Гість' : 'Власник'}</small>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <span>
            Мій простір <span className="breadcrumb">/ {view}</span>
          </span>
          <div className="header-actions">
            <span className="demo-pill">
              {guest ? 'Гостьовий режим' : local ? 'Локально · без БД' : 'Приватна CRM'}
            </span>
            <button
              onClick={async () => {
                try {
                  if (guest) {
                    window.dispatchEvent(new Event('lead-open-login'));
                    return;
                  }
                  if (local) {
                    lockLocal();
                    return;
                  }
                  window.dispatchEvent(new Event('lead-leave-account'));
                } catch {
                  setError('Не вдалося вийти');
                }
              }}
            >
              {guest ? 'Увійти' : local ? 'Заблокувати' : 'Вийти в гостьовий режим'}
            </button>
          </div>
        </header>
        <main className="content">
          <div className="page-heading">
            <div>
              <h1>Lead Finder</h1>
              <p>Знаходьте бізнеси. Вибудовуйте відносини.</p>
            </div>
            <button className="primary" disabled={busy} onClick={() => setSearchOpen(true)}>
              ＋ Новий пошук
            </button>
          </div>
          <section className="profile-strip" aria-label="Активний профіль">
            <div className="location-icon" aria-hidden>
              ⌖
            </div>
            <div>
              <h2>
                {workspace.profile.city} <span>Україна</span>
              </h2>
              <p>
                {workspace.profile.query}{' '}
                <span className="subtle">
                  {workspace.runs[0]
                    ? '· Оновлено ' + date(workspace.runs[0].at)
                    : '· Пошукове джерело очікує підключення'}
                </span>
              </p>
            </div>
            <button
              className="outline"
              disabled={busy}
              onClick={() => {
                if (local || guest) {
                  document
                    .querySelector<HTMLInputElement>('[aria-label="Пошук у таблиці"]')
                    ?.focus();
                  setMessage('Пошук працює серед локально збережених бізнесів.');
                } else {
                  void scan();
                }
              }}
            >
              {local || guest ? 'Пошук у збереженій базі' : busy ? 'Оновлюємо…' : '↻ Оновити пошук'}
            </button>
          </section>
          {busy && (
            <div className="progress" role="status">
              Обробка запиту…
            </div>
          )}
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          {message && (
            <div className="feedback" role="status">
              {message}
              <button onClick={() => setMessage('')} aria-label="Приховати повідомлення">
                ✕
              </button>
            </div>
          )}
          <section className="metrics" aria-label="Статистика">
            {[
              ['Усього бізнесів', workspace.businesses.length, 'У вашій базі'],
              [
                'Сайт не виявлено',
                workspace.businesses.filter((b) => !b.website).length,
                'Можливість для знайомства',
              ],
              [
                'У роботі',
                workspace.businesses.filter(
                  (b) => !['new', 'lost', 'do_not_contact'].includes(b.crm),
                ).length,
                'Активні контакти CRM',
              ],
              ['Зміни', workspace.changes.length, 'Збережені події історії'],
            ].map(([label, count, description]) => (
              <div key={label}>
                <span>{label}</span>
                <strong>{count}</strong>
                <small>{description}</small>
              </div>
            ))}
          </section>
          {view === 'Бізнеси' || view === 'CRM' ? (
            <section className="results">
              <div className="results-title">
                <h2>
                  {view === 'CRM' ? 'Контакти у роботі' : 'База бізнесів'}{' '}
                  <span>{rows.length}</span>
                </h2>
                <div className="header-actions">
                  <button className="primary" onClick={() => setAddOpen(true)}>
                    ＋ Додати бізнес
                  </button>
                  <button className="outline" onClick={exportCsv} disabled={!rows.length}>
                    ↓ Експорт CSV{selected.length ? ` (${selected.length})` : ''}
                  </button>
                </div>
              </div>
              <div className="table-toolbar">
                <label className="search-field">
                  <span aria-hidden>⌕</span>
                  <input
                    aria-label="Пошук у таблиці"
                    placeholder="Назва, адреса або домен…"
                    value={term}
                    onChange={(e) => {
                      setTerm(e.target.value);
                      setSelected([]);
                    }}
                  />
                </label>
                <select
                  aria-label="Фільтр бізнесів"
                  value={filter}
                  onChange={(e) => {
                    setFilter(e.target.value);
                    setSelected([]);
                  }}
                >
                  <option value="all">Усі бізнеси</option>
                  <option value="no-site">Сайт не виявлено</option>
                  <option value="instagram">Instagram є, сайт не виявлено</option>
                  <option value="priority">Високий пріоритет</option>
                  <option value="missing">Не знайдено у скані</option>
                  <option value="new">Нові в останньому скані</option>
                </select>
                <select
                  aria-label="Сортування"
                  value={sort}
                  onChange={(e) => setSort(e.target.value)}
                >
                  <option value="default">За додаванням</option>
                  <option value="name">За назвою</option>
                  <option value="priority">За пріоритетом</option>
                </select>
              </div>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>
                        <input
                          type="checkbox"
                          aria-label="Вибрати всі"
                          checked={rows.length > 0 && rows.every((b) => selected.includes(b.id))}
                          onChange={(e) =>
                            setSelected(e.target.checked ? rows.map((b) => b.id) : [])
                          }
                        />
                      </th>
                      <th>Бізнес</th>
                      <th>Сайт</th>
                      <th>Instagram</th>
                      <th>Статус CRM</th>
                      <th>Останнє виявлення</th>
                      <th aria-label="Дії" />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((b, i) => (
                      <tr key={b.id}>
                        <td>
                          <input
                            type="checkbox"
                            aria-label={`Вибрати ${b.name}`}
                            checked={selected.includes(b.id)}
                            onChange={(e) =>
                              setSelected(
                                e.target.checked
                                  ? [...selected, b.id]
                                  : selected.filter((id) => id !== b.id),
                              )
                            }
                          />
                        </td>
                        <td>
                          <button className="business-cell" onClick={() => setOpened(b.id)}>
                            <span className={`avatar tone-${i % 4}`}>{b.name.slice(0, 1)}</span>
                            <span>
                              <strong>
                                {b.name}
                                {b.priority === 'Високий' && (
                                  <span className="star" aria-label="Високий пріоритет">
                                    {' '}
                                    ★
                                  </span>
                                )}
                              </strong>
                              <small>{b.address}</small>
                            </span>
                          </button>
                        </td>
                        <td>
                          {b.website ? (
                            <span className="domain">
                              {b.website}
                              {b.websiteLocked ? ' ⌑' : ''}
                            </span>
                          ) : (
                            <span className="not-found">● Не виявлено</span>
                          )}
                        </td>
                        <td>
                          {b.instagram ? (
                            <span className="social">@{b.instagram}</span>
                          ) : (
                            <span className="muted">Не виявлено</span>
                          )}
                        </td>
                        <td>
                          <span className={`status status-${b.crm}`}>{crmLabels[b.crm]}</span>
                        </td>
                        <td>
                          {date(b.lastSeen)}
                          {b.discovery !== 'seen' && (
                            <small className="discovery">
                              {
                                {
                                  unchecked: 'Не перевірено джерелом',
                                  seen: 'Виявлено',
                                  missing_once: 'Не знайдено у скані',
                                  missing_multiple: 'Повторно не знайдено',
                                  reappeared: 'Повторно знайдено',
                                }[b.discovery]
                              }
                            </small>
                          )}
                        </td>
                        <td>
                          <button
                            className="row-open"
                            onClick={() => setOpened(b.id)}
                            aria-label={`Відкрити ${b.name}`}
                          >
                            ↗
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!rows.length && (
                <div className="empty">
                  <h3>Бізнесів за цими умовами немає</h3>
                  <p>Змініть фразу або фільтр.</p>
                  <button
                    className="outline"
                    onClick={() => {
                      setTerm('');
                      setFilter('all');
                    }}
                  >
                    Скинути фільтри
                  </button>
                </div>
              )}
              <footer className="table-footer">
                <span>
                  Показано {rows.length} із {workspace.businesses.length}
                  {selected.length ? ` · вибрано ${selected.length}` : ''}
                </span>
                <span>Власні незалежні спостереження</span>
              </footer>
            </section>
          ) : view === 'Історія змін' ? (
            <section className="results activity">
              <h2>Історія змін</h2>
              <p className="muted">Попередні значення та власні правки залишаються в базі.</p>
              {workspace.changes.length ? (
                workspace.changes.map((c) => (
                  <button className="event" key={c.id} onClick={() => setOpened(c.businessId)}>
                    <span className="event-dot" />
                    <span>
                      <strong>{c.name}</strong>
                      <small>{c.text}</small>
                    </span>
                    <time>{date(c.at)}</time>
                  </button>
                ))
              ) : (
                <div className="empty">Оновіть пошук або змініть CRM, щоб побачити історію.</div>
              )}
            </section>
          ) : (
            <section className="results activity">
              <h2>Запуски пошуку</h2>
              <p className="muted">
                Пошукове джерело очікує підключення. Перевірені бізнеси можна додавати вручну.
              </p>
              {workspace.runs.map((run) => (
                <div className="run" key={run.id}>
                  <div>
                    <strong>Демонстраційний знімок {['A', 'B', 'C'][run.snapshot]}</strong>
                    <small>{date(run.at)} · Повне охоплення демонабору</small>
                  </div>
                  <span>+{run.created} нових</span>
                  <span>{run.changed} змін</span>
                  <span className="status status-interested">Завершено</span>
                </div>
              ))}
            </section>
          )}
          <p className="footnote">
            Відсутність бізнесу в джерелі потребує перевірки. Історія та CRM зберігаються.
          </p>
        </main>
      </div>
      {business && (
        <Editor
          key={business.id}
          business={business}
          close={() => setOpened(null)}
          save={async (patch) => {
            setState(await leadGateway.updateBusiness(business.id, patch));
            setOpened(null);
            setMessage(
              guest
                ? 'Гостьові зміни збережено в цьому браузері.'
                : local
                  ? 'Зміни збережено в зашифрованій локальній базі.'
                  : 'Ручні зміни збережено в базі.',
            );
          }}
        />
      )}
      {searchOpen && (
        <dialog
          ref={(node) => {
            if (node && !node.open) node.showModal();
          }}
          onCancel={() => setSearchOpen(false)}
          className="search-dialog"
          aria-labelledby="search-title"
        >
          <form onSubmit={search}>
            <div className="inspector-top">
              <h2 id="search-title">Новий пошук</h2>
              <button type="button" onClick={() => setSearchOpen(false)} aria-label="Закрити пошук">
                ✕
              </button>
            </div>
            <p className="muted">Створіть профіль для міста й категорії бізнесів.</p>
            <label>
              Країна
              <input value="Україна" readOnly />
            </label>
            <label>
              Місто
              <select name="city" defaultValue={workspace.profile.city}>
                <option>Івано-Франківськ</option>
                <option>Львів</option>
                <option>Київ</option>
                <option>Тернопіль</option>
              </select>
            </label>
            <label>
              Запит
              <input
                name="query"
                required
                maxLength={80}
                defaultValue={workspace.profile.query}
                placeholder="Наприклад, стоматологія"
                pattern=".*\S.*"
              />
            </label>
            <p className="notice">
              Кожне місто й запит мають окремий профіль. Попередні записи зберігаються.
            </p>
            <button className="primary full" disabled={busy}>
              Відкрити профіль
            </button>
          </form>
        </dialog>
      )}
      {addOpen && (
        <AddBusiness
          close={() => setAddOpen(false)}
          save={async (input) => {
            setState(await addBusiness(input));
            setAddOpen(false);
            setMessage('Бізнес додано до бази.');
          }}
        />
      )}
    </div>
  );
}

function AddBusiness({
  close,
  save,
}: {
  close: () => void;
  save: (input: {
    name: string;
    address: string;
    website: string;
    independentObservation: boolean;
  }) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const form = new FormData(e.currentTarget);
    try {
      await save({
        name: String(form.get('name')),
        address: String(form.get('address')),
        website: String(form.get('website')),
        independentObservation: form.get('rights') === 'on',
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не вдалося додати бізнес');
    } finally {
      setBusy(false);
    }
  }
  return (
    <dialog
      className="search-dialog"
      ref={(node) => {
        if (node && !node.open) node.showModal();
      }}
      onCancel={close}
    >
      <form onSubmit={submit}>
        <div className="inspector-top">
          <h2>Додати бізнес</h2>
          <button type="button" onClick={close} aria-label="Закрити">
            ✕
          </button>
        </div>
        <label>
          Назва
          <input name="name" required maxLength={200} />
        </label>
        <label>
          Адреса
          <input name="address" required maxLength={300} />
        </label>
        <label>
          Сайт
          <input name="website" maxLength={500} placeholder="https://clinic.example" />
        </label>
        <label className="check-label">
          <input name="rights" type="checkbox" required />
          Це мої незалежно перевірені дані, які дозволено зберігати та експортувати. Контент Google
          Maps або пошукової видачі сюди не переношу.
        </label>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <button className="primary full" disabled={busy}>
          Зберегти бізнес
        </button>
      </form>
    </dialog>
  );
}
