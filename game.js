// ===== ちびそだて：ゲーム本体 =====
(() => {
"use strict";

const $ = (s) => document.querySelector(s);
const STAT_KEYS = ["hunger", "happy", "clean", "energy"];
const ACT_STAT = { food: "hunger", bath: "clean", play: "happy", sleep: "energy" };
const SAVE_KEY = "chibisodate-v2";
const charById = (id) => CHARS.find((c) => c.id === id);
const clamp = (v, a = 0, b = 100) => Math.max(a, Math.min(b, v));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const sleepMs = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- 状態 ----------
function freshState() {
  return { version: 3, current: null, zukan: {}, view: "room", fast: false, introDone: false, tips: {}, bonds: {}, pairRank: {}, together: {}, proposeAt: {}, cheer: {}, homeShow: [], affection: {}, settings: { bed: CONFIG.bedHour, wake: CONFIG.wakeHour, weather: false, city: "tokyo", geo: null, sound: true }, weather: null, awakeUntil: 0, lastTick: Date.now() };
}
function newRun() {
  return {
    charId: null, phase: "egg", temp: 25, hatchP: 0, eggQ: 50, wobbleUntil: 0, incubate: false, night: false,
    stats: { hunger: 80, happy: 80, clean: 100, energy: 90 },
    growth: 0, misses: 0, zero: { hunger: 0, happy: 0, clean: 0, energy: 0 },
    sleeping: false, ended: null, endingId: null,
    call: null, callCool: 90, shitsuke: CONFIG.shitsukeStart,
    baby: { gentle: 0, strict: 0, spoiled: 0 }, // あかちゃん期 → キャラ決定
    log: { spoiled: 0, discipline: 0, wins: 0 }, // ちび・おとな期 → 結末決定
    startedAt: Date.now(),
  };
}
// 古い/壊れたデータでも落ちないよう、足りない項目を必ず補う
function normalize(s) {
  const out = Object.assign(freshState(), s && typeof s === "object" ? s : {});
  if (!out.zukan || typeof out.zukan !== "object") out.zukan = {};
  for (const k of ["tips", "bonds", "pairRank", "together", "proposeAt", "cheer", "affection"]) if (!out[k] || typeof out[k] !== "object") out[k] = {};
  if (!Array.isArray(out.homeShow)) out.homeShow = [];
  out.settings = Object.assign(freshState().settings, out.settings && typeof out.settings === "object" ? out.settings : {});
  for (const id of Object.keys(out.zukan)) {
    const z = out.zukan[id] || {};
    if (!z.endings) { z.endings = {}; if (z.grad) z.endings.normal = z.grad; if (z.perfect) z.endings.best = 1; }
    delete z.grad; delete z.perfect;
    out.zukan[id] = z;
  }
  const c = out.current;
  if (c && typeof c === "object") {
    const r = Object.assign(newRun(), c);
    r.stats = Object.assign(newRun().stats, c.stats || {});
    r.zero = Object.assign(newRun().zero, c.zero || {});
    r.baby = Object.assign(newRun().baby, c.baby || {});
    r.log = Object.assign(newRun().log, c.log || {});
    if (!["egg", "baby", "child", "adult"].includes(r.phase)) r.phase = "egg";
    if (r.call && !r.call.want && r.call.type !== "mischief") r.call = null; // 旧形式の呼び出し
    if (r.phase === "egg" || r.phase === "baby") r.charId = null;      // 旧版は卵の時点でキャラが決まっていた
    if ((r.phase === "child" || r.phase === "adult") && !charById(r.charId)) r.charId = CHARS[0].id;
    out.current = r;
  } else out.current = null;
  if (out.view !== "home") out.view = "room";
  out.version = 3;
  return out;
}

function load() {
  try { return normalize(JSON.parse(localStorage.getItem(SAVE_KEY))); }
  catch (e) { return freshState(); }
}
let saveTimer = 0;
function save(now = false) {
  const run = () => {
    try { state.lastTick = Date.now(); localStorage.setItem(SAVE_KEY, JSON.stringify(state)); }
    catch (e) { /* 保存できない環境でもゲームは続ける */ }
  };
  clearTimeout(saveTimer);
  if (now) run(); else saveTimer = setTimeout(run, 800);
}

let state;
const who = (r) => (r && r.charId ? charById(r.charId) : BABY);

// ---------- シミュレーション ----------
// t = ゲーム内の秒。away = アプリを閉じていた間（おるすばん）
function step(t, away, clock = Date.now()) {
  const r = state.current;
  const ev = [];
  if (!r || r.ended) return ev;

  if (r.phase === "egg") return ev; // たまごは eggStep で実時間で進む

  // 夜は自動でおやすみ（呼び出し・ミスなし、減りもゆっくり）
  const night = isNightAt(clock) && !(state.awakeUntil > clock);
  if (night && !r.night) {
    r.night = true; r.sleeping = true;
    if (r.call && r.call.type !== "need") r.call = null;
    ev.push("nightSleep");
  } else if (!night && r.night) {
    r.night = false; r.sleeping = false;
    ev.push("morning");
  }
  const slow = r.sleeping ? (r.night ? CONFIG.nightDecay : CONFIG.sleepDecay) : away ? 0.3 : 1;
  for (const k of STAT_KEYS) {
    const rate = 100 / (CONFIG.decayMin[k] * 60);
    if (k === "energy" && r.sleeping) r.stats.energy = clamp(r.stats.energy + (100 / (CONFIG.sleepFullMin * 60)) * t);
    else r.stats[k] = clamp(r.stats[k] - rate * t * slow);

    if (r.stats[k] <= 0 && !r.night) {
      r.zero[k] += t;
      if (r.zero[k] >= CONFIG.missAfterMin * 60) {
        r.zero[k] = 0;
        // おるすばん中はおわかれまでは進めない（戻ってきたら挽回できる）
        if (!away || r.misses < CONFIG.farewellMisses - 1) { r.misses++; ev.push("miss"); }
      }
    } else r.zero[k] = 0;
  }

  if (!r.sleeping && r.stats.energy <= 0) { r.sleeping = true; if (r.call && r.call.type !== "need") { if (r.call.type === "mischief") ev.push("mischiefGone"); r.call = null; } ev.push("fellAsleep"); }
  else if (r.sleeping && !r.night && r.stats.energy >= 100) { r.sleeping = false; ev.push("wokeUp"); }

  // 呼び出し
  if (r.call) {
    r.call.t -= t;
    if (r.call.type === "need" && r.stats[r.call.want] >= CONFIG.needBelow + 15) { r.call = null; r.callCool = 60; }
    else if (r.call.t <= 0) {
      const ty = r.call.type;
      r.call = null; r.callCool = 60;
      if (ty === "need") {
        if (!away || r.misses < CONFIG.farewellMisses - 1) { r.misses++; ev.push("miss"); }
      } else if (ty === "whim") r.stats.happy = clamp(r.stats.happy - 5);
      else if (ty === "mischief") { spoil(r); ev.push("mischiefGone"); }
    }
  } else if (!r.sleeping && !away) {
    r.callCool -= t;
    if (r.callCool <= 0) {
      const disc = r.shitsuke / 100;
      const low = STAT_KEYS.filter((k) => r.stats[k] < CONFIG.needBelow).sort((a, b) => r.stats[a] - r.stats[b])[0];
      if (low) { r.call = { type: "need", want: low, t: CONFIG.callMin * 60 }; ev.push("call"); }
      else if (r.phase !== "baby" && Math.random() < (t / (CONFIG.mischiefEveryMin * 60)) * (1 - disc) * 2) {
        r.call = { type: "mischief", t: CONFIG.callMin * 60 }; ev.push("mischief");
      } else if (Math.random() < t / ((r.phase === "baby" ? CONFIG.babyWhimEveryMin : CONFIG.whimEveryMin) * 60 * (0.5 + disc))) {
        // わがまま：減っていないものを「ほしい」と言う
        const fine = STAT_KEYS.filter((k) => r.stats[k] >= 50);
        r.call = { type: "whim", want: pick(fine.length ? fine : STAT_KEYS), t: CONFIG.callMin * 60 }; ev.push("call");
      }
    }
  }

  const avg = STAT_KEYS.reduce((a, k) => a + r.stats[k], 0) / STAT_KEYS.length;
  if (avg >= CONFIG.growthMinAvg) r.growth = clamp(r.growth + (100 / (CONFIG.growthFullMin * 60)) * t);

  if (r.phase === "baby" && r.growth >= CONFIG.childAt) { evolve(r); ev.push("evolve"); }
  else if (r.phase === "child" && r.growth >= CONFIG.adultAt) { r.phase = "adult"; ev.push("grow"); }
  if (r.misses >= CONFIG.farewellMisses) { r.ended = "bye"; ev.push("end"); }
  else if (r.growth >= 100) { r.ended = "grad"; r.endingId = judgeEnding(r); ev.push("end"); }
  return ev;
}

// ---------- 夜 ----------
function isNightAt(ms) {
  const h = new Date(ms).getHours(), { bed, wake } = state.settings;
  return bed > wake ? h >= bed || h < wake : h >= bed && h < wake;
}

// ---------- たまご：温度を保つミニゲーム ----------
function eggStep(dt) {
  const r = state.current;
  if (!r || r.phase !== "egg" || busyUI) return;
  if (r.incubate) {
    r.hatchP = clamp(r.hatchP + (100 / (CONFIG.incubateMin * 60)) * dt);
    r.temp = (CONFIG.eggZone[0] + CONFIG.eggZone[1]) / 2;
    if (r.hatchP >= 100 && state.view === "room") hatch();
    return;
  }
  if (state.view !== "room") return;
  const [lo, hi] = CONFIG.eggZone;
  r.temp = clamp(r.temp - CONFIG.eggCoolPerSec * dt);
  if (r.temp >= lo && r.temp <= hi) { r.hatchP = clamp(r.hatchP + (100 / CONFIG.hatchSec) * dt); r.eggQ = clamp(r.eggQ + 0.6 * dt); }
  else if (r.temp > CONFIG.eggHot) { r.hatchP = clamp(r.hatchP - 3 * dt); r.eggQ = clamp(r.eggQ - 2 * dt); }
  else if (r.temp < CONFIG.eggCold) r.eggQ = clamp(r.eggQ - 0.5 * dt);
  const now = Date.now();
  if (r.wobbleUntil) {
    if (now > r.wobbleUntil) {
      r.wobbleUntil = 0;
      r.hatchP = clamp(r.hatchP - 12); r.eggQ = clamp(r.eggQ - 10);
      el.actor.classList.remove("shaking");
      anim("squish", 350);
      toast("たまごがころがっちゃった…（孵化が少し戻った）");
    }
  } else if (r.hatchP > 5 && Math.random() < dt / CONFIG.wobbleEverySec) {
    r.wobbleUntil = now + CONFIG.wobbleSec * 1000;
    el.actor.classList.add("shaking");
    say("ぐらぐら……！ なでて！", CONFIG.wobbleSec * 1000);
    sfx("wobble");
  }
  if (r.hatchP >= 100) hatch();
}
function eggCatchUp(sec) {
  const r = state.current;
  if (r && r.phase === "egg" && r.incubate) r.hatchP = clamp(r.hatchP + (100 / (CONFIG.incubateMin * 60)) * sec);
}
function eggState(r) {
  const [lo, hi] = CONFIG.eggZone;
  if (r.incubate) return ["ok", `あたため器 のこり${Math.max(1, Math.ceil(((100 - r.hatchP) / 100) * CONFIG.incubateMin))}分`];
  if (r.temp > CONFIG.eggHot) return ["hot", "あつすぎ！あおいで"];
  if (r.temp > hi) return ["warm", "ちょっとあつい"];
  if (r.temp >= lo) return ["ok", "ちょうどいい"];
  if (r.temp >= CONFIG.eggCold) return ["cool", "ちょっとさむい"];
  return ["cold", "さむい…あたためて"];
}

function spoil(r) {
  if (r.phase === "baby") r.baby.spoiled += 2; else r.log.spoiled += 1;
  r.shitsuke = clamp(r.shitsuke - CONFIG.spoilLoss);
}

function evolve(r) {
  let best = CHARS[0], bestScore = -Infinity;
  for (const c of CHARS) { const s = c.cond(r.baby); if (s > bestScore) { best = c; bestScore = s; } }
  r.charId = best.id;
  r.phase = "child";
  r.call = null; r.callCool = 60;
}

function advance(realSec, away = false) {
  const speed = state.fast ? 20 : CONFIG.speed;
  let remain = realSec * speed;
  const all = [];
  let clock = Date.now() - realSec * 1000;
  while (remain > 0) {
    const t = Math.min(5, remain);
    remain -= t;
    clock += (t / speed) * 1000;
    for (const e of step(t, away, clock)) all.push(e);
    if (state.current && state.current.ended) break;
  }
  return all;
}

// ---------- 画面 ----------
const el = {
  hud: $("#hud"), name: $("#hud-name"), stage: $("#hud-stage"), miss: $("#hud-miss"),
  growthBar: $("#growth b"), growthLabel: $("#growth-label"), callhint: $("#callhint"), tapcatch: $("#tapcatch"), homeBtn: $("#btn-home"), eggPanel: $("#eggpanel"), eggTemp: $("#egg-temp"), eggTempLabel: $("#egg-temp-label"), eggHatch: $("#egg-hatch b"),
  room: $("#stage"), actor: $("#actor"), img: $("#actor-img"), zzz: $("#zzz"), call: $("#call"), look: $("#look"),
  fx: $("#fx"), bubble: $("#bubble"), dirt: $("#dirt"), neighbors: $("#neighbors"),
  dialog: $("#dialog"), dialogText: $("#dialog-text"), choices: $("#dialog-choices"),
  actions: $("#actions"), title: $("#title"),
  sheet: $("#sheet"), grid: $("#zukan-grid"), zcount: $("#zukan-count"),
  settings: $("#settings"),
};
const METER_TIP = {
  hunger: "おなか：「ごはん」で回復",
  clean: "せいけつ：「おふろ」で回復",
  happy: "きげん：「あそぶ」となでる（キャラをタップ）で回復",
  energy: "げんき：「ねる」で回復。2分くらいで満タン",
  growth: "成長：メーターの平均が40%以上だと育つ",
  shitsuke: "しつけ：わがまま・いたずらを「しかる」と上がる",
  style: "せいかく：ピンク＝なでる・あそぶ（勝ち）／紫＝わがままをしかる／黄＝わがままを聞いてあげる。いちばん多い色で育つ子が変わる",
};
const meters = {};
document.querySelectorAll(".meter").forEach((m) => {
  meters[m.dataset.k] = m;
  m.addEventListener("click", () => toast(METER_TIP[m.dataset.k]));
});
const STAGE_LABEL = { egg: "たまご", baby: "あかちゃん", child: "ちび", adult: "おとな" };

function render() {
  const r = state.current;
  const home = state.view === "home";
  el.room.dataset.place = home ? "home" : "room";
  el.hud.classList.toggle("egg", !!r && r.phase === "egg" && !home);
  el.hud.classList.toggle("idle", !r || home);

  if (home) {
    el.stage.textContent = "おうち";
    el.name.textContent = `${graduates().length}人がくらしてる`;
    el.hud.classList.add("idle");
  } else if (r) {
    const ph = shownPhase(r);
    el.stage.textContent = STAGE_LABEL[ph];
    el.name.textContent = ph === "egg" ? "ふしぎなたまご" : ph === "baby" ? "あかちゃん" : who(r).short;
  } else {
    el.stage.textContent = "おへや";
    el.name.textContent = "だれもいない";
  }

  if (r && r.phase !== "egg") {
    for (const k of STAT_KEYS) {
      const v = r.stats[k];
      meters[k].querySelector("b").style.width = v + "%";
      meters[k].classList.toggle("low", v < 30 && v > 0);
      meters[k].classList.toggle("empty", v <= 0);
    }
    meters.growth.querySelector("b").style.width = r.growth + "%";
    meters.shitsuke.querySelector("b").style.width = r.shitsuke + "%";
    const baby = r.phase === "baby";
    meters.shitsuke.hidden = baby;
    meters.style.hidden = !baby;
    if (baby) {
      const { gentle: g, strict: st, spoiled: sp } = r.baby;
      const tot = g + st + sp;
      const a = tot ? (g / tot) * 100 : 33.3, b = tot ? (st / tot) * 100 : 33.3;
      meters.style.querySelector("i").style.background = `linear-gradient(90deg, var(--c-play) 0 ${a}%, var(--c-sleep) ${a}% ${a + b}%, var(--c-pet) ${a + b}% 100%)`;
    }
    meters.shitsuke.classList.toggle("low", r.shitsuke < CONFIG.refuseBelow);
  } else if (r) {
    const [cls, txt] = eggState(r);
    el.eggTemp.style.left = r.temp + "%";
    el.eggTempLabel.textContent = txt;
    el.eggPanel.dataset.state = cls;
    el.eggHatch.style.width = r.hatchP + "%";
    el.actor.dataset.temp = cls;
  }

  el.miss.innerHTML = "";
  if (r && r.phase !== "egg" && !home) {
    for (let i = 0; i < CONFIG.farewellMisses; i++) {
      const s = document.createElement("span");
      s.textContent = i < r.misses ? "✖" : "・";
      el.miss.appendChild(s);
    }
  }
  el.homeBtn.hidden = !graduates().length || !!mg;
  el.homeBtn.classList.toggle("on", home);
  renderCallHint();
  renderActor();
  renderDirt();
  renderActions();
}

const WANT_TEXT = { hunger: ["ごはんがほしい", "おなか"], clean: ["おふろに入りたい", "せいけつ"], happy: ["あそんでほしい", "きげん"], energy: ["ねむりたい", "げんき"] };
function renderCallHint() {
  const r = state.current;
  if (r && r.night && r.sleeping && !r.ended) {
    el.callhint.innerHTML = `<i>☾</i><span class="t">夜はおやすみ中。${state.settings.wake}:00に起きるよ（夜はメーターがほとんど減らない）</span>`;
    el.callhint.classList.add("info");
    el.callhint.hidden = false;
    for (const k of STAT_KEYS) meters[k].classList.remove("asked");
    return;
  }
  el.callhint.classList.remove("info");
  const c = r && !r.ended && !r.sleeping && !mg && state.view === "room" ? r.call : null;
  for (const k of STAT_KEYS) meters[k].classList.toggle("asked", !!c && c.want === k && c.type !== "refuse");
  el.room.classList.toggle("mess", !!c && c.type === "mischief");
  if (!c) { el.callhint.hidden = true; return; }
  let html;
  if (c.type === "mischief") html = "<b>いたずらしてる！</b> しかって止めよう";
  else if (c.type === "refuse") html = "<b>いやがってる……</b> しかってからもう一回";
  else {
    const [w, label] = WANT_TEXT[c.want];
    const v = Math.round(r.stats[c.want]);
    const low = v < CONFIG.needBelow + 15;
    html = `<b>${w}</b>って言ってる…？ <span class="chk ${low ? "low" : "ok"}">${label}<i><em style="width:${v}%"></em></i>${v}%</span>`;
  }
  el.callhint.innerHTML = '<i>!</i><span class="t">' + html + "</span>";
  el.callhint.hidden = false;
}

let revealing = false; // 進化演出中はあかちゃんの見た目のまま
const shownPhase = (r) => (revealing && r.phase === "child" ? "baby" : r.phase);
function spriteOf(r) {
  const ph = shownPhase(r);
  if (ph === "egg") return EGG_SPRITE;
  if (ph === "baby") return BABY.sprite;
  return who(r).sprite;
}
function renderActor() {
  const r = state.current;
  const show = !!r && state.view !== "home";
  el.actor.hidden = !show;
  if (!show) return;
  const src = spriteOf(r);
  if (!el.img.src.endsWith(src)) el.img.src = src;
  const ph = shownPhase(r);
  el.img.style.imageRendering = r.charId && ph !== "baby" && ph !== "egg" && who(r).smooth ? "auto" : "";
  for (const p of ["egg", "baby", "child"]) el.actor.classList.toggle(p, shownPhase(r) === p);
  el.actor.classList.toggle("sleeping", r.sleeping);
  el.zzz.hidden = !r.sleeping;
  el.call.hidden = !r.call || r.sleeping || !!r.ended || !!mg;
  el.room.classList.toggle("dark", r.sleeping);
}

let dirtShown = -1;
function renderDirt() {
  const r = state.current;
  const n = r && r.phase !== "egg" && state.view === "room" ? (r.stats.clean < 15 ? 4 : r.stats.clean < 35 ? 2 : 0) : 0;
  if (n === dirtShown) return;
  dirtShown = n;
  el.dirt.innerHTML = "";
  for (let i = 0; i < n; i++) {
    const d = document.createElement("i");
    d.style.left = 15 + Math.random() * 70 + "%";
    d.style.top = 70 + Math.random() * 22 + "%";
    d.style.animationDelay = -Math.random() * 2 + "s";
    el.dirt.appendChild(d);
  }
}

// ---------- アイコン ----------
const ICON = {
  food: '<svg viewBox="0 0 16 16"><path d="M6 2h4v1h1v1h1v1h1v2h1v4h-1v1h-1v1H4v-1H3v-1H2V7h1V5h1V4h1V3h1z" fill="#fff"/><path d="M4 9h8v4H4z" fill="#2a2442"/></svg>',
  bath: '<svg viewBox="0 0 16 16"><path d="M2 8h12v3h-1v2h-1v1H4v-1H3v-2H2z" fill="#fff"/><rect x="5" y="3" width="3" height="3" fill="#fff"/><rect x="9" y="1" width="2" height="2" fill="#fff"/><rect x="10" y="5" width="2" height="2" fill="#fff"/></svg>',
  play: '<svg viewBox="0 0 16 16"><path d="M7 1h2v4h4v2h-1v1h-1v2l1 4h-2l-2-2-2 2H4l1-4V8H4V7H3V5h4z" fill="#fff"/></svg>',
  sleep: '<svg viewBox="0 0 16 16"><path d="M7 2h3v1H9v1H8v2h1v2h1v1h3v1h-1v1h-1v1H9v1H6v-1H4v-1H3v-2H2V6h1V4h1V3h3z" fill="#fff"/></svg>',
  wake: '<svg viewBox="0 0 16 16"><rect x="7" y="1" width="2" height="3" fill="#fff"/><rect x="7" y="12" width="2" height="3" fill="#fff"/><rect x="1" y="7" width="3" height="2" fill="#fff"/><rect x="12" y="7" width="3" height="2" fill="#fff"/><rect x="5" y="5" width="6" height="6" fill="#fff"/></svg>',
  scold: '<svg viewBox="0 0 16 16"><rect x="6" y="1" width="4" height="9" fill="#fff"/><rect x="6" y="12" width="4" height="3" fill="#fff"/></svg>',
  warm: '<svg viewBox="0 0 16 16"><path d="M8 1h1v2h1v2h1v1h1v2h1v3h-1v2h-1v1H5v-1H4v-2H3V8h1V6h1V4h1V3h1V1z" fill="#fff"/><path d="M7 9h2v1h1v2H6v-2h1z" fill="#ff9f6e"/></svg>',
  pet: '<svg viewBox="0 0 16 16"><path d="M3 3h3v1h1v1h2V4h1V3h3v1h1v4h-1v1h-1v1h-1v1h-1v1H9v1H7v-1H6v-1H5v-1H4V9H3V8H2V4h1z" fill="#fff"/></svg>',
  egg: '<svg viewBox="0 0 16 16"><path d="M6 1h4v1h1v2h1v2h1v5h-1v2h-1v1H5v-1H4v-2H3V6h1V4h1V2h1z" fill="#fff"/></svg>',
  home: '<svg viewBox="0 0 16 16"><path d="M7 1h2v1h1v1h1v1h1v1h1v1h1v2h-1v7H3V8H2V6h1V5h1V4h1V3h1V2h1z" fill="#fff"/><rect x="7" y="10" width="2" height="4" fill="#2a2442"/></svg>',
  milk: '<svg viewBox="0 0 16 16"><rect x="6" y="1" width="4" height="2" fill="#fff"/><rect x="5" y="3" width="6" height="2" fill="#2a2442"/><path d="M4 5h8v9H4z" fill="#fff"/><rect x="5" y="8" width="6" height="1" fill="#2a2442"/></svg>',
  fan: '<svg viewBox="0 0 16 16"><path d="M7 1h2v6H7zM9 7h6v2H9zM7 9h2v6H7zM1 7h6v2H1z" fill="#fff" transform="rotate(20 8 8)"/><rect x="6" y="6" width="4" height="4" fill="#fff"/></svg>',
  incubate: '<svg viewBox="0 0 16 16"><path d="M3 7h10v7H3z" fill="#fff"/><path d="M5 2h6v1h1v4H4V3h1z" fill="#fff" opacity=".6"/><rect x="6" y="9" width="4" height="3" fill="#2a2442"/></svg>',
  talk: '<svg viewBox="0 0 16 16"><path d="M1 2h9v6H5l-2 2V8H1z" fill="#fff"/><path d="M11 5h4v6h-2v2l-2-2H7V9h4z" fill="#fff" opacity=".75"/></svg>',
  back: '<svg viewBox="0 0 16 16"><path d="M6 3h2v2h5v6H8v2H6v-1H5v-1H4v-1H3V8h1V7h1V6h1z" fill="#fff"/></svg>',
  left: '<svg viewBox="0 0 16 16"><path d="M9 2h2v2H9v2h5v4H9v2h2v2H9v-1H7v-1H6v-1H5v-1H4V9H3V7h1V6h1V5h1V4h1V3h2z" fill="#fff"/></svg>',
  right: '<svg viewBox="0 0 16 16"><path d="M5 2h2v1h2v1h1v1h1v1h1v1h1v2h-1v1h-1v1h-1v1H9v1H7v1H5v-2h2v-2H2V6h5V4H5z" fill="#fff"/></svg>',
};

function actionList() {
  const r = state.current;
  if (state.view === "home") return [
    { id: "back", label: "もどる", icon: "back", k: "var(--c-sleep)" },
    { id: "hTalk", label: "はなさせる", icon: "talk", k: "var(--c-play)", off: residents.length < 2, alert: homeMode && homeMode.type === "talk" },
    { id: "hSnack", label: "おやつ", icon: "food", k: "var(--c-food)", alert: homeMode && homeMode.type === "snack" },
  ];
  if (!r) {
    const list = [{ id: "start", label: "そだてる", icon: "egg", k: "var(--c-warm)" }];
    if (graduates().length) list.push({ id: "home", label: "おうち", icon: "home", k: "var(--good)" });
    return list;
  }
  if (r.ended) return [];
  if (mg) return [
    { id: "mgL", label: "ひだり", icon: "left", k: "var(--c-play)", off: mg.locked },
    { id: "mgR", label: "みぎ", icon: "right", k: "var(--c-play)", off: mg.locked },
  ];
  if (r.phase === "egg") return [
    { id: "warm", label: "あたためる", icon: "warm", k: "var(--c-warm)", alert: r.temp < CONFIG.eggCold },
    { id: "pet", label: "なでる", icon: "pet", k: "var(--c-pet)", alert: !!r.wobbleUntil },
    { id: "fan", label: "あおぐ", icon: "fan", k: "var(--c-bath)", alert: r.temp > CONFIG.eggHot, off: r.incubate },
    { id: "incubate", label: "おまかせ", icon: "incubate", k: "var(--good)", off: r.incubate },
  ].map((a) => (r.incubate && a.id === "warm" ? { ...a, off: true } : a));
  const s = r.stats, z = r.sleeping, need = r.call && r.call.type === "need" ? r.call.want : null;
  return [
    r.phase === "baby" ? { id: "food", label: "ミルク", icon: "milk", k: "var(--c-food)", off: z, alert: need === "hunger" } :
    { id: "food", label: "ごはん", icon: "food", k: "var(--c-food)", off: z, alert: need === "hunger" },
    { id: "bath", label: "おふろ", icon: "bath", k: "var(--c-bath)", off: z, alert: need === "clean" },
    { id: "play", label: "あそぶ", icon: "play", k: "var(--c-play)", off: z || s.energy < 10, alert: need === "happy" },
    z ? { id: "wake", label: "おこす", icon: "wake", k: "var(--c-sleep)" }
      : { id: "sleep", label: "ねる", icon: "sleep", k: "var(--c-sleep)", alert: need === "energy" },
    { id: "scold", label: "しかる", icon: "scold", k: "var(--bad)", off: z || !r.call, alert: r.call && (r.call.type === "mischief" || r.call.type === "refuse") },
  ];
}

let lastActionsKey = "";
function renderActions() {
  const list = actionList();
  const key = JSON.stringify(list) + busyUI;
  if (key === lastActionsKey) return;
  lastActionsKey = key;
  el.actions.style.gridTemplateColumns = `repeat(${Math.max(list.length, 2)}, 1fr)`;
  el.actions.innerHTML = "";
  for (const a of list) {
    const b = document.createElement("button");
    b.className = "act" + (a.alert ? " alert" : "");
    b.disabled = !!a.off || busyUI;
    b.innerHTML = `<span class="key" style="--k:${a.k}">${ICON[a.icon]}</span><span>${a.label}</span>${a.alert ? '<i class="badge"></i>' : ""}`;
    b.addEventListener("click", () => { sfx("btn"); doAction(a.id); });
    el.actions.appendChild(b);
  }
}

// ---------- 効果音（Web Audio でその場で合成。音声ファイルなし） ----------
let actx = null;
function audio() {
  if (!actx) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { actx = null; } }
  if (actx && actx.state === "suspended") actx.resume();
  return actx;
}
// 最初のタップで音を使えるようにする（ブラウザの決まり）
document.addEventListener("pointerdown", () => audio(), { once: true, capture: true });
function tone(freq, dur, { type = "square", vol = 0.08, at = 0, slide = 0 } = {}) {
  const a = actx; if (!a) return;
  const t = a.currentTime + at;
  const o = a.createOscillator(), g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(a.destination);
  o.start(t); o.stop(t + dur + 0.02);
}
function noise(dur, { vol = 0.06, at = 0, hp = 800 } = {}) {
  const a = actx; if (!a) return;
  const t = a.currentTime + at;
  const buf = a.createBuffer(1, Math.max(1, a.sampleRate * dur), a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  const s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
  f.type = "highpass"; f.frequency.value = hp;
  g.gain.value = vol;
  s.buffer = buf; s.connect(f).connect(g).connect(a.destination);
  s.start(t);
}
const SFX = {
  btn: () => tone(880, 0.05, { vol: 0.05 }),
  page: () => tone(1320, 0.03, { vol: 0.035, type: "triangle" }),
  heart: () => { tone(988, 0.07, { type: "triangle" }); tone(1319, 0.1, { type: "triangle", at: 0.07 }); },
  eat: () => { noise(0.06, { hp: 1500 }); noise(0.06, { hp: 1500, at: 0.13 }); tone(660, 0.08, { at: 0.26, type: "triangle" }); },
  bath: () => [0, 1, 2, 3, 4].forEach((i) => tone(700 + i * 180 + Math.random() * 80, 0.06, { type: "sine", vol: 0.07, at: i * 0.06, slide: 300 })),
  good: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.09, { at: i * 0.07, vol: 0.06 })),
  bad: () => { tone(392, 0.14, { slide: -120 }); tone(262, 0.22, { at: 0.14, slide: -80 }); },
  call: () => { tone(1175, 0.07, { vol: 0.07 }); tone(1175, 0.07, { vol: 0.07, at: 0.12 }); },
  scold: () => tone(180, 0.18, { type: "sawtooth", vol: 0.06, slide: -60 }),
  warm: () => tone(300, 0.18, { type: "sine", vol: 0.08, slide: 250 }),
  fan: () => noise(0.25, { hp: 2500, vol: 0.05 }),
  wobble: () => [0, 1, 2, 3].forEach((i) => tone(i % 2 ? 330 : 294, 0.05, { at: i * 0.07, vol: 0.05 })),
  hit: () => { tone(784, 0.06); tone(1175, 0.12, { at: 0.06 }); },
  miss: () => tone(220, 0.15, { slide: -60, vol: 0.06 }),
  fanfare: () => [[523, 0], [659, .12], [784, .24], [1047, .36], [784, .54], [1047, .66]].forEach(([f, at], i) => tone(f, i === 5 ? 0.35 : 0.11, { at, vol: 0.06 })),
  visit: () => { tone(659, 0.08, { type: "triangle" }); tone(880, 0.08, { type: "triangle", at: 0.1 }); tone(1047, 0.14, { type: "triangle", at: 0.2 }); },
};
function sfx(name) {
  if (!state || !state.settings || !state.settings.sound) return;
  if (!audio()) return;
  try { SFX[name](); } catch (e) { /* 音が出なくてもゲームは続ける */ }
}

