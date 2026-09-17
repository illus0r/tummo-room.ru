#!/bin/sh
# Сжимает фото из «для сайта/моя керамика» в webp для страницы «Моя керамика».
#   !….jpg              — пропускаются (фоны этажей пока заданы в src/_data/ceramics.js)
#   1/ … 5/*.jpg        → 1/ … 5/*.webp          (фото этажа)
#   остальные в корне   → all/*.webp             (для этажей без своей папки)
# Папка с результатом каждый раз собирается заново — так не остаётся лишних фото.
set -e
SRC="src/assets/img/для сайта/моя керамика"
OUT="src/assets/img/ceramics"
rm -rf "$OUT"

conv() { # $1 — исходник, $2 — результат, $3 — ширина
  mkdir -p "$(dirname "$2")"
  cwebp -quiet -metadata icc -resize "$3" 0 -q 78 "$1" -o "$2" && echo "→ $2"
}

for f in "$SRC"/*; do
  [ -f "$f" ] || continue
  name=$(basename "$f"); base=${name%.*}
  case "$name" in
    !*)      ;;
    *.webp)  mkdir -p "$OUT/all"; cp "$f" "$OUT/all/" ;;
    *)       conv "$f" "$OUT/all/$base.webp" 1200 ;;
  esac
done

for n in 1 2 3 4 5; do
  for f in "$SRC/$n"/*; do
    [ -f "$f" ] || continue
    name=$(basename "$f")
    conv "$f" "$OUT/$n/${name%.*}.webp" 1200
  done
done
