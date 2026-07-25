import { el, mount } from '../util.js';
import { getSettings, setSettings, saveJudgment, saveExposure, getAxes,
         setResume, clearResume, getResume, loadCatalog, item } from '../store.js';
import { buildSet } from '../scheduler.js';
import { toast } from '../app.js';

const LABEL_A = ['A', 'B', 'C', 'D', 'E'];

export default async function session(params = {}) {
  const settings = await getSettings();
  const axes = await getAxes();
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
    const draft = { answer: null, axis_diff: [], scores: {}, confidence: null, reason: '',
                    fix_line: null, fix_text: '' };

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

    function scaleRow(key, label, desc) {
      return el('div', { class: 'axis-row' }, [
        el('div', { class: 'lab' }, [
          el('span', { class: 'n', text: label }),
          el('span', { class: 'd', text: desc }),
        ]),
        el('div', { class: 'scale' }, [1, 2, 3, 4, 5].map((n) =>
          el('button', {
            class: draft.scores[key] === n ? 'sel' : '',
            onclick: () => { draft.scores[key] = n; refresh(); },
          }, [String(n)]))),
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
      out.push(el('div', { class: 'prompt', text: q.prompt || defaultPrompt(q) }));
      const ctx = metaRow(q.context_shown || items[0]?.context);
      if (ctx) out.push(ctx);

      if (q.format === 'A' || q.format === 'C' || q.format === 'D') {
        items.forEach((it, i) => out.push(optionCard(it, i)));
        if (draft.answer) {
          out.push(el('div', { class: 'divider' }));
          if (q.format === 'A') {
            out.push(el('div', { class: 'axis-row' }, [
              el('div', { class: 'lab' }, [
                el('span', { class: 'n', text: 'どの軸で差がつきましたか' }),
                el('span', { class: 'd', text: '複数可 / 任意' }),
              ]),
              el('div', { class: 'chips' }, axes.axes.map((a) =>
                el('button', {
                  class: 'chip' + (draft.axis_diff.includes(a.key) ? ' sel' : ''),
                  onclick: () => {
                    const i = draft.axis_diff.indexOf(a.key);
                    if (i < 0) draft.axis_diff.push(a.key); else draft.axis_diff.splice(i, 1);
                    refresh();
                  },
                }, [a.label]))),
            ]));
          }
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
        axes.axes.forEach((a) => out.push(scaleRow(a.key, a.label, a.desc)));
        out.push(confidenceRow());
        const r = reasonRow(); if (r) out.push(r);
      } else if (q.format === 'B') {
        const it = items[0];
        const lines = splitLines(it.content);
        out.push(el('div', { class: 'card' }, [
          el('div', { class: 'faint', style: 'margin-bottom:10px',
                      text: '直したい一箇所をタップ' }),
          ...lines.map((line, i) =>
            el('button', {
              class: 'opt' + (draft.fix_line === i ? ' sel' : ''),
              style: 'padding:12px 14px;margin-bottom:6px;font-size:15px;line-height:1.7',
              onclick: () => { draft.fix_line = i; draft.answer = i; refresh(); },
            }, [line || '　'])),
        ]));
        if (draft.fix_line !== null) {
          out.push(el('div', { class: 'axis-row' }, [
            el('label', { class: 'field', text: 'どう直しますか（一行）' }),
            el('input', {
              type: 'text', placeholder: '例：3行目を消して、結論を先に置く',
              value: draft.fix_text,
              oninput: (e) => { draft.fix_text = e.target.value; },
            }),
          ]));
          out.push(confidenceRow());
        }
      }
      return out.filter(Boolean);
    }

    function ready() {
      if (draft.confidence === null) return false;
      if (q.format === 'S') return axes.axes.every((a) => draft.scores[a.key]);
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
        axis_diff: draft.axis_diff,
        score_hook: draft.scores.hook ?? null,
        score_speed: draft.scores.speed ?? null,
        score_catharsis: draft.scores.catharsis ?? null,
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
function defaultPrompt(q) {
  return { A: 'どちらを通しますか', C: 'どちらが元の版だと思いますか',
           D: 'どちらが伸びたと思いますか', B: '一箇所だけ直せるとしたら、どこですか',
           S: 'これは何を狙っていて、成功していますか' }[q.format] || '';
}
