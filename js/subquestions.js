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
  { key: 'watch_through', q: '最後まで見て（読んで）もらえるのはどちらですか' },
  { key: 'title_alone',   q: 'タイトルを見ただけで、中を見たくなるのはどちらですか' },
  { key: 'memory',        q: '3ヶ月後まで覚えていそうなのはどちらですか' },
  { key: 'cost',          q: '実際に作るとき、手間がかかるのはどちらですか' },
  { key: 'hard_to_copy',  q: '他の人に真似されにくいのはどちらですか' },
  { key: 'talkable',      q: '見た人が誰かに話したくなるのはどちらですか' },
  { key: 'series',        q: '2本目、3本目を作れるのはどちらですか' },
  { key: 'timeless',      q: '1年後に出しても成立するのはどちらですか' },
];

export const SINGLE = [
  { key: 'watch_through', q: '最後まで読んでもらえると思いますか', yes: '読まれる', no: '途中で切れる' },
  { key: 'title_alone',   q: 'これを見て、中を見たくなりますか', yes: '見たくなる', no: 'ならない' },
  { key: 'memory',        q: '3ヶ月後まで覚えていると思いますか', yes: '覚えている', no: '忘れる' },
  { key: 'cost',          q: '作るのに手間がかかっていると思いますか', yes: 'かかっている', no: 'かかっていない' },
  { key: 'hard_to_copy',  q: '他の人に真似されにくいと思いますか', yes: 'されにくい', no: 'すぐ真似できる' },
  { key: 'talkable',      q: '誰かに話したくなりますか', yes: '話したくなる', no: 'ならない' },
  { key: 'series',        q: '2本目、3本目を作れそうですか', yes: '作れる', no: '一回きり' },
  { key: 'timeless',      q: '1年後に出しても成立すると思いますか', yes: '成立する', no: '今だけ' },
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
  title_alone: '見出しで中を見たくなるか',
  memory: '3ヶ月後に覚えているか',
  cost: '作る手間がかかるか',
  hard_to_copy: '真似されにくいか',
  talkable: '誰かに話したくなるか',
  series: '2本目を作れるか',
  timeless: '1年後でも成立するか',
};
