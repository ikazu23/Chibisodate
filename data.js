// ===== ちびそだて：データ =====
// キャラ・結末・数値はここだけ触れば変えられる

const VERSION = "0.2.0";

const CONFIG = {
  speed: 1,                 // 1 = 実時間（設定の「はやおくり」で ×20）
  // ステータスが 100 → 0 になるまでの分数（起きているとき）
  decayMin: { hunger: 30, clean: 45, happy: 35, energy: 50 },
  sleepFullMin: 2,          // ねると何分で げんき 0 → 100 になるか
  sleepDecay: 0.3,          // 寝ている間の減り方の倍率
  missAfterMin: 5,          // 0 のまま何分でお世話ミス
  farewellMisses: 5,        // このミス数でおわかれ
  // 成長：平均ステータスが growthMinAvg 以上のとき growthFullMin 分で 100%
  growthFullMin: 50,
  growthMinAvg: 40,
  childAt: 20,              // あかちゃん → ちび（ここでキャラが決まる）
  adultAt: 55,              // ちび → おとな
  // たまご（実時間で進む。はやおくりの影響なし）
  eggZone: [55, 80],        // ちょうどいい温度
  eggHot: 90,               // これ以上はあつすぎ（孵化が戻る）
  eggCold: 30,              // これ未満はさむい
  eggCoolPerSec: 3.5,       // 何もしないと下がる温度（1秒あたり）
  warmPerTap: 14,           // あたためる
  fanPerTap: 16,            // あおぐ（冷ます）
  hatchSec: 45,             // ちょうどいい温度を何秒保つとかえるか
  wobbleEverySec: 12,       // ぐらぐらする平均間隔
  wobbleSec: 4,             // ぐらぐらしている時間（この間になでる）
  offlineCapHours: 24,
  // 夜はおやすみ（せっていで時刻を変えられる）
  bedHour: 22,
  wakeHour: 7,
  nightDecay: 0.15,         // 夜ねている間の減り方の倍率
  // たまご：あたため器にまかせる
  incubateMin: 10,          // 何分でかえるか（画面を閉じていても進む）
  // 呼び出し
  needBelow: 25,            // このステータス未満で「本当に困ってる」呼び出し
  callMin: 3,               // 呼び出しを無視できる分数（過ぎると need はミス）
  whimEveryMin: 4,          // わがまま呼び出しの平均間隔（分）
  babyWhimEveryMin: 1.5,    // あかちゃん期のわがままの間隔（分）。しかってきびしく育てるチャンス
  // あっちむいてほい
  mgRounds: 5,
  // あそびに来る（実時間）
  visitEveryMin: 5,         // 卒業した子が遊びに来る平均間隔（分）
  visitStaySec: 30,         // いる時間（秒）。はやおくり中は 2/5 に短くなる
  visitHelpSec: 10,         // 何秒ごとにお世話を手伝うか
  // おうちの関係
  homeTalkSec: [18, 35],    // おうちでふたりが話す間隔（秒）
  homeMax: 4,               // おうちに表示する最大人数
  // しつけ
  shitsukeStart: 50,        // 最初のしつけ
  scoldGain: 20,            // 正しくしかったときに上がる量
  spoilLoss: 15,            // 甘やかしたときに下がる量
  mischiefEveryMin: 8,      // しつけ50のときのいたずらの平均間隔（低いほど増える）
  refuseBelow: 30,          // しつけがこれ未満だと言うことを聞かないことがある
  refuseChance: 0.4,
  mgWinAt: 3,
};

