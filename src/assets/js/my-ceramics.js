// Страница «Моя керамика»: этажи с фонами, вспышки фото (компьютер), смена фото между абзацами (телефон).
// Данные (фоны, фото, пропорции) — window.MY_CERAMICS из src/_data/myCeramics.js.
// Панель настроек — my-ceramics-tuner.js, грузится только с ?tune (см. в конце файла).
(function () {
  var field = document.getElementById('mc');
  var footer = document.getElementById('mc-footer');
  var logo = document.getElementById('mc-logo');

  var FLOOR_BGS = window.MY_CERAMICS.bgs;
  var FLOOR_PHOTOS = window.MY_CERAMICS.floors;
  var ASPECT = window.MY_CERAMICS.aspects;

  // размеры — в клетках квадратной сетки: ширина страницы / cols
  var cfg = {
    // фото
    cols: 12, tickMs: 650, holdMs: 4650, fadeMs: 1150, maxPhotos: 11,
    minU: 3, maxU: 6, attempts: 36, iters: 8,
    // текст
    txtCols: 6, txtGapRows: 4, txtInsetCols: 2, txtStartRows: 4,
    txtScale: 170, txtAlign: 0, txtBgOn: true, txtBgOpacity: 0,
    // этажи
    parallax: 67, floorDim: 70,
    paused: false
  };

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var mobileQuery = window.matchMedia('(max-width:767px)');
  function isMobile() { return mobileQuery.matches; }
  var textEls = [].slice.call(field.querySelectorAll('[data-txt]'));
  var textRects = [];   // занятые текстом, логотипом и футером прямоугольники
  var floorBands = [];  // этажи в строках сетки: { s, e }
  var floors = [];

  // ---- раскладка текста и этажей (компьютер) ----
  function layoutText() {
    if (isMobile()) {
      textEls.forEach(function (el) {
        el.style.left = el.style.right = el.style.top = el.style.width = '';
        el.classList.remove('hl');
      });
      field.style.height = '';
      textRects = []; floorBands = [];
      return;
    }
    var cols = cfg.cols;
    var cell = field.clientWidth / cols;
    var tcols = Math.max(1, Math.min(cfg.txtCols, cols - 1));
    var inset = Math.max(0, Math.min(cfg.txtInsetCols, cols - tcols));
    field.style.setProperty('--tscale', cfg.txtScale / 100);
    field.style.setProperty('--tbg', cfg.txtBgOpacity / 100);

    var row = cfg.txtStartRows;
    var blockRows = [];
    textRects = [];
    textEls.forEach(function (el, i) {
      el.classList.toggle('hl', !!cfg.txtBgOn);
      el.style.width = (tcols * cell) + 'px';
      var toLeft = cfg.txtAlign === 1 || (cfg.txtAlign === 0 && i % 2 === 0);
      var colX = Math.max(0, toLeft ? inset : cols - inset - tcols);
      el.style.left = (colX * cell) + 'px';
      el.style.top = (row * cell) + 'px';
      var hRows = Math.max(1, Math.ceil(el.offsetHeight / cell));
      textRects.push({ l: colX * cell, t: row * cell, r: (colX + tcols) * cell, b: (row + hRows) * cell });
      blockRows.push({ top: row, bot: row + hRows });
      row += hRows + cfg.txtGapRows;
    });
    row -= cfg.txtGapRows;

    // футер прибит к низу (bottom в стилях), оставляем под него место
    var fieldH = Math.max(
      (row + Math.max(2, cfg.txtGapRows)) * cell,
      (row + 2) * cell + footer.offsetHeight,
      window.innerHeight
    );
    field.style.height = fieldH + 'px';

    var fr = field.getBoundingClientRect();
    var lr = logo.getBoundingClientRect();
    textRects.push({ l: lr.left - fr.left - 8, t: 0, r: lr.right - fr.left + 8, b: lr.bottom - fr.top + 12 });
    var ft = footer.getBoundingClientRect();
    textRects.push({ l: 0, t: ft.top - fr.top - 8, r: fr.width, b: fieldH });

    // границы этажей — по линиям сетки, посередине между абзацами
    var starts = [0];
    for (var i = 1; i < blockRows.length; i++) starts.push(Math.round((blockRows[i - 1].bot + blockRows[i].top) / 2));
    starts.push(Math.max(1, Math.round(fieldH / cell)));
    floorBands = blockRows.map(function (_, i) { return { s: starts[i], e: starts[i + 1] }; });
  }

  function buildFloors() {
    field.querySelectorAll('.mc-floor').forEach(function (n) { n.remove(); });
    floors = [];
    if (isMobile()) return;
    var cell = field.clientWidth / cfg.cols;
    floorBands.forEach(function (b, i) {
      var el = document.createElement('div');
      el.className = 'mc-floor';
      el.style.top = (b.s * cell) + 'px';
      el.style.height = ((b.e - b.s) * cell) + 'px';
      var bg = new Image();
      bg.className = 'mc-floor-bg'; bg.alt = '';
      var dim = document.createElement('div');
      dim.className = 'mc-floor-dim';
      dim.style.opacity = cfg.floorDim / 100;
      el.appendChild(bg); el.appendChild(dim);
      field.insertBefore(el, field.firstChild);
      floors.push({ el: el, bg: bg, src: FLOOR_BGS[i % FLOOR_BGS.length] });
    });
    updateFloors();
  }

  function updateFloors() {
    var vh = window.innerHeight;
    var k = cfg.parallax / 100;
    floors.forEach(function (f) {
      var r = f.el.getBoundingClientRect();
      // фон грузим, когда этаж ближе двух экранов
      if (!f.bg.src && r.top < vh * 2 && r.bottom > -vh) f.bg.src = f.src;
      // k=0 — фон едет с этажом, k=1 — фон неподвижен и высотой в экран;
      // между ними смешиваем, так что видимая часть этажа всегда закрыта фоном
      f.bg.style.height = (r.height * (1 - k) + vh * k).toFixed(1) + 'px';
      f.bg.style.transform = 'translateY(' + (-k * r.top).toFixed(1) + 'px)';
    });
  }

  // ---- вспышки фото (компьютер) ----
  var active = [];
  var recent = []; // недавно исчезнувшие — чтобы не показывать их сразу снова
  function hit(a, b, pad) {
    return !(a.r + pad <= b.l || a.l - pad >= b.r || a.b + pad <= b.t || a.t - pad >= b.b);
  }
  function randInt(lo, hi) { return lo + Math.floor(Math.random() * (hi - lo + 1)); }
  function pick(list) { return list[(Math.random() * list.length) | 0]; }

  function tryPlace() {
    if (active.length >= cfg.maxPhotos) return;
    var H = field.clientHeight;
    var cell = field.clientWidth / cfg.cols;
    var vh = window.innerHeight;
    var vTop = window.scrollY - field.offsetTop;
    var b0 = Math.max(0, vTop - 0.25 * vh);
    var b1 = Math.min(H, vTop + 1.25 * vh);
    // фото берём из этажа, который сейчас в середине экрана
    var mid = (vTop + vh / 2) / cell, fi = 0;
    while (fi < floorBands.length - 1 && mid >= floorBands[fi].e) fi++;
    var pool = FLOOR_PHOTOS[fi] || [];
    if (!pool.length) return;

    var best = null, found = 0;
    for (var k = 0; k < cfg.attempts && found < cfg.iters; k++) {
      var name = pick(pool);
      if (active.some(function (p) { return p.name === name; })) continue;
      if (recent.indexOf(name) >= 0 && pool.length > active.length + recent.length) continue;
      // ширина — целые клетки, высота — по пропорциям снимка (без обрезки), верх — на линии сетки
      var wU = randInt(cfg.minU, Math.min(cfg.maxU, cfg.cols));
      var hPx = wU * cell / ASPECT[name];
      if (hPx > H) continue;
      var xU = randInt(0, cfg.cols - wU);
      var yLo = b0, yHi = b1 - hPx;
      if (yHi <= yLo) { yLo = 0; yHi = H - hPx; }
      var yU = Math.round((yLo + Math.random() * (yHi - yLo)) / cell);
      if (yU * cell + hPx > H) yU = Math.floor((H - hPx) / cell);
      if (yU < 0) continue;
      var rect = { l: xU * cell, t: yU * cell, r: (xU + wU) * cell, b: yU * cell + hPx };
      if (textRects.some(function (t) { return hit(rect, t, 0); })) continue;
      if (active.some(function (p) { return hit(rect, p, 2); })) continue;
      found++;
      var area = wU * hPx;
      if (!best || area > best.area) best = { name: name, rect: rect, area: area };
    }
    if (best) place(best.name, best.rect);
  }

  function place(name, rect) {
    var img = new Image();
    img.className = 'mc-photo';
    img.alt = '';
    img.style.left = rect.l + 'px';
    img.style.top = rect.t + 'px';
    img.style.width = (rect.r - rect.l) + 'px';
    img.style.height = (rect.b - rect.t) + 'px';
    img.style.setProperty('--fade', cfg.fadeMs + 'ms');
    // место занимаем сразу, а показываем фото, только когда оно загрузилось
    var e = { name: name, l: rect.l, t: rect.t, r: rect.r, b: rect.b };
    active.push(e);
    function release() {
      img.remove();
      active.splice(active.indexOf(e), 1);
    }
    img.onerror = release;
    img.onload = function () {
      field.appendChild(img);
      setTimeout(function () { img.classList.add('on'); }, 20);
      if (reduce) return;
      setTimeout(function () {
        img.classList.remove('on');
        setTimeout(function () {
          release();
          recent.push(name);
          if (recent.length > 6) recent.shift();
        }, cfg.fadeMs + 60);
      }, cfg.holdMs + cfg.fadeMs);
    };
    img.src = name;
  }

  function loop() {
    if (!cfg.paused && !isMobile() && !document.hidden) tryPlace();
    setTimeout(loop, cfg.tickMs);
  }

  // ---- телефон: по одному фото между абзацами ----
  // Первое фото ставим, когда место подъезжает к экрану. Меняем только видимые места
  // и только после загрузки нового фото, чтобы место не пустовало.
  var slots = [].slice.call(field.querySelectorAll('[data-slot]')).map(function (el) {
    return { el: el, img: el.querySelector('img') };
  });

  function swapSlot(i) {
    var sl = slots[i];
    var shown = slots.map(function (x) { return x.name; });
    var free = (FLOOR_PHOTOS[i] || []).filter(function (n) { return shown.indexOf(n) < 0; });
    if (!free.length || sl.busy) return;
    var name = pick(free);
    sl.img.style.setProperty('--fade', cfg.fadeMs + 'ms');
    if (!sl.name) {
      sl.name = name;
      sl.img.onload = function () { sl.img.classList.add('on'); };
      sl.img.src = name;
      return;
    }
    sl.busy = true;
    var next = new Image();
    next.onerror = function () { sl.busy = false; };
    next.onload = function () {
      sl.name = name;
      sl.img.classList.remove('on');
      setTimeout(function () { sl.img.src = name; sl.busy = false; }, cfg.fadeMs);
    };
    next.src = name;
  }
  function slotNearView(sl) {
    var r = sl.el.getBoundingClientRect();
    return r.bottom > -window.innerHeight / 2 && r.top < window.innerHeight * 1.5;
  }
  function fillSlots() {
    if (!isMobile()) return;
    slots.forEach(function (sl, i) { if (!sl.name && slotNearView(sl)) swapSlot(i); });
  }
  setInterval(function () {
    if (!isMobile() || cfg.paused || reduce || document.hidden) return;
    var near = slots.filter(slotNearView);
    if (near.length) swapSlot(slots.indexOf(pick(near)));
  }, 3500);

  // ---- запуск ----
  function apply() {
    layoutText();
    buildFloors();
    fillSlots();
  }

  var resizeTimer, scrollFrame = 0;
  window.addEventListener('resize', function () { clearTimeout(resizeTimer); resizeTimer = setTimeout(apply, 130); });
  window.addEventListener('scroll', function () {
    if (scrollFrame) return;
    scrollFrame = requestAnimationFrame(function () { scrollFrame = 0; updateFloors(); fillSlots(); });
  }, { passive: true });

  apply();
  if (reduce) { for (var i = 0; i < 5; i++) tryPlace(); }
  else loop();

  // для панели настроек
  window.MC = { cfg: cfg, apply: apply, field: field };

  // Панель настроек: открыть страницу с ?tune (запоминается), выключить — ?tune=0
  try {
    var tune = new URLSearchParams(location.search).get('tune');
    if (tune === '0') localStorage.removeItem('tummo-tune');
    else if (tune !== null) localStorage.setItem('tummo-tune', '1');
    if (localStorage.getItem('tummo-tune')) {
      var s = document.createElement('script');
      s.src = '/assets/js/my-ceramics-tuner.js';
      document.body.appendChild(s);
    }
  } catch (e) {}
})();
