import type { DemoState } from './model.ts';
import { emptyLocalState } from './offline-model.ts';
import { getWorkspaceMode, setWorkspaceMode } from './workspace-mode.ts';
const vaultKey = 'lead-finder-private-vault-v1';
const preference = 'lead-finder-local-preferred';
interface Envelope {
  version: 1;
  salt: string;
  iv: string;
  ciphertext: string;
  revision: number;
}
interface Payload {
  state: DemoState;
  snapshotAt: string;
}
let session: { key: CryptoKey; envelope: Envelope; payload: Payload } | null = null;
const toBase64 = (data: Uint8Array) =>
  btoa(Array.from(data, (n) => String.fromCharCode(n)).join(''));
const fromBase64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const buffer = (value: Uint8Array) => value.buffer as ArrayBuffer;
export async function deriveVaultKey(passphrase: string, salt: Uint8Array) {
  if (passphrase.length < 12)
    throw new Error('Пароль локального простору має містити щонайменше 12 символів');
  const material = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt: buffer(salt), iterations: 210000 },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}
export async function sealVault(key: CryptoKey, text: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const result = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: buffer(iv) },
    key,
    new TextEncoder().encode(text),
  );
  return { iv: toBase64(iv), ciphertext: toBase64(new Uint8Array(result)) };
}
export async function openVault(key: CryptoKey, sealed: { iv: string; ciphertext: string }) {
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: buffer(fromBase64(sealed.iv)) },
    key,
    buffer(fromBase64(sealed.ciphertext)),
  );
  return new TextDecoder().decode(plain);
}
export function hasLocalVault() {
  return localStorage.getItem(vaultKey) !== null;
}
export function prefersLocal() {
  return localStorage.getItem(preference) === 'true';
}
export function isLocalMode() {
  return getWorkspaceMode() === 'local';
}
export function localUnlocked() {
  return session !== null;
}
export function localSnapshotAt() {
  return session?.payload.snapshotAt;
}
export function chooseLocal() {
  if (!session) throw new Error('Розблокуйте локальний простір');
  localStorage.setItem(preference, 'true');
  setWorkspaceMode('local');
}
export function chooseServer() {
  localStorage.removeItem(preference);
  setWorkspaceMode('server');
  session = null;
}
export function lockLocal() {
  session = null;
  window.location.reload();
}
export function forgetLocalKey() {
  session = null;
}
export async function createLocalVault(passphrase: string, state = emptyLocalState()) {
  if (hasLocalVault())
    throw new Error('Локальний простір уже існує. Розблокуйте його своїм паролем.');
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await deriveVaultKey(passphrase, salt);
  const payload: Payload = { state, snapshotAt: new Date().toISOString() };
  const sealed = await sealVault(key, JSON.stringify(payload));
  const envelope: Envelope = { version: 1, salt: toBase64(salt), revision: 1, ...sealed };
  if (!navigator.locks) throw new Error('Оновіть браузер для безпечного локального сховища');
  await navigator.locks.request(vaultKey, () => {
    if (hasLocalVault()) throw new Error('Локальна база вже існує в іншій вкладці');
    localStorage.setItem(vaultKey, JSON.stringify(envelope));
    session = { key, envelope, payload };
  });
}
export async function unlockLocal(passphrase: string) {
  const raw = localStorage.getItem(vaultKey);
  if (!raw) throw new Error('Локальну базу ще не створено');
  try {
    const envelope = JSON.parse(raw) as Envelope;
    if (envelope.version !== 1) throw new Error();
    const key = await deriveVaultKey(passphrase, fromBase64(envelope.salt));
    const payload = JSON.parse(await openVault(key, envelope)) as Payload;
    if (payload.state.version !== 1 || !payload.state.workspaces[payload.state.activeKey])
      throw new Error();
    session = { key, envelope, payload };
  } catch {
    throw new Error('Невірний пароль або пошкоджена локальна копія');
  }
}
export function readLocal() {
  if (!session) throw new Error('Розблокуйте локальний простір');
  return structuredClone(session.payload.state);
}
export async function changeLocal(change: (state: DemoState) => DemoState) {
  if (!navigator.locks)
    throw new Error(
      'Цей браузер не підтримує безпечний паралельний запис. Використайте актуальний Chrome, Edge або Firefox.',
    );
  return navigator.locks.request(vaultKey, async () => {
    if (!session) throw new Error('Локальну базу заблоковано');
    const expected = JSON.stringify(session.envelope);
    if (localStorage.getItem(vaultKey) !== expected)
      throw new Error('Локальну базу змінено в іншій вкладці. Розблокуйте її повторно.');
    const state = change(readLocal());
    const payload = { ...session.payload, state };
    const sealed = await sealVault(session.key, JSON.stringify(payload));
    if (localStorage.getItem(vaultKey) !== expected) throw new Error('Конфлікт локальних змін');
    const envelope = { ...session.envelope, ...sealed, revision: session.envelope.revision + 1 };
    try {
      localStorage.setItem(vaultKey, JSON.stringify(envelope));
    } catch {
      throw new Error('У браузері бракує місця. Попередню локальну копію збережено.');
    }
    session = { ...session, envelope, payload };
    return state;
  });
}