// 食べ物（ちび以降。ごはんボタンでメニューが開く）
const R = (x, y, w, h, c) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${c}"/>`;
const svg16 = (s) => `<svg viewBox="0 0 16 16" shape-rendering="crispEdges">${s}</svg>`;
const INK = "#2a2442";
const FOODS = [
  { id: "onigiri", name: "おにぎり", icon: svg16(R(6,2,4,1,INK)+R(5,3,6,1,INK)+R(4,4,8,1,INK)+R(3,5,10,1,INK)+R(2,6,12,7,INK)+R(6,3,4,1,"#fff")+R(5,4,6,1,"#fff")+R(4,5,8,1,"#fff")+R(3,6,10,3,"#fff")+R(5,10,6,3,"#3b3355")) },
  { id: "ramen", name: "ラーメン", icon: svg16(R(11,1,1,7,INK)+R(13,1,1,7,INK)+R(2,7,12,1,INK)+R(3,8,10,1,"#ffd77a")+R(2,9,12,1,INK)+R(2,10,12,2,"#ff8a65")+R(3,12,10,1,"#ff8a65")+R(3,13,10,1,INK)+R(5,6,6,1,"#ffd77a")+R(6,5,4,1,"#ffd77a")) },
  { id: "curry", name: "カレー", icon: svg16(R(1,8,14,1,INK)+R(1,9,14,3,"#fff")+R(2,12,12,1,INK)+R(3,6,5,3,"#fff")+R(3,5,5,1,INK)+R(8,6,6,3,"#c9853b")+R(8,5,6,1,INK)+R(9,7,2,1,"#ff8a65")) },
  { id: "cake", name: "ケーキ", icon: svg16(R(7,1,3,3,"#ff4d6d")+R(3,4,10,1,INK)+R(3,5,10,2,"#fff")+R(3,7,10,2,"#ffb3c4")+R(3,9,10,1,"#fff")+R(3,10,10,2,"#ffb3c4")+R(3,12,10,1,INK)+R(2,5,1,7,INK)+R(13,5,1,7,INK)) },
  { id: "apple", name: "りんご", icon: svg16(R(8,1,1,3,INK)+R(9,2,3,2,"#5cc98b")+R(4,4,8,1,INK)+R(3,5,10,7,"#ff5a5f")+R(2,6,1,5,INK)+R(13,6,1,5,INK)+R(4,12,8,1,INK)+R(5,6,2,2,"#fff")) },
  { id: "fish", name: "やきざかな", icon: svg16(R(3,6,9,4,"#8aa2c8")+R(2,7,1,2,INK)+R(3,5,9,1,INK)+R(3,10,9,1,INK)+R(12,6,1,4,INK)+R(13,5,2,6,"#8aa2c8")+R(15,5,1,6,INK)+R(4,7,1,1,INK)+R(7,7,1,2,"#5d7196")+R(9,7,1,2,"#5d7196")) },
];

const BABY = {
  sprite: "sprites/baby.png",
  lines: {
    tap: ["あう", "きゃっ", "……？", "うー"],
    hungry: ["うぇ……", "あーう！"],
    dirty: ["むー……"],
    sleepy: ["ふぁ……"],
    happy: ["きゃはっ"],
    eat: ["んまんま"],
    bath: ["ぷは"],
    play: ["きゃっきゃ"],
    whim: ["あーう！", "うぇ……", "んー！"],
    scolded: ["……ぐすっ"],
    spoiled: ["きゃっ♪"],
    hurt: ["うぇぇ……"],
    refuse: ["やー！", "ぷいっ"],
    mischief: ["きゃっきゃ"],
  },
};

