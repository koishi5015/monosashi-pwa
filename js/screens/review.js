// 振り返り。判断中には出さない（§3.13-3）。
import { el, mount, pct, fmtInt } from '../util.js';
import { allJudgments, allExposures, loadCatalog } from '../store.js';
import { SHORT } from '../subquestions.js';

export default async function review() {
  const js = await allJudgments();
  const ex = await allExposures();
  try { await loadCatalog(); } catch (_) {}

  if (!js.length) {
    mount(el('div', {}, [
      el('a', { class: 'back', href: '#/' }, ['← もどる']),
      el('div', { class: 'empty' }, ['まだ判断がありません。']),
    ]));
    return;
  }

  const stat = (k, v, sub) => el('div', { class: 'stat' }, [
    el('div', {}, [el('div', { class: 'k', text: k }), sub ? el('div', { class: 'faint', text: sub }) : null]),
    el('div', { class: 'v', text: v }),
  ]);

  // --- 迷い度 ---
  const conf = { 1: 0, 2: 0, 3: 0 };
  js.forEach((j) => { if (conf[j.confidence] !== undefined) conf[j.confidence]++; });

  // --- 答え合わせ ---
  const graded = js.filter((j) => j.was_correct !== null && j.was_correct !== undefined);
  const correct = graded.filter((j) => j.was_correct).length;

  const byKey = (rows, keyFn) => {
    const m = {};
    rows.forEach((j) => {
      const k = keyFn(j); if (!k) return;
      (m[k] ||= { n: 0, ok: 0 });
      m[k].n++; if (j.was_correct) m[k].ok++;
    });
    return m;
  };
  const byLayer = byKey(graded, (j) => j.target_layer);
  const byPerturb = byKey(graded, (j) => j.perturbation_type);
  const byFormat = byKey(graded, (j) => j.format);

  const LAYER_JA = { discriminate: '識別', direction: '方向', diagnose: '診断', predict: '予測' };

  // --- 自己一致率（同一問題の再出題で答えが一致したか） ---
  const byQ = {};
  js.forEach((j) => { (byQ[j.question_id] ||= []).push(j); });
  let repeats = 0, agree = 0;
  Object.values(byQ).forEach((rows) => {
    if (rows.length < 2) return;
    rows.sort((a, b) => new Date(a.answered_at) - new Date(b.answered_at));
    for (let i = 1; i < rows.length; i++) {
      repeats++;
      if (JSON.stringify(rows[i].answer) === JSON.stringify(rows[i - 1].answer)) agree++;
    }
  });

  // --- 過去の自分の選択との一致（自作素材） ---
  // 動的生成された自作問題は、id の中に当時採用した素材のidを持つ
  let priorN = 0, priorOK = 0;
  js.forEach((j) => {
    const m = /^qself_.+?_(it_self_[a-z0-9-]+)_/.exec(j.question_id);
    if (!m) return;
    priorN++;
    if (j.answer === m[1]) priorOK++;
  });

  // --- 疲労（セッション内の位置別） ---
  const seqBuckets = { '1-2問目': [], '3-4問目': [], '5問目以降': [] };
  js.forEach((j) => {
    const k = j.session_seq <= 2 ? '1-2問目' : j.session_seq <= 4 ? '3-4問目' : '5問目以降';
    seqBuckets[k].push(j);
  });

  // --- 副設問（§6）。主設問と一致した率を型ごとに出す ---
  const subs = {};
  js.forEach((j) => {
    if (!j.sub_key || j.sub_agrees === null || j.sub_agrees === undefined) return;
    (subs[j.sub_key] ||= { n: 0, agree: 0, hesitant: 0 });
    subs[j.sub_key].n++;
    if (j.sub_agrees) subs[j.sub_key].agree++;
    if (j.confidence === 1) subs[j.sub_key].hesitant++;
  });
  const subTotal = Object.values(subs).reduce((s, v) => s + v.n, 0);
  const splits = js.filter((j) => j.sub_agrees === false);

  // --- 迷った判断の理由 ---
  const reasons = js.filter((j) => j.reason).sort((a, b) => new Date(b.answered_at) - new Date(a.answered_at));
  const fixes = js.filter((j) => j.fix_text).sort((a, b) => new Date(b.answered_at) - new Date(a.answered_at));

  const bars = (m, labelFn) => Object.entries(m)
    .sort((a, b) => b[1].n - a[1].n)
    .map(([k, v]) => el('div', { style: 'margin-bottom:14px' }, [
      el('div', { class: 'stat', style: 'border:none;padding:0' }, [
        el('span', { class: 'k', text: labelFn ? labelFn(k) : k }),
        el('span', { class: 'v', text: `${pct(v.ok, v.n)}  (${v.ok}/${v.n})` }),
      ]),
      el('div', { class: 'bar' }, [el('i', { style: `width:${(v.ok / v.n) * 100}%` })]),
    ]));

  mount(el('div', {}, [
    el('a', { class: 'back', href: '#/' }, ['← もどる']),
    el('h1', { text: '振り返り' }),

    el('h2', { text: '溜まった量' }),
    stat('判断', fmtInt(js.length) + ' 件',
      js.length < 30 ? '30件で、要らない問いを削ります'
      : js.length < 200 ? '200〜300件で頭打ちの見込み' : null),
    stat('浴びた', fmtInt(ex.length) + ' 本'),
    stat('判断なしで浴びた', fmtInt(ex.filter((e) => !e.with_judgment).length) + ' 本'),
    js.length < 30
      ? el('div', { class: 'bar', style: 'margin-top:10px' }, [el('i', { style: `width:${(js.length / 30) * 100}%` })])
      : null,

    el('h2', { text: '迷い度' }),
    stat('即決', `${conf[3]} 件`),
    stat('少し迷った', `${conf[2]} 件`),
    stat('かなり迷った', `${conf[1]} 件`, '評価軸を分離するのはここだけ'),

    graded.length ? el('div', {}, [
      el('h2', { text: '答え合わせ' }),
      stat('正答率', `${pct(correct, graded.length)}`, `${correct} / ${graded.length}`),
      Object.keys(byLayer).length ? el('div', { style: 'margin-top:18px' }, [
        el('p', { class: 'faint', text: '層べつ — 弱い層が、鍛えるべきところ' }),
        ...bars(byLayer, (k) => LAYER_JA[k] || k),
      ]) : null,
      Object.keys(byPerturb).length ? el('div', { style: 'margin-top:18px' }, [
        el('p', { class: 'faint', text: '改変の種類べつ — 低い種類が、知覚できていない次元' }),
        ...bars(byPerturb),
      ]) : null,
      Object.keys(byFormat).length > 1 ? el('div', { style: 'margin-top:18px' }, [
        el('p', { class: 'faint', text: '形式べつ' }),
        ...bars(byFormat),
      ]) : null,
    ]) : null,

    el('h2', { text: '自己一致率' }),
    stat('再出題での一致', repeats ? pct(agree, repeats) : '—',
      repeats ? `${agree} / ${repeats} · 予測精度の理論上限` : '再出題は14日後から'),
    priorN ? stat('当時の自分の選択との一致', pct(priorOK, priorN), `${priorOK} / ${priorN}`) : null,

    subTotal ? el('div', {}, [
      el('h2', { text: '「通す判断」と一致した割合' }),
      el('p', { class: 'faint' },
        ['100%に近い問いは、あなたの判断とほぼ同じことを測っています。低い問いほど、通す判断とは別のものを測っている。そこが評価関数の分かれ目です。']),
      ...Object.entries(subs).sort((a, b) => (b[1].agree / b[1].n) - (a[1].agree / a[1].n))
        .map(([k, v]) => el('div', { style: 'margin-bottom:14px' }, [
          el('div', { class: 'stat', style: 'border:none;padding:0' }, [
            el('span', { class: 'k', text: SHORT[k] || k }),
            el('span', { class: 'v', text: `${pct(v.agree, v.n)}  (${v.agree}/${v.n})` }),
          ]),
          el('div', { class: 'bar' }, [el('i', { style: `width:${(v.agree / v.n) * 100}%` })]),
        ])),
      splits.length ? el('div', { style: 'margin-top:20px' }, [
        el('p', { class: 'faint' },
          [`ズレた判断 ${splits.length} 件。「良いと思うが、そうではない」と答えた事例が、いちばん濃いデータです。`]),
      ]) : null,
    ]) : null,

    el('h2', { text: '疲労' }),
    ...Object.entries(seqBuckets).filter(([, rows]) => rows.length).map(([k, rows]) => {
      const avg = Math.round(rows.reduce((s, j) => s + (j.duration_ms || 0), 0) / rows.length / 1000);
      const g = rows.filter((j) => j.was_correct !== null && j.was_correct !== undefined);
      const acc = g.length ? pct(g.filter((j) => j.was_correct).length, g.length) : '—';
      return stat(k, `${avg}秒 / 正答 ${acc}`, `${rows.length} 件`);
    }),
    el('p', { class: 'faint' }, ['後半で正答率が落ちるなら、1セットの問題数を減らしてください。']),

    fixes.length ? el('div', {}, [
      el('h2', { text: '直しの指示' }),
      ...fixes.slice(0, 20).map((j) => el('p', { class: 'small dim', style: 'margin-bottom:10px' },
        ['— ' + j.fix_text])),
    ]) : null,

    reasons.length ? el('div', {}, [
      el('h2', { text: '迷ったときの決め手' }),
      ...reasons.slice(0, 30).map((j) => el('p', { class: 'small dim', style: 'margin-bottom:10px' },
        ['— ' + j.reason])),
      el('p', { class: 'faint' },
        ['ここに溜まった言葉が、そのままルールブックの原型になります。一致率の低い問いと突き合わせて読んでください。']),
    ]) : null,

    el('div', { style: 'height:40px' }),
  ]));
}
