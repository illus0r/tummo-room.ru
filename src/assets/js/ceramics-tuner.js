// Панель настроек страницы «Моя керамика». В обычном режиме не загружается:
// включается через ?tune, выключается через ?tune=0 (см. конец ceramics.js).
(function () {
  var MC = window.MC;
  var cfg = MC.cfg, field = MC.field;
  var DEF = Object.assign({}, cfg);
  var STORE = 'tummo-ceramics-cfg';
  // только для отладки: сетка и фото без обрезки
  DEF.showGrid = false;
  DEF.uncrop = false;

  var PHOTO_SPEC = [
    ['cols',    'колонок',      6, 28, 1, 'На сколько столбцов делится ширина страницы. Задаёт размер клетки — к ней привязаны и фотографии, и текстовые блоки, и границы этажей.'],
    ['tickMs',  'тик, мс',    120,3000,10, 'Как часто система пытается показать новую фотографию. Меньше значение — вспышки появляются чаще.'],
    ['holdMs',  'показ, мс',  150,6000,50, 'Сколько времени фотография держится на экране в полной видимости, прежде чем начать растворяться.'],
    ['fadeMs',  'фейд, мс',    40,2600,10, 'Длительность плавного проявления и растворения каждой фотографии.'],
    ['maxPhotos','фото разом',  1, 18, 1, 'Максимум фотографий, одновременно видимых на экране.'],
    ['minU',    'мин. ширина',  1, 14, 1, 'Наименьшая ширина фото, в клетках. Высота считается по пропорциям снимка, поэтому фото не обрезаются.'],
    ['maxU',    'макс. ширина', 2, 22, 1, 'Наибольшая ширина фото, в клетках. Поднимите, чтобы фотографии могли быть крупнее.'],
    ['attempts','перебор/тик',  6,120, 1, 'Сколько случайных прямоугольников система проверяет за один тик, подбирая свободное подходящее место.'],
    ['iters',   'итераций',     1, 40, 1, 'Из скольких подходящих вариантов выбирается лучший — по площади. Больше — фото в среднем крупнее.']
  ];
  var TEXT_SPEC = [
    ['txtCols',     'ширина, клеток',        1, 14, 1, 'Ширина каждого текстового блока в клетках сетки.'],
    ['txtGapRows',  'между блоками, клеток', 0, 24, 1, 'Вертикальный промежуток между соседними блоками текста, в клетках.'],
    ['txtInsetCols','отступ от края, клеток',0, 16, 1, 'На сколько клеток блок отступает от левого или правого края страницы.'],
    ['txtStartRows','первый сверху, клеток', 0, 28, 1, 'Отступ первого блока от верхнего края страницы, в клетках.'],
    ['txtScale',    'кегль, %',             75,170, 1, 'Размер шрифта в текстовых блоках относительно базового.'],
    ['txtBgOpacity','фон подложки, %',       0, 40, 1, 'Непрозрачность светлой плашки под текстом. 0 — плашки не видно, даже если она включена.']
  ];
  var FLOOR_SPEC = [
    ['parallax', 'параллакс фона, %', 0, 100, 1, 'Насколько фон этажа отстаёт от страницы при прокрутке. 0 — фон едет вместе со всем, 100 — фон стоит на месте, а этаж проезжает над ним, как в окне.'],
    ['floorDim', 'затемнение фона, %', 0, 92, 1, 'Насколько притушен фоновый снимок этажа. Больше — темнее фон, лучше читаются текст и вспышки поверх него.']
  ];

  var css = document.createElement('style');
  css.textContent = [
    '.mc-grid{position:absolute;inset:0;z-index:4;pointer-events:none;opacity:.16;',
    '  background-image:repeating-linear-gradient(to right,#d9c5ae 0 1px,transparent 1px var(--cw)),',
    '  repeating-linear-gradient(to bottom,#d9c5ae 0 1px,transparent 1px var(--cw))}',
    '.mc.uncrop .mc-photo{object-fit:contain;outline:1px dashed rgba(217,197,174,.5)}',
    '.mc-toggle{position:fixed;top:12px;right:12px;z-index:51;background:rgba(10,10,10,.82);color:#d9c5ae;',
    '  border:0;border-radius:8px;padding:6px 10px;font:400 13px/1 system-ui,sans-serif;cursor:pointer}',
    '.mc-panel{position:fixed;top:50px;right:12px;z-index:50;width:256px;max-width:calc(100vw - 24px);',
    '  max-height:calc(100vh - 64px);overflow:auto;background:rgba(10,10,10,.9);backdrop-filter:blur(8px);',
    '  color:#d9c5ae;font:400 12px/1.35 system-ui,sans-serif;border-radius:8px;padding:10px 12px 12px}',
    '.mc-panel[hidden]{display:none}',
    '.mc-head{margin:12px 0 4px;font-weight:700;letter-spacing:.14em;font-size:10px;opacity:.55}',
    '.mc-head:first-child{margin-top:0}',
    '.mc-row{margin-top:8px}',
    '.mc-row .lbl{display:flex;justify-content:space-between;gap:8px;margin-bottom:2px}',
    '.mc-row .lbl span{border-bottom:1px dotted rgba(217,197,174,.35);cursor:help}',
    '.mc-row .lbl b{font-weight:600;font-variant-numeric:tabular-nums;opacity:.85}',
    '.mc-panel input[type=range]{width:100%;accent-color:#d9c5ae;margin:0}',
    '.mc-panel select{width:100%;background:#1c1c1c;color:#d9c5ae;border:1px solid #3a3a3a;border-radius:4px;padding:3px 4px;font:inherit}',
    '.mc-check{display:flex;align-items:center;gap:6px;margin-top:9px;cursor:help}',
    '.mc-panel button{margin-top:12px;width:100%;background:rgba(217,197,174,.12);color:#d9c5ae;border:0;',
    '  border-radius:6px;padding:6px;font:inherit;cursor:pointer}',
    '.mc-panel button:hover{background:rgba(217,197,174,.2)}',
    '@media (max-width:767px){.mc-grid,.mc-toggle,.mc-panel{display:none}}'
  ].join('\n');
  document.head.appendChild(css);

  var grid = document.createElement('div');
  grid.className = 'mc-grid';
  field.appendChild(grid);
  var toggle = document.createElement('button');
  toggle.className = 'mc-toggle'; toggle.textContent = '⚙'; toggle.setAttribute('aria-label', 'Параметры');
  var panel = document.createElement('form');
  panel.className = 'mc-panel'; panel.hidden = true;
  document.body.appendChild(toggle);
  document.body.appendChild(panel);
  toggle.addEventListener('click', function () {
    panel.hidden = !panel.hidden;
    toggle.textContent = panel.hidden ? '⚙' : '✕';
  });

  function set(values) {
    for (var k in DEF) if (k in values) cfg[k] = values[k];
  }
  function save() { try { localStorage.setItem(STORE, JSON.stringify(cfg)); } catch (e) {} }
  function update() {
    MC.apply();
    grid.hidden = !cfg.showGrid;
    grid.style.setProperty('--cw', (field.clientWidth / cfg.cols) + 'px');
    field.classList.toggle('uncrop', !!cfg.uncrop);
  }
  function change() { save(); update(); }

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function row(s) {
    var key = s[0];
    var wrap = el('div', 'mc-row'), lbl = el('div', 'lbl');
    var name = el('span', null, s[1]); name.title = s[5];
    var val = el('b', null, cfg[key]);
    var inp = el('input');
    inp.type = 'range'; inp.min = s[2]; inp.max = s[3]; inp.step = s[4]; inp.value = cfg[key]; inp.title = s[5];
    inp.addEventListener('input', function () { cfg[key] = parseFloat(inp.value); val.textContent = cfg[key]; change(); });
    lbl.appendChild(name); lbl.appendChild(val);
    wrap.appendChild(lbl); wrap.appendChild(inp);
    return wrap;
  }
  function select(key, label, opts, desc) {
    var wrap = el('div', 'mc-row'), lbl = el('div', 'lbl');
    var name = el('span', null, label); name.title = desc;
    var se = el('select'); se.title = desc;
    opts.forEach(function (o, i) { var op = el('option', null, o); op.value = i; se.appendChild(op); });
    se.value = cfg[key];
    se.addEventListener('change', function () { cfg[key] = parseInt(se.value, 10); change(); });
    lbl.appendChild(name); wrap.appendChild(lbl); wrap.appendChild(se);
    return wrap;
  }
  function check(key, label, desc) {
    var wrap = el('label', 'mc-check'); wrap.title = desc;
    var inp = el('input'); inp.type = 'checkbox'; inp.checked = !!cfg[key];
    inp.addEventListener('change', function () { cfg[key] = inp.checked; change(); });
    wrap.appendChild(inp); wrap.appendChild(el('span', null, label));
    return wrap;
  }
  function button(label, onClick) {
    var b = el('button', null, label);
    b.type = 'button';
    b.addEventListener('click', onClick);
    return b;
  }

  function build() {
    panel.innerHTML = '';
    panel.appendChild(el('div', 'mc-head', 'ФОТО'));
    PHOTO_SPEC.forEach(function (s) { panel.appendChild(row(s)); });
    panel.appendChild(el('div', 'mc-head', 'ТЕКСТ'));
    TEXT_SPEC.forEach(function (s) { panel.appendChild(row(s)); });
    panel.appendChild(select('txtAlign', 'выравнивание', ['чередовать', 'слева', 'справа'],
      'С какой стороны стоят блоки: строго слева, строго справа или попеременно.'));
    panel.appendChild(check('txtBgOn', 'подложка под текстом',
      'Включить светлую плашку за текстом. Её прозрачность задаётся ползунком «фон подложки».'));
    panel.appendChild(el('div', 'mc-head', 'ЭТАЖИ'));
    FLOOR_SPEC.forEach(function (s) { panel.appendChild(row(s)); });
    panel.appendChild(el('div', 'mc-head', 'ОБЩЕЕ'));
    panel.appendChild(check('paused', 'пауза', 'Остановить появление новых фотографий-вспышек.'));
    panel.appendChild(check('showGrid', 'показать сетку', 'Показать служебную сетку из клеток — удобно при настройке раскладки.'));
    panel.appendChild(check('uncrop', 'фото без обрезки', 'Показывать фотографии целиком, с пунктирной рамкой места.'));
    panel.appendChild(button('сохранить настройки', function () {
      var a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([JSON.stringify(cfg, null, 2)], { type: 'application/json' }));
      a.download = 'ceramics-settings.json';
      a.click();
    }));
    panel.appendChild(button('загрузить настройки', function () {
      var inp = el('input');
      inp.type = 'file'; inp.accept = '.json,application/json';
      inp.onchange = function () {
        inp.files[0].text().then(function (t) {
          set(DEF); set(JSON.parse(t)); build(); change();
        }).catch(function () { alert('Не получилось прочитать файл настроек'); });
      };
      inp.click();
    }));
    panel.appendChild(button('сбросить', function () { set(DEF); build(); change(); }));
  }

  // сохранённые настройки, затем параметры из адреса (?cols=10&paused=1)
  try { set(JSON.parse(localStorage.getItem(STORE) || '{}')); } catch (e) {}
  var q = new URLSearchParams(location.search);
  for (var key in DEF) {
    if (!q.has(key)) continue;
    cfg[key] = typeof DEF[key] === 'boolean' ? /^(1|true)$/.test(q.get(key)) : parseFloat(q.get(key));
  }
  window.addEventListener('resize', update);
  build();
  update();
})();