// あかちゃん期の育て方でキャラが決まる。cond(log) が一番大きいキャラになる（同点なら上にいる方）
// log.gentle = なでる・あそぶ（勝ち）、log.strict = わがままをしかる、log.spoiled = わがままを聞いてあげる
const CHARS = [
  {
    id: "kdj",
    no: 1,
    name: "キム・ドクシャ",
    short: "ドクシャ",
    sprite: "sprites/kdj.png",
    color: "#7fa7d9",
    likes: ["ramen"],
    dislikes: ["fish"],
    cond: (log) => log.gentle,
    hint: "たくさんなでて、いっぱい遊んであげると……",
    endings: [
      { id: "best", title: "ひだまりの読者", line: "……ありがとう。きみに育ててもらえてよかった。",
        hint: "しつけを70以上にして、お世話ミス1回以下で育てる" },
      { id: "spoiled", title: "ひねくれ者の読者", line: "まあ、なんとかなるでしょ。たぶんね。",
        hint: "わがままをたくさん聞いてあげる" },
      { id: "normal", title: "ふつうの読者", line: "じゃあ、行ってくるよ。",
        hint: "ふつうに育てる" },
    ],
    lines: {
      tap: ["……ん？", "読みかけなんだけど", "なに？", "ふふ", "続き、気になるな"],
      hungry: ["おなかすいた……", "ラーメンでいいよ"],
      dirty: ["ちょっと汚れたかも"],
      sleepy: ["ねむい……"],
      happy: ["悪くないね", "今日はいい日だ"],
      eat: ["いただきます", "おいしい"],
      bath: ["さっぱりした"],
      play: ["もう一回！", "あはは"],
      whim: ["おなかすいた……", "ねえ、ひま", "かまってよ", "ちょっと来て"],
      scolded: ["……はい", "ごめんって"],
      spoiled: ["やった", "言ってみるもんだね"],
      hurt: ["え、なんで……"],
      refuse: ["今いいところなんだけど", "あとでね"],
      liked: ["これ！これが食べたかった", "やっぱりこれだよね"],
      visit: ["遊びに来たよ", "元気にしてた？"],
      help: ["ほら、これ食べて", "一緒に遊ぼうか", "よしよし"],
      bye: ["じゃあ、またね"],
      disliked: ["……これはちょっと", "うーん、パスで"],
      mischief: ["ちょっと借りるだけ", "ばれないって"],
    },
  },
  {
    id: "yjh",
    no: 2,
    name: "ユ・ジュンヒョク",
    short: "ジュンヒョク",
    sprite: "sprites/yjh.png",
    color: "#8c86b8",
    likes: ["fish"],
    dislikes: ["cake"],
    cond: (log) => log.strict,
    hint: "わがままはしっかりしかって、なでたり遊んだりはひかえめに……",
    endings: [
      { id: "best", title: "頼れる剣士", line: "……世話になった。この借りは返す。",
        hint: "しつけを70以上にして、お世話ミス1回以下で育てる" },
      { id: "spoiled", title: "孤高の王", line: "……俺に指図するな。",
        hint: "わがままをたくさん聞いてあげる" },
      { id: "normal", title: "旅立つ剣士", line: "……行ってくる。",
        hint: "ふつうに育てる" },
    ],
    lines: {
      tap: ["……何だ", "触るな", "用がないなら行け", "……", "ふん"],
      hungry: ["……腹が減った", "飯はまだか"],
      dirty: ["……洗え"],
      sleepy: ["……少し休む"],
      happy: ["……悪くない"],
      eat: ["……まあまあだ", "おかわり"],
      bath: ["……ふう"],
      play: ["……付き合ってやる", "遅い"],
      whim: ["……腹が減った", "おい", "……退屈だ", "来い"],
      scolded: ["……ちっ", "……わかった"],
      spoiled: ["……ふん", "……当然だ"],
      hurt: ["……何のつもりだ"],
      refuse: ["……断る", "……後にしろ"],
      liked: ["……悪くない。もう一つ", "……これでいい"],
      visit: ["……様子を見に来た", "……邪魔するぞ"],
      help: ["……食え", "……ほら", "……泣くな"],
      bye: ["……行く"],
      disliked: ["……甘いものはいらん", "……下げろ"],
      mischief: ["……邪魔だった", "……ふん"],
    },
  },
  {
    id: "hsy",
    no: 3,
    name: "ハン・スヨン",
    short: "スヨン",
    sprite: "sprites/hsy.png",
    smooth: true,
    color: "#b48ad6",
    likes: ["cake"],
    dislikes: ["apple"],
    cond: (log) => log.spoiled,
    hint: "わがままを、ついつい聞いてあげると……",
    endings: [
      { id: "best", title: "頼れる作家", line: "……ま、あんたのおかげってことにしといてあげる。",
        hint: "しつけを70以上にして、お世話ミス1回以下で育てる" },
      { id: "spoiled", title: "わがまま作家", line: "締め切り？ 知らなーい。",
        hint: "わがままをたくさん聞いてあげる" },
      { id: "normal", title: "旅立つ作家", line: "じゃ、行ってくる。",
        hint: "ふつうに育てる" },
    ],
    lines: {
      tap: ["なに？", "じろじろ見ないで", "ふーん", "ネタになりそう"],
      hungry: ["おなかすいたんだけど", "なんか甘いのない？"],
      dirty: ["……お風呂入りたい"],
      sleepy: ["ねむ……"],
      happy: ["まあ、悪くないかな", "気分いいかも"],
      eat: ["いただきまーす", "まあまあね"],
      bath: ["すっきり"],
      play: ["次は勝つから", "もう一回！"],
      whim: ["おなかすいたんだけど", "ねえ、ひまー", "かまってよ", "ちょっと来て"],
      scolded: ["……はいはい", "わかったってば"],
      spoiled: ["やった、ちょろい", "言ってみるもんね"],
      hurt: ["は？ なんで？"],
      refuse: ["今いそがしいの", "あとで"],
      mischief: ["ちょっと書き足しただけ", "バレてないよね"],
      liked: ["わかってるじゃん", "これこれ！"],
      disliked: ["……これ、いらない", "パス"],
      visit: ["来てあげたよ", "元気してる？"],
      help: ["ほら、食べな", "しょうがないなあ"],
      bye: ["じゃ、またね"],
    },
  },
];

