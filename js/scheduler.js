// 1セット（既定5問）の組み立て。§9.4 の標準構成に従う。
import { loadCatalog, allJudgments, item } from './store.js';
import { shuffle, daysAgo } from './util.js';

const RETEST_MIN_DAYS = 14; // §10.3

// 自作素材（採用/不採用ペア）から出題を動的に作る
function questionsFromSelfItems(items) {
  const batches = {};
  for (const it of items) {
    if (it.origin !== 'self' || !it.generation_batch) continue;
    (batches[it.generation_batch] ||= []).push(it);
  }
  const out = [];
  for (const [batch, rows] of Object.entries(batches)) {
    const kept = rows.filter((r) => r.self_kept);
    const dropped = rows.filter((r) => !r.self_kept);
    for (const k of kept) {
      for (const d of shuffle(dropped).slice(0, 2)) {
        out.push({
          id: `qself_${batch}_${k.id}_${d.id}`,
          mode: 'judge',
          format: 'A',
          item_ids: shuffle([k.id, d.id]),
          context_shown: k.context || {},
          prompt: 'どちらを通しますか',
          has_ground_truth: false,
          prior_choice: k.id, // 当時の自分の選択。自己一致率の測定にのみ使う（表示しない）
          target_layer: 'direction',
          origin_mix: 'self',
        });
      }
    }
  }
  return out;
}

function originOf(q, byId) {
  if (q.origin_mix) return q.origin_mix;
  const os = q.item_ids.map((id) => byId[id]?.origin).filter(Boolean);
  if (os.every((o) => o === 'ai_generated')) return 'ai_generated';
  if (os.some((o) => o === 'external')) return 'external';
  return os[0] || 'external';
}

// スロット定義（§9.4）。モードをまたいで混ぜない（§8・§3.5）
const SLOTS = {
  judge: [
    { name: '浴びる', test: (q, o) => o === 'external' && q.format === 'S' },
    { name: '荒い案の比較', test: (q, o) => o === 'ai_generated' && q.format === 'A' },
    { name: '診断', test: (q) => q.format === 'B' },
    { name: '自作', test: (q, o) => o === 'self' },
    { name: '再出題', test: null },
  ],
  verify: [
    { name: '識別', test: (q) => q.format === 'C' },
    { name: '予測', test: (q) => q.format === 'D' },
  ],
};

export async function buildSet({ mode = 'judge', size = 5 } = {}) {
  const cat = await loadCatalog();
  const judgments = await allJudgments();

  const byId = cat.byId;
  const dynamic = questionsFromSelfItems(cat.items);
  // §3.5：答え合わせのある問題とない問題を、同じセッションに混ぜない
  const pool = [...cat.questions, ...dynamic].filter((q) =>
    mode === 'verify' ? q.has_ground_truth : !q.has_ground_truth);

  // 回答履歴
  const lastAnswered = {};
  const lastJudgmentId = {};
  const retestDone = new Set();
  for (const j of judgments) {
    const t = new Date(j.answered_at).getTime();
    if (!lastAnswered[j.question_id] || t > lastAnswered[j.question_id]) {
      lastAnswered[j.question_id] = t;
      lastJudgmentId[j.question_id] = j.id;
    }
    if (j.is_retest_of) retestDone.add(j.question_id);
  }

  const fresh = shuffle(pool.filter((q) => !(q.id in lastAnswered)));
  const retestable = pool
    .filter((q) => q.id in lastAnswered && !retestDone.has(q.id))
    .filter((q) => daysAgo(new Date(lastAnswered[q.id]).toISOString()) >= RETEST_MIN_DAYS)
    .sort((a, b) => lastAnswered[a.id] - lastAnswered[b.id]);

  const chosen = [];
  const used = new Set();
  const take = (list, test) => {
    for (const q of list) {
      if (used.has(q.id)) continue;
      if (test && !test(q, originOf(q, byId))) continue;
      used.add(q.id);
      return q;
    }
    return null;
  };

  // 新規:再出題 = 2:1 を下限（§9.4）
  const slots = SLOTS[mode] || SLOTS.judge;
  const retestQuota = Math.max(1, Math.floor(size / 3));
  let retestUsed = 0;

  const wrap = (q, slotName) => ({
    ...q,
    _isRetest: !!lastAnswered[q.id],
    _priorJudgmentId: lastJudgmentId[q.id] || null,
    _slot: slotName,
  });

  for (let i = 0; i < size; i++) {
    const slot = slots[i % slots.length];
    let q = null;

    // 後ろのスロットは再出題を優先
    if (i >= size - retestQuota && retestUsed < retestQuota) {
      q = take(retestable, null);
      if (q) { retestUsed++; chosen.push(wrap(q, '再出題')); continue; }
    }

    q = take(fresh, slot.test) || take(fresh, null) || take(retestable, null);
    if (!q) break;
    chosen.push(wrap(q, slot.name));
  }

  return chosen;
}

// 曝露セット：判断を伴わずに浴びるだけ（§8）
export async function buildExposeSet({ size = 5 } = {}) {
  const cat = await loadCatalog();
  const pool = cat.items.filter((i) => i.origin === 'external');
  return shuffle(pool).slice(0, size);
}

export function itemsOf(q) {
  return q.item_ids.map((id) => item(id)).filter(Boolean);
}
