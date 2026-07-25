// IndexedDB ラッパ。依存なし。
// ストア: judgments / exposures / items(self) / kv

const DB_NAME = 'monosashi';
const DB_VERSION = 1;

let _db = null;

export function open() {
  if (_db) return Promise.resolve(_db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('judgments')) {
        const s = db.createObjectStore('judgments', { keyPath: 'id' });
        s.createIndex('question_id', 'question_id');
        s.createIndex('answered_at', 'answered_at');
      }
      if (!db.objectStoreNames.contains('exposures')) {
        db.createObjectStore('exposures', { keyPath: 'id' });
      }
      // 自作素材（貼り付けで取り込んだボツ案など）
      if (!db.objectStoreNames.contains('items')) {
        db.createObjectStore('items', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('kv')) {
        db.createObjectStore('kv', { keyPath: 'k' });
      }
    };
    req.onsuccess = () => { _db = req.result; resolve(_db); };
    req.onerror = () => reject(req.error);
  });
}

function tx(store, mode) {
  return open().then((db) => db.transaction(store, mode).objectStore(store));
}

function wrap(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export const put = (store, value) => tx(store, 'readwrite').then((s) => wrap(s.put(value)));
export const get = (store, key) => tx(store, 'readonly').then((s) => wrap(s.get(key)));
export const all = (store) => tx(store, 'readonly').then((s) => wrap(s.getAll()));
export const del = (store, key) => tx(store, 'readwrite').then((s) => wrap(s.delete(key)));
export const clear = (store) => tx(store, 'readwrite').then((s) => wrap(s.clear()));

export async function kvGet(k, fallback = null) {
  const row = await get('kv', k);
  return row ? row.v : fallback;
}
export const kvSet = (k, v) => put('kv', { k, v });
