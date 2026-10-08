// Админка галереи «Примеры работ» (/admin/): загрузка фото, порядок, удаление.
// Сервера нет — страница сама ходит в GitHub API с токеном из localStorage и публикует всё
// одним коммитом: новые webp (превью 360 px и полный размер 1200 px делаются тут же, в браузере)
// и порядок в src/_data/gallery.json. Дальше сайт пересобирает обычный деплой.
(function () {
  var REPO = 'illus0r/tummo-room.ru';
  var BRANCH = 'main';
  var ORDER = 'src/_data/gallery.json';
  var DIR = 'src/assets/img/photos/gallery/';
  var FULL_W = 1200, THUMB_W = 360;
  var API = 'https://api.github.com/repos/' + REPO;
  var KEY = 'tummo-admin-token';

  var $ = function (id) { return document.getElementById(id); };
  var grid = $('grid'), msg = $('msg');

  var token = '';
  var saved = [];      // порядок, который сейчас лежит в репозитории
  var savedSha = '';   // и sha этого файла — чтобы не затереть чужую правку
  var order = [];      // порядок на экране
  var fresh = {};      // новые фото: имя → { full, thumb } (Blob), ещё не опубликованы
  var local = {};      // имя → objectURL превью, пока фото не доехало до сайта
  var selected = null;
  var busy = false;

  function say(text, err) {
    msg.textContent = text || '';
    msg.classList.toggle('err', !!err);
  }

  function gh(path, opts) {
    opts = opts || {};
    return fetch(path.indexOf('http') === 0 ? path : API + path, {
      method: opts.method || 'GET',
      cache: 'no-store',
      headers: {
        Authorization: 'Bearer ' + token,
        Accept: opts.raw ? 'application/vnd.github.raw' : 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    }).then(function (r) {
      if (!r.ok) {
        var e = new Error('GitHub ответил ' + r.status);
        e.status = r.status;
        throw e;
      }
      return opts.raw ? r.blob() : r.json();
    });
  }

  // ——— вход

  function showLogin(text) {
    $('app').hidden = true;
    $('login').hidden = false;
    $('login-msg').textContent = text || '';
    $('login-msg').classList.toggle('err', !!text);
  }

  $('login').addEventListener('submit', function (e) {
    e.preventDefault();
    token = $('token').value.trim();
    $('token').value = '';
    start();
  });

  $('logout').addEventListener('click', function () {
    if (dirty() && !confirm('Есть неопубликованные изменения. Выйти?')) return;
    localStorage.removeItem(KEY);
    token = '';
    showLogin();
  });

  function start() {
    $('login-msg').textContent = 'Проверяю…';
    load().then(function () {
      localStorage.setItem(KEY, token);
      $('login').hidden = true;
      $('app').hidden = false;
    }, function (e) {
      var denied = e.status === 401 || e.status === 403 || e.status === 404;
      if (denied) localStorage.removeItem(KEY);
      showLogin(denied
        ? 'Токен не подошёл: нет доступа к репозиторию.'
        : 'Не получилось связаться с GitHub. Проверьте интернет и обновите страницу.');
    });
  }

  // ——— состояние

  function load() {
    return gh('/contents/' + ORDER + '?ref=' + BRANCH).then(function (f) {
      var bytes = Uint8Array.from(atob(f.content.replace(/\s/g, '')), function (c) { return c.charCodeAt(0); });
      saved = JSON.parse(new TextDecoder().decode(bytes));
      savedSha = f.sha;
      order = saved.slice();
      fresh = {};
      selected = null;
      render();
      say('');
    });
  }

  function dirty() {
    return order.length !== saved.length || order.some(function (n, i) { return n !== saved[i]; });
  }

  function render() {
    grid.textContent = '';
    order.forEach(function (name, i) {
      var t = document.createElement('div');
      t.className = 'tile' + (fresh[name] ? ' new' : '') + (name === selected ? ' sel' : '');
      t.dataset.name = name;
      var img = document.createElement('img');
      img.alt = '';
      img.loading = 'lazy';
      img.src = local[name] || '/assets/img/photos/gallery/thumb/' + name + '.webp';
      // фото уже в репозитории, но сайт ещё не пересобрался — берём превью прямо из GitHub
      img.onerror = function () {
        img.onerror = null;
        gh('/contents/' + DIR + 'thumb/' + name + '.webp?ref=' + BRANCH, { raw: true }).then(function (b) {
          local[name] = URL.createObjectURL(b);
          img.src = local[name];
        }, function () {});
      };
      var num = document.createElement('span');
      num.className = 'num';
      num.textContent = i + 1;
      t.appendChild(img);
      t.appendChild(num);
      grid.appendChild(t);
    });
    update();
  }

  function update() {
    var d = dirty();
    $('publish').disabled = !d || busy;
    $('add').disabled = busy;
    $('reset').hidden = !d || busy;
    $('acts').hidden = !selected || busy;
    $('foot').hidden = !!selected && !busy;
  }

  function select(name) {
    selected = name;
    Array.prototype.forEach.call(grid.children, function (t) {
      t.classList.toggle('sel', t.dataset.name === name);
    });
    update();
  }

  // ——— порядок

  grid.addEventListener('click', function (e) {
    var t = e.target.closest('.tile');
    if (!t || busy) return;
    select(t.dataset.name === selected ? null : t.dataset.name);
  });

  // на телефоне плитку берём долгим нажатием — короткое движение остаётся прокруткой
  window.Sortable && new Sortable(grid, {
    animation: 150,
    delay: 250,
    delayOnTouchOnly: true,
    ghostClass: 'ghost',
    onEnd: function () {
      order = Array.prototype.map.call(grid.children, function (t) { return t.dataset.name; });
      render();
    },
  });

  function move(toStart) {
    var name = selected;
    order = order.filter(function (n) { return n !== name; });
    if (toStart) order.unshift(name); else order.push(name);
    render();
    grid.querySelector('.sel').scrollIntoView({ block: 'center' });
  }

  $('to-start').addEventListener('click', function () { move(true); });
  $('to-end').addEventListener('click', function () { move(false); });

  $('del').addEventListener('click', function () {
    if (!confirm('Убрать это фото из галереи?')) return;
    var name = selected;
    order = order.filter(function (n) { return n !== name; });
    delete fresh[name];
    selected = null;
    render();
  });

  $('reset').addEventListener('click', function () {
    if (!confirm('Вернуть галерею к тому, что сейчас опубликовано?')) return;
    order = saved.slice();
    fresh = {};
    selected = null;
    render();
    say('');
  });

  // ——— загрузка фото

  // уменьшаем ступенями вдвое: одним шагом с 4000 до 360 px canvas даёт рябь
  function resize(src, w) {
    var sw = src.width, sh = src.height;
    w = Math.min(w, sw);
    var h = Math.round(sh * w / sw);
    while (sw / 2 > w) {
      var half = document.createElement('canvas');
      half.width = sw = Math.round(sw / 2);
      half.height = sh = Math.round(sh / 2);
      half.getContext('2d').drawImage(src, 0, 0, sw, sh);
      src = half;
    }
    var c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    var ctx = c.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(src, 0, 0, w, h);
    return c;
  }

  function webp(canvas, q) {
    return new Promise(function (ok, fail) {
      canvas.toBlob(function (b) {
        // Safari вместо webp молча отдаёт png — такой файл на сайт класть нельзя
        if (b && b.type === 'image/webp') ok(b); else fail(new Error('webp'));
      }, 'image/webp', q);
    });
  }

  function uniqueName(file) {
    var base = file.name.replace(/\.[^.]*$/, '').replace(/[^A-Za-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '') || 'photo';
    var name = base, i = 2;
    // имя не должно совпасть и с опубликованным фото, убранным в этой же правке: файл ещё лежит в репозитории
    while (order.indexOf(name) >= 0 || saved.indexOf(name) >= 0) name = base + '_' + i++;
    return name;
  }

  function addFile(file) {
    return createImageBitmap(file).then(function (bmp) {
      var full = resize(bmp, FULL_W);
      var thumb = resize(full, THUMB_W);
      return Promise.all([webp(full, 0.82), webp(thumb, 0.8)]);
    }).then(function (blobs) {
      var name = uniqueName(file);
      fresh[name] = { full: blobs[0], thumb: blobs[1] };
      local[name] = URL.createObjectURL(blobs[1]);
      order.unshift(name);
    });
  }

  $('add').addEventListener('click', function () { $('files').click(); });

  $('files').addEventListener('change', function () {
    var files = Array.prototype.slice.call(this.files);
    this.value = '';
    if (!files.length) return;
    busy = true;
    update();
    var failed = 0, done = 0;
    // по одному и с конца, чтобы в галерее они встали в том порядке, в каком выбраны
    files.reverse().reduce(function (p, f) {
      return p.then(function () {
        say('Обрабатываю фото: ' + (done + 1) + ' из ' + files.length + '…');
        return addFile(f).catch(function () { failed++; }).then(function () { done++; });
      });
    }, Promise.resolve()).then(function () {
      busy = false;
      render();
      window.scrollTo(0, 0);
      if (failed) say('Не получилось обработать фото: ' + failed + '. Остальные добавлены в начало.', true);
      else say('Добавлено в начало. Расставьте и нажмите «Опубликовать».');
    });
  });

  // ——— публикация

  function base64(blob) {
    return new Promise(function (ok, fail) {
      var r = new FileReader();
      r.onload = function () { ok(r.result.slice(r.result.indexOf(',') + 1)); };
      r.onerror = fail;
      r.readAsDataURL(blob);
    });
  }

  function upload(path, blob) {
    return base64(blob).then(function (content) {
      return gh('/git/blobs', { method: 'POST', body: { content: content, encoding: 'base64' } });
    }).then(function (b) {
      return { path: path, mode: '100644', type: 'blob', sha: b.sha };
    });
  }

  function publish() {
    var added = order.filter(function (n) { return fresh[n]; });
    var removed = saved.filter(function (n) { return order.indexOf(n) < 0; });
    var head, tree = [], step = 0, steps = added.length * 2;
    busy = true;
    update();
    say('Публикую…');

    return gh('/git/ref/heads/' + BRANCH).then(function (ref) {
      head = ref.object.sha;
      return gh('/contents/' + ORDER + '?ref=' + head);
    }).then(function (f) {
      if (f.sha !== savedSha) {
        var e = new Error('changed');
        e.changed = true;
        throw e;
      }
      return gh('/git/commits/' + head);
    }).then(function (commit) {
      var files = [];
      added.forEach(function (n) {
        files.push([DIR + 'full/' + n + '.webp', fresh[n].full], [DIR + 'thumb/' + n + '.webp', fresh[n].thumb]);
      });
      return files.reduce(function (p, f) {
        return p.then(function () {
          say('Загружаю фото: ' + (Math.floor(step / 2) + 1) + ' из ' + added.length + '…');
          return upload(f[0], f[1]);
        }).then(function (entry) { tree.push(entry); step++; });
      }, Promise.resolve()).then(function () {
        removed.forEach(function (n) {
          tree.push({ path: DIR + 'full/' + n + '.webp', mode: '100644', type: 'blob', sha: null });
          tree.push({ path: DIR + 'thumb/' + n + '.webp', mode: '100644', type: 'blob', sha: null });
        });
        tree.push({ path: ORDER, mode: '100644', type: 'blob', content: JSON.stringify(order, null, 2) + '\n' });
        say('Сохраняю…');
        return gh('/git/trees', { method: 'POST', body: { base_tree: commit.tree.sha, tree: tree } });
      });
    }).then(function (t) {
      var what = [];
      if (added.length) what.push('add ' + added.length);
      if (removed.length) what.push('remove ' + removed.length);
      if (!what.length) what.push('reorder');
      return gh('/git/commits', {
        method: 'POST',
        body: { message: 'Update the works gallery from the admin page: ' + what.join(', '), tree: t.sha, parents: [head] },
      });
    }).then(function (c) {
      return gh('/git/refs/heads/' + BRANCH, { method: 'PATCH', body: { sha: c.sha } });
    }).then(function () {
      busy = false;
      // sha нового gallery.json узнаём заново — следующая правка сверяется уже с ним
      return load();
    }).then(function () {
      say('Опубликовано. На сайте появится через пару минут.');
    }).catch(function (e) {
      busy = false;
      update();
      if (e.changed || e.status === 409 || e.status === 422) {
        say('Галерею только что изменили с другого устройства. Обновите страницу и повторите правку.', true);
      } else if (e.status === 401 || e.status === 403) {
        say('GitHub не принял токен: он истёк или у него нет права записи. Выйдите и вставьте новый.', true);
      } else {
        say('Не получилось опубликовать. Проверьте интернет и нажмите ещё раз — правки на экране сохранены.', true);
      }
    });
  }

  $('publish').addEventListener('click', publish);

  window.addEventListener('beforeunload', function (e) {
    if (dirty()) e.preventDefault();
  });

  token = localStorage.getItem(KEY) || '';
  if (token) {
    $('app').hidden = false;
    say('Загружаю…');
    start();
  } else {
    showLogin();
  }
})();
