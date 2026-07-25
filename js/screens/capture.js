// 捨てた案の取り込み（§9.3）。ChatGPT / Notion AI からの貼り付けを想定。
import { el, mount, uid, nowISO } from '../util.js';
import { addSelfItems, allSelfItems } from '../store.js';
import { toast } from '../app.js';

export default async function capture() {
  let step = 1;
  let raw = '';
  let context = '';
  let lines = [];
  let kept = new Set();

  function parse(text) {
    return text
      .split('\n')
      .map((l) => l.replace(/^\s*(?:[-*・]|\d+[.)、]|【\d+】)\s*/, '').trim())
      .filter((l) => l.length >= 2);
  }

  function view() {
    if (step === 1) return viewPaste();
    return viewMark();
  }

  function viewPaste() {
    mount(el('div', {}, [
      el('a', { class: 'back', href: '#/' }, ['← もどる']),
      el('h1', { text: '捨てた案を取り込む' }),
      el('p', { class: 'faint', style: 'margin-bottom:22px' },
        ['AIと案を出したあと、そのまま貼り付けてください。改行区切りで1行1案として読み込みます。採用した案も一緒に入れてください。採用と不採用のペアが、いちばん濃い教師データになります。']),

      el('label', { class: 'field', text: '何のための案でしたか（任意）' }),
      el('input', { type: 'text', placeholder: '例：ガジェット系YouTubeの企画タイトル',
        oninput: (e) => { context = e.target.value; } }),

      el('div', { style: 'height:14px' }),
      el('label', { class: 'field', text: '案（改行区切り）' }),
      el('textarea', { rows: 10, placeholder: '1. 〜\n2. 〜\n3. 〜',
        oninput: (e) => { raw = e.target.value; } }),

      el('div', { class: 'sticky-foot' }, [
        el('button', {
          class: 'btn primary',
          onclick: () => {
            lines = parse(raw);
            if (lines.length < 2) { toast('2案以上を貼り付けてください'); return; }
            step = 2; view();
          },
        }, ['つぎへ']),
      ]),
    ]));
  }

  function viewMark() {
    mount(el('div', {}, [
      el('a', { class: 'back', href: '#', onclick: (e) => { e.preventDefault(); step = 1; view(); } }, ['← もどる']),
      el('h1', { text: '採用したものをタップ' }),
      el('p', { class: 'faint', style: 'margin-bottom:20px' },
        [`${lines.length}案を読み込みました。実際に採用した（残した）ものだけ選んでください。残りは不採用として保存します。`]),

      el('div', { class: 'stack' }, lines.map((l, i) =>
        el('button', {
          class: 'opt' + (kept.has(i) ? ' sel' : ''),
          style: 'padding:14px 16px',
          onclick: () => { kept.has(i) ? kept.delete(i) : kept.add(i); view(); },
        }, [
          el('div', { class: 'title', style: 'font-size:15px;font-weight:500', text: l }),
        ]))),

      el('div', { class: 'sticky-foot' }, [
        el('button', {
          class: 'btn primary',
          onclick: async () => {
            const batch = uid('b_');
            const rows = lines.map((l, i) => ({
              id: uid('it_self_'),
              media: 'plan',
              content: l,
              source: '自作',
              is_famous: false,
              origin: 'self',
              completion: 'draft',
              domain: context || null,
              lang: 'ja',
              context: { note: context || null },
              generation_batch: batch,
              self_kept: kept.has(i),
              created_at: nowISO(),
            }));
            await addSelfItems(rows);
            toast(`${rows.length}件 取り込みました`);
            location.hash = '#/';
          },
        }, [kept.size ? `保存（採用 ${kept.size} / 不採用 ${lines.length - kept.size}）` : '全部不採用として保存']),
      ]),
    ]));
  }

  const existing = await allSelfItems();
  view();
  if (existing.length) {
    // 既存件数を控えめに出す
    const p = el('p', { class: 'faint', style: 'margin-top:24px', text: `これまでに ${existing.length} 件の自作素材` });
    document.getElementById('app').appendChild(p);
  }
}
