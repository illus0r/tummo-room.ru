#!/usr/bin/env node
'use strict';

/**
 * Собирает сайт, поднимает его на локальном порту и прогоняет headless-браузер
 * по каждой странице из _site/, проверяя:
 *   1. страница отдаёт 200 (сборка/сервер её вообще нашли)
 *   2. все внутренние ссылки (<a href>, не внешние) не ведут на 404
 *   3. все <img> реально загрузились (не битые)
 *   4. нет горизонтального скролла на 375px и 1280px
 *   5. в консоли браузера нет JS-ошибок
 *
 * Использование:
 *   node .claude/skills/check-site/scripts/check-site.js [опции]
 *   pnpm run check-site -- [опции]
 *
 * Опции:
 *   --skip-build       не пересобирать сайт, использовать текущий _site/
 *   --widths=375,1280  ширины для проверки скролла (по умолчанию 375,1280)
 *   --port=0           порт локального сервера (0 = свободный порт)
 *   --json=path.json   дополнительно сохранить отчёт в JSON
 */

const { execSync, spawnSync } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const ROOT = path.resolve(__dirname, '..', '..', '..', '..'); // .claude/skills/check-site/scripts -> repo root
const SITE_DIR = path.join(ROOT, '_site');

const args = process.argv.slice(2);
const has = (flag) => args.includes(flag);
const opt = (name, def) => {
  const p = args.find((a) => a.startsWith(name + '='));
  return p ? p.slice(name.length + 1) : def;
};

const WIDTHS = opt('--widths', '375,1280').split(',').map((n) => parseInt(n.trim(), 10));
const REQUESTED_PORT = parseInt(opt('--port', '0'), 10);
const JSON_OUT = opt('--json', null);
const SKIP_BUILD = has('--skip-build');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.json': 'application/json',
  '.txt': 'text/plain',
  '.xml': 'application/xml',
};

function log(msg) { process.stdout.write(msg + '\n'); }

function findChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    process.env.PUPPETEER_EXECUTABLE_PATH,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  ].filter(Boolean);
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return null;
}

// --- рекурсивно находим все *.html в _site/ и превращаем в маршруты ---
function findHtmlRoutes(dir) {
  const routes = [];
  (function walk(d) {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile() && entry.name.endsWith('.html')) {
        let route = '/' + path.relative(SITE_DIR, full).split(path.sep).join('/');
        route = route.replace(/index\.html$/, '');
        if (route === '') route = '/';
        routes.push(route);
      }
    }
  })(dir);
  return routes.sort();
}

// --- крошечный статический сервер поверх _site/, с поведением как у GH Pages ---
function startServer(port) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      let urlPath = decodeURIComponent(req.url.split('?')[0].split('#')[0]);
      let filePath = path.join(SITE_DIR, urlPath);
      const trySend = (fp) => {
        fs.readFile(fp, (err, data) => {
          if (err) return sendNotFound();
          res.writeHead(200, { 'Content-Type': MIME[path.extname(fp).toLowerCase()] || 'application/octet-stream' });
          res.end(data);
        });
      };
      const sendNotFound = () => {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not found');
      };
      fs.stat(filePath, (err, stat) => {
        if (!err && stat.isDirectory()) return trySend(path.join(filePath, 'index.html'));
        if (!err && stat.isFile()) return trySend(filePath);
        if (!path.extname(filePath)) return trySend(filePath + '/index.html');
        return sendNotFound();
      });
    });
    server.on('error', reject);
    server.listen(port, () => resolve(server));
  });
}

