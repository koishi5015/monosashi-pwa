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

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}