// ===== ふたりの関係（おうち） =====
// キーはキャラidを「|」でつなぐ（アルファベット順）。データがないペアは PAIR_DEFAULT を使う
// romance: true のランクから先は、プレイヤーが「応援する」を選んだペアだけが進む
const PAIRS = {
  "kdj|yjh": {
    talks: [
      [["kdj", "やあ、ジュンヒョク"], ["yjh", "……何の用だ"]],
      [["yjh", "……今日は何を読んでいる"], ["kdj", "気になる？"]],
      [["kdj", "ごはん食べた？"], ["yjh", "……お前こそ"]],
      [["yjh", "……隣、空いているか"], ["kdj", "どうぞ"]],
      [["kdj", "また眉間にしわ寄ってる"], ["yjh", "……うるさい"]],
    ],
    ranks: [
      { at: 3, name: "しりあい", scene: ["ドクシャとジュンヒョクが、よく話すようになった。"] },
      { at: 8, name: "なかよし", scene: ["ジュンヒョクが、ドクシャの読んでいる本をのぞきこんでいる。", "ふたりはすっかり仲良しみたい。"] },
      { at: 15, name: "だいじな人", romance: true, scene: ["夕方、ふたりが並んで座っている。", "「……お前がいないと、調子が狂う」", "ジュンヒョクはそう言って、目をそらした。"] },
    ],
    proposal: {
      lines: ["ジュンヒョクが、ドクシャに何か言いたそうにしている……", "「……一緒に暮らすか」"],
      yes: "ふたりは一緒に暮らすことになった！",
      no: "ドクシャは「もうちょっと考えさせて」と笑った。",
    },
  },
};
PAIRS["hsy|kdj"] = {
  talks: [
    [["hsy", "ちょっと、ドクシャ"], ["kdj", "なに、スヨン"]],
    [["kdj", "また何か書いてる？"], ["hsy", "のぞいたら怒るよ"]],
    [["hsy", "それ、私の本でしょ"], ["kdj", "借りてるだけだよ"]],
  ],
};
PAIRS["hsy|yjh"] = {
  talks: [
    [["hsy", "ちょっと、無愛想"], ["yjh", "……何だ"]],
    [["yjh", "……騒がしい"], ["hsy", "あんたが静かすぎるの"]],
    [["hsy", "それ、ちゃんと食べてる？"], ["yjh", "……お前に関係ない"]],
  ],
};
// 足りない項目（ranks・proposal など）は PAIR_DEFAULT から補う
const PAIR_DEFAULT = {
  talks: [[["a", "やあ"], ["b", "やあ"]], [["a", "いい天気だね"], ["b", "そうだね"]]],
  ranks: [
    { at: 3, name: "しりあい", scene: ["{a}と{b}が、よく話すようになった。"] },
    { at: 8, name: "なかよし", scene: ["{a}と{b}は、すっかり仲良しみたい。"] },
    { at: 15, name: "だいじな人", romance: true, scene: ["{a}と{b}は、おたがいを大切に思っているみたい。"] },
  ],
  proposal: { lines: ["{a}が、{b}に「一緒に暮らさない？」と言った。"], yes: "ふたりは一緒に暮らすことになった！", no: "まだ早いみたい。" },
};

// 結末の判定（上から順にチェック）。ちび・おとな期に甘やかした回数・しつけ・ミスで決まる
function judgeEnding(run) {
  const l = run.log;
  if (l.spoiled >= 3) return "spoiled";
  if (run.misses <= 1 && run.shitsuke >= 70) return "best";
  return "normal";
}

// 天気の地域（Open-Meteo を使用。GitHub Pages など通常のページで動く）
const CITIES = [
  { id: "sapporo", name: "札幌", lat: 43.06, lon: 141.35 },
  { id: "sendai", name: "仙台", lat: 38.27, lon: 140.87 },
  { id: "tokyo", name: "東京", lat: 35.68, lon: 139.76 },
  { id: "nagoya", name: "名古屋", lat: 35.18, lon: 136.91 },
  { id: "osaka", name: "大阪", lat: 34.69, lon: 135.50 },
  { id: "hiroshima", name: "広島", lat: 34.39, lon: 132.46 },
  { id: "fukuoka", name: "福岡", lat: 33.59, lon: 130.40 },
  { id: "naha", name: "那覇", lat: 26.21, lon: 127.68 },
];

const EGG_SPRITE = "sprites/egg.png";
