import { el, mount } from '../util.js';
import { getSettings, saveJudgment, saveExposure,
         setResume, clearResume, getResume, loadCatalog, item } from '../store.js';
import { buildSet } from '../scheduler.js';
import { subFor } from '../subquestions.js';
import { toast } from '../app.js';

const LABEL_A = ['A', 'B', 'C', 'D', 'E'];

export default async function session(params = {}) {
  const settings = await getSettings();
  await loadCatalog();

  let state;
  if (params.resume) {
    state = await getResume();
    if (!state) { location.hash = '#/'; return; }
  } else {
    const mode = settings.lastMode === 'expose' ? 'judge' : (settings.lastMode || 'judge');
    const questions = await buildSet({ mode, size: settings.setSize });
    if (!questions.length) return renderEmpty();
    state = { mode, questions, index: 0, startedAt: Date.now() };
  }

  await run();

  async function persist() {
    await setResume({ ...state, remaining: state.questions.length - state.index });
  }

  async function run() {
    if (state.index >= state.questions.length) return renderDone();
    await persist();
    renderQuestion(state.questions[state.index]);
  }

  function renderEmpty() {
    mount(el('div', {}, [
      el('a', { class: 'back', href: '#/' }, ['← もどる']),
      el('div', { class: 'empty' }, ['出せる問題がありません。素材を追加するか、2週間後に再出題が解禁されます。']),
      el('button', { class: 'btn ghost', onclick: () => (location.hash = '#/capture') }, ['捨てた案を取り込む']),
    ]));
  }

  // ---------- 出題 ----------
  function renderQuestion(q) {
    const shownAt = Date.now();
    const items = q.item_ids.map((id) => item(id)).filter(Boolean);
    if (items.length !== q.item_ids.length) { // 素材欠損は飛ばす
      state.index++; run(); return;
    }

    // §3.2: 正解・出典はここでは一切 DOM に入れない
    const draft = { answer: null, sub: null, confidence: null, reason: '',
                    fix_line: null, fix_text: '' };
    const sub = subFor(q); // 問題ごとに聞くことを変える（§6）

    const dots = el('div', { class: 'dots' },
      state.questions.map((_, i) =>
        el('i', { class: i < state.index ? 'done' : i === state.index ? 'on' : '' })));

    const metaRow = (ctx) => {
      const parts = [];
      if (ctx?.audience) parts.push(['誰向け', ctx.audience]);
      if (ctx?.placement) parts.push(['掲載', ctx.placement]);
      if (ctx?.length) parts.push(['尺', ctx.length]);
      if (ctx?.note) parts.push(['', ctx.note]);
      if (!parts.length) return null;
      return el('div', { class: 'meta' },
        parts.map(([k, v]) => el('span', {}, [k ? el('b', { text: k + ' ' }) : null, v])));
    };

    const body = el('div', { class: 'stack' });
    const foot = el('div', { class: 'sticky-foot' });

    const refresh = () => {
      body.replaceChildren(...buildBody());
      foot.replaceChildren(...buildFoot());
    };

    function optionCard(it, i) {
      const sel = draft.answer === it.id;
      return el('button', {
        class: 'opt' + (sel ? ' sel' : ''),
        onclick: () => { draft.answer = it.id; refresh(); },
      }, [
        el('div', { class: 'tag', text: LABEL_A[i] }),
        el('div', { class: 'title', text: it.title || firstLine(it.content) }),
        it.body || restLines(it.content)
          ? el('div', { class: 'body', text: it.body || restLines(it.content) })
          : null,
      ]);
    }

    // 副設問。問題ごとに聞くことが変わる（§6）。回答は1タップ。
    function subRow() {
      const opts = q.format === 'S'
        ? [['yes', sub.yes], ['no', sub.no]]
        : items.map((it, i) => [it.id, LABEL_A[i]]);
      return el('div', { class: 'axis-row' }, [
        el('div', { class: 'lab' }, [
          el('span', { class: 'n', text: sub.q }),
          el('span', { class: 'd', text: 'もう一問' }),
        ]),
        el('div', { class: 'scale' }, opts.map(([v, t]) =>
          el('button', {
            class: draft.sub === v ? 'sel' : '',
            onclick: () => { draft.sub = v; refresh(); },
          }, [t]))),
      ]);
    }

    function confidenceRow() {
      const opts = [[3, '即決'], [2, '少し迷った'], [1, 'かなり迷った']];
      return el('div', { class: 'axis-row' }, [
        el('div', { class: 'lab' }, [
          el('span', { class: 'n', text: 'どれくらい迷いましたか' }),
          el('span', { class: 'd', text: '必須' }),
        ]),
        el('div', { class: 'scale' }, opts.map(([v, t]) =>
          el('button', {
            class: draft.confidence === v ? 'sel' : '',
            onclick: () => { draft.confidence = v; refresh(); },
          }, [t]))),
      ]);
    }

    function reasonRow() {
      if (draft.confidence === null || draft.confidence > 1) return null;
      return el('div', { class: 'axis-row' }, [
        el('label', { class: 'field', text: '迷ったので、決め手を一行だけ' }),
        el('textarea', {
          rows: 2, placeholder: '例：Bのほうが具体的な絵が浮かぶ',
          oninput: (e) => { draft.reason = e.target.value; },
        }),
      ]);
    }

    function buildBody() {
      const out = [];
      const g = guide(q, items);
      out.push(el('div', { class: 'prompt', text: g.title }));
      if (g.note) out.push(el('p', { class: 'faint', style: 'margin:-10px 0 16px', text: g.note }));
      const ctx = metaRow(q.context_shown || items[0]?.context);
      if (ctx) out.push(ctx);

      if (q.format === 'A' || q.format === 'C' || q.format === 'D') {
        items.forEach((it, i) => out.push(optionCard(it, i)));
        if (draft.answer) {
          out.push(el('div', { class: 'divider' }));
          if (q.format === 'A') out.push(subRow());
          out.push(confidenceRow());
          const r = reasonRow(); if (r) out.push(r);
        }
      } else if (q.format === 'S') {
        const it = items[0];
        out.push(el('div', { class: 'card' }, [
          el('div', { class: 'title', style: 'font-weight:600', text: it.title || firstLine(it.content) }),
          el('div', { class: 'readable long dim small', style: 'margin-top:10px',
                      text: it.body || restLines(it.content) }),
        ]));
        out.push(el('div', { class: 'divider' }));
        out.push(el('div', { class: 'row' }, [
          el('button', {
            class: 'opt center' + (draft.answer === 'works' ? ' sel' : ''),
            onclick: () => { draft.answer = 'works'; refresh(); },
          }, ['効いている']),
          el('button', {
            class: 'opt center' + (draft.answer === 'fails' ? ' sel' : ''),
            onclick: () => { draft.answer = 'fails'; refresh(); },
          }, ['効いていない']),
        ]));
        if (draft.answer) {
          out.push(subRow());
          out.push(confidenceRow());
          const r = reasonRow(); if (r) out.push(r);
        }
      } else if (q.format === 'B') {
        const it = items[0];
        const lines = splitLines(it.content);
        out.push(el('div', { class: 'card' }, [
          el('div', { class: 'faint', style: 'margin-bottom:12px',
                      text: '① 弱いと思う行をひとつタップ' }),
          ...lines.map((line, i) =>
            el('button', {
              class: 'opt' + (draft.fix_line === i ? ' sel' : ''),
              style: 'padding:12px 14px;margin-bottom:6px;font-size:15px;line-height:1.7',
              onclick: () => { draft.fix_line = i; draft.answer = i; refresh(); },
            }, [
              el('span', { class: 'faint', style: 'display:block;font-size:11px;letter-spacing:.1em;margin-bottom:3px',
                           text: i === 0 ? 'タイトル' : `${i}行目` }),
              line || '　',
            ])),
        ]));
        if (draft.fix_line !== null) {
          out.push(el('div', { class: 'axis-row' }, [
            el('label', { class: 'field', text: '② その行をどう直しますか（一行で）' }),
            el('input', {
              type: 'text',
              placeholder: '例：消す / 数字を入れる / 結論を先に置く',
              value: draft.fix_text,
              oninput: (e) => { draft.fix_text = e.target.value; },
            }),
            el('p', { class: 'faint', style: 'margin:8px 0 0' },
              ['「なぜ弱いか」ではなく「どう直すか」を書いてください。ここに書いた指示が、そのまま自分の作業に持ち帰れる形になります。']),
          ]));
          out.push(confidenceRow());
        }
      }
      return out.filter(Boolean);
    }

    function ready() {
      if (draft.confidence === null) return false;
      if (q.format === 'B') return draft.fix_line !== null;
      return !!draft.answer;
    }

    function buildFoot() {
      return [el('button', {
        class: 'btn primary', disabled: ready() ? null : 'disabled',
        onclick: () => submit(),
      }, ['決定'])];
    }

    async function submit() {
      const durationMs = Date.now() - shownAt;
      const answer = q.format === 'B'
        ? { line: draft.fix_line, fix: draft.fix_text }
        : draft.answer;

      let wasCorrect = null;
      if (q.has_ground_truth && q.ground_truth) wasCorrect = draft.answer === q.ground_truth;

      const j = await saveJudgment({
        question_id: q.id,
        mode: state.mode,
        format: q.format,
        item_ids: q.item_ids,
        answer,
        sub_key: (q.format === 'A' || q.format === 'S') ? sub.key : null,
        sub_answer: draft.sub,
        // 主設問と副設問がズレたか。ここが評価関数の内部構造を表す（§6）
        sub_agrees: (q.format === 'A' && draft.sub) ? (draft.sub === draft.answer)
                  : (q.format === 'S' && draft.sub) ? ((draft.sub === 'yes') === (draft.answer === 'works'))
                  : null,
        confidence: draft.confidence,
        reason: draft.reason || null,
        fix_text: q.format === 'B' ? draft.fix_text : null,
        locked_at: new Date().toISOString(),
        revealed_at: null,
        was_correct: wasCorrect,
        duration_ms: durationMs,
        session_seq: state.index + 1,
        is_retest_of: q._isRetest ? (q._priorJudgmentId || q.id) : null,
        target_layer: q.target_layer || null,
        perturbation_type: q.perturbation_type || null,
      });

      for (const it of items) {
        await saveExposure({ item_id: it.id, dwell_ms: durationMs, with_judgment: true });
      }

      // 答え合わせがある問題だけ、ロック後に開示する（§3.2）
      if (q.has_ground_truth && q.ground_truth) renderReveal(q, items, draft, wasCorrect, j);
      else { state.index++; await run(); }
    }

    mount(el('div', {}, [
      el('div', { class: 'head' }, [
        el('a', { class: 'back', href: '#/' , style:'margin:0'}, ['← 中断']),
        dots,
      ]),
      body, foot,
    ]));
    refresh();
  }

  // ---------- 開示 ----------
  function renderReveal(q, items, draft, wasCorrect, judgment) {
    const chosen = items.find((i) => i.id === draft.answer);
    const truth = items.find((i) => i.id === q.ground_truth);

    mount(el('div', {}, [
      el('div', { class: 'head' }, [
        el('h1', { text: wasCorrect ? '当たり' : 'はずれ' }),
        el('div', { class: 'sub', text: `${state.index + 1} / ${state.questions.length}` }),
      ]),

      el('div', { class: 'reveal' }, [
        el('div', { class: 'verdict ' + (wasCorrect ? 'ok' : 'ng'),
                    text: wasCorrect ? '選んだほうが正解でした' : `正解は「${truth?.title || firstLine(truth?.content || '')}」` }),
        q.reveal?.note ? el('p', { class: 'small dim', text: q.reveal.note }) : null,
        el('div', { class: 'divider', style: 'margin:18px 0' }),
        ...items.map((it) => el('p', { class: 'small dim' }, [
          el('b', { text: (it.title || firstLine(it.content)).slice(0, 28) + ' — ' }),
          it.source || '',
          it.result_data ? ` / ${it.result_data.metric} ${Number(it.result_data.value).toLocaleString('ja-JP')}` : '',
          it.url ? el('span', {}, [' ', el('a', { href: it.url, target: '_blank', rel: 'noopener' }, ['開く'])]) : null,
        ])),
        !wasCorrect && q.reveal?.why
          ? el('p', { class: 'small', style: 'margin-top:14px', text: q.reveal.why })
          : null,
      ]),

      el('div', { class: 'sticky-foot' }, [
        el('button', {
          class: 'btn primary',
          onclick: async () => {
            judgment.revealed_at = new Date().toISOString();
            const db = await import('../db.js');
            await db.put('judgments', judgment);
            state.index++;
            await run();
          },
        }, ['つぎへ']),
      ]),
    ]));
  }

  // ---------- セット終了 ----------
  async function renderDone() {
    await clearResume();
    const secs = Math.round((Date.now() - state.startedAt) / 1000);
    mount(el('div', {}, [
      el('div', { class: 'head' }, [el('h1', { text: 'ひと区切り' })]),
      el('p', { class: 'dim' }, [`${state.questions.length}問 / ${Math.floor(secs / 60)}分${secs % 60}秒`]),
      el('p', { class: 'faint' }, ['続けるかどうかは、疲れているかどうかで決めてください。疲れた状態の判断はノイズになります。']),
      el('div', { style: 'height:20px' }),
      el('div', { class: 'row' }, [
        el('button', { class: 'btn ghost', onclick: () => (location.hash = '#/') }, ['終わる']),
        el('button', {
          class: 'btn primary',
          onclick: async () => {
            const qs = await buildSet({ mode: state.mode, size: settings.setSize });
            if (!qs.length) { toast('出せる問題がなくなりました'); location.hash = '#/'; return; }
            state = { mode: state.mode, questions: qs, index: 0, startedAt: Date.now() };
            await run();
          },
        }, ['もう1セット']),
      ]),
    ]));
  }
}

