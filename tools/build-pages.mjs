#!/usr/bin/env node
// 生成每部作品的分享页和分享图：
//   w/<id>/index.html  —— 和首页一样的网站，只是标题、描述、分享图换成这部作品的（微信、iMessage、Discord 等贴链接时显示）
//   og/<id>.jpg        —— 1200×630 的分享图，用 tools/og.html 画出来再截图
// 改了 data/works.js 之后运行一次：
//   node tools/build-pages.mjs           （没变的作品不重画分享图）
//   node tools/build-pages.mjs --force   （全部重画）
// 画分享图需要 Playwright（npm i -g playwright && npx playwright install chromium）；没有的话只生成分享页，分享图用通用的 assets/og.jpg。
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'https://silen1.com/afterimage/';
const BASE_PATH = '/afterimage/';
const FORCE = process.argv.includes('--force');
const rel = (...p) => path.join(ROOT, ...p);

const data = fs.readFileSync(rel('data/works.js'), 'utf8');
const { WORKS, TYPES } = await import('data:text/javascript;charset=utf-8,' + encodeURIComponent(data));
const ids = new Set(WORKS.map((w) => w.id));
for (const w of WORKS) if (!/^[a-z0-9][a-z0-9-]*$/.test(w.id)) throw new Error(`id 只能用小写字母、数字和横线：${w.id}`);

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/* ---------- 分享图 ---------- */
const ogTpl = fs.readFileSync(rel('tools/og.html'), 'utf8');
const fileHash = (p) => { try { return crypto.createHash('sha1').update(fs.readFileSync(rel(p))).digest('hex'); } catch (e) { return ''; } };
const fontsHash = ['noto-serif-sc-600', 'noto-serif-sc-400'].map((f) => fileHash(`assets/fonts/${f}.woff2`)).join('');
const hashOf = (w) => crypto.createHash('sha1').update(JSON.stringify([w, WORKS.indexOf(w), ogTpl, fontsHash, w.still ? fileHash(w.still.src) : ''])).digest('hex').slice(0, 10);

const manifestPath = rel('og/manifest.json');
let manifest = {};
try { manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')); } catch (e) { /* 第一次 */ }
fs.mkdirSync(rel('og'), { recursive: true });
const todo = WORKS.filter((w) => FORCE || manifest[w.id] !== hashOf(w) || !fs.existsSync(rel(`og/${w.id}.jpg`)));

let chromium = null;
if (todo.length) {
  try { ({ chromium } = createRequire(import.meta.url)('playwright')); }
  catch (e) { console.warn('! 没找到 Playwright，跳过分享图（分享页会先用通用的 assets/og.jpg）'); }
}
if (chromium && todo.length) {
  const TYPES_MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css', '.woff2': 'font/woff2', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml' };
  const server = http.createServer((req, res) => {
    const p = path.normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^([/\\])+/, '');
    const f = path.join(ROOT, p);
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'content-type': TYPES_MIME[path.extname(f)] || 'application/octet-stream' });
    fs.createReadStream(f).pipe(res);
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => console.error('og.html:', e.message));
  for (const w of todo) {
    await page.goto(`http://127.0.0.1:${port}/tools/og.html?id=${encodeURIComponent(w.id)}`);
    await page.waitForSelector('body[data-ready="1"]', { timeout: 20000 });
    await page.screenshot({ path: rel(`og/${w.id}.jpg`), type: 'jpeg', quality: 84 });
    manifest[w.id] = hashOf(w);
    console.log(`  分享图  og/${w.id}.jpg`);
  }
  await browser.close();
  server.close();
}
// 删掉已经不在片单里的分享图
for (const f of fs.readdirSync(rel('og'))) {
  const id = f.replace(/\.jpg$/, '');
  if (f.endsWith('.jpg') && !ids.has(id)) { fs.rmSync(rel('og', f)); delete manifest[id]; console.log(`  删除    og/${f}`); }
}
for (const id of Object.keys(manifest)) if (!ids.has(id)) delete manifest[id];
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');

/* ---------- 分享页 ---------- */
const tpl = fs.readFileSync(rel('index.html'), 'utf8');
function swap(html, re, value, what) {
  if (!re.test(html)) throw new Error(`index.html 里找不到 ${what}，模板可能改过了`);
  return html.replace(re, () => value);
}
const meta = (html, attr, key, value) =>
  swap(html, new RegExp(`<meta ${attr}="${key}" content="[^"]*">`), `<meta ${attr}="${key}" content="${esc(value)}">`, key);
function describe(w) {
  const kind = `Silen1 看过的${TYPES[w.type].zh}`;
  const extra = w.still ? (w.still.kind === 'ticket' ? '附票根' : '附定格') : '';
  return [w.line && `「${w.line}」`, `${kind} · ${w.title_en} (${w.year})`, w.meta, extra].filter(Boolean).join(' — ');
}
fs.mkdirSync(rel('w'), { recursive: true });
for (const w of WORKS) {
  const url = `${SITE}w/${w.id}/`;
  const img = fs.existsSync(rel(`og/${w.id}.jpg`)) ? `${SITE}og/${w.id}.jpg?v=${manifest[w.id] || '1'}` : `${SITE}assets/og.jpg`;
  const title = `${w.title} · ${w.title_en}`;
  let h = tpl;
  h = swap(h, /<meta charset="utf-8">/, `<meta charset="utf-8">\n<base href="${BASE_PATH}">\n<!-- 由 tools/build-pages.mjs 生成，别直接改这个文件 -->`, 'charset');
  h = swap(h, /<title>[^<]*<\/title>/, `<title>${esc(w.title)} · 残影 Afterimage</title>\n<link rel="canonical" href="${esc(url)}">`, '<title>');
  h = meta(h, 'name', 'description', describe(w));
  h = meta(h, 'property', 'og:type', 'article');
  h = meta(h, 'property', 'og:title', title);
  h = meta(h, 'property', 'og:description', describe(w));
  h = meta(h, 'property', 'og:image', img);
  h = meta(h, 'property', 'og:url', url);
  fs.mkdirSync(rel('w', w.id), { recursive: true });
  fs.writeFileSync(rel('w', w.id, 'index.html'), h);
  console.log(`  分享页  w/${w.id}/`);
}
// 删掉已经不在片单里的分享页
for (const d of fs.readdirSync(rel('w'))) {
  if (!ids.has(d) && fs.statSync(rel('w', d)).isDirectory()) { fs.rmSync(rel('w', d), { recursive: true }); console.log(`  删除    w/${d}/`); }
}
console.log(`完成：${WORKS.length} 部作品。`);
