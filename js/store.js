// 素材カタログの読み込みと、判断データのアクセス層。
import * as db from './db.js';
import { uid, nowISO } from './util.js';

let catalog = null;

export async function loadCatalog() {
  if (catalog) return catalog;
  const res = await fetch('./data/items.json', { cache: 'no-cache' });
  if (!res.ok) throw new Error('素材カタログを読み込めませんでした');
  const data = await res.json();

  // 端末内に取り込んだ自作素材をマージする
  const selfItems = await db.all('items');
  const items = [...data.items, ...selfItems];

  catalog = {
    version: data.version,
    items,
    questions: data.questions,
    byId: Object.fromEntries(items.map((i) => [i.id, i])),
  };
  return catalog;
}

export function invalidateCatalog() { catalog = null; }

export const item = (id) => catalog?.byId[id];

// ---- 判断 ----
export async function saveJudgment(j) {
  const row = {
    id: uid('j_'),
    user_id: await getUserId(),
    answered_at: nowISO(),
    ...j,
  };
  await db.put('judgments', row);
  return row;
}

export const allJudgments = () => db.all('judgments');

export async function saveExposure(e) {
  const row = { id: uid('e_'), user_id: await getUserId(), viewed_at: nowISO(), ...e };
  await db.put('exposures', row);
  return row;
}

export const allExposures = () => db.all('exposures');

export async function getUserId() {
  let id = await db.kvGet('user_id');
  if (!id) { id = uid('u_'); await db.kvSet('user_id', id); }
  return id;
}

// ---- 自作素材の取り込み ----
export async function addSelfItems(rows) {
  for (const r of rows) await db.put('items', r);
  invalidateCatalog();
}

export const allSelfItems = () => db.all('items');

// ---- 設定 ----
const DEFAULT_SETTINGS = {
  setSize: 5,          // 1セットの問題数
  maxSetsPerDay: 5,    // 目安。ノルマにはしない
  lastMode: 'judge',
  exposeEveryNSets: 3, // Nセットに1回は曝露セットを挟む
  notifyEnabled: false,
};

export async function getSettings() {
  return { ...DEFAULT_SETTINGS, ...(await db.kvGet('settings', {})) };
}
export async function setSettings(patch) {
  const s = await getSettings();
  const next = { ...s, ...patch };
  await db.kvSet('settings', next);
  return next;
}

// ---- 中断復帰（§11.1）----
export const getResume = () => db.kvGet('resume', null);
export const setResume = (v) => db.kvSet('resume', v);
export const clearResume = () => db.kvSet('resume', null);
