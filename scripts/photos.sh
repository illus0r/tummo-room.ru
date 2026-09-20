#!/bin/sh
# Сжимает фото из «для сайта/<раздел>» в webp: src/assets/img/photos/<страница>/
#   !….jpg          → bg/*.webp   (кандидаты в фоны этажей; какие и куда — в src/_data/photos.js)
#   1/ … 5/*.jpg    → 1/ … 5/     (фото этажа)
#   остальные       → all/        (для этажей без своей папки)
# Папка с результатом каждый раз собирается заново — так не остаётся лишних фото.
set -e

conv() { # $1 — исходник, $2 — результат, $3 — максимальная ширина
  mkdir -p "$(dirname "$2")"
  # уменьшаем, только если оригинал шире: растянуть маленький — значит просто замылить его
  w=$(sips -g pixelWidth "$1" 2>/dev/null | awk '/pixelWidth/{print $2}')
  if [ -n "$w" ] && [ "$w" -gt "$3" ] 2>/dev/null; then
    cwebp -quiet -metadata icc -resize "$3" 0 -q 78 "$1" -o "$2" && echo "→ $2"
  else
    cwebp -quiet -metadata icc -q 78 "$1" -o "$2" && echo "→ $2"
  fi
}

page() { # $1 — папка с оригиналами, $2 — страница
  SRC="src/assets/img/для сайта/$1"
  OUT="src/assets/img/photos/$2"
  rm -rf "$OUT"
  for f in "$SRC"/*; do
    [ -f "$f" ] || continue
    name=$(basename "$f"); base=${name%.*}
    case "$name" in
      !*)     conv "$f" "$OUT/bg/$(echo "$base" | cut -c2- | tr -d " ").webp" 3840 ;;
      *.webp) mkdir -p "$OUT/all"; cp "$f" "$OUT/all/" ;;
      *)      conv "$f" "$OUT/all/$base.webp" 1200 ;;
    esac
  done
  for n in 1 2 3 4 5; do
    for f in "$SRC/$n"/*; do
      [ -f "$f" ] || continue
      name=$(basename "$f")
      conv "$f" "$OUT/$n/${name%.*}.webp" 1200
    done
  done
}

page "моя керамика" ceramics
page "мастерская" workshops
