// ===== ちびそだて：起動（言語を選んで、その言語のファイルを読み込む） =====
(() => {
  const V = "0.2.2"; // 更新したら index.html の ?v= と一緒に上げる
  let lang = null;
  try { lang = localStorage.getItem("chibisodate-lang"); } catch (e) { /* なにもしない */ }
  if (lang !== "ja" && lang !== "ko") lang = /^ko/i.test(navigator.language || "") ? "ko" : "ja";
  window.CHIBI_LANG = lang;
  document.documentElement.lang = lang;

  if (lang === "ko") {
    // 韓国語が出るフォントに差し替え
    const font = document.createElement("link");
    font.rel = "stylesheet";
    font.href = "https://fonts.googleapis.com/css2?family=Gowun+Dodum&family=Jua&display=swap";
    document.head.appendChild(font);
    const st = document.createElement("style");
    st.textContent = 'html:root{--f-dot:"Gowun Dodum","Apple SD Gothic Neo","Malgun Gothic",sans-serif;--f-round:"Jua","Apple SD Gothic Neo","Malgun Gothic",sans-serif}#hud .meter{grid-template-columns:4.6em 1fr}#sheet .card.current::after{content:"키우는 중"}';
    document.head.appendChild(st);
    document.title = "꼬마키우기";

    // 画面に最初から書いてある文字
    const T = (sel, text, attr) => document.querySelectorAll(sel).forEach((n) => (attr ? n.setAttribute(attr, text) : (n.textContent = text)));
    const meters = { hunger: "포만감", happy: "기분", clean: "청결", energy: "기운", growth: "성장", shitsuke: "훈육", style: "성격" };
    for (const k in meters) T(`.meter[data-k="${k}"] > span`, meters[k]);
    T("#hud-miss", "돌봄 실수", "title");
    T("#btn-home", "집", "aria-label");
    T("#btn-zukan", "도감", "aria-label");
    T("#btn-settings", "설정", "aria-label");
    T("#sheet-close, #settings-close, #tray-close", "닫기", "aria-label");
    T(".erow:first-child > span:first-child", "온도");
    T("#egg-temp-label", "추워");
    T(".erow:last-child > span:first-child", "부화까지");
    T(".tray-head > span", "뭘 줄까?");
    const logo = document.querySelector(".logo");
    if (logo) logo.innerHTML = ["꼬", "마", "키", "우", "기"].map((c) => `<span>${c}</span>`).join("");
    T(".tap-start", "탭해서 시작");
    T("#sheet h2", "도감");
    T("#settings h2", "설정");
    const rows = { "opt-sound": "효과음", "opt-weather": "날씨를 현실과 연동", "opt-fast": "테스트용 빨리감기 (×20)" };
    for (const id in rows) { const n = document.getElementById(id); if (n) n.closest(".row").querySelector("span").firstChild.textContent = rows[id] + " "; }
    const bed = document.getElementById("opt-bed");
    if (bed) bed.closest(".row").querySelector("span").textContent = "취침";
    T("#opt-bed", "자는 시간", "aria-label");
    T("#opt-wake", "일어나는 시간", "aria-label");
    const city = document.getElementById("opt-city");
    if (city) { city.closest(".row").querySelector("span").textContent = "지역"; city.setAttribute("aria-label", "지역"); }
    T("#opt-reset", "데이터 전부 지우기");
    T(".credits p:first-child", "비공식 2차 창작 팬게임입니다. 원작자님·공식과는 일절 관계없습니다.");
    const ver = document.querySelector(".credits p:last-child");
    if (ver) ver.firstChild.textContent = "꼬마키우기 ";
    const rc = document.getElementById("reset-confirm");
    if (rc) rc.firstChild.textContent = "정말 지울까? ";
    T("#reset-yes", "지우기");
    T("#reset-no", "그만두기");
  }

  // データ → 本体の順に読み込む
  const files = lang === "ko" ? ["data.ko.js", "game.ko.js"] : ["data.js", "game.js"];
  const load = (i) => {
    if (i >= files.length) return;
    const s = document.createElement("script");
    s.src = files[i] + "?v=" + V;
    s.onload = () => load(i + 1);
    document.body.appendChild(s);
  };
  load(0);
})();