// ---------- 演出 ----------
function actorPoint(yRatio = 0) {
  const s = el.room.getBoundingClientRect();
  const a = el.actor.getBoundingClientRect();
  return { x: a.left - s.left + a.width / 2, y: a.top - s.top + a.height * yRatio, w: a.width, h: a.height };
}
function fx(html, cls = "", dx = 0, dy = 0, delay = 0) {
  const p = actorPoint(0.3);
  const d = document.createElement("div");
  d.className = "fx " + cls;
  d.innerHTML = html;
  d.style.left = p.x + dx + "px";
  d.style.top = p.y + dy + "px";
  d.style.animationDelay = delay + "ms";
  el.fx.appendChild(d);
  setTimeout(() => d.remove(), 1600 + delay);
}
const HEART = '<svg viewBox="0 0 8 8"><path d="M1 1h2v1h2V1h2v1h1v2H7v1H6v1H5v1H3V6H2V5H1V4H0V2h1z" fill="#ff6f9a" stroke="#2a2442" stroke-width=".5"/></svg>';
const NOTE = '<svg viewBox="0 0 8 8"><path d="M3 0h4v2H4v4H3v1H1V6H0V5h1V4h2z" fill="#2a2442"/></svg>';
const STAR = '<svg viewBox="0 0 8 8"><path d="M3 0h2v2h3v2H6v1h1v3H5V7H3v1H1V5h1V4H0V2h3z" fill="#ffd34d" stroke="#2a2442" stroke-width=".5"/></svg>';
const HEAT = '<svg viewBox="0 0 8 8"><path d="M4 0h1v1h1v2h1v3H6v1H2V6H1V4h1V2h1V1h1z" fill="#ff8a4c" stroke="#2a2442" stroke-width=".5"/></svg>';
const ANGER = '<svg viewBox="0 0 8 8"><path d="M1 0h2v3H0V1h1zM5 0h2v1h1v2H5zM0 5h3v3H1V7H0zM5 5h3v2H7v1H5z" fill="#ff6f7d" stroke="#2a2442" stroke-width=".4"/></svg>';
function hearts(n = 3) { for (let i = 0; i < n; i++) fx(HEART, "", (Math.random() - .5) * 60, -10, i * 140); }

