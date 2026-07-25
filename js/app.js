import { el, mount } from './util.js';
import home from './screens/home.js';
import session from './screens/session.js';
import expose from './screens/expose.js';
import capture from './screens/capture.js';
import review from './screens/review.js';
import settings from './screens/settings.js';

const routes = { '': home, '#/': home, '#/session': session, '#/expose': expose,
  '#/capture': capture, '#/review': review, '#/settings': settings };

export function go(hash) {
  if (location.hash === hash) render();
  else location.hash = hash;
}

export function toast(msg, ms = 1800) {
  const t = el('div', { class: 'toast', text: msg });
  document.body.appendChild(t);
  setTimeout(() => t.remove(), ms);
}

async function render() {
  const [path, query] = location.hash.split('?');
  const params = Object.fromEntries(new URLSearchParams(query || ''));
  const screen = routes[path] || home;
  try {
    await screen(params);
  } catch (err) {
    console.error(err);
    mount(el('div', {}, [
      el('h1', { text: '読み込めませんでした' }),
      el('p', { class: 'dim small', text: String(err.message || err) }),
      el('button', { class: 'btn ghost', onclick: () => location.reload() }, ['再読み込み']),
    ]));
  }
}

window.addEventListener('hashchange', render);
render();

// Service Worker。更新が出たら黙って入れ替えて1度だけ再読み込みする。
// これがないと、ホーム画面に追加したあと古いコードが残り続ける。
if ('serviceWorker' in navigator) {
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading) return;
    reloading = true;
    location.reload();
  });
  window.addEventListener('load', async () => {
    try {
      const reg = await navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' });
      reg.addEventListener('updatefound', () => {
        const sw = reg.installing;
        if (!sw) return;
        sw.addEventListener('statechange', () => {
          // 既に制御下にある＝更新。初回インストールでは再読み込みしない
          if (sw.state === 'installed' && navigator.serviceWorker.controller) sw.postMessage('skipWaiting');
        });
      });
      reg.update();
    } catch (_) { /* オフライン等。無視してよい */ }
  });
}
