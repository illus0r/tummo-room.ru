// Фото для этажей страницы «Моя керамика» (готовит pnpm photos).
// floors[i] — фото из папки i+1, а если её нет — из общей папки all.
const fs = require("fs");

const DIR = "src/assets/img/ceramics";

// пропорции (ширина/высота) из заголовка webp — чтобы странице не скачивать фото ради размеров
function webpAspect(file) {
  const b = fs.readFileSync(file).subarray(0, 30);
  const kind = b.toString("ascii", 12, 16);
  if (kind === "VP8X") return (b.readUIntLE(24, 3) + 1) / (b.readUIntLE(27, 3) + 1);
  if (kind === "VP8 ") return (b.readUInt16LE(26) & 0x3fff) / (b.readUInt16LE(28) & 0x3fff);
  if (kind === "VP8L") {
    const bits = b.readUInt32LE(21);
    return ((bits & 0x3fff) + 1) / (((bits >> 14) & 0x3fff) + 1);
  }
  return 2 / 3;
}
const list = (sub) =>
  fs.existsSync(`${DIR}/${sub}`)
    ? fs.readdirSync(`${DIR}/${sub}`).filter((f) => f.endsWith(".webp")).map((f) => `/assets/img/ceramics/${sub}/${f}`)
    : [];

module.exports = () => ({
  aspects: Object.fromEntries(
    ["all", 1, 2, 3, 4, 5].flatMap(list).map((src) => [src, webpAspect("src" + src)])
  ),
  bgs: ["shop-ceramics", "photo-vase", "shop-tea", "photo-table", "nature-cliff"].map((n) => `/assets/img/${n}.webp`),
  floors: [1, 2, 3, 4, 5].map((n) => (list(n).length ? list(n) : list("all"))),
});