function anim(cls, ms) {
  el.actor.classList.remove(cls);
  void el.actor.offsetWidth;
  el.actor.classList.add(cls);
  setTimeout(() => el.actor.classList.remove(cls), ms);
}

let bubbleTimer = 0;
function say(text, ms = 2200) {
  if (el.actor.hidden) return;
  const p = actorPoint(0);
  el.bubble.textContent = text;
  el.bubble.style.left = clamp(p.x, 80, el.room.clientWidth - 80) + "px";
  el.bubble.style.top = Math.max(p.y - 34, 50) + "px";
  el.bubble.hidden = false;
  el.bubble.style.animation = "none"; void el.bubble.offsetWidth; el.bubble.style.animation = "";
  clearTimeout(bubbleTimer);
  pauseWalk(ms);
  if (ms > 0) bubbleTimer = setTimeout(() => (el.bubble.hidden = true), ms);
}
function line(kind, ms) {
  const r = state.current;
  if (!r || r.phase === "egg") return;
  const set = who(r).lines;
  say(pick(set[kind] || set.tap), ms);
}
function flash() {
  const f = document.createElement("div");
  f.className = "flash";
  el.room.appendChild(f);
  setTimeout(() => f.remove(), 900);
}
// お知らせ：部屋の上にゲームっぽい札で出す。内容から「いいこと／わるいこと／ふつう」を見分ける
let toastEl = null, toastTimer = 0;
function toast(text, kind) {
  if (!kind) {
    if (/ミス|ダウン|苦手|止められなかった|ころが|取れなかった|困ってた|理由もなく|使えない/.test(text)) kind = "bad";
    else if (/アップ|成功|見つけた|仲良く|NEW|落ち着いた|勝！|わいわい/.test(text)) kind = "good";
    else kind = "info";
  }
  if (toastEl) toastEl.remove();
  clearTimeout(toastTimer);
  const t = document.createElement("div");
  t.className = "toast " + kind;
  t.innerHTML = `<i>${{ good: "★", bad: "!", info: "♪" }[kind]}</i><span></span>`;
  t.querySelector("span").textContent = text;
  t.style.top = el.room.offsetTop + 12 + "px";
  $("#device").appendChild(t);
  toastEl = t;
  toastTimer = setTimeout(() => { t.classList.add("out"); setTimeout(() => t.remove(), 300); if (toastEl === t) toastEl = null; }, 2400);
}

