import { el, mount, daysAgo } from '../util.js';
import { getSettings, allJudgments, getResume, loadCatalog } from '../store.js';

const MODE_LABEL = {
  judge: { k: '判断', t: '答えは出ない。評価基準を溜める', hint: '主目的' },
  verify: { k: '答え合わせ', t: '正解のある問題だけ。当たり外れが出る', hint: '訓練' },
  expose: { k: '浴びる', t: '判断しない。良いものを見るだけ', hint: '曝露' },
};

export default async function home() {
  const s = await getSettings();
  const js = await allJudgments();
  const resume = await getResume();
  let stock = { judge: 0, verify: 0, expose: 0 };
  try {
    const cat = await loadCatalog();
    const answered = new Set(js.map((j) => j.question_id));
    for (const q of cat.questions) {
      if (answered.has(q.id)) continue;
      stock[q.has_ground_truth ? 'verify' : 'judge']++;
    }
    stock.expose = cat.items.filter((i) => i.origin === 'external').length;
  } catch (_) {}

  const recent = js.filter((j) => daysAgo(j.answered_at) < 1).length;
  const mode = s.lastMode || 'judge';
  const m = MODE_LABEL[mode];

  const modeBtn = (key) => {
    const info = MODE_LABEL[key];
    const n = stock[key];
    return el('button', {
      class: 'opt' + (key === mode ? ' sel' : ''),
      onclick: async () => {
        const { setSettings } = await import('../store.js');
        await setSettings({ lastMode: key });
        home();
      },
    }, [
      el('div', { class: 'tag', text: info.hint + (n ? ` · 残り${n}` : ' · 在庫なし') }),
      el('div', { class: 'title', text: info.k }),
      el('div', { class: 'body', text: info.t }),
    ]);
  };

  let picking = false;

  const view = () => mount(el('div', {}, [
    el('div', { class: 'head' }, [
      el('h1', { text: 'ものさし' }),
      el('div', { class: 'sub', text: `${js.length} 件` }),
    ]),

    resume
      ? el('button', {
          class: 'btn primary', onclick: () => (location.hash = '#/session?resume=1'),
        }, ['続きから（残り ' + resume.remaining + ' 問）'])
      : el('button', {
          class: 'btn primary',
          onclick: () => (location.hash = mode === 'expose' ? '#/expose' : '#/session'),
        }, ['はじめる — ' + m.k + ' 5問 / 約3分']),

    el('div', { style: 'height:10px' }),
    picking
      ? el('div', { class: 'stack' }, ['judge', 'verify', 'expose'].map(modeBtn))
      : el('button', {
          class: 'btn ghost small',
          onclick: () => { picking = true; view(); },
        }, ['モードを変える']),

    el('div', { class: 'divider' }),

    el('div', { class: 'stack' }, [
      el('button', { class: 'btn', onclick: () => (location.hash = '#/capture') }, [
        el('span', { class: 'k', text: 'AIと案を練ったあとに' }),
        el('span', { text: '捨てた案を取り込む' }),
      ]),
      el('button', { class: 'btn', onclick: () => (location.hash = '#/review') }, [
        el('span', { class: 'k', text: '別画面。判断中には出さない' }),
        el('span', { text: '振り返る' }),
      ]),
      el('button', { class: 'btn', onclick: () => (location.hash = '#/settings') }, [
        el('span', { class: 'k', text: '軸の定義 / 書き出し / 通知' }),
        el('span', { text: '設定' }),
      ]),
    ]),

    el('p', { class: 'faint', style: 'margin-top:28px' },
      [`今日 ${recent} 件 · 未回答 判断${stock.judge}問 / 答え合わせ${stock.verify}問 / 浴びる${stock.expose}本`]),
    el('p', { class: 'faint' },
      ['連続日数は数えません。疲れているときの判断はデータを汚すので、休むほうが得です。']),
  ]));

  view();
}
