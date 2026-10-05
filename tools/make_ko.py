#!/usr/bin/env python3
# 日本語版（data.js / game.js）から韓国語版（data.ko.js / game.ko.js）を作る。
# 日本語版を直したら、このスクリプトを実行し直す：  python3 tools/make_ko.py
import os, re, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from ko_strings import GAME, DATA

def curly(s):
    out, o = [], True
    for ch in s:
        if ch == '"': out.append('“' if o else '”'); o = not o
        else: out.append(ch)
    return "".join(out)

# ---- data.js ----
d = open(os.path.join(ROOT, "data.js"), encoding="utf-8").read()
for ja in sorted(DATA, key=len, reverse=True):
    for q in ('"', "'"):
        d = d.replace(q + ja + q, q + curly(DATA[ja]) + q)
d = d.replace("const CITIES = [", """const CITIES = [
  { id: "seoul", name: "서울", lat: 37.57, lon: 126.98 },
  { id: "busan", name: "부산", lat: 35.18, lon: 129.08 },
  { id: "incheon", name: "인천", lat: 37.46, lon: 126.71 },
  { id: "daegu", name: "대구", lat: 35.87, lon: 128.60 },
  { id: "daejeon", name: "대전", lat: 36.35, lon: 127.38 },
  { id: "gwangju", name: "광주", lat: 35.16, lon: 126.85 },
  { id: "jeju", name: "제주", lat: 33.50, lon: 126.53 },""", 1)
open(os.path.join(ROOT, "data.ko.js"), "w", encoding="utf-8").write("// 自動生成（tools/make_ko.py）。直接編集しないでね\n" + d)

# ---- game.js ----
g = open(os.path.join(ROOT, "game.js"), encoding="utf-8").read()
for ja in sorted(GAME, key=len, reverse=True):
    g = g.replace(ja, GAME[ja])
g = g.replace('"use strict";', '''"use strict";
// 韓国語の助詞（받침の有無で 이/가・은/는・을/를・과/와・으로/로 を選ぶ）
function P(w, pair) {
  const [a, b] = pair.split("/");
  const ch = String(w || "").trim().slice(-1).charCodeAt(0);
  if (!(ch >= 0xac00 && ch <= 0xd7a3)) return b;
  const jong = (ch - 0xac00) % 28;
  if (pair === "으로/로" && jong === 8) return b;
  return jong ? a : b;
}
const J = (w, pair) => w + P(w, pair);''', 1)
g = g.replace('city: "tokyo"', 'city: "seoul"').replace("|| CITIES[2]", "|| CITIES[0]")
open(os.path.join(ROOT, "game.ko.js"), "w", encoding="utf-8").write("// 自動生成（tools/make_ko.py）。直接編集しないでね\n" + g)

# ---- 訳し忘れチェック ----
jp = re.compile(r"[぀-ヿ一-鿿]")
left = 0
for f in ("data.ko.js", "game.ko.js"):
    for i, line in enumerate(open(os.path.join(ROOT, f), encoding="utf-8"), 1):
        code = re.sub(r"/\*.*?\*/", "", re.sub(r"//.*$", "", line))
        if jp.search(code):
            left += 1
            print(f"訳し忘れ? {f}:{i}: {code.strip()[:90]}")
print("OK" if not left else f"{left}行に日本語が残ってる（tools/ko_strings.py に訳を足してね）")