// ---------- 歩き回り ----------
let walkPauseUntil = 0, walkTimer = 0, actorX = 50;
function pauseWalk(ms) { walkPauseUntil = Math.max(walkPauseUntil, Date.now() + ms); }
function setX(x, sec) {
  el.actor.style.setProperty("--walk", sec + "s");
  el.actor.style.left = x + "%";
  actorX = x;
}
function walkLoop() {
  clearTimeout(walkTimer);
  walkTimer = setTimeout(walkLoop, 1800 + Math.random() * 3500);
  const r = state.current;
  if (!r || r.ended || r.phase === "egg" || r.sleeping || mg || state.view !== "room" || el.actor.hidden) return;
  if (Date.now() < walkPauseUntil || busyUI) return;
  if (Math.random() < 0.25) return;
  const nx = 18 + Math.random() * 64;
  const dist = Math.abs(nx - actorX);
  if (dist < 6) return;
  const sec = dist / (r.phase === "baby" ? 6 : r.phase === "child" ? 9 : 12);
  el.actor.style.setProperty("--face", nx < actorX ? "-1" : "1");
  el.actor.classList.add("walking");
  setX(nx, sec);
  clearTimeout(el.actor._stop);
  el.actor._stop = setTimeout(() => el.actor.classList.remove("walking"), sec * 1000);
}
function stopWalkHere() {
  const s = el.room.getBoundingClientRect();
  const a = el.actor.getBoundingClientRect();
  if (!s.width) return;
  setX(((a.left - s.left + a.width / 2) / s.width) * 100, 0);
  el.actor.classList.remove("walking");
}

// ---------- メッセージウィンドウ ----------
let dialogChain = Promise.resolve();
let dialogTap = null;
// メッセージ中は画面のどこをタップしても次へ
el.tapcatch.addEventListener("click", (e) => { e.stopPropagation(); if (dialogTap) dialogTap(); });
let busyUI = false;
function setBusy(v) { busyUI = v; lastActionsKey = ""; renderActions(); }

function dialog(pages, choices) {
  const p = dialogChain.then(() => runDialog(pages, choices));
  dialogChain = p.catch(() => {});
  return p;
}
function runDialog(pages, choices) {
  return new Promise((resolve) => {
    setBusy(true);
    el.dialog.hidden = false;
    el.tapcatch.hidden = false;
    let i = 0, typing = 0, full = "";
    const typeOut = (text) => {
      full = text; el.choices.innerHTML = ""; el.dialog.classList.remove("has-choices");
      let n = 0; el.dialogText.textContent = "";
      clearInterval(typing);
      typing = setInterval(() => {
        n++; el.dialogText.textContent = full.slice(0, n);
        if (n >= full.length) { clearInterval(typing); typing = 0; afterTyped(); }
      }, 32);
    };
    const afterTyped = () => {
      if (i === pages.length - 1 && choices) {
        el.dialog.classList.add("has-choices");
        el.tapcatch.hidden = true;
        for (const ch of choices) {
          const b = document.createElement("button");
          b.textContent = ch.label;
          if (ch.sub) b.className = "sub";
          b.addEventListener("click", (e) => { e.stopPropagation(); finish(ch.value); });
          el.choices.appendChild(b);
        }
      }
    };
    const finish = (val) => {
      dialogTap = null;
      el.dialog.hidden = true;
      el.tapcatch.hidden = true;
      el.choices.innerHTML = "";
      setBusy(false);
      resolve(val);
    };
    const onTap = () => {
      if (typing) { clearInterval(typing); typing = 0; el.dialogText.textContent = full; afterTyped(); return; }
      if (i === pages.length - 1 && choices) return;
      i++;
      sfx("page");
      if (i >= pages.length) finish();
      else typeOut(pages[i]);
    };
    dialogTap = onTap;
    typeOut(pages[0]);
  });
}

// ---------- ずかん ----------
function graduates() {
  return CHARS.filter((c) => {
    const z = state.zukan[c.id];
    return z && z.endings && Object.values(z.endings).some((n) => n > 0);
  });
}
function openSheet(s) { s.classList.add("open"); s.setAttribute("aria-hidden", "false"); }
function closeSheet(s) { s.classList.remove("open"); s.setAttribute("aria-hidden", "true"); }

function foodRow(c, z) {
  const f = z.foods || {};
  const name = (id) => (f[id] ? foodById(id).name : "？？？");
  return `<div class="foods">好物：${(c.likes || []).map(name).join("・") || "なし"}　苦手：${(c.dislikes || []).map(name).join("・") || "なし"}</div>`;
}
function renderZukan() {
  const r = state.current;
  let got = 0, total = 0;
  el.grid.innerHTML = "";
  for (const c of CHARS) {
    const z = state.zukan[c.id] || { endings: {} };
    const ends = z.endings || {};
    const card = document.createElement("div");
    card.className = "card" + (z.seen ? "" : " unknown") + (r && r.charId === c.id ? " current" : "");
    card.style.setProperty("--c", c.color);
    const rows = c.endings.map((e) => {
      total++;
      const n = ends[e.id] || 0;
      if (n) got++;
      return n
        ? `<li class="got"><span><b>${e.title}</b> ×${n}</span></li>`
        : `<li><span class="h">${z.seen ? e.hint : "？？？"}</span></li>`;
    }).join("");
    card.innerHTML = `
      <div class="pic"><img src="${c.sprite}" alt=""${c.smooth ? ' style="image-rendering:auto"' : ""}></div>
      <span class="no">No.${String(c.no).padStart(3, "0")}</span>
      <span class="nm">${z.seen ? c.name : "？？？"}</span>
      ${z.seen ? "" : `<span class="hint">ヒント：${c.hint}</span>`}
      <ul class="endings">${rows}</ul>
      ${z.seen ? foodRow(c, z) : ""}
      ${graduates().includes(c) ? `<div class="foods">なつき度 ${"★".repeat(affStars(c.id))}${"☆".repeat(3 - affStars(c.id))}</div>` : ""}
      ${z.bye ? `<div class="res"><span class="tag soft">おわかれ ×${z.bye}</span></div>` : ""}`;
    if (graduates().includes(c) && graduates().length > CONFIG.homeMax) {
      const on = homeResidents().includes(c);
      const t = document.createElement("button");
      t.className = "go sub" + (on ? " on" : "");
      t.textContent = on ? "おうちに表示中" : "おうちに表示しない";
      t.addEventListener("click", () => toggleHomeShow(c.id));
      card.appendChild(t);
    }
    if (graduates().includes(c)) {
      const v = document.createElement("button");
      v.className = "go sub";
      v.textContent = "おうちを見る";
      v.addEventListener("click", () => { closeSheet(el.sheet); enterHome(); });
      card.appendChild(v);
    }
    el.grid.appendChild(card);
  }
  el.zcount.textContent = `結末 ${got} / ${total}`;
  const keys = Object.keys(state.bonds).filter((k) => k.split("|").every((id) => charById(id)));
  if (keys.length) {
    const box = document.createElement("div");
    box.className = "pairs";
    box.innerHTML = "<h3>ふたりの関係</h3>" + keys.map((k) => {
      const [a, b] = k.split("|").map(charById);
      const idx = pairRankIndex(k);
      const name = idx >= 0 ? pairData(k).ranks[idx].name : "しらない";
      const ch = state.cheer[k];
      const ctrl = ch ? `<div class="cheer" data-k="${k}">${["cheer", "watch", "no"].map((v) => `<button data-v="${v}" class="${ch === v ? "on" : ""}">${{ cheer: "応援する", watch: "見守る", no: "応援できない" }[v]}</button>`).join("")}</div>` : "";
      return `<div class="pair"><div class="pair-top"><span>${a.short} × ${b.short}</span><span class="tag ${state.together[k] ? "gold" : "soft"}">${state.together[k] ? "同居中" : name}</span></div>${ctrl}</div>`;
    }).join("");
    box.querySelectorAll(".cheer button").forEach((btn) => btn.addEventListener("click", () => {
      const k = btn.parentElement.dataset.k;
      setCheer(k, btn.dataset.v);
      toast({ cheer: "応援することにした！", watch: "見守ることにした", no: "友達として見守ることにした" }[btn.dataset.v]);
      renderZukan();
    }));
    el.grid.prepend(box);
  }
}

// ---------- 流れ ----------
async function startRun() {
  closeSheet(el.sheet);
  state.view = "room";
  state.current = newRun();
  clearNeighbors();
  save(true);
  setX(50, 0);
  render();
  anim("jump", 500);
  await dialog(["たまごを受け取った！", "温度を「ちょうどいい」に保つと、だんだんかえってくるよ。", "あつすぎたら「あおぐ」、ぐらぐらしたら「なでる」。", "じょうずに温めるほど、元気な子が生まれるみたい。"]);
}

