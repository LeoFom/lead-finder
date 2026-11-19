'use client';
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { api, isApiMode } from '../lib/api-gateway';
import { LeadWorkspace } from './workspace';
import { LocalAccess, useLocalMode } from './local-access';
import { chooseServer, prefersLocal, lockLocal, localSnapshotAt } from '../lib/offline-vault';
import { prepareOfflineShell } from '../lib/offline-shell';

export function PrivateApp() {
  const [authenticated, setAuthenticated] = useState(!isApiMode);
  const [setup, setSetup] = useState(false);
  const [busy, setBusy] = useState(isApiMode);
  const [error, setError] = useState('');
  const [localOpen, setLocalOpen] = useState(false);
  const local = useLocalMode();
  const [localPreferred, setLocalPreferred] = useState(false);
  useEffect(() => {
    void prepareOfflineShell().catch(() => {});
  }, []);
  useEffect(() => {
    if (!isApiMode) return;
    let preferred = false;
    try {
      preferred = prefersLocal();
    } catch {
      /* Server mode also works with browser storage disabled. */
    }
    if (preferred) {
      setLocalPreferred(true);
      setLocalOpen(true);
      setBusy(false);
      return;
    }
    api('auth/me')
      .then(() => setAuthenticated(true))
      .catch(() =>
        api<{ setupRequired: boolean }>('auth/status')
          .then((s) => setSetup(s.setupRequired))
          .catch((e) => setError(String(e.message))),
      )
      .finally(() => setBusy(false));
  }, []);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const data = new FormData(e.currentTarget);
    try {
      await api(
        'auth/' + (setup ? 'setup' : 'login'),
        {
          email: data.get('email'),
          password: data.get('password'),
          ...(setup ? { token: data.get('token') } : {}),
        },
        'POST',
      );
      setAuthenticated(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Помилка входу');
    } finally {
      setBusy(false);
    }
  }
  const tools = isApiMode && (
    <div className="local-tools">
      {local ? (
        <>
          <span>
            Локальна база від {new Date(localSnapshotAt() ?? '').toLocaleDateString('uk-UA')} · без
            автоматичної синхронізації
          </span>
          <button onClick={lockLocal}>Заблокувати</button>
          <button
            onClick={() => {
              chooseServer();
              window.location.reload();
            }}
          >
            До серверної CRM
          </button>
        </>
      ) : (
        <button onClick={() => setLocalOpen(true)}>Локальний простір без БД</button>
      )}
    </div>
  );
  const gate = localOpen && (
    <LocalAccess
      authenticated={authenticated}
      close={() => setLocalOpen(false)}
      complete={() => {
        setLocalOpen(false);
        setLocalPreferred(false);
      }}
    />
  );
  if (local || (authenticated && !localPreferred))
    return (
      <>
        <LeadWorkspace key={local ? 'local' : 'server'} />
        {tools}
        {gate}
      </>
    );
  return (
    <>
      <main className="auth-page">
        <form onSubmit={submit} className="auth-card" hidden={localPreferred}>
          <h1>Lead Finder</h1>
          <h2>{setup ? 'Створення простору власника' : 'Увійдіть у свій простір'}</h2>
          <p className="muted">
            {setup
              ? 'Використайте приватний код початкового налаштування. Після створення власника цей код більше не працює.'
              : 'CRM та історія бізнесів доступні лише вам.'}
          </p>
          {setup && (
            <label>
              Код налаштування
              <input name="token" type="password" required autoComplete="off" />
            </label>
          )}
          <label>
            Електронна пошта
            <input name="email" type="email" required maxLength={254} autoComplete="username" />
          </label>
          <label>
            Пароль
            <input
              name="password"
              type="password"
              required
              minLength={12}
              maxLength={128}
              autoComplete={setup ? 'new-password' : 'current-password'}
            />
          </label>
          {setup && <p className="muted">Щонайменше 12 символів.</p>}
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <button className="primary full" disabled={busy}>
            {busy ? 'З’єднання…' : setup ? 'Створити простір' : 'Увійти'}
          </button>
        </form>
        {localPreferred && (
          <div className="auth-card">
            <h1>Lead Finder</h1>
            <p>Локальну базу заблоковано.</p>
            <button className="primary" onClick={() => setLocalOpen(true)}>
              Розблокувати локальну базу
            </button>
            <button
              className="outline"
              onClick={() => {
                chooseServer();
                window.location.reload();
              }}
            >
              До серверної CRM
            </button>
          </div>
        )}
      </main>
      {tools}
      {gate}
    </>
  );
}
