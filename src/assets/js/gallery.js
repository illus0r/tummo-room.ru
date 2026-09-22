// Галерея «Примеры работ» на странице «Моя керамика»: плитка превью, по клику под рядом
// раскрывается фото в половину ширины сетки. Фото — window.GALLERY из src/_data/photos.js,
// число фото в ряду — --g-cols в ceramics.njk.
(function () {
  var PHOTOS = window.GALLERY || [];
  var grid = document.getElementById('fl-g-grid');
  if (!grid || !PHOTOS.length) return;

  var tiles = PHOTOS.map(function (p, i) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'fl-g-item';
    b.setAttribute('aria-label', 'Фото ' + (i + 1));
    var img = document.createElement('img');
    img.src = p.thumb; img.alt = ''; img.loading = 'lazy';
    b.appendChild(img);
    b.addEventListener('click', function () { open(current === i ? -1 : i); });
    grid.appendChild(b);
    return b;
  });

  // раскрытое фото — строкой под рядом
  var panel = document.createElement('div');
  panel.className = 'fl-g-open';
  panel.innerHTML =
    '<div class="fl-g-frame"><img class="fl-g-big" alt=""></div>' +
    '<div class="fl-g-ctl"><div class="fl-g-stick">' +
    '<button type="button" class="fl-g-nav fl-g-prev" aria-label="Предыдущее">‹</button>' +
    '<button type="button" class="fl-g-nav fl-g-next" aria-label="Следующее">›</button>' +
    '<button type="button" class="fl-g-close" aria-label="Закрыть">×</button>' +
    '</div></div>';
  var big = panel.querySelector('.fl-g-big');
  panel.querySelector('.fl-g-prev').addEventListener('click', function () { step(-1); });
  panel.querySelector('.fl-g-next').addEventListener('click', function () { step(1); });
  panel.querySelector('.fl-g-close').addEventListener('click', function () { open(-1); });

  var current = -1;

  function cols() {
    return getComputedStyle(grid).gridTemplateColumns.split(' ').length || 1;
  }

  function open(i) {
    var tile = tiles[i];
    // закрытие ряда выше сдвигает страницу — держим нажатое фото на том же месте экрана
    var before = tile && tile.getBoundingClientRect().top;

    if (current >= 0) tiles[current].classList.remove('on');
    current = i;
    if (i < 0) {
      panel.remove();
      relayout();
      return;
    }
    tile.classList.add('on');

    var c = cols();
    var last = Math.min((Math.floor(i / c) + 1) * c, tiles.length) - 1;
    if (panel.previousSibling !== tiles[last] || !panel.parentNode) grid.insertBefore(panel, tiles[last].nextSibling);

    if (big.getAttribute('src') !== PHOTOS[i].full) big.src = PHOTOS[i].full;
    relayout();

    var shift = tile.getBoundingClientRect().top - before;
    if (shift) window.scrollBy(0, shift);
    // и плавно ставим раскрытое фото серединой на середину экрана
    var pr = panel.getBoundingClientRect();
    var need = Math.round(pr.top + pr.height / 2 - window.innerHeight / 2);
    if (need) window.scrollBy({ top: need, behavior: 'smooth' });
  }

  function step(d) {
    if (current < 0) return;
    open((current + d + tiles.length) % tiles.length);
  }

  // высота галереи поменялась — на компьютере этажи и абзацы ниже надо пересчитать
  function relayout() { window.dispatchEvent(new Event('fl:relayout')); }

  document.addEventListener('keydown', function (e) {
    if (current < 0) return;
    if (e.key === 'Escape') open(-1);
    else if (e.key === 'ArrowLeft') step(-1);
    else if (e.key === 'ArrowRight') step(1);
    else return;
    e.preventDefault();
  });

  // число фото в ряду меняется с шириной окна — раскрытое фото переставляем под свой ряд
  var lastCols = cols();
  window.addEventListener('resize', function () {
    if (current >= 0 && cols() !== lastCols) open(current);
    lastCols = cols();
  });

  relayout();
})();