// ---------- helpers ----------
function firstLine(s = '') { return String(s).split('\n')[0]; }
function restLines(s = '') { return String(s).split('\n').slice(1).join('\n').trim(); }
function splitLines(s = '') {
  return String(s).split('\n').map((l) => l.trim()).filter((l) => l.length);
}
// 設問文。何を聞かれているのか、何をすればいいのかを、画面だけで分かるようにする。
// title = やること（命令形）、note = 前提の説明。
function guide(q, items) {
  const media = items[0]?.media;
  switch (q.format) {
    case 'A':
      return media === 'copy'
        ? { title: '2つのコピー案。どちらを出しますか',
            note: '同じ依頼に対する2案です。正解はありません。自分が実際に世に出すならどちらか、で選んでください。' }
        : { title: '2つの企画案。どちらを通しますか',
            note: '同じ枠に出てきた2案です。正解はありません。自分が実際に作るならどちらか、で選んでください。' };
    case 'B':
      return { title: 'この案で、いちばん弱い1行はどれですか',
               note: '行をタップして選び、そのあと直し方を一行で書きます。直せるのは1箇所だけです。' };
    case 'C':
      return { title: '片方は劣化版です。元はどちらですか',
               note: '語順の入れ替え・一文の追加・具体の削除などを、片方にだけ1つ加えてあります。' };
    case 'D': {
      const metric = items[0]?.result_data?.metric;
      return { title: '実際に伸びたのはどちらですか',
               note: `同じ発信者が出した2本です。${metric ? metric + 'で比べます。' : ''}答えは決まっています。` };
    }
    case 'S':
      return { title: 'この見出しは、狙いどおり効いていますか',
               note: '実在のものです。誰に何をさせたい見出しなのかを考えてから答えてください。' };
    default:
      return { title: q.prompt || '', note: null };
  }
}
