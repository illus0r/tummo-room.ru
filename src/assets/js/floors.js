// Страницы «этажами» (Моя керамика, Мастерская): этажи с фонами, вспышки фото (компьютер), смена фото между абзацами (телефон).
// Данные (фоны, фото, пропорции) — window.PHOTOS из src/_data/photos.js.
(function () {
  var field = document.getElementById('fl');
  var footer = document.getElementById('fl-footer');
  var logo = document.getElementById('fl-logo');
  var title = document.getElementById('fl-title');
  // строки заголовка (их делит <br>) заворачиваем в блоки: так их можно мерить и не переносить
  if (title) {
    title.innerHTML = title.innerHTML.split(/<br\s*\/?>/i)
      .map(function (line) { return '<span class="fl-title-line">' + line + '</span>'; }).join('');
  }

  // заголовок выключаем по ширине колонки абзацев: кегль подбираем так, чтобы самая
  // длинная строка встала ровно в колонку. Разрядка висит и после последней буквы — её вычитаем,
  // иначе правый край букв не дойдёт до края текста
  function fitTitle(boxW) {
    if (!title || !boxW) return;
    title.style.fontSize = '';
    var st = getComputedStyle(title);
    var base = parseFloat(st.fontSize);
    var ls = parseFloat(st.letterSpacing) || 0;
    // мерим именно текст, а не коробку строки: коробка шириной во всю колонку,
    // и по ней кегль не подобрать
    var wide = 0, range = document.createRange();
    [].forEach.call(title.children, function (l) {
      range.selectNodeContents(l);
      wide = Math.max(wide, range.getBoundingClientRect().width);
    });
    if (wide > ls) title.style.fontSize = (base * boxW / (wide - ls)) + 'px';
  }

  var FLOOR_BGS = window.PHOTOS.bgs;
  var FLOOR_PHOTOS = window.PHOTOS.floors;
  var ASPECT = window.PHOTOS.aspects;

  // размеры — в клетках квадратной сетки: ширина страницы / cols
  var cfg = {
    // фото
    cols: 12, tickMs: 650, holdMs: 4650, fadeMs: 1150, maxPhotos: 11, burst: 4,
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
      if (title) { title.style.left = title.style.width = ''; }
      fitTitle(textEls[0] && textEls[0].offsetWidth);
      textRects = []; floorBands = [];
      return;
    }
    var cols = cfg.cols;
    var cell = field.clientWidth / cols;
    var tcols = Math.max(1, Math.min(cfg.txtCols, cols - 1));
    var inset = Math.max(0, Math.min(cfg.txtInsetCols, cols - tcols));
    field.style.setProperty('--tscale', cfg.txtScale / 100);
    field.style.setProperty('--tbg', cfg.txtBgOpacity / 100);

    // заголовок — по левому краю и по ширине абзаца. Равняем по буквам, а не по колонке:
    // у абзаца есть свои отступы (.hl), и его текст начинается не от края колонки
    if (title && textEls.length) {
      textEls[0].classList.toggle('hl', !!cfg.txtBgOn);
      var tcs = getComputedStyle(textEls[0]);
      var padL = parseFloat(tcs.paddingLeft) || 0;
      var titleW = tcols * cell - padL - (parseFloat(tcs.paddingRight) || 0);
      title.style.left = (inset * cell + padL) + 'px';
      title.style.width = titleW + 'px';
      fitTitle(titleW);
    }

    // первый абзац — ниже заголовка: он стоит на середине первого экрана и бывает в две строки
    var row = cfg.txtStartRows;
    if (title) {
      var titleBot = title.getBoundingClientRect().bottom - field.getBoundingClientRect().top;
      row = Math.max(row, Math.ceil(titleBot / cell) + 1);
    }
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
    if (title) {
      var tr = title.getBoundingClientRect();
      textRects.push({ l: 0, t: tr.top - fr.top - 12, r: tr.right - fr.left + 12, b: tr.bottom - fr.top + 12 });
    }
    var ft = footer.getBoundingClientRect();
    textRects.push({ l: 0, t: ft.top - fr.top - 8, r: fr.width, b: fieldH });

    // границы этажей — по линиям сетки, посередине между абзацами
    var starts = [0];
    for (var i = 1; i < blockRows.length; i++) starts.push(Math.round((blockRows[i - 1].bot + blockRows[i].top) / 2));
    starts.push(Math.max(1, Math.round(fieldH / cell)));
    floorBands = blockRows.map(function (_, i) { return { s: starts[i], e: starts[i + 1] }; });
  }

  // границы этажей в пикселях: на компьютере — по сетке, на телефоне — посередине между абзацами
  function floorSpans() {
    if (!isMobile()) {
      var cell = field.clientWidth / cfg.cols;
      return floorBands.map(function (b) { return { t: b.s * cell, h: (b.e - b.s) * cell }; });
    }
    var top = field.getBoundingClientRect().top + window.scrollY;
    var y = function (el, edge) { return el.getBoundingClientRect()[edge] + window.scrollY - top; };
    var cuts = [0];
    for (var i = 1; i < textEls.length; i++) cuts.push((y(textEls[i - 1], 'bottom') + y(textEls[i], 'top')) / 2);
    cuts.push(field.offsetHeight);
    return textEls.map(function (_, i) { return { t: cuts[i], h: cuts[i + 1] - cuts[i] }; });
  }

  // фон этажа грузим, когда этаж подходит к экрану. Браузер сообщает об этом сам —
  // слушать прокрутку и мерить каждый кадр не нужно
  var floorSeen = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (!e.isIntersecting) return;
      floorSeen.unobserve(e.target);
      floors.forEach(function (f) { if (f.el === e.target && !f.bg.src) f.bg.src = f.src; });
    });
  }, { rootMargin: '100% 0px' });

  function buildFloors() {
    var spans = floorSpans();
    // этажи переиспользуем, а не собираем заново: иначе фоны перезагружаются при каждом
    // изменении размера окна — а на телефоне его меняет одна только адресная строка
    while (floors.length > spans.length) {
      var gone = floors.pop();
      floorSeen.unobserve(gone.el);
      gone.el.remove();
    }
    while (floors.length < spans.length) {
      var el = document.createElement('div');
      el.className = 'fl-floor';
      var bg = new Image();
      bg.className = 'fl-floor-bg'; bg.alt = '';
      var dim = document.createElement('div');
      dim.className = 'fl-floor-dim';
      el.appendChild(bg); el.appendChild(dim);
      field.insertBefore(el, field.firstChild);
      floors.push({ el: el, bg: bg, dim: dim });
      floorSeen.observe(el);
    }
    // параллакс — только на компьютере. На телефоне адресная строка прячется прямо во время
    // прокрутки, меняя высоту окна, и любое движение фона превращается в дрожание
    var vh = window.innerHeight, k = isMobile() ? 0 : cfg.parallax / 100;
    floors.forEach(function (f, i) {
      var h = spans[i].h;
      f.el.style.top = spans[i].t + 'px';
      f.el.style.height = h + 'px';
      f.dim.style.opacity = cfg.floorDim / 100;
      f.k = k;
      f.src = FLOOR_BGS[i % FLOOR_BGS.length];
      // k=0 — фон едет с этажом, k=1 — фон неподвижен и высотой в экран;
      // между ними смешиваем, так что видимая часть этажа всегда закрыта фоном.
      // Сдвиг фона = −k × (верх этажа относительно экрана): от −k·vh (этаж внизу экрана) до k·h (ушёл вверх)
      f.bg.style.height = Math.ceil(h * (1 - k) + vh * k) + 'px';
      f.bg.style.setProperty('--from', (-k * vh) + 'px');
      f.bg.style.setProperty('--to', (k * h) + 'px');
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
    img.className = 'fl-photo';
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

  // сколько вспышек сейчас в кадре (место занято сразу, ещё до загрузки фото, — поэтому залп не перебрасывает)
  function inView() {
    var vh = window.innerHeight, top = window.scrollY - field.offsetTop, n = 0;
    active.forEach(function (p) { if (p.b > top && p.t < top + vh) n++; });
    return n;
  }

  function loop() {
    if (!cfg.paused && !isMobile() && !document.hidden) {
      // пока экран пустует — только открыли страницу или въехали в новый участок —
      // ставим залпом, а не по одной в такт; когда кадр набрался, ритм возвращается к обычному
      var n = Math.max(1, cfg.burst - inView());
      for (var i = 0; i < n; i++) tryPlace();
    }
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
  // место под фото наполняем, когда оно подъезжает к экрану, и помним, видно ли его сейчас.
  // На компьютере места скрыты (display:none), поэтому наблюдатель про них молчит сам собой
  var slotSeen = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      slots.forEach(function (sl, i) {
        if (sl.el !== e.target) return;
        sl.near = e.isIntersecting;
        if (e.isIntersecting && !sl.name) swapSlot(i);
      });
    });
  }, { rootMargin: '50% 0px' });
  slots.forEach(function (sl) { slotSeen.observe(sl.el); });

  setInterval(function () {
    if (cfg.paused || reduce || document.hidden) return;
    var near = slots.filter(function (sl) { return sl.near; });
    if (near.length) swapSlot(slots.indexOf(pick(near)));
  }, 3500);

  // ---- запуск ----
  function apply() {
    layoutText();
    buildFloors();
  }

  var resizeTimer, lastW = window.innerWidth;
  window.addEventListener('resize', function () {
    // на телефоне высоту окна меняет одна только адресная строка, а раскладка телефона
    // от высоты не зависит вовсе. Пересчитывать нечего, и именно лишний пересчёт
    // прямо посреди прокрутки давал рывок
    if (isMobile() && window.innerWidth === lastW) return;
    lastW = window.innerWidth;
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(apply, 130);
  });
  // переход телефон↔компьютер пересчитываем сразу, не ждём паузы после resize:
  // иначе заголовок остаётся с кеглем другого режима и распирает страницу вбок
  if (mobileQuery.addEventListener) mobileQuery.addEventListener('change', apply);
  else if (mobileQuery.addListener) mobileQuery.addListener(apply);
  apply();
  // шрифт грузится со стороны: когда он встанет, высота абзацев меняется — пересчитываем этажи
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(apply);
  if (reduce) { for (var i = 0; i < 5; i++) tryPlace(); }
  else loop();
})();
