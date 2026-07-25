import { el, mount, download, nowISO } from '../util.js';
import { getSettings, setSettings, getAxes, setAxes, allJudgments, allExposures,
         allSelfItems, getUserId } from '../store.js';
import * as db from '../db.js';
import { toast } from '../app.js';

export default async function settings() {
  const s = await getSettings();
  const axes = await getAxes();
  const js = await allJudgments();

  const draft = JSON.parse(JSON.stringify(axes));

  async function exportJSON() {
    const payload = {
      schema: 'monosashi/v1',
      exported_at: nowISO(),
      user_id: await getUserId(),
      axes: await getAxes(),
      judgments: await allJudgments(),
      exposures: await allExposures(),
      self_items: await allSelfItems(),
    };
    download(`monosashi-${new Date().toISOString().slice(0, 10)}.json`,
      JSON.stringify(payload, null, 2));
  }

  async function exportCSV() {
    const rows = await allJudgments();
    const cols = ['id', 'user_id', 'answered_at', 'question_id', 'mode', 'format', 'target_layer',
      'perturbation_type', 'answer', 'axis_diff', 'score_hook', 'score_speed', 'score_catharsis',
      'confidence', 'reason', 'fix_text', 'was_correct', 'duration_ms', 'session_seq',
      'is_retest_of', 'locked_at', 'revealed_at', 'axes_version'];
    const esc = (v) => {
      if (v === null || v === undefined) return '';
      const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
      return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    const csv = [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n');
    download(`monosashi-${new Date().toISOString().slice(0, 10)}.csv`, '﻿' + csv, 'text/csv');
  }

  async function enableNotifications() {
    if (!('Notification' in window)) { toast('この端末では使えません'); return; }
    const p = await Notification.requestPermission();
    if (p !== 'granted') { toast('許可されませんでした'); return; }
    await setSettings({ notifyEnabled: true });
    new Notification('ものさし', { body: '素材が入ったときだけお知らせします。', icon: './icons/icon-192.png' });
    settings();
  }

  mount(el('div', {}, [
    el('a', { class: 'back', href: '#/' }, ['← もどる']),
    el('h1', { text: '設定' }),

    el('h2', { text: '軸の定義' }),
    el('p', { class: 'faint' }, [
      `バージョン ${axes.version} · ${axes.note || ''}`,
      js.length >= 30 ? ' 30件を超えました。理由の記録を読んで、定義を書き直す時期です。' : '',
    ]),
    ...draft.axes.map((a, i) => el('div', { style: 'margin-bottom:16px' }, [
      el('label', { class: 'field', text: a.label }),
      el('textarea', {
        rows: 2, value: a.desc,
        oninput: (e) => { draft.axes[i].desc = e.target.value; },
      }),
    ])),
    el('button', {
      class: 'btn ghost',
      onclick: async () => {
        const changed = draft.axes.some((a, i) => a.desc !== axes.axes[i].desc);
        if (!changed) { toast('変更がありません'); return; }
        await setAxes({ ...draft, version: axes.version + 1,
          note: `v${axes.version + 1} · ${js.length}件時点で更新` });
        toast(`軸の定義を v${axes.version + 1} に更新しました`);
        settings();
      },
    }, ['新しいバージョンとして保存']),
    el('p', { class: 'faint' }, ['過去の判断は、当時の定義バージョンのまま保存されます。上書きはしません。']),

    el('h2', { text: '1セットの問題数' }),
    el('div', { class: 'scale' }, [3, 5, 7, 10].map((n) =>
      el('button', {
        class: s.setSize === n ? 'sel' : '',
        onclick: async () => { await setSettings({ setSize: n }); settings(); },
      }, [String(n)]))),
    el('p', { class: 'faint' }, ['振り返りで後半の正答率が落ちているなら、減らしてください。']),

    el('h2', { text: '通知' }),
    s.notifyEnabled
      ? el('p', { class: 'small dim' }, ['オン。素材の入荷のときだけ通知します。'])
      : el('button', { class: 'btn ghost', onclick: enableNotifications }, ['通知を許可する']),
    el('p', { class: 'faint' }, ['連続日数やノルマの通知は送りません。送るのは「素材が入りました」だけです。iPhone ではホーム画面に追加したあとで有効になります。']),

    el('h2', { text: '書き出し' }),
    el('div', { class: 'stack' }, [
      el('button', { class: 'btn', onclick: exportJSON }, [
        el('span', { class: 'k', text: '判断・曝露・自作素材のすべて' }),
        el('span', { text: 'JSON で書き出す' }),
      ]),
      el('button', { class: 'btn', onclick: exportCSV }, [
        el('span', { class: 'k', text: '表計算・分析用' }),
        el('span', { text: 'CSV で書き出す' }),
      ]),
    ]),

    el('h2', { text: 'データ' }),
    el('p', { class: 'small dim' }, [`判断 ${js.length} 件。この端末の中だけに保存されています。`]),
    el('button', {
      class: 'btn ghost',
      onclick: async () => {
        if (!confirm('判断データをすべて消します。書き出してからにしてください。よろしいですか。')) return;
        if (!confirm('本当に消しますか。元に戻せません。')) return;
        await db.clear('judgments'); await db.clear('exposures');
        toast('消しました'); location.hash = '#/';
      },
    }, ['判断データを消す']),

    el('div', { style: 'height:40px' }),
    el('p', { class: 'faint' }, ['ものさし v1 · 判断を記録して、自分の評価基準を取り出す。']),
  ]));
}
