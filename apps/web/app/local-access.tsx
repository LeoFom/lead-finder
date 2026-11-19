'use client';
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { api } from '../lib/api-gateway';
import type { DemoState } from '../lib/model';
import {
  chooseLocal,
  createLocalVault,
  hasLocalVault,
  isLocalMode,
  unlockLocal,
} from '../lib/offline-vault';
export function useLocalMode() {
  const [local, setLocal] = useState(false);
  useEffect(() => {
    const update = () => setLocal(isLocalMode());
    update();
    window.addEventListener('lead-storage-mode', update);
    return () => window.removeEventListener('lead-storage-mode', update);
  }, []);
  return local;
}
export function LocalAccess({
  authenticated,
  close,
  complete,
}: {
  authenticated: boolean;
  close: () => void;
  complete: () => void;
}) {
  const [existing, setExisting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [copyServer, setCopyServer] = useState(authenticated);
  const [error, setError] = useState('');
  useEffect(() => {
    try {
      setExisting(hasLocalVault());
    } catch {
      setError('Сховище браузера недоступне');
    }
  }, []);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const form = new FormData(e.currentTarget),
      password = String(form.get('password'));
    try {
      if (existing) await unlockLocal(password);
      else {
        if (password !== form.get('confirm')) throw new Error('Паролі не збігаються');
        const snapshot = copyServer
          ? await api<{ state: DemoState }>('offline-snapshot')
          : undefined;
        await createLocalVault(password, snapshot?.state);
      }
      chooseLocal();
      complete();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не вдалося відкрити локальну базу');
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
      className="search-dialog"
      aria-labelledby="local-title"
    >
      <form onSubmit={submit}>
        <div className="inspector-top">
          <h2 id="local-title">{existing ? 'Відкрити локальну базу' : 'Створити локальну базу'}</h2>
          <button type="button" onClick={close} aria-label="Закрити">
            ✕
          </button>
        </div>
        <p className="muted">
          Локальні бізнеси, CRM та звіти працюють у цьому браузері без API і БД. Дані зашифровані
          вашим окремим паролем.
        </p>
        {!existing && authenticated && (
          <label className="check-label">
            <input
              type="checkbox"
              checked={copyServer}
              onChange={(e) => setCopyServer(e.target.checked)}
            />
            Почати з дозволеної копії серверної бази
          </label>
        )}
        {!existing && !copyServer && (
          <p className="notice">
            Буде створено порожній простір. Попередні серверні дані доступні лише у заздалегідь
            підготовленій копії.
          </p>
        )}
        <label>
          Пароль локальної бази
          <input
            name="password"
            type="password"
            minLength={12}
            required
            autoComplete={existing ? 'current-password' : 'new-password'}
          />
        </label>
        {!existing && (
          <label>
            Повторіть пароль
            <input
              name="confirm"
              type="password"
              minLength={12}
              required
              autoComplete="new-password"
            />
          </label>
        )}
        <p className="notice">
          Пароль не надсилається на сервер. Відновити його неможливо. Очищення даних браузера
          видалить локальну базу. Локальні правки не надсилаються до серверної CRM автоматично.
        </p>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <button disabled={busy} className="primary full">
          {busy ? 'Відкриття…' : existing ? 'Розблокувати локальну базу' : 'Створити локальну базу'}
        </button>
      </form>
    </dialog>
  );
}
