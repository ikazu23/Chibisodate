// 自動生成（tools/make_ko.py）。直接編集しないでね
// ===== ちびそだて：データ =====
// キャラ・結末・数値はここだけ触れば変えられる

const VERSION = "0.2.2";

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
  { id: "onigiri", name: "주먹밥", icon: svg16(R(6,2,4,1,INK)+R(5,3,6,1,INK)+R(4,4,8,1,INK)+R(3,5,10,1,INK)+R(2,6,12,7,INK)+R(6,3,4,1,"#fff")+R(5,4,6,1,"#fff")+R(4,5,8,1,"#fff")+R(3,6,10,3,"#fff")+R(5,10,6,3,"#3b3355")) },
  { id: "ramen", name: "라면", icon: svg16(R(11,1,1,7,INK)+R(13,1,1,7,INK)+R(2,7,12,1,INK)+R(3,8,10,1,"#ffd77a")+R(2,9,12,1,INK)+R(2,10,12,2,"#ff8a65")+R(3,12,10,1,"#ff8a65")+R(3,13,10,1,INK)+R(5,6,6,1,"#ffd77a")+R(6,5,4,1,"#ffd77a")) },
  { id: "curry", name: "카레", icon: svg16(R(1,8,14,1,INK)+R(1,9,14,3,"#fff")+R(2,12,12,1,INK)+R(3,6,5,3,"#fff")+R(3,5,5,1,INK)+R(8,6,6,3,"#c9853b")+R(8,5,6,1,INK)+R(9,7,2,1,"#ff8a65")) },
  { id: "cake", name: "케이크", icon: svg16(R(7,1,3,3,"#ff4d6d")+R(3,4,10,1,INK)+R(3,5,10,2,"#fff")+R(3,7,10,2,"#ffb3c4")+R(3,9,10,1,"#fff")+R(3,10,10,2,"#ffb3c4")+R(3,12,10,1,INK)+R(2,5,1,7,INK)+R(13,5,1,7,INK)) },
  { id: "apple", name: "사과", icon: svg16(R(8,1,1,3,INK)+R(9,2,3,2,"#5cc98b")+R(4,4,8,1,INK)+R(3,5,10,7,"#ff5a5f")+R(2,6,1,5,INK)+R(13,6,1,5,INK)+R(4,12,8,1,INK)+R(5,6,2,2,"#fff")) },
  { id: "fish", name: "생선구이", icon: svg16(R(3,6,9,4,"#8aa2c8")+R(2,7,1,2,INK)+R(3,5,9,1,INK)+R(3,10,9,1,INK)+R(12,6,1,4,INK)+R(13,5,2,6,"#8aa2c8")+R(15,5,1,6,INK)+R(4,7,1,1,INK)+R(7,7,1,2,"#5d7196")+R(9,7,1,2,"#5d7196")) },
];

const BABY = {
  sprite: "sprites/baby.png",
  lines: {
    tap: ["아우", "꺄", "……?", "우우"],
    hungry: ["으앵……", "아우!"],
    dirty: ["무우……"],
    sleepy: ["하암……"],
    happy: ["꺄핫"],
    eat: ["맘마"],
    bath: ["푸하"],
    play: ["꺄르르"],
    whim: ["아우!", "으앵……", "응~!"],
    scolded: ["……훌쩍"],
    spoiled: ["꺄♪"],
    hurt: ["으애애……"],
    refuse: ["싫어!", "흥칫"],
    mischief: ["꺄르르"],
  },
};

