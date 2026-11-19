'use client';
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { api } from '../lib/api-gateway';
import { LeadWorkspace } from './workspace';
import { LocalAccess, useLocalMode, useGuestMode } from './local-access';
import { chooseServer, forgetLocalKey, lockLocal, localSnapshotAt } from '../lib/offline-vault';
import { setWorkspaceMode } from '../lib/workspace-mode';
import { guestWarning } from '../lib/guest-store';
import { prepareOfflineShell } from '../lib/offline-shell';

export function PrivateApp() {
  const [authenticated, setAuthenticated] = useState(false);
  const [setup, setSetup] = useState(false);
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState('');
  const [showLogin, setShowLogin] = useState(false);
  const [localOpen, setLocalOpen] = useState(false);
  const [warning, setWarning] = useState('');
  const local = useLocalMode();
  const guest = useGuestMode();
  useEffect(() => {
    void prepareOfflineShell().catch(() => {});
  }, []);
  useEffect(() => {
    const update = () => setWarning(guestWarning());
    update();
    window.addEventListener('lead-guest-storage', update);
    return () => window.removeEventListener('lead-guest-storage', update);
  }, []);
  function returnToGuest() {
    forgetLocalKey();
    setWorkspaceMode('guest');
    setAuthenticated(false);
    setShowLogin(false);
  }
  useEffect(() => {
    const open = () => {
      setShowLogin(true);
      setError('');
      setChecking(true);
      api<{ setupRequired: boolean }>('auth/status')
        .then((s) => setSetup(s.setupRequired))
        .catch(() =>
          setError('Сервер або БД недоступні. Закрийте вікно й продовжуйте роботу як гість.'),
        )
        .finally(() => setChecking(false));
    };
    const leave = () => {
      void api('auth/logout', {}, 'POST')
        .finally(() => {
          forgetLocalKey();
          setWorkspaceMode('guest');
          setAuthenticated(false);
          setShowLogin(false);
        })
        .catch(() => {});
    };
    window.addEventListener('lead-open-login', open);
    window.addEventListener('lead-leave-account', leave);
    return () => {
      window.removeEventListener('lead-open-login', open);
      window.removeEventListener('lead-leave-account', leave);
    };
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
      forgetLocalKey();
      chooseServer();
      setAuthenticated(true);
      setShowLogin(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Помилка входу');
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <LeadWorkspace key={guest ? 'guest' : local ? 'local' : 'server'} />
      <div className="local-tools">
        {guest ? (
          <>
            <span role="status">
              {warning ||
                'Гість · дані в цьому браузері. На спільному пристрої використайте захищений простір.'}
            </span>
            <button onClick={() => setLocalOpen(true)}>Захищений локальний простір</button>
          </>
        ) : local ? (
          <>
            <span>
              Захищена локальна база від{' '}
              {new Date(localSnapshotAt() ?? '').toLocaleDateString('uk-UA')}
            </span>
            <button onClick={lockLocal}>Заблокувати</button>
            <button onClick={returnToGuest}>До гостьового простору</button>
          </>
        ) : (
          <>
            <span>Серверна CRM · гостьові записи залишаються окремо</span>
            <button onClick={() => setLocalOpen(true)}>Підготувати захищену копію</button>
          </>
        )}
      </div>
      {localOpen && (
        <LocalAccess
          authenticated={authenticated && !guest && !local}
          close={() => setLocalOpen(false)}
          complete={() => setLocalOpen(false)}
        />
      )}
      {showLogin && (
        <dialog
          className="search-dialog"
          aria-labelledby="login-title"
          ref={(node) => {
            if (node && !node.open) node.showModal();
          }}
          onCancel={(e) => {
            if (busy) e.preventDefault();
            else setShowLogin(false);
          }}
        >
          <form onSubmit={submit}>
            <div className="inspector-top">
              <h2 id="login-title">{setup ? 'Налаштування власника' : 'Вхід в акаунт'}</h2>
              <button
                type="button"
                disabled={busy}
                onClick={() => setShowLogin(false)}
                aria-label="Закрити вхід"
              >
                ✕
              </button>
            </div>
            <p className="muted">
              Ваш гостьовий простір зберігається в цьому браузері. Вхід відкриє окрему серверну CRM.
            </p>
            {checking && <p role="status">Перевірка доступності сервера…</p>}
            {setup && (
              <label>
                Код налаштування власника
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
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            <button className="primary full" disabled={busy || checking}>
              {busy ? 'Вхід…' : setup ? 'Створити простір власника' : 'Увійти'}
            </button>
            <button
              className="outline full"
              type="button"
              disabled={busy}
              onClick={() => setShowLogin(false)}
            >
              Продовжити як гість
            </button>
          </form>
        </dialog>
      )}
    </>
  );
}