async function hatch() {
  const r = state.current;
  setBusy(true);
  for (let i = 0; i < 3; i++) { anim("wobble", 600); await sleepMs(700); }
  flash(); sfx("fanfare");
  await sleepMs(250);
  r.phase = "baby";
  r.callCool = 90;
  el.actor.classList.remove("shaking");
  // あたため方で生まれたときの元気さが変わる
  const q = r.incubate ? 55 : r.eggQ;
  const rank = q >= 75 ? "great" : q >= 45 ? "ok" : "poor";
  const base = { great: 100, ok: 80, poor: 55 }[rank];
  for (const k of STAT_KEYS) r.stats[k] = base;
  if (rank === "great") r.shitsuke = clamp(r.shitsuke + 10);
  save(true);
  render();
  anim("jump", 500);
  hearts(rank === "great" ? 6 : 3);
  setBusy(false);
  const qMsg = { great: "じょうずに温められた！ とっても元気なあかちゃんだ！", ok: "ふつうに元気なあかちゃんだ。", poor: "ちょっと弱々しいかも……。しっかりお世話しよう。" }[rank];
  await dialog(["たまごがかえった！", "あかちゃんが生まれた！", qMsg, "メーターの色と同じ色のボタンで回復できるよ。", "きげんは「あそぶ」と、タップしてなでると上がる。げんきは「ねる」で回復。", "メーターをタップすると、いつでも上げ方を見られるよ。"]);
  line("tap");
}

async function evolved() {
  const r = state.current;
  const c = who(r);
  const z = (state.zukan[c.id] ||= { endings: {} });
  const first = !z.seen;
  z.seen = true;
  save(true);
  revealing = true;
  render();
  await dialog(["……あかちゃんのようすが？"]);
  setBusy(true);
  for (let i = 0; i < 3; i++) { anim("wobble", 600); await sleepMs(650); }
  flash(); sfx("fanfare");
  await sleepMs(200);
  revealing = false;
  setBusy(false);
  render();
  anim("jump", 500);
  hearts(4);
  await dialog([`${c.name}になった！${first ? "（はじめて見た！）" : ""}`]);
}

async function grewUp() {
  const c = who(state.current);
  flash(); sfx("fanfare");
  render();
  anim("jump", 500);
  hearts(3);
  await dialog([`${c.short}が大きくなった！`]);
}

async function endRun() {
  const r = state.current;
  if (mg) endMinigame(true);
  if (trayOpen) closeTray();
  stopWalkHere();
  if (r.ended === "grad") {
    const c = who(r);
    const z = (state.zukan[c.id] ||= { endings: {} });
    z.seen = true; z.endings ||= {};
    const e = c.endings.find((x) => x.id === r.endingId) || c.endings[c.endings.length - 1];
    const first = !z.endings[e.id];
    r.sleeping = false; r.call = null; render();
    anim("jump", 500); hearts(5); sfx("fanfare");
    await dialog([`${c.short}はりっぱに育った。`, `結末『${e.title}』${first ? "　NEW!" : ""}`, `「${e.line}」`]);
    el.actor.classList.add("walking");
    el.actor.style.setProperty("--face", "1");
    setX(115, 2.5);
    await sleepMs(2600);
    z.endings[e.id] = (z.endings[e.id] || 0) + 1;
    await dialog([`${c.short}はおうちでくらしはじめた。`, `ずかんに記録した！（お世話ミス ${r.misses}回）`]);
  } else {
    const name = r.charId ? who(r).short : "あかちゃん";
    el.actor.classList.add("ghost"); sfx("bad");
    await dialog(["お世話ミスが重なって……", `${name}はどこかへ行ってしまった。`]);
    el.actor.classList.add("gone");
    await sleepMs(1200);
    if (r.charId) {
      const z = (state.zukan[r.charId] ||= { endings: {} });
      z.seen = true; z.bye = (z.bye || 0) + 1;
    }
    await dialog(["次はもっとお世話してあげよう。"]);
  }
  el.actor.classList.remove("ghost", "gone", "walking");
  state.current = null;
  save(true);
  setX(50, 0);
  render();
}

let pendingCallLine = false;
function handleEvents(evs) {
  if (!evs.length) return;
  if (evs.includes("miss")) { toast("お世話ミス…！"); sfx("bad"); }
  if (evs.includes("fellAsleep") || evs.includes("wokeUp") || evs.includes("nightSleep") || evs.includes("morning")) { stopWalkHere(); render(); }
  if (evs.includes("morning")) setTimeout(() => say("おはよう"), 300);
  if (evs.includes("wokeUp")) line("happy");
  if (evs.includes("call") || evs.includes("mischief")) {
    if (state.view === "home" && state.current) toast(`${state.current.charId ? who(state.current).short : "あかちゃん"}が呼んでる！`);
  }
  if (evs.includes("call")) {
    sfx("call");
    pendingCallLine = true;
    if (!state.tips.call) {
      state.tips.call = 1; save();
      dialog(["「！」は呼んでるサイン。", "上の画面に、なにがほしいか出るよ。", "メーターが赤くて減ってたら本当。その世話をしてあげて。", "メーターが緑で足りてるのに言ってたら、わがまま。「しかる」でしつけよう。", "「しかる」は呼ばれてるときだけ使えるよ。"]);
    }
  }
  if (evs.includes("mischief")) {
    sfx("call");
    pendingCallLine = true;
    anim("wobble", 600);
    if (!state.tips.mischief) {
      state.tips.mischief = 1; save();
      dialog(["いたずらしてる！", "いたずらは「しかる」で止めよう。", "ほうっておいたり、ほかの世話でごまかすと、しつけが下がるよ。"]);
    }
  }
  if (evs.includes("mischiefGone")) { tidyUp(); toast("いたずらを止められなかった…（しつけダウン）"); }
  if (evs.includes("evolve")) { revealing = true; evolved(); }
  if (evs.includes("grow")) grewUp();
  if (evs.includes("end")) endRun();
}
const WANT_LINE = { hunger: "hungry", clean: "dirty", energy: "sleepy", happy: "whim" };
function callLine() {
  const r = state.current;
  if (!r || !r.call || r.sleeping || busyUI || mg) return false;
  const c = r.call;
  if (c.type === "mischief") line("mischief", 2600);
  else if (c.type === "refuse") line("refuse", 2600);
  else if (c.type === "whim" && c.want === "happy") line("whim", 2600);
  else line(WANT_LINE[c.want], 2600);
  return true;
}

// 呼び出しへの対応。甘やかしたら記録
function answerCall(actionId) {
  const r = state.current;
  if (!r || !r.call) return null;
  if (r.call.type === "need") {
    if (ACT_STAT[actionId] === r.call.want) { r.call = null; r.callCool = 60; return "helped"; }
    return null;
  }
  // わがまま・いたずら・いやいや中に世話をする＝甘やかし
  const wasMischief = r.call.type === "mischief";
  r.call = null; r.callCool = 60;
  spoil(r);
  if (wasMischief) tidyUp();
  toast("甘やかしちゃった…（しつけダウン）");
  return "spoiled";
}

// 言うことを聞かない（しつけが低いとき）
function maybeRefuse(id) {
  const r = state.current;
  if (r.call || r.phase === "baby" || r.shitsuke >= CONFIG.refuseBelow) return false;
  if (Math.random() >= CONFIG.refuseChance) return false;
  r.call = { type: "refuse", want: ACT_STAT[id] || "happy", t: CONFIG.callMin * 60 };
  anim("squish", 350);
  line("refuse");
  render(); save();
  if (!state.tips.refuse) {
    state.tips.refuse = 1;
    dialog(["いやがってる……。", "しつけが低いと、言うことを聞かないみたい。", "「しかる」でしつけてから、もう一回やってみよう。"]);
  }
  return true;
}
function tidyUp() { el.room.classList.remove("mess"); }

// ---------- ごはん・好物 ----------
const foodById = (id) => FOODS.find((f) => f.id === id);
function prefOf(c, foodId) {
  if (c.likes && c.likes.includes(foodId)) return "like";
  if (c.dislikes && c.dislikes.includes(foodId)) return "dislike";
  return "normal";
}
let trayOpen = false;
// onPick を渡すと、おうちのおやつ用に使える
function openTray(onPick, forChar) {
  const r = state.current;
  const c = forChar === undefined ? who(r) : forChar;
  const known = (c && (state.zukan[c.id] || {}).foods) || {};
  const grid = $("#tray-grid");
  grid.innerHTML = "";
  for (const f of FOODS) {
    const b = document.createElement("button");
    const k = known[f.id];
    b.className = "food" + (k ? " " + k : "");
    b.innerHTML = `${f.icon}<span>${f.name}</span>${k === "like" ? '<em>好物</em>' : k === "dislike" ? '<em>苦手</em>' : ""}`;
    b.addEventListener("click", () => {
      closeTray(); sfx("btn");
      if (typeof onPick === "function") { onPick(f); return; }
      feed(f.id, answerCall("food")); render(); save();
    });
    grid.appendChild(b);
  }
  $("#tray").hidden = false;
  trayOpen = true;
  pauseWalk(60000);
}
function closeTray() {
  $("#tray").hidden = true;
  trayOpen = false;
  walkPauseUntil = 0;
}
$("#tray-close").addEventListener("click", () => { closeTray(); if (homeMode) setHomeMode(null); });

const STAT_NAME = { hunger: "おなか", happy: "きげん", clean: "せいけつ", energy: "げんき" };
function showDeltas(D) {
  let i = 0;
  for (const k in D) {
    if (!D[k]) continue;
    const up = D[k] > 0;
    fx(`<span class="delta ${up ? "up" : "down"}">${STAT_NAME[k]}${up ? "+" : ""}${D[k]}</span>`, "", 60, 10 - i * 22, i * 120);
    i++;
  }
}
function feed(foodId, res) {
  const r = state.current;
  const s = r.stats;
  if (s.hunger >= 95 && res !== "spoiled") { s.happy = clamp(s.happy - 5); anim("squish", 350); say("もういらない…"); return; }
  const icon = foodId === "milk" ? ICON.milk : foodById(foodId).icon;
  fx(icon, "drop", 0, 0);
  setTimeout(() => {
    if (state.current !== r || r.ended) return;
    if (foodId === "milk") {
      s.hunger = clamp(s.hunger + 35); s.happy = clamp(s.happy + 5);
      anim("squish", 350); hearts(2); line(res === "spoiled" ? "spoiled" : "eat"); sfx("eat");
    } else {
      const c = who(r);
      const pref = prefOf(c, foodId);
      const D = { like: { hunger: 40, happy: 15, energy: 10 }, dislike: { hunger: 15, happy: -15, energy: -10 }, normal: { hunger: 35, happy: 5, energy: 0 } }[pref];
      for (const k in D) s[k] = clamp(s[k] + D[k]);
      showDeltas(D);
      if (pref === "like") { anim("jump", 500); hearts(4); line("liked"); sfx("good"); }
      else if (pref === "dislike") { anim("squish", 350); fx(ANGER, "", 26, -20); line("disliked"); sfx("bad"); }
      else { anim("squish", 350); hearts(2); line(res === "spoiled" ? "spoiled" : "eat"); sfx("eat"); }
      const z = (state.zukan[c.id] ||= { endings: {} });
      z.foods ||= {};
      if (!z.foods[foodId]) {
        z.foods[foodId] = pref;
        const n = foodById(foodId).name;
        if (pref === "like") toast(`好物を見つけた！「${n}」`);
        else if (pref === "dislike") toast(`「${n}」は苦手みたい…`);
      }
    }
    render(); save();
  }, 650);
}

