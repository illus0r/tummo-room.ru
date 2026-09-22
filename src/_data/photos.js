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

// Галерея «Примеры работ»: имена по порядку показа. Файлы — photos/gallery/thumb/<имя>.webp
// (превью, 360 px в ширину) и photos/gallery/full/<имя>.webp (1200 px в ширину)
const gallery = [
  "IMG_20260311_174642",
  "IMG_20260526_145853",
  "IMG_20260406_210107",
  "IMG_20260901_125710",
  "1787644680113",
  "IMG_20260426_192606",
  "1787644776669",
  "IMG_20260527_183053",
  "1787645023701",
  "IMG_20260331_155825",
  "IMG_20260406_190512",
  "IMG_20260207_120823",
  "1787644776829",
  "IMG_20260207_121255",
  "IMG_20260526_145718",
  "IMG_20260207_123207",
  "IMG_20260421_152619",
  "IMG_20260207_123427",
  "IMG_20260209_154512",
  "IMG_20260421_152927",
  "IMG_20260426_193201",
  "IMG_20260311_170938",
  "IMG_20260527_181548",
  "IMG_20260311_172243",
  "IMG_20260901_130542",
  "IMG_20260311_173321",
  "IMG_20260527_173302",
  "IMG_20260311_171800",
  "IMG_20260331_154433",
  "IMG_20260527_181739",
  "1787644776786",
  "IMG_20260901_130907",
  "IMG_20260331_155806",
  "1787644680258",
  "IMG_20260527_183026",
  "IMG_20260402_173239",
  "IMG_20260527_173105",
  "IMG_20260311_171020",
  "IMG_20260901_130628",
  "IMG_20260402_164828",
  "IMG_20260527_181526",
  "IMG_20260209_153454",
  "IMG_20260527_173247",
  "IMG_20260406_183116",
  "IMG_20260207_121013",
  "IMG_20260421_152525",
  "IMG_20260526_145511",
  "IMG_20260421_160416",
  "IMG_20260426_193826",
  "IMG_20260517_113058",
  "IMG_20260527_182823",
  "IMG_20260526_145627",
  "IMG_20260527_172625",
  "IMG_20260527_172701",
  "IMG_20260406_185340",
  "IMG_20260527_172820",
  "IMG_20260527_182759",
  "IMG_20260421_154052",
  "IMG_20260901_130834",
  "IMG_20260901_131324",
].map((n) => ({ thumb: `/assets/img/photos/gallery/thumb/${n}.webp`, full: `/assets/img/photos/gallery/full/${n}.webp` }));

module.exports = () => ({
  gallery: gallery,
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