// あかちゃん期の育て方でキャラが決まる。cond(log) が一番大きいキャラになる（同点なら上にいる方）
// log.gentle = なでる・あそぶ（勝ち）、log.strict = わがままをしかる、log.spoiled = わがままを聞いてあげる
const CHARS = [
  {
    id: "kdj",
    no: 1,
    name: "김독자",
    short: "독자",
    sprite: "sprites/kdj.png",
    color: "#7fa7d9",
    likes: ["ramen"],
    dislikes: ["fish"],
    cond: (log) => log.gentle,
    hint: "많이 쓰다듬고, 잔뜩 놀아 주면……",
    endings: [
      { id: "best", title: "양지바른 독자", line: "……고마워. 네가 키워 줘서 다행이야.",
        hint: "훈육을 70 이상으로, 돌봄 실수 1회 이하로 키운다" },
      { id: "spoiled", title: "삐딱한 독자", line: "뭐, 어떻게든 되겠지. 아마도.",
        hint: "투정을 많이 들어준다" },
      { id: "normal", title: "평범한 독자", line: "그럼, 다녀올게.",
        hint: "평범하게 키운다" },
    ],
    lines: {
      tap: ["……응?", "읽던 중인데", "뭐?", "후후", "뒷이야기 궁금하네"],
      hungry: ["배고파……", "라면이면 돼"],
      dirty: ["조금 더러워졌을지도"],
      sleepy: ["졸려……"],
      happy: ["나쁘지 않네", "오늘은 좋은 날이다"],
      eat: ["잘 먹겠습니다", "맛있다"],
      bath: ["개운하다"],
      play: ["한 번 더!", "아하하"],
      whim: ["배고파……", "저기, 심심해", "놀아 줘", "잠깐 와 봐"],
      scolded: ["……네", "미안하다니까"],
      spoiled: ["아싸", "말해 보길 잘했네"],
      hurt: ["어, 왜……"],
      refuse: ["지금 좋은 부분인데", "나중에 할게"],
      liked: ["이거! 이게 먹고 싶었어", "역시 이거지"],
      visit: ["놀러 왔어", "잘 지냈어?"],
      help: ["자, 이거 먹어", "같이 놀까", "옳지 옳지"],
      bye: ["그럼, 또 보자"],
      disliked: ["……이건 좀", "음, 패스할게"],
      mischief: ["잠깐 빌리는 것뿐이야", "안 들킨다니까"],
    },
  },
  {
    id: "yjh",
    no: 2,
    name: "유중혁",
    short: "중혁",
    sprite: "sprites/yjh.png",
    color: "#8c86b8",
    likes: ["fish"],
    dislikes: ["cake"],
    cond: (log) => log.strict,
    hint: "투정은 확실히 혼내고, 쓰다듬기나 놀기는 적당히……",
    endings: [
      { id: "best", title: "믿음직한 검사", line: "……신세 졌다. 이 빚은 갚겠다.",
        hint: "훈육을 70 이상으로, 돌봄 실수 1회 이하로 키운다" },
      { id: "spoiled", title: "고고한 왕", line: "……나한테 명령하지 마.",
        hint: "투정을 많이 들어준다" },
      { id: "normal", title: "떠나는 검사", line: "……다녀오겠다.",
        hint: "평범하게 키운다" },
    ],
    lines: {
      tap: ["……뭐지", "만지지 마", "볼일 없으면 가라", "……", "흥"],
      hungry: ["……배고프군", "밥은 아직인가"],
      dirty: ["……씻겨"],
      sleepy: ["……잠깐 쉬겠다"],
      happy: ["……나쁘지 않군"],
      eat: ["……그럭저럭이군", "한 그릇 더"],
      bath: ["……후"],
      play: ["……어울려 주지", "느리다"],
      whim: ["……배고프군", "어이", "……지루하군", "와라"],
      scolded: ["……쯧", "……알았다"],
      spoiled: ["……흥", "……당연하다"],
      hurt: ["……무슨 짓이지"],
      refuse: ["……거절한다", "……나중에 해"],
      liked: ["……나쁘지 않군. 하나 더", "……이거면 됐다"],
      visit: ["……상태를 보러 왔다", "……실례하지"],
      help: ["……먹어라", "……자", "……울지 마라"],
      bye: ["……간다"],
      disliked: ["……단 건 필요 없다", "……치워"],
      mischief: ["……방해됐다", "……흥"],
    },
  },
  {
    id: "hsy",
    no: 3,
    name: "한수영",
    short: "수영",
    sprite: "sprites/hsy.png",
    smooth: true,
    color: "#b48ad6",
    likes: ["cake"],
    dislikes: ["apple"],
    cond: (log) => log.spoiled,
    hint: "투정을 자꾸만 들어주면……",
    endings: [
      { id: "best", title: "믿음직한 작가", line: "……뭐, 네 덕분이라고 해 둘게.",
        hint: "훈육을 70 이상으로, 돌봄 실수 1회 이하로 키운다" },
      { id: "spoiled", title: "제멋대로 작가", line: "마감? 몰라~.",
        hint: "투정을 많이 들어준다" },
      { id: "normal", title: "떠나는 작가", line: "그럼, 다녀올게.",
        hint: "평범하게 키운다" },
    ],
    lines: {
      tap: ["뭐?", "빤히 쳐다보지 마", "흐응", "소재가 될 것 같아"],
      hungry: ["배고픈데", "뭐 단 거 없어?"],
      dirty: ["……목욕하고 싶어"],
      sleepy: ["졸려……"],
      happy: ["뭐, 나쁘지 않네", "기분 좋을지도"],
      eat: ["잘 먹겠습니당", "그럭저럭이네"],
      bath: ["상쾌해"],
      play: ["다음엔 이길 거야", "한 번 더!"],
      whim: ["배고픈데", "저기, 심심해~", "놀아 줘", "잠깐 와 봐"],
      scolded: ["……네네", "알았다니까"],
      spoiled: ["아싸, 쉽네", "말해 보길 잘했어"],
      hurt: ["하? 왜?"],
      refuse: ["지금 바빠", "나중에"],
      mischief: ["조금 덧붙여 쓴 것뿐이야", "안 들켰지?"],
      liked: ["좀 아네", "이거야 이거!"],
      disliked: ["……이거, 필요 없어", "패스"],
      visit: ["와 줬어", "잘 지내?"],
      help: ["자, 먹어", "어쩔 수 없네"],
      bye: ["그럼, 또 봐"],
    },
  },
];