// ---------- あっちむいてほい ----------
let mg = null;
let mgScoreEl = null;
function startMinigame() {
  const r = state.current;
  const res = answerCall("play");
  mg = { round: 0, hits: [], locked: false, spoiled: res === "spoiled" };
  stopWalkHere();
  el.actor.style.setProperty("--face", "1");
  mgScoreEl = document.createElement("div");
  mgScoreEl.className = "mg-score";
  el.room.appendChild(mgScoreEl);
  updateScore();
  say("あっちむいて……", 0);
  render();
}
function updateScore() {
  if (!mgScoreEl) return;
  let html = "";
  for (let i = 0; i < CONFIG.mgRounds; i++) {
    const h = mg.hits[i];
    html += `<i class="${h === true ? "hit" : h === false ? "miss" : ""}"></i>`;
  }
  mgScoreEl.innerHTML = html;
}
async function mgPick(dir) {
  if (!mg || mg.locked) return;
  mg.locked = true; lastActionsKey = ""; renderActions();
  const look = Math.random() < 0.5 ? "L" : "R";
  say("ほい！", 900);
  el.actor.classList.add("look" + look);
  el.look.textContent = look === "L" ? "←" : "→";
  el.look.hidden = false;
  const hit = look === dir;
  mg.hits.push(hit);
  updateScore();
  fx(hit ? "○" : "×", "mark" + (hit ? "" : " no"), 0, -30);
  sfx(hit ? "hit" : "miss");
  await sleepMs(950);
  if (!mg) return;
  el.actor.classList.remove("lookL", "lookR");
  el.look.hidden = true;
  mg.round++;
  if (mg.round >= CONFIG.mgRounds) { endMinigame(false); return; }
  mg.locked = false; lastActionsKey = "";
  say("あっちむいて……", 0);
  render();
}
function endMinigame(silent) {
  const r = state.current;
  const wins = mg.hits.filter(Boolean).length;
  const win = wins >= CONFIG.mgWinAt;
  mg = null;
  if (mgScoreEl) { mgScoreEl.remove(); mgScoreEl = null; }
  el.actor.classList.remove("lookL", "lookR");
  el.look.hidden = true;
  el.bubble.hidden = true;
  if (silent || !r) return;
  const s = r.stats;
  s.happy = clamp(s.happy + (win ? 40 : 25));
  s.energy = clamp(s.energy - 6);
  s.hunger = clamp(s.hunger - 4);
  if (r.phase === "baby" && win) r.baby.gentle += 1;
  else if (win) r.log.wins++;
  anim("jump", 500);
  if (win) { hearts(3); sfx("good"); setTimeout(() => line("play"), 200); toast(`${wins}勝！きげん大アップ`); }
  else { fx(NOTE, "", 0, -10); setTimeout(() => line("happy"), 200); toast(`${wins}勝…でも楽しかったみたい（きげんアップ）`); }
  render(); save();
}

// ---------- 行動 ----------
let lastPet = 0, lastGentle = 0;
function doAction(id) {
  if (busyUI) return;
  const r = state.current;
  switch (id) {
    case "start": startRun(); return;
    case "home": enterHome(); return;
    case "back": leaveHome(); return;
    case "hTalk": if (homeMode && homeMode.type === "talk") setHomeMode(null); else { if (trayOpen) closeTray(); setHomeMode({ type: "talk" }); } return;
    case "hSnack":
      if (homeMode && homeMode.type === "snack") { setHomeMode(null); return; }
      setHomeMode(null);
      openTray((f) => setHomeMode({ type: "snack", food: f }), null);
      return;
    case "mgL": mgPick("L"); return;
    case "mgR": mgPick("R"); return;
  }
  if (!r || r.ended || mg) return;
  if (trayOpen) closeTray();
  const s = r.stats;

  if (id === "warm") {
    r.temp = clamp(r.temp + CONFIG.warmPerTap);
    anim("squish", 350);
    fx(HEAT, "", -20, 10); fx(HEAT, "", 22, 0, 120); sfx("warm");
  } else if (id === "incubate") {
    dialog(["あたため器にまかせる？", `${CONFIG.incubateMin}分でかえるよ。画面を閉じていても進む。`, "そのかわり、生まれる子は「ふつう」になる。"], [
      { label: "まかせる", value: true }, { label: "自分であたためる", value: false, sub: true },
    ]).then((v) => {
      if (!v || !state.current || state.current.phase !== "egg") return;
      state.current.incubate = true;
      state.current.wobbleUntil = 0;
      el.actor.classList.remove("shaking");
      save(true); render();
      toast("あたため器にセットした");
    });
    return;
  } else if (id === "fan") {
    r.temp = clamp(r.temp - CONFIG.fanPerTap);
    anim("squish", 350);
    for (let i = 0; i < 3; i++) fx("", "wind", -50 + i * 8, 10 + i * 14, i * 80);
    sfx("fan");
  } else if (id === "pet") {
    anim("squish", 350); hearts(1); sfx("heart");
    if (r.wobbleUntil) {
      r.wobbleUntil = 0; r.eggQ = clamp(r.eggQ + 6);
      el.actor.classList.remove("shaking");
      el.bubble.hidden = true;
      toast("落ち着いた！");
    }
  } else if (id === "play") {
    if (maybeRefuse(id)) return;
    startMinigame();
    return;
  } else if (id === "scold") {
    const c = r.call;
    anim("squish", 350);
    fx(ANGER, "", 26, -20);
    sfx("scold");
    if (c && c.type !== "need") {
      r.call = null; r.callCool = 60;
      s.happy = clamp(s.happy - 5);
      r.shitsuke = clamp(r.shitsuke + CONFIG.scoldGain);
      if (r.phase === "baby") r.baby.strict += 2; else r.log.discipline += 1;
      if (c.type === "mischief") tidyUp();
      line("scolded");
      toast("しつけ成功！（しつけアップ）"); sfx("good");
    } else {
      s.happy = clamp(s.happy - 10);
      if (r.phase === "baby") r.baby.strict += 1;
      line("hurt");
      toast(c ? "本当に困ってたのに……（きげんダウン）" : "理由もなくしかった……（きげんダウン）"); sfx("bad");
    }
  } else {
    if (id !== "wake" && maybeRefuse(id)) return;
    const res = id === "food" && r.phase !== "baby" ? null : answerCall(id);
    if (id === "food") {
      if (r.phase === "baby") feed("milk", res);
      else { openTray(); return; }
    } else if (id === "bath") {
      s.clean = 100; s.happy = clamp(s.happy + 5); sfx("bath");
      for (let i = 0; i < 8; i++) fx("", "bubbleo", (Math.random() - .5) * 90, 20 + Math.random() * 40, i * 90);
      anim("squish", 350);
      setTimeout(() => line(res === "spoiled" ? "spoiled" : "bath"), 600);
    } else if (id === "sleep") {
      stopWalkHere(); r.sleeping = true;
      if (res === "spoiled") setTimeout(() => line("spoiled", 1500), 100);
    } else if (id === "wake") {
      if (r.night) {
        // 夜に起こすと5分だけ起きて、またねる
        r.night = false;
        state.awakeUntil = Date.now() + 5 * 60 * 1000;
        s.happy = clamp(s.happy - 10);
        setTimeout(() => say("……まだ夜だよ"), 100);
      }
      r.sleeping = false;
      if (s.energy < 30) { s.happy = clamp(s.happy - 10); setTimeout(() => say("……まだねむい"), 100); }
    }
  }
  render();
  save();
}

el.actor.addEventListener("click", () => {
  const r = state.current;
  if (!r || r.ended || busyUI || mg) return;
  if (r.phase === "egg") { doAction("pet"); return; }
  if (r.sleeping) { anim("squish", 350); return; }
  const now = Date.now();
  // なでる：10秒に1回きげん+8（あかちゃん期のやさしさは30秒に1回）
  if (now - lastPet > 10000) {
    r.stats.happy = clamp(r.stats.happy + 8);
    fx(HEART, "", 0, -20);
    if (r.phase === "baby" && now - lastGentle > 60000) { r.baby.gentle += 1; lastGentle = now; }
    lastPet = now;
  }
  stopWalkHere();
  anim("jump", 500);
  hearts(1); sfx("heart");
  if (r.call) callLine();
  else line(r.stats.happy > 80 ? pick(["tap", "happy"]) : "tap");
  render(); save();
});

// ---------- 小さなキャラ（おうちの住人・遊びに来た子） ----------
// 部屋の中を歩ける actor を作る。each: { c, el, x, busy, timers }
function makeMini(c, x, height) {
  const a = document.createElement("div");
  a.className = "actor mini";
  a.innerHTML = `<div class="shadow"></div><div class="body"><img src="${c.sprite}" alt="${c.short}" draggable="false"${c.smooth ? ' style="image-rendering:auto"' : ""}></div><div class="vb" hidden></div>`;
  a.style.left = x + "%";
  a.style.height = height;
  el.neighbors.appendChild(a);
  const m = { c, el: a, x, busy: false, timers: [] };
  a.addEventListener("click", (e) => {
    e.stopPropagation();
    if (busyUI || m.busy) return;
    if (state.view === "home") { homeTap(m); return; }
    a.classList.remove("jump"); void a.offsetWidth; a.classList.add("jump");
    miniSay(m, pick(c.lines.happy.concat(c.lines.tap)));
  });
  return m;
}
function miniLater(m, fn, ms) { m.timers.push(setTimeout(fn, ms)); }
function miniFace(m, dir) { m.el.querySelector("img").style.transform = `scaleX(${dir})`; }
function miniMove(m, nx, cb, speed = 10) {
  const sec = Math.abs(nx - m.x) / speed;
  miniFace(m, nx < m.x ? -1 : 1);
  m.el.style.setProperty("--walk", sec + "s");
  m.el.classList.add("walking");
  m.el.style.left = nx + "%";
  m.x = nx;
  miniLater(m, () => { m.el.classList.remove("walking"); cb && cb(); }, sec * 1000 + 30);
}
function miniSay(m, text, ms = 2200) {
  const b = m.el.querySelector(".vb");
  b.textContent = text;
  b.hidden = false;
  b.style.animation = "none"; void b.offsetWidth; b.style.animation = "";
  clearTimeout(m.sayT);
  m.sayT = setTimeout(() => (b.hidden = true), ms);
}
function miniJump(m) { m.el.classList.remove("jump"); void m.el.offsetWidth; m.el.classList.add("jump"); }
function miniHeart(m, html = HEART) {
  const s = el.room.getBoundingClientRect(), b = m.el.getBoundingClientRect();
  const d = document.createElement("div");
  d.className = "fx"; d.innerHTML = html;
  d.style.left = b.left - s.left + b.width / 2 + "px";
  d.style.top = b.top - s.top + b.height * 0.2 + "px";
  el.fx.appendChild(d);
  setTimeout(() => d.remove(), 1600);
}
function miniRemove(m) { m.timers.forEach(clearTimeout); clearTimeout(m.sayT); m.el.remove(); }

