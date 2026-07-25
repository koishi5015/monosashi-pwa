// 曝露モード（§8）。判断を求めない。浴びる量だけを稼ぐ。
import { el, mount } from '../util.js';
import { saveExposure, getSettings } from '../store.js';
import { buildExposeSet } from '../scheduler.js';

export default async function expose() {
  const s = await getSettings();
  const items = await buildExposeSet({ size: s.setSize });
  if (!items.length) {
    mount(el('div', {}, [
      el('a', { class: 'back', href: '#/' }, ['← もどる']),
      el('div', { class: 'empty' }, ['浴びる素材がまだありません。']),
    ]));
    return;
  }

  let i = 0;
  let shownAt = Date.now();

  function view() {
    if (i >= items.length) return done();
    const it = items[i];
    shownAt = Date.now();

    mount(el('div', {}, [
      el('div', { class: 'head' }, [
        el('a', { class: 'back', href: '#/', style: 'margin:0' }, ['← 中断']),
        el('div', { class: 'dots' }, items.map((_, n) =>
          el('i', { class: n < i ? 'done' : n === i ? 'on' : '' }))),
      ]),

      el('div', { class: 'card' }, [
        el('div', { style: 'font-weight:600;line-height:1.6', text: it.title || firstLine(it.content) }),
        rest(it) ? el('div', { class: 'readable long dim small', style: 'margin-top:12px', text: rest(it) }) : null,
      ]),

      el('p', { class: 'faint', style: 'margin-top:16px' },
        [[it.source, it.domain, it.result_data ? `${it.result_data.metric} ${Number(it.result_data.value).toLocaleString('ja-JP')}` : null]
          .filter(Boolean).join(' · ')]),
      it.url ? el('p', { class: 'small' }, [el('a', { href: it.url, target: '_blank', rel: 'noopener',
        style: 'color:var(--accent)' }, ['元を読む'])]) : null,

      el('div', { class: 'sticky-foot' }, [
        el('button', {
          class: 'btn primary',
          onclick: async () => {
            await saveExposure({ item_id: it.id, dwell_ms: Date.now() - shownAt, with_judgment: false });
            i++; view();
          },
        }, ['つぎ']),
      ]),
    ]));
  }

  function done() {
    mount(el('div', {}, [
      el('div', { class: 'head' }, [el('h1', { text: `${items.length}本 浴びました` })]),
      el('p', { class: 'faint' }, ['判断を付けずに見る日と、少数を深く判断する日を分けるのが効くかどうかは、まだ分かっていません。これはその実験でもあります。']),
      el('div', { style: 'height:20px' }),
      el('div', { class: 'row' }, [
        el('button', { class: 'btn ghost', onclick: () => (location.hash = '#/') }, ['終わる']),
        el('button', { class: 'btn primary', onclick: () => expose() }, ['もう1セット']),
      ]),
    ]));
  }

  view();
}

const firstLine = (s = '') => String(s).split('\n')[0];
const rest = (it) => it.body || String(it.content || '').split('\n').slice(1).join('\n').trim();
