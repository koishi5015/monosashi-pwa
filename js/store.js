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

// ---- 軸の定義（バージョン付き。§6.1）----
const AXES_V1 = {
  version: 1,
  updated_at: '2026-07-25',
  axes: [
    { key: 'hook', label: 'フック', desc: '冒頭で「続きを見る理由」が発生しているか' },
    { key: 'speed', label: 'スピード', desc: '情報が停滞せず進むか。冗長・滞留がないか' },
    { key: 'catharsis', label: 'カタルシス', desc: '期待に対する報酬が着地しているか' },
  ],
  note: '仮定義。30件時点で理由テキストから起草し直す。',
};

export async function getAxes() {
  return await db.kvGet('axes', AXES_V1);
}
export async function setAxes(a) {
  return db.kvSet('axes', { ...a, updated_at: nowISO() });
}

// ---- 判断 ----
export async function saveJudgment(j) {
  const row = {
    id: uid('j_'),
    user_id: await getUserId(),
    axes_version: (await getAxes()).version,
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