async function checkStatus(port, pathname) {
  return new Promise((resolve) => {
    const req = http.get({ host: '127.0.0.1', port, path: pathname, timeout: 5000 }, (res) => {
      res.resume();
      resolve(res.statusCode);
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
  });
}

function isInternalHref(href) {
  if (!href) return false;
  if (href.startsWith('#')) return false;
  if (/^(mailto:|tel:|javascript:)/i.test(href)) return false;
  if (/^([a-z][a-z0-9+.-]*:)?\/\//i.test(href)) return false; // http(s):// or protocol-relative //
  return true;
}

async function main() {
  if (!SKIP_BUILD) {
    log('▸ Собираю сайт (pnpm run build)…');
    try {
      execSync('pnpm run build', { cwd: ROOT, stdio: 'inherit' });
    } catch (e) {
      log('\n✗ Сборка упала — дальше проверять нечего.');
      process.exitCode = 1;
      return;
    }
  } else {
    log('▸ Пропускаю сборку (--skip-build), использую текущий _site/');
  }

  if (!fs.existsSync(SITE_DIR)) {
    log(`✗ Не найдена папка ${SITE_DIR} — сборка не создала _site/?`);
    process.exitCode = 1;
    return;
  }

  const chromePath = findChrome();
  if (!chromePath) {
    log('✗ Не нашёл установленный Chrome/Chromium.');
    log('  Укажи путь явно: CHROME_PATH=/путь/к/Chrome node .claude/skills/check-site/scripts/check-site.js');
    process.exitCode = 1;
    return;
  }

  let puppeteer;
  try {
    puppeteer = require('puppeteer-core');
  } catch (e) {
    log('✗ Не установлен puppeteer-core. Один раз выполни: pnpm install');
    process.exitCode = 1;
    return;
  }

  const routes = findHtmlRoutes(SITE_DIR);
  if (routes.length === 0) {
    log('✗ В _site/ не нашлось ни одной .html страницы.');
    process.exitCode = 1;
    return;
  }

  const server = await startServer(REQUESTED_PORT);
  const port = server.address().port;
  const base = `http://127.0.0.1:${port}`;
  log(`▸ Локальный сервер: ${base}  (${routes.length} стр.: ${routes.join(', ')})\n`);

  const browser = await puppeteer.launch({ executablePath: chromePath, headless: true });

  const results = [];
  const linkTargets = new Map(); // pathname -> статус (кэш между страницами)
  const networkWarnings = new Set(); // упавшие запросы (шрифты и т.п.) — информационно, не фейлят проверку

  try {
    for (const route of routes) {
      const page = await browser.newPage();
      const consoleErrors = [];
      page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
      page.on('pageerror', (err) => consoleErrors.push(String(err && err.message ? err.message : err)));
      page.on('requestfailed', (req) => {
        const f = req.failure();
        networkWarnings.add(`${route} → ${req.url()} (${f ? f.errorText : 'failed'})`);
      });

      let httpStatus = null;
      try {
        const resp = await page.goto(base + route, { waitUntil: 'networkidle0', timeout: 20000 });
        httpStatus = resp ? resp.status() : null;
      } catch (e) {
        results.push({ route, buildOk: false, error: String(e.message || e) });
        await page.close();
        continue;
      }

      // дать доводным скриптам/шрифтам чуть осесть, прежде чем мерить раскладку
      await new Promise((r) => setTimeout(r, 250));

      const { images, hrefs } = await page.evaluate(() => ({
        images: [...document.images].map((img) => ({
          src: img.getAttribute('src') || img.currentSrc || img.src,
          broken: img.complete && img.naturalWidth === 0,
        })),
        hrefs: [...document.querySelectorAll('a[href]')].map((a) => a.getAttribute('href')),
      }));

      const brokenImages = images.filter((i) => i.broken).map((i) => i.src);

      const internalHrefs = [...new Set(hrefs.filter(isInternalHref))];
      const badLinks = [];
      for (const href of internalHrefs) {
        let pathname;
        try {
          pathname = new URL(href, base + route).pathname;
        } catch (e) {
          badLinks.push({ href, status: 'unparsable' });
          continue;
        }
        if (!linkTargets.has(pathname)) {
          linkTargets.set(pathname, await checkStatus(port, pathname));
        }
        const status = linkTargets.get(pathname);
        if (!status || status >= 400) badLinks.push({ href, status: status || 'no response' });
      }

      const overflow = {};
      for (const w of WIDTHS) {
        await page.setViewport({ width: w, height: 900 });
        await new Promise((r) => setTimeout(r, 120));
        overflow[w] = await page.evaluate(() => {
          const de = document.documentElement;
          return { scrollW: de.scrollWidth, clientW: de.clientWidth };
        });
      }

      results.push({
        route,
        buildOk: true,
        httpStatus,
        images: { total: images.length, broken: brokenImages },
        links: { total: internalHrefs.length, broken: badLinks },
        overflow,
        consoleErrors,
      });

      await page.close();
    }
  } finally {
    await browser.close();
    server.close();
  }

  // --- отчёт ---
  let anyFail = false;
  for (const r of results) {
    log(`${r.route}`);
    if (!r.buildOk) {
      anyFail = true;
      log(`  ✗ страница не открылась: ${r.error}`);
      log('');
      continue;
    }
    const statusOk = r.httpStatus === 200;
    if (!statusOk) anyFail = true;
    log(`  сборка/HTTP:  ${statusOk ? '✓' : '✗'} ${r.httpStatus}`);

    const linksOk = r.links.broken.length === 0;
    if (!linksOk) anyFail = true;
    log(`  ссылки:       ${linksOk ? '✓' : '✗'} ${r.links.total} провере${r.links.total === 1 ? 'на' : 'но'}, ${r.links.broken.length} битых`);
    for (const b of r.links.broken) log(`      ✗ ${b.href}  →  ${b.status}`);

    const imgsOk = r.images.broken.length === 0;
    if (!imgsOk) anyFail = true;
    log(`  картинки:     ${imgsOk ? '✓' : '✗'} ${r.images.total} провере${r.images.total === 1 ? 'на' : 'но'}, ${r.images.broken.length} битых`);
    for (const b of r.images.broken) log(`      ✗ ${b}`);

    const overflowBits = WIDTHS.map((w) => {
      const o = r.overflow[w];
      const bad = o.scrollW > o.clientW + 1;
      if (bad) anyFail = true;
      return `${w}px ${bad ? `✗ (${o.scrollW}>${o.clientW})` : '✓'}`;
    });
    log(`  скролл вбок:  ${overflowBits.join(' · ')}`);

    const consoleOk = r.consoleErrors.length === 0;
    if (!consoleOk) anyFail = true;
    log(`  консоль:      ${consoleOk ? '✓' : '✗'} ${r.consoleErrors.length} ошиб${r.consoleErrors.length === 1 ? 'ка' : 'ок'}`);
    for (const e of r.consoleErrors) log(`      ✗ ${e}`);

    log('');
  }

  if (networkWarnings.size) {
    log('Сетевые предупреждения (не блокируют проверку — например, недоступны внешние шрифты):');
    for (const w of networkWarnings) log(`  · ${w}`);
    log('');
  }

  log(anyFail ? '✗ Есть проблемы — см. выше.' : `✓ Все ${results.length} страниц(ы) в порядке.`);

  if (JSON_OUT) {
    fs.writeFileSync(path.resolve(ROOT, JSON_OUT), JSON.stringify({ ok: !anyFail, results }, null, 2));
    log(`(отчёт сохранён в ${JSON_OUT})`);
  }

  process.exitCode = anyFail ? 1 : 0;
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