// ---------- ふたりの関係 ----------
const pairKey = (a, b) => [a, b].sort().join("|");
function pairData(key) { return Object.assign({}, PAIR_DEFAULT, PAIRS[key] || {}); }
// 友情ルートの最後のランク（この次から恋愛ルート）
function friendTop(key) {
  const rk = pairData(key).ranks;
  const i = rk.findIndex((r) => r.romance);
  return i < 0 ? rk.length - 1 : i - 1;
}
function pairRankIndex(key) {
  const n = state.bonds[key] || 0;
  let idx = -1;
  pairData(key).ranks.forEach((r, i) => { if (n >= r.at) idx = i; });
  // 応援していないペアは友情ルートで止まる
  if (state.cheer[key] !== "cheer") idx = Math.min(idx, friendTop(key));
  return idx;
}
const CHEER_LABEL = { cheer: "応援中", watch: "見守り中", no: "友達" };
async function askCheer(key) {
  const [a, b] = key.split("|").map((id) => charById(id).short);
  const v = await dialog([`${a}と${b}、ふたりの距離が近づいてる……`, "どうする？"], [
    { label: "応援する", value: "cheer" },
    { label: "見守る", value: "watch", sub: true },
    { label: "応援できない", value: "no", sub: true },
  ]);
  setCheer(key, v);
  const msg = { cheer: "ふたりを応援することにした！", watch: "しばらく見守ることにした。（ずかんからいつでも変えられるよ）", no: "ふたりはこれからも、いい友達。（ずかんからいつでも変えられるよ）" }[v];
  await dialog([msg]);
}
function setCheer(key, v) {
  state.cheer[key] = v;
  if (v !== "cheer") {
    state.together[key] = false;
    state.pairRank[key] = Math.min(state.pairRank[key] ?? -1, friendTop(key));
  }
  save(true);
}
function fill(text, key) {
  const [a, b] = key.split("|").map((id) => charById(id).short);
  return text.replace(/\{a\}/g, a).replace(/\{b\}/g, b);
}
function addBond(key, n) {
  state.bonds[key] = (state.bonds[key] || 0) + n;
  save();
}
// ランクが上がっていたらイベント。最高ランクなら同居の提案
async function checkPairEvents(key) {
  const idx = pairRankIndex(key);
  const shown = state.pairRank[key] ?? -1;
  const pd = pairData(key);
  if (idx > shown) {
    state.pairRank[key] = idx;
    save(true);
    const rk = pd.ranks[idx];
    sfx("fanfare");
    await dialog([...rk.scene.map((t) => fill(t, key)), `ふたりの関係が「${rk.name}」になった！`]);
    if (idx >= friendTop(key) && !state.cheer[key]) await askCheer(key);
    return;
  }
  if (idx >= friendTop(key) && !state.cheer[key]) { await askCheer(key); return; }
  const top = pd.ranks.length - 1;
  if (state.cheer[key] === "cheer" && idx === top && !state.together[key] && (state.bonds[key] || 0) >= (state.proposeAt[key] || 0)) {
    const lines = pd.proposal.lines.map((t) => fill(t, key));
    const yes = await dialog(lines, [{ label: "いっしょに暮らす", value: true }, { label: "まだはやい", value: false, sub: true }]);
    if (yes) { state.together[key] = true; await dialog([fill(pd.proposal.yes, key)]); }
    else { state.proposeAt[key] = (state.bonds[key] || 0) + 5; await dialog([fill(pd.proposal.no, key)]); }
    save(true);
    if (state.view === "home") { leaveHome(true); enterHome(); }
  }
}

// ---------- おうち ----------
let residents = [], homeTalkTimer = 0;
function clearNeighbors() {
  residents.forEach(miniRemove); residents = [];
  clearTimeout(homeTalkTimer);
  if (visitor) { miniRemove(visitor.m); visitor = null; }
  el.neighbors.innerHTML = "";
}
function enterHome() {
  if (mg) return;
  if (trayOpen) closeTray();
  state.view = "home";
  el.bubble.hidden = true;
  save();
  clearNeighbors();
  render();
  const list = homeResidents();
  // 同居ペアは隣どうしに並べる
  const order = [];
  for (const c of list) {
    if (order.includes(c)) continue;
    order.push(c);
    const mate = list.find((o) => o !== c && state.together[pairKey(c.id, o.id)] && !order.includes(o));
    if (mate) order.push(mate);
  }
  order.forEach((c, i) => {
    const x = order.length === 1 ? 50 : 18 + (i * 64) / (order.length - 1);
    const m = makeMini(c, x, order.length > 2 ? "27%" : "34%");
    residents.push(m);
    miniLater(m, () => homeWander(m), 1200 + i * 900);
  });
  scheduleHomeTalk();
}
// おうちに表示する子（最大 homeMax 人）。選んでいなければ先頭から自動
function homeResidents() {
  const grads = graduates();
  if (grads.length <= CONFIG.homeMax) return grads;
  const sel = grads.filter((c) => state.homeShow.includes(c.id)).slice(0, CONFIG.homeMax);
  return sel.length ? sel : grads.slice(0, CONFIG.homeMax);
}
function toggleHomeShow(id) {
  const cur = homeResidents().map((c) => c.id);
  if (cur.includes(id)) {
    if (cur.length <= 1) { toast("だれもいなくなっちゃうよ"); return; }
    state.homeShow = cur.filter((x) => x !== id);
  } else {
    if (cur.length >= CONFIG.homeMax) { toast(`おうちに出せるのは${CONFIG.homeMax}人まで。先にだれかを外してね`); return; }
    state.homeShow = cur.concat(id);
  }
  save(true);
  renderZukan();
  if (state.view === "home") { leaveHome(true); enterHome(); }
}
function mateOf(m) {
  return residents.find((o) => o !== m && state.together[pairKey(m.c.id, o.c.id)]);
}
function homeWander(m) {
  if (state.view !== "home") return;
  const next = () => miniLater(m, () => homeWander(m), 2000 + Math.random() * 4000);
  if (m.busy || busyUI) return next();
  const mate = mateOf(m);
  let nx = 12 + Math.random() * 76;
  // 同居中は相手の近くにいたがる
  if (mate && Math.random() < 0.6) nx = clamp(mate.x + (Math.random() < 0.5 ? -24 : 24), 12, 88);
  miniMove(m, nx, next);
}
function scheduleHomeTalk() {
  clearTimeout(homeTalkTimer);
  const [a, b] = CONFIG.homeTalkSec;
  homeTalkTimer = setTimeout(homeTalk, (a + Math.random() * (b - a)) * 1000);
}
// ふたりが近づいて会話 → 仲が深まる
function homeTalk() {
  if (state.view !== "home") return;
  if (residents.length < 2 || busyUI || homeMode) return scheduleHomeTalk();
  const free = residents.filter((m) => !m.busy);
  if (free.length < 2) return scheduleHomeTalk();
  if (free.length >= 3 && Math.random() < 0.25) { groupGather(free, scheduleHomeTalk); return; }
  const A = pick(free);
  const B = pick(free.filter((m) => m !== A));
  talkPair(A, B, scheduleHomeTalk);
}
// ふたりを近づけて会話させる
const lastTalk = {};
function talkPair(A, B, done) {
  const key = pairKey(A.c.id, B.c.id);
  lastTalk[key] = Date.now();
  A.busy = B.busy = true;
  const mid = clamp((A.x + B.x) / 2, 35, 65);
  let arrived = 0;
  const go = () => {
    if (++arrived < 2) return;
    miniFace(A, A.x < B.x ? 1 : -1);
    miniFace(B, B.x < A.x ? 1 : -1);
    const pd = pairData(key);
    const talk = pick(pd.talks);
    const speak = (w) => (w === "a" ? A : w === "b" ? B : A.c.id === w ? A : B);
    talk.forEach(([w, text], i) => miniLater(A, () => { const m = speak(w); miniSay(m, text, 2000); miniJump(m); }, i * 1900));
    miniLater(A, () => {
      const romance = state.cheer[key] === "cheer";
      miniHeart(A, romance ? HEART : STAR); miniHeart(B, romance ? HEART : STAR);
      addBond(key, state.together[key] || romance ? 2 : 1);
      A.busy = B.busy = false;
      checkPairEvents(key);
      done && done();
    }, talk.length * 1900 + 200);
  };
  const aLeft = A.x <= B.x;
  miniMove(A, mid + (aLeft ? -15 : 15), go);
  miniMove(B, mid + (aLeft ? 15 : -15), go);
}
// みんなで集まる（3人以上）
function groupGather(list, done) {
  list.forEach((m) => (m.busy = true));
  const n = list.length;
  let arrived = 0;
  list.forEach((m, i) => miniMove(m, 22 + (i * 56) / (n - 1), () => {
    if (++arrived < n) return;
    list.forEach((mm, k) => miniLater(mm, () => { miniSay(mm, pick(mm.c.lines.happy), 1800); miniJump(mm); miniHeart(mm, STAR); }, k * 700));
    miniLater(list[0], () => {
      for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) addBond(pairKey(list[a].c.id, list[b].c.id), 1);
      list.forEach((m) => (m.busy = false));
      toast("みんなでわいわいした！（みんな少し仲良くなった）");
      sfx("good");
      done && done();
    }, n * 700 + 1600);
  }));
}

// ---------- おうちでできること ----------
let homeMode = null; // { type: "talk", first } | { type: "snack", food }
function setHomeMode(mode) {
  homeMode = mode;
  residents.forEach((m) => m.el.classList.remove("picked", "pickable"));
  if (mode) residents.forEach((m) => m.el.classList.add("pickable"));
  if (mode && mode.first) mode.first.el.classList.add("picked");
  const hint = $("#home-hint");
  hint.hidden = !mode;
  if (mode) hint.textContent = mode.type === "talk" ? (mode.first ? `${mode.first.c.short}と話す子をタップ` : "話させたい子をタップ（2人）") : `「${mode.food.name}」をあげる子をタップ`;
  lastActionsKey = ""; renderActions();
}
const AFF_STEPS = [20, 50, 100];
function affStars(id) { const a = state.affection[id] || 0; return AFF_STEPS.filter((s) => a >= s).length; }
function addAffection(c, n) {
  const before = affStars(c.id);
  state.affection[c.id] = clamp((state.affection[c.id] || 0) + n, 0, 100);
  const after = affStars(c.id);
  save();
  if (after > before) {
    sfx("fanfare");
    dialog([`${c.short}が、すっかりなついてきた！`, `なつき度 ${"★".repeat(after)}${"☆".repeat(3 - after)}`, "遊びに来たときのお手伝いが、ちょっとパワーアップするよ。"]);
  }
}
const petCool = {};
function homeTap(m) {
  const c = m.c;
  if (homeMode && homeMode.type === "snack") {
    const food = homeMode.food;
    setHomeMode(null);
    const pref = prefOf(c, food.id);
    miniJump(m);
    if (pref === "like") { miniSay(m, pick(c.lines.liked)); miniHeart(m, STAR); miniHeart(m, STAR); sfx("good"); addAffection(c, 10); }
    else if (pref === "dislike") { miniSay(m, pick(c.lines.disliked)); sfx("bad"); addAffection(c, -3); }
    else { miniSay(m, pick(c.lines.eat)); miniHeart(m, STAR); sfx("eat"); addAffection(c, 4); }
    const z = (state.zukan[c.id] ||= { endings: {} });
    z.foods ||= {};
    if (!z.foods[food.id]) {
      z.foods[food.id] = pref;
      if (pref === "like") toast(`好物を見つけた！「${food.name}」`);
      else if (pref === "dislike") toast(`「${food.name}」は苦手みたい…`);
    }
    save();
    return;
  }
  if (homeMode && homeMode.type === "talk") {
    if (!homeMode.first) { setHomeMode({ type: "talk", first: m }); sfx("btn"); return; }
    if (homeMode.first === m) { setHomeMode({ type: "talk" }); return; }
    const A = homeMode.first, B = m;
    const key = pairKey(A.c.id, B.c.id);
    setHomeMode(null);
    if (Date.now() - (lastTalk[key] || 0) < 60000) { toast("さっき話したばかりみたい。ちょっと待ってね"); return; }
    if (A.busy || B.busy) { toast("いまはいそがしいみたい"); return; }
    talkPair(A, B);
    return;
  }
  // ふつうにタップ：なでる（20秒に1回なつき度+2）
  miniJump(m);
  miniSay(m, pick(c.lines.happy.concat(c.lines.tap)));
  sfx("heart");
  if (Date.now() - (petCool[c.id] || 0) > 20000) { petCool[c.id] = Date.now(); miniHeart(m, STAR); addAffection(c, 2); }
}
function leaveHome(silent) {
  if (homeMode) setHomeMode(null);
  if (trayOpen) closeTray();
  state.view = "room";
  clearNeighbors();
  el.bubble.hidden = true;
  save();
  if (!silent) render();
}

