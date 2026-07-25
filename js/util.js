export const uid = (p = '') =>
  p + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);

export const nowISO = () => new Date().toISOString();

export const DAY = 86400000;

export function daysAgo(iso) {
  return (Date.now() - new Date(iso).getTime()) / DAY;
}

export function shuffle(arr, rng = Math.random) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function fmtInt(n) {
  return typeof n === 'number' ? n.toLocaleString('ja-JP') : String(n ?? '');
}

export function pct(n, d) {
  if (!d) return '—';
  return Math.round((n / d) * 100) + '%';
}

// DOM
export function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') node.className = v;
    else if (k === 'html') node.innerHTML = v;
    else if (k === 'text') node.textContent = v;
    else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
    else if (v !== null && v !== undefined) node.setAttribute(k, v);
  }
  for (const c of [].concat(children)) {
    if (c === null || c === undefined) continue;
    node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  return node;
}

export function mount(node) {
  const root = document.getElementById('app');
  root.replaceChildren(node);
  window.scrollTo(0, 0);
  return node;
}

export function escapeHTML(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function download(filename, text, type = 'application/json') {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
