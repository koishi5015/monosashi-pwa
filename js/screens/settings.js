import { el, mount, download, nowISO } from '../util.js';
import { getSettings, setSettings, allJudgments, allExposures,
         allSelfItems, getUserId } from '../store.js';
import { PAIR, SHORT } from '../subquestions.js';
import * as db from '../db.js';
import { toast } from '../app.js';

export default async function settings() {
  const s = await getSettings();
  const js = await allJudgments();

  async function exportJSON() {
    const payload = {
      schema: 'monosashi/v1',
      exported_at: nowISO(),
      user_id: await getUserId(),
      sub_questions: PAIR,
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
      'perturbation_type', 'answer', 'sub_key', 'sub_answer', 'sub_agrees',
      'confidence', 'reason', 'fix_text', 'was_correct', 'duration_ms', 'session_seq',
      'is_retest_of', 'locked_at', 'revealed_at'];
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

    el('h2', { text: '聞かれること' }),
    el('p', { class: 'faint' }, [
      '評価軸は固定していません。「どちらを通すか」に加えて、下の8つの問いが順に出ます。',
      js.length >= 30 ? ' 30件を超えました。振り返り画面の一致率を見て、要らない問いを削る時期です。' : '',
    ]),
    ...PAIR.map((p) => el('p', { class: 'small dim', style: 'margin-bottom:6px' },
      ['— ' + (SHORT[p.key] || p.q)])),
    el('p', { class: 'faint' },
      ['「通す判断」と常に一致する問いは、同じことを二度聞いているだけなので削ります。逆に一致率の低い問いが、あなたの判断を分解している問いです。']),

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