// ---------- あそびに来る ----------
let visitor = null, visitCheckAt = Date.now() + 30000;
function maybeVisit(now) {
  const r = state.current;
  if (visitor || now < visitCheckAt) return;
  visitCheckAt = now + 1000;
  if (!r || r.ended || r.phase === "egg" || r.sleeping || mg || busyUI || state.view !== "room") return;
  const cand = graduates().filter((c) => c.id !== r.charId);
  if (!cand.length) return;
  if (Math.random() > 1 / (CONFIG.visitEveryMin * 60)) return;
  startVisit(pick(cand));
}
function startVisit(c) {
  const fromLeft = actorX > 50;
  const m = makeMini(c, fromLeft ? -12 : 112, "44%");
  const k = state.fast ? 0.4 : 1;
  visitor = { m, until: Date.now() + CONFIG.visitStaySec * 1000 * k, helpAt: Date.now() + 4000 * k };
  toast(`${c.short}が遊びに来た！`); sfx("visit");
  miniMove(m, fromLeft ? 20 : 80, () => { miniSay(m, pick(c.lines.visit)); miniJump(m); }, 14);
}
function visitTick(now) {
  if (!visitor) return;
  const r = state.current;
  const m = visitor.m;
  if (!r || r.ended || state.view !== "room") { endVisit(true); return; }
  if (now > visitor.until) { endVisit(false); return; }
  if (m.busy || busyUI || mg || r.sleeping || now < visitor.helpAt) return;
  visitor.helpAt = now + CONFIG.visitHelpSec * 1000 * (state.fast ? 0.4 : 1);
  // いちばん減っているメーターを少し手伝う
  const k = STAT_KEYS.filter((x) => x !== "energy").sort((a, b) => r.stats[a] - r.stats[b])[0];
  if (r.stats[k] > 85) { miniSay(m, pick(m.c.lines.tap)); return; }
  const amt = 12 + affStars(m.c.id) * 4;
  r.stats[k] = clamp(r.stats[k] + amt);
  miniSay(m, pick(m.c.lines.help));
  miniJump(m);
  showDeltas({ [k]: amt });
  fx(STAR, "", 0, -20);
  render(); save();
}
function endVisit(silent) {
  const v = visitor;
  visitor = null;
  if (!v) return;
  const m = v.m, r = state.current;
  if (silent) { miniRemove(m); return; }
  miniSay(m, pick(m.c.lines.bye), 1500);
  // 育てている子とも仲が深まる（キャラが決まってから）
  if (r && r.charId && r.charId !== m.c.id) {
    const key = pairKey(r.charId, m.c.id);
    addBond(key, 2);
    toast(`${m.c.short}と${who(r).short}が少し仲良くなった`);
  }
  setTimeout(() => miniMove(m, m.x < 50 ? -15 : 115, () => miniRemove(m), 14), 1200);
}

// ---------- 天気（現実と連動） ----------
let weatherTimer = 0, weatherWarned = false;
function weatherKind(code) {
  if (code <= 1) return "clear";
  if (code <= 3) return "cloudy";
  if (code === 45 || code === 48) return "fog";
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return "snow";
  if (code >= 95) return "thunder";
  return "rain";
}
async function fetchWeather() {
  clearTimeout(weatherTimer);
  if (!state.settings.weather) { state.weather = null; applyWeather(); return; }
  weatherTimer = setTimeout(fetchWeather, 30 * 60 * 1000);
  const s = state.settings;
  const pos = s.city === "geo" && s.geo ? s.geo : CITIES.find((c) => c.id === s.city) || CITIES[2];
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${pos.lat}&longitude=${pos.lon}&current=weather_code&timezone=auto`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(res.status);
    const j = await res.json();
    state.weather = { kind: weatherKind(j.current.weather_code), at: Date.now() };
    save();
  } catch (e) {
    if (!weatherWarned) { weatherWarned = true; toast("天気を取れなかった（この画面では使えないかも）"); }
  }
  applyWeather();
}
const WEATHER_NAME = { clear: "はれ", cloudy: "くもり", fog: "きり", rain: "あめ", snow: "ゆき", thunder: "かみなり" };
function applyWeather() {
  const k = state.settings.weather && state.weather ? state.weather.kind : "clear";
  el.room.dataset.weather = k;
  const lab = $("#weather-now");
  if (lab) lab.textContent = state.settings.weather && state.weather ? `いま：${WEATHER_NAME[k]}` : "";
}
function useGeo() {
  if (!navigator.geolocation) { toast("現在地が使えないみたい"); return; }
  navigator.geolocation.getCurrentPosition(
    (p) => { state.settings.geo = { lat: +p.coords.latitude.toFixed(2), lon: +p.coords.longitude.toFixed(2) }; save(true); fetchWeather(); },
    () => { toast("現在地が取れなかった。地域を選んでね"); },
    { timeout: 8000 }
  );
}

// ---------- 時間帯 ----------
function updateTime() {
  const h = new Date().getHours();
  el.room.dataset.time = h >= 5 && h < 9 ? "morning" : h >= 9 && h < 16 ? "day" : h >= 16 && h < 19 ? "evening" : "night";
}

// ---------- メインループ ----------
let lastFrame = Date.now(), chatterAt = Date.now() + 15000, callLineAt = 0;
function tick() {
  const now = Date.now();
  const dt = Math.min(5, (now - lastFrame) / 1000);
  lastFrame = now;
  const r0 = state.current;
  if (r0 && r0.phase === "egg") eggStep(dt);
  else handleEvents(advance(dt));
  render();

  const r = state.current;
  if (r && !r.ended && r.phase !== "egg" && !r.sleeping && !busyUI && !mg && state.view === "room") {
    if (r.call && (pendingCallLine || now > callLineAt)) {
      if (callLine()) { pendingCallLine = false; callLineAt = now + 12000; }
    } else if (!r.call && now > chatterAt) {
      chatterAt = now + 20000 + Math.random() * 20000;
      if (Math.random() < 0.3) line("happy");
    }
  }
  maybeVisit(now);
  visitTick(now);
  if (Math.floor(now / 1000) % 10 === 0) save();
}

// ---------- 設定 ----------
function fillSettings() {
  $("#opt-fast").checked = state.fast;
  $("#opt-sound").checked = state.settings.sound;
  $("#opt-weather").checked = state.settings.weather;
  const city = $("#opt-city");
  if (!city.options.length) {
    for (const c of CITIES) city.add(new Option(c.name, c.id));
    city.add(new Option("現在地", "geo"));
    const hours = (sel) => { for (let h = 0; h < 24; h++) sel.add(new Option(`${h}:00`, h)); };
    hours($("#opt-bed")); hours($("#opt-wake"));
  }
  city.value = state.settings.city;
  city.disabled = !state.settings.weather;
  $("#opt-bed").value = state.settings.bed;
  $("#opt-wake").value = state.settings.wake;
  applyWeather();
}
$("#btn-settings").addEventListener("click", () => { fillSettings(); openSheet(el.settings); });
$("#opt-sound").addEventListener("change", (e) => { state.settings.sound = e.target.checked; save(true); if (e.target.checked) sfx("good"); });
$("#opt-weather").addEventListener("change", (e) => {
  state.settings.weather = e.target.checked; save(true); fillSettings();
  if (state.settings.weather && state.settings.city === "geo") useGeo(); else fetchWeather();
});
$("#opt-city").addEventListener("change", (e) => {
  state.settings.city = e.target.value; save(true);
  if (e.target.value === "geo") useGeo(); else fetchWeather();
});
$("#opt-bed").addEventListener("change", (e) => { state.settings.bed = +e.target.value; save(true); toast(`${e.target.value}:00 におやすみ`); });
$("#opt-wake").addEventListener("change", (e) => { state.settings.wake = +e.target.value; save(true); toast(`${e.target.value}:00 におきる`); });
$("#settings-close").addEventListener("click", () => closeSheet(el.settings));
$("#opt-fast").addEventListener("change", (e) => { state.fast = e.target.checked; save(true); toast(state.fast ? "はやおくり ON" : "はやおくり OFF"); });
$("#opt-reset").addEventListener("click", () => ($("#reset-confirm").hidden = false));
$("#reset-no").addEventListener("click", () => ($("#reset-confirm").hidden = true));
$("#reset-yes").addEventListener("click", () => {
  if (mg) endMinigame(true);
  state = freshState(); state.introDone = true;
  save(true); clearNeighbors(); setX(50, 0);
  $("#reset-confirm").hidden = true; closeSheet(el.settings);
  render(); toast("データを消したよ");
});
$("#btn-zukan").addEventListener("click", () => { if (!el.dialog.hidden) return; renderZukan(); openSheet(el.sheet); });
$("#sheet-close").addEventListener("click", () => closeSheet(el.sheet));
el.homeBtn.addEventListener("click", () => {
  if (busyUI) return;
  if (state.view === "home") leaveHome(); else enterHome();
});

// ---------- 起動 ----------
async function begin() {
  el.title.classList.add("out");
  setTimeout(() => (el.title.hidden = true), 500);
  if (!state.introDone) {
    state.introDone = true; save(true);
    await dialog(["ようこそ！", "ここは、ちいさな子を育てるおへや。", "たまごから育てて、ずかんの結末をぜんぶ集めよう。"]);
  }
}

const DEBUG = /debug/.test(location.hash);
function start(data) {
  state = data && data.state ? normalize(data.state) : load();
  if (!DEBUG) state.fast = false;
  $("#row-fast").hidden = !DEBUG;
  $("#title-ver").textContent = `ver ${VERSION}`;
  $("#set-ver").textContent = `ver ${VERSION}`;
  // 公開ページではオフラインでも遊べるようにする（使えない環境では何もしない）
  try {
    if ("serviceWorker" in navigator && location.protocol === "https:" && !/claude/.test(location.hostname)) {
      navigator.serviceWorker.register("sw.js").catch(() => {});
    }
  } catch (e) { /* なにもしない */ }
  const away = Math.max(0, (Date.now() - (state.lastTick || Date.now())) / 1000);
  const capped = Math.min(away, CONFIG.offlineCapHours * 3600);
  let evs = [];
  if (state.current && state.current.phase === "egg" && state.current.incubate) eggCatchUp(capped);
  if (state.current && capped > 5) {
    evs = advance(capped, true);
    if (away > 120) setTimeout(() => toast(`おるすばん ${Math.round(away / 60)}分`), 600);
  }
  updateTime();
  setInterval(updateTime, 60000);
  fetchWeather();
  render();
  if (state.view === "home") { state.view = "room"; enterHome(); }
  if (data && data.state) el.title.hidden = true;
  else el.title.addEventListener("click", begin, { once: true });
  if (evs.length) {
    const fire = () => handleEvents(evs);
    if (el.title.hidden) fire(); else el.title.addEventListener("click", () => setTimeout(fire, 600), { once: true });
  }
  lastFrame = Date.now();
  setInterval(tick, 1000);
  walkLoop();
  let hiddenAt = 0;
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) { hiddenAt = Date.now(); save(true); return; }
    if (hiddenAt) {
      const sec = Math.min((Date.now() - hiddenAt) / 1000, CONFIG.offlineCapHours * 3600);
      hiddenAt = 0;
      if (sec > 5) { eggCatchUp(sec); handleEvents(advance(sec, true)); render(); }
    }
    lastFrame = Date.now();
  });
  window.addEventListener("pagehide", () => save(true));
  window.claude?.hot?.snapshot?.(() => ({ state }));
}

window.claude?.hot?.ready ? window.claude.hot.ready(start) : start(window.claude?.hot?.data ?? {});
})();
