// Фото для страниц «этажами»: photos.<страница> = { bgs, floors, aspects }.
// Готовые webp лежат в src/assets/img/photos/<страница>/ и хранятся в репозитории:
// bg/ — кандидаты в фоны этажей, all/ — вспышки, 1/…5/ — вспышки конкретного этажа.
// floors[i] — фото из папки i+1, а если её нет — из общей папки all.
const fs = require("fs");

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

function page(name, bgList) {
  const url = (sub) => `/assets/img/photos/${name}/${sub}`;
  const list = (sub) => {
    const dir = "src" + url(sub);
    return fs.existsSync(dir)
      ? fs.readdirSync(dir).filter((f) => f.endsWith(".webp")).sort().map((f) => `${url(sub)}/${f}`)
      : [];
  };
  const bgs = bgList || list("bg");
  // фото, стоящее фоном этажа, во вспышках не показываем
  const noBg = (photos) => photos.filter((src) => bgs.indexOf(src) < 0);
  return {
    aspects: Object.fromEntries(["all", 1, 2, 3, 4, 5].flatMap(list).map((src) => [src, webpAspect("src" + src)])),
    bgs: bgs,
    floors: [1, 2, 3, 4, 5].map((n) => noBg(list(n).length ? list(n) : list("all"))),
  };
}

module.exports = () => ({
  // фоны этажей по порядку, сверху вниз. Фон можно брать с любой страницы,
  // и в самих вспышках фоны не участвуют
  ceramics: page("ceramics", [
    "ceramics/bg/siluet-u-okna",
    "ceramics/bg/vaza-u-okna",
    "ceramics/bg/zavarivanie-chaya",
    "ceramics/bg/pialy-na-stole",
    "ceramics/bg/obryv-u-volgi",
  ].map((n) => `/assets/img/photos/${n}.webp`)),
  workshops: page("workshops", [
    "workshops/bg/studiya-stol",
    "workshops/bg/ruki-na-krugu",
    "ceramics/bg/chainaya-tseremoniya",
    "workshops/bg/obtochka-pialy",
    "workshops/bg/vid-na-volgu",
  ].map((n) => `/assets/img/photos/${n}.webp`)),
});