// ===== ふたりの関係（おうち） =====
// キーはキャラidを「|」でつなぐ（アルファベット順）。データがないペアは PAIR_DEFAULT を使う
// romance: true のランクから先は、プレイヤーが「応援する」を選んだペアだけが進む
const PAIRS = {
  "kdj|yjh": {
    talks: [
      [["kdj", "안녕, 중혁"], ["yjh", "……무슨 용건이지"]],
      [["yjh", "……오늘은 뭘 읽고 있지"], ["kdj", "궁금해?"]],
      [["kdj", "밥 먹었어?"], ["yjh", "……너야말로"]],
      [["yjh", "……옆자리, 비었나"], ["kdj", "앉아"]],
      [["kdj", "또 미간 찌푸리고 있네"], ["yjh", "……시끄러워"]],
    ],
    ranks: [
      { at: 3, name: "아는 사이", scene: ["독자와 중혁이 자주 이야기하게 되었다."] },
      { at: 8, name: "친한 사이", scene: ["중혁이 독자가 읽는 책을 들여다보고 있다.", "두 사람은 완전히 친해진 것 같다."] },
      { at: 15, name: "소중한 사람", romance: true, scene: ["해 질 녘, 두 사람이 나란히 앉아 있다.", "“……네가 없으면, 리듬이 흐트러진다”", "중혁은 그렇게 말하고 눈을 피했다."] },
    ],
    proposal: {
      lines: ["중혁이 독자에게 뭔가 말하고 싶은 눈치다……", "“……같이 살겠나”"],
      yes: "두 사람은 같이 살게 되었다!",
      no: "독자는 “조금만 더 생각해 볼게”라며 웃었다.",
    },
  },
};
PAIRS["hsy|kdj"] = {
  talks: [
    [["hsy", "잠깐, 독자"], ["kdj", "왜, 수영"]],
    [["kdj", "또 뭐 쓰고 있어?"], ["hsy", "훔쳐보면 화낼 거야"]],
    [["hsy", "그거, 내 책이잖아"], ["kdj", "빌린 것뿐이야"]],
  ],
};
PAIRS["hsy|yjh"] = {
  talks: [
    [["hsy", "잠깐, 무뚝뚝이"], ["yjh", "……뭐지"]],
    [["yjh", "……시끄럽군"], ["hsy", "네가 너무 조용한 거야"]],
    [["hsy", "너, 밥은 제대로 먹고 있어?"], ["yjh", "……너랑 상관없다"]],
  ],
};
// 足りない項目（ranks・proposal など）は PAIR_DEFAULT から補う
const PAIR_DEFAULT = {
  talks: [[["a", "안녕"], ["b", "안녕"]], [["a", "날씨 좋다"], ["b", "그러게"]]],
  ranks: [
    { at: 3, name: "아는 사이", scene: ["{a}, {b} 두 사람이 자주 이야기하게 되었다."] },
    { at: 8, name: "친한 사이", scene: ["{a}, {b} 두 사람은 완전히 친해진 것 같다."] },
    { at: 15, name: "소중한 사람", romance: true, scene: ["{a}, {b} 두 사람은 서로를 소중히 여기는 것 같다."] },
  ],
  proposal: { lines: ["{a}, {b}에게 “같이 살래?”라고 말했다."], yes: "두 사람은 같이 살게 되었다!", no: "아직 이른 것 같다." },
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
  { id: "seoul", name: "서울", lat: 37.57, lon: 126.98 },
  { id: "busan", name: "부산", lat: 35.18, lon: 129.08 },
  { id: "incheon", name: "인천", lat: 37.46, lon: 126.71 },
  { id: "daegu", name: "대구", lat: 35.87, lon: 128.60 },
  { id: "daejeon", name: "대전", lat: 36.35, lon: 127.38 },
  { id: "gwangju", name: "광주", lat: 35.16, lon: 126.85 },
  { id: "jeju", name: "제주", lat: 33.50, lon: 126.53 },
  { id: "sapporo", name: "삿포로", lat: 43.06, lon: 141.35 },
  { id: "sendai", name: "센다이", lat: 38.27, lon: 140.87 },
  { id: "tokyo", name: "도쿄", lat: 35.68, lon: 139.76 },
  { id: "nagoya", name: "나고야", lat: 35.18, lon: 136.91 },
  { id: "osaka", name: "오사카", lat: 34.69, lon: 135.50 },
  { id: "hiroshima", name: "히로시마", lat: 34.39, lon: 132.46 },
  { id: "fukuoka", name: "후쿠오카", lat: 33.59, lon: 130.40 },
  { id: "naha", name: "나하", lat: 26.21, lon: 127.68 },
];

const EGG_SPRITE = "sprites/egg.png";
