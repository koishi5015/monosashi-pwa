// 副設問（§6）。
//
// 評価軸を固定ラベルで与えるのをやめ、「問題ごとに聞くことを変える」方式にする。
// ただし完全自由にすると1件ずつ n=1 になって集計できないので、型を8つに固定して回す。
// 同じ型が10回前後出るので、型の中では集計できる。
//
// 設計の狙い:
//   主設問（どちらを通すか）と副設問がズレた事例が、いちばん情報量が大きい。
//   「良いと思うが最後まで見られない」のような分離が、評価関数の内部構造を表す。

export const PAIR = [
  { key: 'watch_through', q: 'どちらが最後まで見られると思いますか' },
  { key: 'title_alone',   q: 'タイトルだけで成立しているのはどちらですか' },
  { key: 'memory',        q: '3ヶ月後に覚えているのはどちらですか' },
  { key: 'cost',          q: '自分でやるとしたら、面倒なのはどちらですか' },
  { key: 'hard_to_copy',  q: '真似されにくいのはどちらですか' },
  { key: 'client',        q: '人に提案するなら、どちらを出しますか' },
  { key: 'series',        q: '続きを作れるのはどちらですか' },
  { key: 'timeless',      q: '1年前でも成立したのはどちらですか' },
];

export const SINGLE = [
  { key: 'watch_through', q: 'これは最後まで見られると思いますか', yes: '見られる', no: '途中で切れる' },
  { key: 'title_alone',   q: 'タイトルだけで成立していますか', yes: '成立する', no: '中身が要る' },
  { key: 'memory',        q: '3ヶ月後に覚えていると思いますか', yes: '覚えている', no: '忘れる' },
  { key: 'cost',          q: 'これは手間や金を払っていますか', yes: '払っている', no: '払っていない' },
  { key: 'hard_to_copy',  q: '真似されにくいですか', yes: 'されにくい', no: 'すぐ真似できる' },
  { key: 'client',        q: '人に提案として出せますか', yes: '出せる', no: '出せない' },
  { key: 'series',        q: '続きを作れますか', yes: '作れる', no: '一回きり' },
  { key: 'timeless',      q: '1年前でも成立しましたか', yes: '成立した', no: '今だけ' },
];

// 出題idから決定的に選ぶ。同じ問題を再出題したとき、副設問も同じになる
// （そうしないと自己一致率が測れない）。
function hash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function subFor(question) {
  const pool = question.format === 'S' ? SINGLE : PAIR;
  return pool[hash(question.id) % pool.length];
}

export const labelOf = (key) =>
  (PAIR.find((p) => p.key === key) || SINGLE.find((p) => p.key === key) || {}).q || key;

export const SHORT = {
  watch_through: '最後まで見られるか',
  title_alone: 'タイトルだけで成立するか',
  memory: '3ヶ月後に覚えているか',
  cost: '手間や金を払っているか',
  hard_to_copy: '真似されにくいか',
  client: '人に出せるか',
  series: '続きを作れるか',
  timeless: '1年前でも成立したか',
};
