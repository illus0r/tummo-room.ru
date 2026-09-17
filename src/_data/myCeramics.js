// Фото для этажей страницы «Моя керамика» (готовит pnpm photos).
// floors[i] — фото из папки i+1, а если её нет — из общей папки all.
const fs = require("fs");

const DIR = "src/assets/img/my-ceramics";
const list = (sub) =>
  fs.existsSync(`${DIR}/${sub}`)
    ? fs.readdirSync(`${DIR}/${sub}`).filter((f) => f.endsWith(".webp")).map((f) => `/assets/img/my-ceramics/${sub}/${f}`)
    : [];

module.exports = () => ({
  bgs: ["shop-ceramics", "photo-vase", "shop-tea", "photo-table", "nature-cliff"].map((n) => `/assets/img/${n}.webp`),
  floors: [1, 2, 3, 4, 5].map((n) => (list(n).length ? list(n) : list("all"))),
});
